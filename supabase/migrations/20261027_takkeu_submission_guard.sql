-- Takkeu-only submission hardening (shared RPC signatures unchanged).
-- The exact shared function definitions below are based on the live schema at 2026-10-27.
-- A client can forge an elapsed-time plausible score; Phase 3 adds independent telemetry.

CREATE OR REPLACE FUNCTION public.finish_game_play_v1(p_play_id uuid, p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_client_version text, p_ranking_score integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_game public.games%rowtype;
  v_session private.game_play_sessions%rowtype;
  v_display_name text;
  v_normalized_name text;
  v_game_slug text;
  v_result_type text;
  v_client_version text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_play_id is null
     or p_display_name is null
     or p_game_slug is null
     or p_result_type is null
     or p_reached_wave is null
     or p_score is null
     or p_client_version is null then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'required_input_missing'
    );
  end if;

  v_display_name := btrim(p_display_name);
  v_game_slug := lower(btrim(p_game_slug));
  v_result_type := lower(btrim(p_result_type));
  v_client_version := btrim(p_client_version);
  v_normalized_name := public.normalize_player_name(v_display_name);

  if p_display_name <> v_display_name
     or p_game_slug <> v_game_slug
     or p_result_type <> v_result_type
     or char_length(v_display_name) < 1
     or char_length(v_display_name) > 20
     or v_result_type not in ('clear', 'game_over', 'retire')
     or p_reached_wave < 1
     or p_reached_wave > 30
     or p_client_version <> v_client_version
     or char_length(v_client_version) < 1
     or char_length(v_client_version) > 80 then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'invalid_input'
    );
  end if;

  if p_score < 0
     or (p_ranking_score is not null and p_ranking_score < 0) then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'invalid_score'
    );
  end if;

  select *
  into v_game
  from public.games
  where game_slug = v_game_slug
    and is_active is true
    and submission_mode = 'shared'
  for share;

  if not found then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'game_not_available',
      'game_slug', v_game_slug
    );
  end if;

  if p_score < v_game.score_min or p_score > v_game.score_max then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'score_out_of_range',
      'score_min', v_game.score_min,
      'score_max', v_game.score_max
    );
  end if;

  -- Takkeu's ranking count and game-over count must be identical.
  if v_game_slug = 'takkeu' and p_ranking_score is distinct from p_score then
    return jsonb_build_object('accepted', false, 'reason', 'takkeu_ranking_score_mismatch');
  end if;

  select *
  into v_session
  from private.game_play_sessions
  where play_id = p_play_id
  for update;

  if not found then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'play_not_found'
    );
  end if;

  if v_session.game_slug <> v_game_slug
     or v_session.normalized_name <> v_normalized_name
     or v_session.client_version <> v_client_version then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'play_payload_mismatch'
    );
  end if;

  -- Takkeu only: bound reported hits by server wall time, not client time.
  -- 40 hits/s allows extra room above the 30-ball game's expected peak.
  -- The 150-hit allowance protects against short bursts and existing runs.
  if v_game_slug = 'takkeu' and p_score > 0
     and p_score::numeric > 40::numeric * greatest(0::numeric,
         extract(epoch from (v_now - v_session.started_at))::numeric) + 150::numeric then
    return jsonb_build_object('accepted', false, 'reason', 'takkeu_score_rate_impossible');
  end if;

  -- An unfinished provisional retirement can still be finalized normally.
  if v_session.finished_at is not null then
    if v_session.result_type = v_result_type
       and v_session.reached_wave = p_reached_wave
       and v_session.score = p_score
       and v_session.ranking_score is not distinct from p_ranking_score then
      return jsonb_build_object(
        'accepted', true,
        'duplicate', true,
        'play_id', p_play_id,
        'game_slug', v_game_slug,
        'result_type', v_result_type,
        'reached_wave', p_reached_wave,
        'score', p_score
      );
    end if;

    return jsonb_build_object(
      'accepted', false,
      'reason', 'play_already_finished'
    );
  end if;

  v_now := pg_catalog.clock_timestamp();

  update private.game_play_sessions
  set
    result_type = v_result_type,
    reached_wave = p_reached_wave,
    score = p_score,
    ranking_score = p_ranking_score,
    finished_at = v_now,
    updated_at = v_now
  where play_id = p_play_id;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'play_id', p_play_id,
    'game_slug', v_game_slug,
    'result_type', v_result_type,
    'reached_wave', p_reached_wave,
    'score', p_score,
    'finished_at', v_now
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.submit_score_idempotent_v1(p_play_id uuid, p_submission_id uuid, p_display_name text, p_game_slug text, p_score integer, p_client_version text)
 RETURNS TABLE(accepted boolean, result_submission_id uuid, result_play_id uuid, result_normalized_name text, result_display_name text, result_first_score integer, result_best_score integer, result_play_count integer, is_first_play boolean, is_new_best boolean, was_duplicate boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_game public.games%rowtype;
  v_session private.game_play_sessions%rowtype;
  v_existing public.score_runs%rowtype;
  v_score public.game_scores%rowtype;
  v_display_name text;
  v_normalized_name text;
  v_game_slug text;
  v_client_version text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_run_id bigint;
  v_is_first_play boolean := false;
  v_is_new_best boolean := false;
  v_result_first_score integer;
  v_result_best_score integer;
  v_result_play_count integer;
  v_existing_submission boolean := false;
begin
  if p_play_id is null
     or p_submission_id is null
     or p_display_name is null
     or p_game_slug is null
     or p_score is null
     or p_client_version is null then
    raise exception 'required input is missing'
      using errcode = '22023';
  end if;

  v_display_name := btrim(p_display_name);
  v_normalized_name := public.normalize_player_name(v_display_name);
  v_game_slug := lower(btrim(p_game_slug));
  v_client_version := btrim(p_client_version);

  if p_display_name <> v_display_name
     or p_game_slug <> v_game_slug
     or char_length(v_display_name) < 1
     or char_length(v_display_name) > 20
     or char_length(v_game_slug) < 1
     or char_length(v_game_slug) > 80
     or char_length(v_client_version) < 1
     or char_length(v_client_version) > 80 then
    raise exception 'ranking submission input is invalid'
      using errcode = '22023';
  end if;

  select *
  into v_game
  from public.games
  where game_slug = v_game_slug
    and is_active is true
    and submission_mode = 'shared'
  for share;

  if not found then
    raise exception 'game is not available for this submission contract'
      using errcode = '42501';
  end if;

  if p_score < v_game.score_min or p_score > v_game.score_max then
    raise exception 'score is outside the game range'
      using errcode = '22003';
  end if;

  select *
  into v_existing
  from public.score_runs
  where submission_id = p_submission_id
  for update;

  if found then
    if v_existing.play_id is distinct from p_play_id
       or v_existing.game_slug <> v_game_slug
       or v_existing.normalized_name <> v_normalized_name
       or v_existing.score <> p_score
       or coalesce(v_existing.client_version, '') <> v_client_version then
      raise exception 'submission id payload does not match'
        using errcode = 'PT409';
    end if;

    select *
    into v_score
    from public.game_scores
    where normalized_name = v_normalized_name
      and game_slug = v_game_slug;

    if not found then
      raise exception 'submission aggregate is unavailable'
        using errcode = 'PT500';
    end if;

    v_result_first_score :=
      coalesce(nullif(v_existing.metadata ->> 'result_first_score', '')::integer, v_score.first_score);
    v_result_best_score :=
      coalesce(nullif(v_existing.metadata ->> 'result_best_score', '')::integer, v_score.best_score);
    v_result_play_count :=
      coalesce(nullif(v_existing.metadata ->> 'result_play_count', '')::integer, v_score.play_count);

    return query
    select
      true,
      p_submission_id,
      p_play_id,
      v_score.normalized_name,
      v_score.display_name,
      v_result_first_score,
      v_result_best_score,
      v_result_play_count,
      coalesce((v_existing.metadata ->> 'is_first_play')::boolean, false),
      coalesce((v_existing.metadata ->> 'is_new_best')::boolean, false),
      true;
    return;
  end if;

  select *
  into v_session
  from private.game_play_sessions
  where play_id = p_play_id
  for update;

  if not found then
    raise exception 'play is unavailable'
      using errcode = 'PT410';
  end if;

  if v_session.game_slug <> v_game_slug
     or v_session.normalized_name <> v_normalized_name
     or v_session.client_version <> v_client_version then
    raise exception 'play payload does not match'
      using errcode = 'PT409';
  end if;

  -- A provisional retirement is not submittable until finish_game_play_v1 runs.
  if v_session.finished_at is null then
    raise exception 'play has not been finished'
      using errcode = 'PT425';
  end if;

  -- Closing a real play is not proof that the separately supplied score is real.
  if v_game_slug = 'takkeu' and (v_session.score is distinct from p_score
     or v_session.ranking_score is distinct from p_score) then
    raise exception 'takkeu finished score does not match submitted score'
      using errcode = 'PT409';
  end if;

  if v_session.submission_id is not null
     and v_session.submission_id <> p_submission_id then
    raise exception 'play already has another submission'
      using errcode = 'PT409';
  end if;

  if (
    select count(*)
    from public.score_runs
    where game_slug = v_game_slug
      and normalized_name = v_normalized_name
      and play_id is not null
      and created_at >= v_now - interval '1 minute'
  ) >= 60 then
    raise exception 'score submission rate limit exceeded'
      using errcode = '42900';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_game_slug || ':' || v_normalized_name,
      0::bigint
    )
  );

  insert into public.score_runs (
    normalized_name,
    game_slug,
    score,
    client_version,
    created_at,
    metadata,
    play_id,
    submission_id
  )
  values (
    v_normalized_name,
    v_game_slug,
    p_score,
    v_client_version,
    v_now,
    jsonb_build_object('contract_version', 'ranking-submission-v1'),
    p_play_id,
    p_submission_id
  )
  on conflict do nothing
  returning id into v_run_id;

  if v_run_id is null then
    select *
    into v_existing
    from public.score_runs
    where submission_id = p_submission_id
    for update;

    if found then
      if v_existing.play_id is distinct from p_play_id
         or v_existing.game_slug <> v_game_slug
         or v_existing.normalized_name <> v_normalized_name
         or v_existing.score <> p_score
         or coalesce(v_existing.client_version, '') <> v_client_version then
        raise exception 'submission id payload does not match'
          using errcode = 'PT409';
      end if;

      select *
      into v_score
      from public.game_scores
      where normalized_name = v_normalized_name
        and game_slug = v_game_slug;

      if not found then
        raise exception 'submission aggregate is unavailable'
          using errcode = 'PT500';
      end if;

      return query
      select
        true,
        p_submission_id,
        p_play_id,
        v_score.normalized_name,
        v_score.display_name,
        coalesce(nullif(v_existing.metadata ->> 'result_first_score', '')::integer, v_score.first_score),
        coalesce(nullif(v_existing.metadata ->> 'result_best_score', '')::integer, v_score.best_score),
        coalesce(nullif(v_existing.metadata ->> 'result_play_count', '')::integer, v_score.play_count),
        coalesce((v_existing.metadata ->> 'is_first_play')::boolean, false),
        coalesce((v_existing.metadata ->> 'is_new_best')::boolean, false),
        true;
      return;
    end if;

    raise exception 'submission conflicts with an existing play'
      using errcode = 'PT409';
  end if;

  select *
  into v_score
  from public.game_scores
  where normalized_name = v_normalized_name
    and game_slug = v_game_slug
  for update;

  if not found then
    v_is_first_play := true;
    v_is_new_best := true;

    insert into public.game_scores (
      normalized_name,
      game_slug,
      display_name,
      first_score,
      best_score,
      play_count,
      first_score_at,
      best_score_at,
      updated_at
    )
    values (
      v_normalized_name,
      v_game_slug,
      v_display_name,
      p_score,
      p_score,
      1,
      v_now,
      v_now,
      v_now
    )
    returning * into v_score;
  else
    v_is_new_best :=
      (v_game.score_order = 'desc' and p_score > v_score.best_score)
      or (v_game.score_order = 'asc' and p_score < v_score.best_score);

    update public.game_scores
    set
      display_name = v_display_name,
      best_score = case when v_is_new_best then p_score else best_score end,
      play_count = v_score.play_count + 1,
      best_score_at = case when v_is_new_best then v_now else best_score_at end,
      updated_at = v_now
    where normalized_name = v_normalized_name
      and game_slug = v_game_slug
    returning * into v_score;
  end if;

  v_result_first_score := v_score.first_score;
  v_result_best_score := v_score.best_score;
  v_result_play_count := v_score.play_count;

  update public.score_runs
  set metadata = jsonb_build_object(
    'contract_version', 'ranking-submission-v1',
    'result_first_score', v_result_first_score,
    'result_best_score', v_result_best_score,
    'result_play_count', v_result_play_count,
    'is_first_play', v_is_first_play,
    'is_new_best', v_is_new_best
  )
  where id = v_run_id;

  update private.game_play_sessions
  set
    submission_id = p_submission_id,
    updated_at = v_now
  where play_id = p_play_id;

  return query
  select
    true,
    p_submission_id,
    p_play_id,
    v_score.normalized_name,
    v_score.display_name,
    v_score.first_score,
    v_score.best_score,
    v_score.play_count,
    v_is_first_play,
    v_is_new_best,
    false;
end;
$function$;


CREATE OR REPLACE FUNCTION public.submit_score(p_display_name text, p_game_slug text, p_score integer, p_client_version text DEFAULT ''::text)
 RETURNS TABLE(accepted boolean, result_normalized_name text, result_display_name text, result_first_score integer, result_best_score integer, result_play_count integer, is_first_play boolean, is_new_best boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Takkeu requires a started, finished and matched play submission.
  if lower(btrim(coalesce(p_game_slug, ''))) = 'takkeu' then
    raise exception 'takkeu requires submit_score_idempotent_v1' using errcode = '42501';
  end if;

  if p_game_slug in ('sabasaba_normal', 'sabasaba_endless')
     or exists (
       select 1 from public.games g
       where g.game_slug = p_game_slug
         and g.submission_mode = 'verified'
     )
  then
    raise exception 'verified run required' using errcode = '42501';
  end if;

  return query
  select *
  from public.submit_score_unverified(
    p_display_name, p_game_slug, p_score, p_client_version
  );
end;
$function$;
