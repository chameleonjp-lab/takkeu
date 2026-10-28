-- OFFLINE ONLY: metadata/source replica for PUBLIC caller parity; no production data.
CREATE SEQUENCE public.game_play_events_id_seq;
CREATE TABLE "private"."tomatoku_runs_v1" ("run_token" uuid,
"game_slug" text DEFAULT 'tomatoku_competition_v1'::text,
"generation" text,
"client_version" text,
"display_name" text,
"normalized_name" text,
"request_key" text,
"deck_id" smallint,
"slot_id" smallint,
"stage_ids" text[],
"status" text DEFAULT 'prepared'::text,
"prepared_at" timestamp with time zone DEFAULT clock_timestamp(),
"started_at" timestamp with time zone,
"completed_at" timestamp with time zone,
"expires_at" timestamp with time zone,
"client_elapsed_ms" integer,
"action_count" integer,
"mistake_count" integer,
"hint_count" integer,
"score" integer,
"score_run_id" bigint,
"transcript_hash" text,
"requires_review" boolean DEFAULT false,
"rejection_reason" text,
"result_payload" jsonb);
CREATE TABLE "public"."game_play_events" ("id" bigint NOT NULL DEFAULT nextval('public.game_play_events_id_seq'::regclass),
"play_id" text,
"game_slug" text NOT NULL,
"display_name" text NOT NULL,
"normalized_name" text NOT NULL,
"result_type" text NOT NULL,
"reached_wave" integer NOT NULL DEFAULT 1,
"score" integer NOT NULL DEFAULT 0,
"ranking_score" integer,
"client_version" text NOT NULL DEFAULT ''::text,
"created_at" timestamp with time zone NOT NULL DEFAULT now());
ALTER TABLE "public"."game_play_events" ADD CONSTRAINT "game_play_events_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."game_play_events" ADD CONSTRAINT "game_play_events_play_id_key" UNIQUE (play_id);
ALTER TABLE "public"."game_play_events" ADD CONSTRAINT "game_play_events_ranking_score_check" CHECK (((ranking_score IS NULL) OR (ranking_score >= 0)));
ALTER TABLE "public"."game_play_events" ADD CONSTRAINT "game_play_events_reached_wave_check" CHECK (((reached_wave >= 1) AND (reached_wave <= 30)));
ALTER TABLE "public"."game_play_events" ADD CONSTRAINT "game_play_events_result_type_check" CHECK ((result_type = ANY (ARRAY['game_over'::text, 'clear'::text, 'retire'::text, 'home'::text, 'play'::text])));
ALTER TABLE "public"."game_play_events" ADD CONSTRAINT "game_play_events_score_check" CHECK ((score >= 0));
CREATE UNIQUE INDEX IF NOT EXISTS game_play_events_pkey ON public.game_play_events USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS game_play_events_play_id_key ON public.game_play_events USING btree (play_id);
CREATE INDEX IF NOT EXISTS game_play_events_game_slug_created_at_idx ON public.game_play_events USING btree (game_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS game_play_events_game_slug_result_type_idx ON public.game_play_events USING btree (game_slug, result_type);
CREATE INDEX IF NOT EXISTS game_play_events_game_slug_normalized_name_idx ON public.game_play_events USING btree (game_slug, normalized_name);
CREATE INDEX IF NOT EXISTS idx_game_play_events_game_slug_created ON public.game_play_events USING btree (game_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_play_events_game_slug_normalized_name ON public.game_play_events USING btree (game_slug, normalized_name);
CREATE TABLE "private"."sabasaba_run_sessions" ("play_token" uuid DEFAULT gen_random_uuid(),
"client_run_id" uuid,
"game_slug" text,
"normalized_name" text,
"display_name" text,
"client_version" text DEFAULT ''::text,
"status" text DEFAULT 'started'::text,
"started_at" timestamp with time zone DEFAULT clock_timestamp(),
"expires_at" timestamp with time zone DEFAULT (clock_timestamp() + '24:00:00'::interval),
"finished_at" timestamp with time zone,
"outcome" text,
"elapsed_seconds" integer,
"kills" integer,
"level" integer,
"damage_hits" integer,
"damage_taken" integer,
"score" integer);
CREATE TABLE "private"."akerun_runs_v1" ("run_token" uuid DEFAULT gen_random_uuid(),
"game_slug" text DEFAULT 'akerun'::text,
"generation" text,
"client_version" text,
"contract_version" text,
"display_name" text,
"normalized_name" text,
"problem_id" text,
"problem_version" text,
"status" text DEFAULT 'prepared'::text,
"prepared_at" timestamp with time zone DEFAULT clock_timestamp(),
"started_at" timestamp with time zone,
"completed_at" timestamp with time zone,
"expires_at" timestamp with time zone,
"elapsed_time_ms" integer,
"fault_count" integer,
"total_dial_steps" integer,
"excess_dial_steps" integer,
"false_gate_contacts" integer,
"observation_accuracy" integer,
"score" integer,
"score_run_id" bigint,
"result_payload" jsonb,
"server_elapsed_time_ms" integer,
"operation_trace" jsonb,
"operation_trace_event_count" integer,
"operation_trace_hash" text,
"run_mode" text DEFAULT 'official'::text,
"competition_day" date);
SET check_function_bodies=off;
CREATE OR REPLACE FUNCTION public.check_player_name(p_display_name text) RETURNS TABLE(name_exists boolean, registered_display_name text) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $snapshot$
declare
  v_normalized_name text;
begin
  v_normalized_name := public.normalize_player_name(p_display_name);

  if char_length(v_normalized_name) = 0 then
    raise exception 'name is empty';
  end if;

  if char_length(v_normalized_name) > 20 then
    raise exception 'name is too long';
  end if;

  return query
  select
    exists (
      select 1
      from public.players p
      where p.normalized_name = v_normalized_name
    ) as name_exists,
    (
      select p.display_name
      from public.players p
      where p.normalized_name = v_normalized_name
      limit 1
    ) as registered_display_name;
end;
$snapshot$;
REVOKE ALL ON FUNCTION public.check_player_name(p_display_name text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.check_player_name(p_display_name text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_player_name(p_display_name text) TO "anon";
CREATE OR REPLACE FUNCTION public.get_best_score_ranking_with_metadata(p_game_slug text, p_limit integer DEFAULT 10) RETURNS TABLE(rank_no integer, display_name text, best_score integer, play_count integer, best_score_at timestamp with time zone, metadata jsonb) LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO public AS $snapshot$
  with ranked as (
    select
      row_number() over (
        order by
          case when g.score_order = 'asc' then gs.best_score end asc nulls last,
          case when coalesce(g.score_order, 'desc') <> 'asc' then gs.best_score end desc nulls last,
          gs.best_score_at asc
      )::integer as rank_no,
      p.display_name,
      gs.normalized_name,
      gs.game_slug,
      gs.best_score,
      gs.play_count,
      gs.best_score_at
    from public.game_scores gs
    join public.players p
      on p.normalized_name = gs.normalized_name
    join public.games g
      on g.game_slug = gs.game_slug
    where gs.game_slug = p_game_slug
      and (p_game_slug <> 'takkeu' or coalesce(gs.ranking_status, 'normal') = 'normal')
      and p_game_slug not in ('sabasaba_normal', 'sabasaba_endless')
    order by
      case when g.score_order = 'asc' then gs.best_score end asc nulls last,
      case when coalesce(g.score_order, 'desc') <> 'asc' then gs.best_score end desc nulls last,
      gs.best_score_at asc
    limit p_limit
  )
  select
    r.rank_no,
    r.display_name,
    r.best_score,
    r.play_count,
    r.best_score_at,
    sr.metadata
  from ranked r
  left join lateral (
    select s.metadata
    from public.score_runs s
    where s.normalized_name = r.normalized_name
      and s.game_slug = r.game_slug
      and s.score = r.best_score
    order by
      abs(extract(epoch from (s.created_at - r.best_score_at))) asc,
      s.created_at desc,
      s.id desc
    limit 1
  ) sr on true
  order by r.rank_no;
$snapshot$;
REVOKE ALL ON FUNCTION public.get_best_score_ranking_with_metadata(p_game_slug text, p_limit integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_best_score_ranking_with_metadata(p_game_slug text, p_limit integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_best_score_ranking_with_metadata(p_game_slug text, p_limit integer) TO "anon";
GRANT EXECUTE ON FUNCTION public.get_best_score_ranking_with_metadata(p_game_slug text, p_limit integer) TO "authenticated";
CREATE OR REPLACE FUNCTION public.get_first_try_ranking_with_metadata(p_game_slug text, p_limit integer DEFAULT 10) RETURNS TABLE(rank_no integer, display_name text, first_score integer, play_count integer, first_score_at timestamp with time zone, metadata jsonb) LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO public AS $snapshot$
  with ranked as (
    select
      row_number() over (
        order by
          case when g.score_order = 'asc' then gs.first_score end asc nulls last,
          case when coalesce(g.score_order, 'desc') <> 'asc' then gs.first_score end desc nulls last,
          gs.first_score_at asc
      )::integer as rank_no,
      p.display_name,
      gs.normalized_name,
      gs.game_slug,
      gs.first_score,
      gs.play_count,
      gs.first_score_at
    from public.game_scores gs
    join public.players p
      on p.normalized_name = gs.normalized_name
    join public.games g
      on g.game_slug = gs.game_slug
    where gs.game_slug = p_game_slug
      and (p_game_slug <> 'takkeu' or coalesce(gs.ranking_status, 'normal') = 'normal')
    order by
      case when g.score_order = 'asc' then gs.first_score end asc nulls last,
      case when coalesce(g.score_order, 'desc') <> 'asc' then gs.first_score end desc nulls last,
      gs.first_score_at asc
    limit p_limit
  )
  select
    r.rank_no,
    r.display_name,
    r.first_score,
    r.play_count,
    r.first_score_at,
    sr.metadata
  from ranked r
  left join lateral (
    select s.metadata
    from public.score_runs s
    where s.normalized_name = r.normalized_name
      and s.game_slug = r.game_slug
      and s.score = r.first_score
    order by
      abs(extract(epoch from (s.created_at - r.first_score_at))) asc,
      s.created_at asc,
      s.id asc
    limit 1
  ) sr on true
  order by r.rank_no;
$snapshot$;
REVOKE ALL ON FUNCTION public.get_first_try_ranking_with_metadata(p_game_slug text, p_limit integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_first_try_ranking_with_metadata(p_game_slug text, p_limit integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_first_try_ranking_with_metadata(p_game_slug text, p_limit integer) TO "anon";
GRANT EXECUTE ON FUNCTION public.get_first_try_ranking_with_metadata(p_game_slug text, p_limit integer) TO "authenticated";
CREATE OR REPLACE FUNCTION public.get_game_ranking(p_game_slug text, p_limit integer DEFAULT 100) RETURNS TABLE(rank_no integer, display_name text, best_score integer, play_count integer, best_score_at timestamp with time zone) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $snapshot$
declare
  v_score_order text;
  v_limit integer;
begin
  v_limit := least(greatest(coalesce(p_limit, 100), 1), 100);

  select g.score_order
  into v_score_order
  from public.games g
  where g.game_slug = p_game_slug
    and g.is_active = true;

  if v_score_order is null then
    raise exception 'game not found';
  end if;

  if v_score_order = 'asc' then
    return query
    select
      row_number() over (
        order by gs.best_score asc, gs.best_score_at asc, gs.updated_at asc
      )::integer as rank_no,
      gs.display_name,
      gs.best_score,
      gs.play_count,
      gs.best_score_at
    from public.game_scores gs
    where gs.game_slug = p_game_slug
      and (p_game_slug <> 'takkeu' or coalesce(gs.ranking_status, 'normal') = 'normal')
    order by gs.best_score asc, gs.best_score_at asc, gs.updated_at asc
    limit v_limit;
  else
    return query
    select
      row_number() over (
        order by gs.best_score desc, gs.best_score_at asc, gs.updated_at asc
      )::integer as rank_no,
      gs.display_name,
      gs.best_score,
      gs.play_count,
      gs.best_score_at
    from public.game_scores gs
    where gs.game_slug = p_game_slug
      and (p_game_slug <> 'takkeu' or coalesce(gs.ranking_status, 'normal') = 'normal')
    order by gs.best_score desc, gs.best_score_at asc, gs.updated_at asc
    limit v_limit;
  end if;
end;
$snapshot$;
REVOKE ALL ON FUNCTION public.get_game_ranking(p_game_slug text, p_limit integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_game_ranking(p_game_slug text, p_limit integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_game_ranking(p_game_slug text, p_limit integer) TO "anon";
CREATE OR REPLACE FUNCTION public.get_player_score_summary_with_metadata(p_game_slug text, p_normalized_name text) RETURNS TABLE(display_name text, first_score integer, best_score integer, play_count integer, first_score_at timestamp with time zone, best_score_at timestamp with time zone, first_metadata jsonb, best_metadata jsonb) LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO public AS $snapshot$
  select
    p.display_name,
    gs.first_score,
    gs.best_score,
    gs.play_count,
    gs.first_score_at,
    gs.best_score_at,
    first_run.metadata as first_metadata,
    best_run.metadata as best_metadata
  from public.game_scores gs
  join public.players p
    on p.normalized_name = gs.normalized_name
  left join lateral (
    select s.metadata
    from public.score_runs s
    where s.normalized_name = gs.normalized_name
      and s.game_slug = gs.game_slug
      and s.score = gs.first_score
    order by
      abs(extract(epoch from (s.created_at - gs.first_score_at))) asc,
      s.created_at asc,
      s.id asc
    limit 1
  ) first_run on true
  left join lateral (
    select s.metadata
    from public.score_runs s
    where s.normalized_name = gs.normalized_name
      and s.game_slug = gs.game_slug
      and s.score = gs.best_score
    order by
      abs(extract(epoch from (s.created_at - gs.best_score_at))) asc,
      s.created_at desc,
      s.id desc
    limit 1
  ) best_run on true
  where gs.game_slug = p_game_slug
    and p_game_slug not in ('sabasaba_normal', 'sabasaba_endless')
    and gs.normalized_name = p_normalized_name
  limit 1;
$snapshot$;
REVOKE ALL ON FUNCTION public.get_player_score_summary_with_metadata(p_game_slug text, p_normalized_name text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_player_score_summary_with_metadata(p_game_slug text, p_normalized_name text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_score_summary_with_metadata(p_game_slug text, p_normalized_name text) TO "anon";
GRANT EXECUTE ON FUNCTION public.get_player_score_summary_with_metadata(p_game_slug text, p_normalized_name text) TO "authenticated";
CREATE OR REPLACE FUNCTION public.record_game_play(p_display_name text, p_game_slug text, p_result_type text DEFAULT 'play'::text, p_client_version text DEFAULT NULL::text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $snapshot$
declare
  v_game_slug text;
  v_display_name text;
  v_normalized_name text;
  v_result_type text;
  v_game_exists boolean;
  v_now timestamptz := clock_timestamp();
  v_play_id text;
  v_best_score integer;
  v_play_count integer;
begin
  v_game_slug := lower(trim(coalesce(p_game_slug, '')));

  if v_game_slug = '' then
    return jsonb_build_object('accepted', false, 'reason', 'empty_game_slug');
  end if;

  select exists (
    select 1 from public.games where game_slug = v_game_slug
  ) into v_game_exists;

  if not v_game_exists then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'game_not_found',
      'game_slug', v_game_slug
    );
  end if;

  v_display_name := left(
    coalesce(
      nullif(regexp_replace(trim(coalesce(p_display_name, '')), '\s+', ' ', 'g'), ''),
      '名無し'
    ),
    20
  );

  v_normalized_name := case
    when v_game_slug = 'sainome_300_seconds'
      then public.normalize_player_name(v_display_name)
    else lower(v_display_name)
  end;

  v_result_type := lower(trim(coalesce(p_result_type, 'play')));
  if v_result_type not in ('clear', 'retire', 'home', 'play') then
    v_result_type := 'play';
  end if;

  if v_game_slug = 'sainome_300_seconds' and v_result_type = 'play' then
    if char_length(v_normalized_name) = 0 or char_length(v_normalized_name) > 20 then
      return jsonb_build_object(
        'accepted', false,
        'reason', 'invalid_display_name',
        'game_slug', v_game_slug
      );
    end if;

    v_play_id := pg_catalog.gen_random_uuid()::text;

    insert into public.players (
      normalized_name,
      display_name,
      created_at,
      last_played_at
    ) values (
      v_normalized_name,
      v_display_name,
      v_now,
      v_now
    )
    on conflict (normalized_name) do update set
      display_name = excluded.display_name,
      last_played_at = excluded.last_played_at;

    insert into public.game_play_events (
      play_id,
      game_slug,
      display_name,
      normalized_name,
      result_type,
      reached_wave,
      score,
      ranking_score,
      client_version,
      created_at
    ) values (
      v_play_id,
      v_game_slug,
      v_display_name,
      v_normalized_name,
      'retire',
      1,
      0,
      null,
      coalesce(p_client_version, ''),
      v_now
    );

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
    ) values (
      v_normalized_name,
      v_game_slug,
      v_display_name,
      0,
      0,
      1,
      v_now,
      v_now,
      v_now
    )
    on conflict (normalized_name, game_slug) do update set
      display_name = excluded.display_name,
      play_count = public.game_scores.play_count + 1,
      updated_at = excluded.updated_at
    returning best_score, play_count
      into v_best_score, v_play_count;

    return jsonb_build_object(
      'accepted', true,
      'game_slug', v_game_slug,
      'display_name', v_display_name,
      'normalized_name', v_normalized_name,
      'result_type', 'play',
      'provisional_result_type', 'retire',
      'provisional_score', 0,
      'play_id', v_play_id,
      'best_score', v_best_score,
      'play_count', v_play_count,
      'reached_wave', 1
    );
  end if;

  insert into public.game_play_events (
    game_slug,
    display_name,
    normalized_name,
    result_type,
    reached_wave,
    client_version
  ) values (
    v_game_slug,
    v_display_name,
    v_normalized_name,
    v_result_type,
    1,
    coalesce(p_client_version, '')
  );

  return jsonb_build_object(
    'accepted', true,
    'game_slug', v_game_slug,
    'display_name', v_display_name,
    'normalized_name', v_normalized_name,
    'result_type', v_result_type,
    'reached_wave', 1
  );
end;
$snapshot$;
REVOKE ALL ON FUNCTION public.record_game_play(p_display_name text, p_game_slug text, p_result_type text, p_client_version text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_game_play(p_display_name text, p_game_slug text, p_result_type text, p_client_version text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_game_play(p_display_name text, p_game_slug text, p_result_type text, p_client_version text) TO "anon";
GRANT EXECUTE ON FUNCTION public.record_game_play(p_display_name text, p_game_slug text, p_result_type text, p_client_version text) TO "authenticated";
CREATE OR REPLACE FUNCTION public.record_play_event(p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_ranking_score integer DEFAULT NULL::integer, p_client_version text DEFAULT ''::text, p_play_id text DEFAULT NULL::text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $snapshot$
declare
  v_display_name text;
  v_normalized_name text;
  v_play_id text;
begin
  v_display_name := left(coalesce(nullif(trim(p_display_name), ''), '名無し'), 20);
  v_normalized_name := lower(v_display_name);
  v_play_id := nullif(trim(coalesce(p_play_id, '')), '');

  if not exists (
    select 1
    from public.games
    where game_slug = p_game_slug
  ) then
    raise exception 'unknown game_slug: %', p_game_slug;
  end if;

  if p_result_type not in ('game_over', 'clear', 'retire') then
    raise exception 'invalid result_type: %', p_result_type;
  end if;

  if p_reached_wave < 1 or p_reached_wave > 30 then
    raise exception 'invalid reached_wave: %', p_reached_wave;
  end if;

  if p_score < 0 then
    raise exception 'invalid score: %', p_score;
  end if;

  insert into public.game_play_events (
    play_id,
    game_slug,
    display_name,
    normalized_name,
    result_type,
    reached_wave,
    score,
    ranking_score,
    client_version
  )
  values (
    v_play_id,
    p_game_slug,
    v_display_name,
    v_normalized_name,
    p_result_type,
    p_reached_wave,
    p_score,
    p_ranking_score,
    coalesce(p_client_version, '')
  )
  on conflict (play_id) do nothing;

  return jsonb_build_object(
    'accepted', true,
    'game_slug', p_game_slug,
    'result_type', p_result_type,
    'reached_wave', p_reached_wave
  );
end;
$snapshot$;
REVOKE ALL ON FUNCTION public.record_play_event(p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_ranking_score integer, p_client_version text, p_play_id text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_play_event(p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_ranking_score integer, p_client_version text, p_play_id text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_play_event(p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_ranking_score integer, p_client_version text, p_play_id text) TO "anon";
GRANT EXECUTE ON FUNCTION public.record_play_event(p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_ranking_score integer, p_client_version text, p_play_id text) TO "authenticated";
CREATE OR REPLACE FUNCTION public.submit_hito_wo_yurusuna_score(p_display_name text, p_score integer, p_clear_wave integer, p_client_version text DEFAULT ''::text) RETURNS TABLE(accepted boolean, result_normalized_name text, result_display_name text, result_first_score integer, result_best_score integer, result_play_count integer, is_first_play boolean, is_new_best boolean, result_clear_wave integer, result_first_clear_wave integer, result_best_clear_wave integer) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $snapshot$
declare
  r record;
  v_clear_wave integer;
  v_first_clear_wave integer;
  v_best_clear_wave integer;
begin
  v_clear_wave := greatest(0, least(coalesce(p_clear_wave, 0), 30));

  select *
  into r
  from public.submit_score(
    p_display_name,
    'hito_wo_yurusuna',
    p_score,
    coalesce(p_client_version, '')
  );

  update public.game_scores gs
  set
    first_clear_wave = case
      when r.is_first_play then v_clear_wave
      else coalesce(gs.first_clear_wave, 0)
    end,
    best_clear_wave = case
      when r.is_new_best then v_clear_wave
      else coalesce(gs.best_clear_wave, 0)
    end
  where gs.game_slug = 'hito_wo_yurusuna'
    and gs.normalized_name = r.result_normalized_name;

  update public.score_runs sr
  set clear_wave = v_clear_wave
  where sr.ctid = (
    select sr2.ctid
    from public.score_runs sr2
    where sr2.game_slug = 'hito_wo_yurusuna'
      and sr2.normalized_name = r.result_normalized_name
      and sr2.score = p_score
    order by sr2.created_at desc
    limit 1
  );

  select
    coalesce(gs.first_clear_wave, 0),
    coalesce(gs.best_clear_wave, 0)
  into
    v_first_clear_wave,
    v_best_clear_wave
  from public.game_scores gs
  where gs.game_slug = 'hito_wo_yurusuna'
    and gs.normalized_name = r.result_normalized_name;

  return query
  select
    r.accepted,
    r.result_normalized_name,
    r.result_display_name,
    r.result_first_score,
    r.result_best_score,
    r.result_play_count,
    r.is_first_play,
    r.is_new_best,
    v_clear_wave,
    coalesce(v_first_clear_wave, 0),
    coalesce(v_best_clear_wave, 0);
end;
$snapshot$;
REVOKE ALL ON FUNCTION public.submit_hito_wo_yurusuna_score(p_display_name text, p_score integer, p_clear_wave integer, p_client_version text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_hito_wo_yurusuna_score(p_display_name text, p_score integer, p_clear_wave integer, p_client_version text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_hito_wo_yurusuna_score(p_display_name text, p_score integer, p_clear_wave integer, p_client_version text) TO "anon";
GRANT EXECUTE ON FUNCTION public.submit_hito_wo_yurusuna_score(p_display_name text, p_score integer, p_clear_wave integer, p_client_version text) TO "authenticated";
CREATE OR REPLACE FUNCTION public.submit_score(p_display_name text, p_game_slug text, p_score integer, p_client_version text DEFAULT ''::text) RETURNS TABLE(accepted boolean, result_normalized_name text, result_display_name text, result_first_score integer, result_best_score integer, result_play_count integer, is_first_play boolean, is_new_best boolean) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $snapshot$
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
$snapshot$;
REVOKE ALL ON FUNCTION public.submit_score(p_display_name text, p_game_slug text, p_score integer, p_client_version text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_score(p_display_name text, p_game_slug text, p_score integer, p_client_version text) TO "anon";
GRANT EXECUTE ON FUNCTION public.submit_score(p_display_name text, p_game_slug text, p_score integer, p_client_version text) TO "authenticated";
CREATE OR REPLACE FUNCTION public.submit_score_unverified(p_display_name text, p_game_slug text, p_score integer, p_client_version text DEFAULT ''::text) RETURNS TABLE(accepted boolean, result_normalized_name text, result_display_name text, result_first_score integer, result_best_score integer, result_play_count integer, is_first_play boolean, is_new_best boolean) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $snapshot$
declare
  v_normalized_name text;
  v_display_name text;
  v_score_order text;
  v_old_first_score integer;
  v_old_best integer;
  v_old_play_count integer;
  v_is_first_play boolean := false;
  v_is_new_best boolean := false;
  v_now timestamptz := clock_timestamp();
  v_max_score integer;
  v_provisional_event_id bigint;
  v_final_result_type text;
begin
  v_display_name := btrim(coalesce(p_display_name, ''));
  v_normalized_name := public.normalize_player_name(p_display_name);

  if char_length(v_normalized_name) = 0 then
    raise exception 'name is empty';
  end if;
  if char_length(v_normalized_name) > 20 then
    raise exception 'name is too long';
  end if;
  if p_score is null then
    raise exception 'invalid score';
  end if;
  if p_score < -100000000 then
    raise exception 'score is too small';
  end if;
  if p_game_slug = 'sainome_300_seconds' and p_score < 0 then
    raise exception 'invalid score';
  end if;

  v_max_score := case
    when p_game_slug = 'maron_hikou' then 400000000
    when p_game_slug = 'uchikaeru' then 121999999
    else 100000000
  end;
  if p_score > v_max_score then
    raise exception 'score is too large';
  end if;

  select g.score_order into v_score_order
  from public.games as g
  where g.game_slug = p_game_slug and g.is_active = true;
  if v_score_order is null then
    raise exception 'game not found';
  end if;

  insert into public.players (normalized_name, display_name, created_at, last_played_at)
  values (v_normalized_name, v_display_name, v_now, v_now)
  on conflict (normalized_name) do update set
    display_name = excluded.display_name,
    last_played_at = excluded.last_played_at;

  if p_game_slug = 'sainome_300_seconds' then
    select gpe.id
    into v_provisional_event_id
    from public.game_play_events as gpe
    where gpe.game_slug = p_game_slug
      and gpe.normalized_name = v_normalized_name
      and gpe.ranking_score is null
      and gpe.result_type in ('play', 'retire')
      and gpe.created_at >= v_now - interval '24 hours'
    order by gpe.created_at desc, gpe.id desc
    limit 1
    for update;

    if v_provisional_event_id is not null then
      select not exists (
        select 1
        from public.score_runs as sr
        where sr.normalized_name = v_normalized_name
          and sr.game_slug = p_game_slug
      ) into v_is_first_play;

      v_final_result_type := case when p_score = 0 then 'retire' else 'clear' end;

      update public.game_play_events as gpe set
        display_name = v_display_name,
        result_type = v_final_result_type,
        score = p_score,
        ranking_score = p_score,
        client_version = coalesce(p_client_version, '')
      where gpe.id = v_provisional_event_id;

      insert into public.score_runs (
        normalized_name,
        game_slug,
        score,
        client_version,
        created_at,
        metadata
      ) values (
        v_normalized_name,
        p_game_slug,
        p_score,
        coalesce(p_client_version, ''),
        v_now,
        jsonb_build_object(
          'source', 'sainome_provisional_retire',
          'play_event_id', v_provisional_event_id,
          'result_type', v_final_result_type
        )
      );

      select gs.first_score, gs.best_score, gs.play_count
      into v_old_first_score, v_old_best, v_old_play_count
      from public.game_scores as gs
      where gs.normalized_name = v_normalized_name
        and gs.game_slug = p_game_slug
      for update;

      if v_old_best is null then
        v_is_new_best := p_score > 0;
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
        ) values (
          v_normalized_name,
          p_game_slug,
          v_display_name,
          0,
          p_score,
          1,
          v_now,
          v_now,
          v_now
        );
      else
        if (v_score_order = 'desc' and p_score > v_old_best)
           or (v_score_order = 'asc' and p_score < v_old_best) then
          v_is_new_best := true;
          update public.game_scores as gs set
            display_name = v_display_name,
            best_score = p_score,
            best_score_at = v_now,
            updated_at = v_now
          where gs.normalized_name = v_normalized_name
            and gs.game_slug = p_game_slug;
        else
          update public.game_scores as gs set
            display_name = v_display_name,
            updated_at = v_now
          where gs.normalized_name = v_normalized_name
            and gs.game_slug = p_game_slug;
        end if;
      end if;

      return query
      select true, gs.normalized_name, gs.display_name, gs.first_score, gs.best_score,
             gs.play_count, v_is_first_play, v_is_new_best
      from public.game_scores as gs
      where gs.normalized_name = v_normalized_name
        and gs.game_slug = p_game_slug;
      return;
    end if;

    if exists (
      select 1
      from public.score_runs as sr
      where sr.normalized_name = v_normalized_name
        and sr.game_slug = p_game_slug
        and sr.score = p_score
        and coalesce(sr.client_version, '') = coalesce(p_client_version, '')
        and sr.created_at >= v_now - interval '2 minutes'
        and sr.metadata ->> 'source' = 'sainome_provisional_retire'
    ) then
      return query
      select true, gs.normalized_name, gs.display_name, gs.first_score, gs.best_score,
             gs.play_count, false, false
      from public.game_scores as gs
      where gs.normalized_name = v_normalized_name
        and gs.game_slug = p_game_slug;
      return;
    end if;
  end if;

  insert into public.score_runs (normalized_name, game_slug, score, client_version, created_at)
  values (v_normalized_name, p_game_slug, p_score, coalesce(p_client_version, ''), v_now);

  select gs.first_score, gs.best_score, gs.play_count
  into v_old_first_score, v_old_best, v_old_play_count
  from public.game_scores as gs
  where gs.normalized_name = v_normalized_name and gs.game_slug = p_game_slug
  for update;

  if v_old_best is null then
    v_is_first_play := true;
    v_is_new_best := true;
    insert into public.game_scores (
      normalized_name, game_slug, display_name, first_score, best_score, play_count,
      first_score_at, best_score_at, updated_at
    ) values (
      v_normalized_name, p_game_slug, v_display_name, p_score, p_score, 1,
      v_now, v_now, v_now
    );
  else
    if (v_score_order = 'desc' and p_score > v_old_best)
       or (v_score_order = 'asc' and p_score < v_old_best) then
      v_is_new_best := true;
      update public.game_scores as gs set
        display_name = v_display_name,
        best_score = p_score,
        play_count = v_old_play_count + 1,
        best_score_at = v_now,
        updated_at = v_now
      where gs.normalized_name = v_normalized_name and gs.game_slug = p_game_slug;
    else
      update public.game_scores as gs set
        display_name = v_display_name,
        play_count = v_old_play_count + 1,
        updated_at = v_now
      where gs.normalized_name = v_normalized_name and gs.game_slug = p_game_slug;
    end if;
  end if;

  return query
  select true, gs.normalized_name, gs.display_name, gs.first_score, gs.best_score,
         gs.play_count, v_is_first_play, v_is_new_best
  from public.game_scores as gs
  where gs.normalized_name = v_normalized_name and gs.game_slug = p_game_slug;
end;
$snapshot$;
REVOKE ALL ON FUNCTION public.submit_score_unverified(p_display_name text, p_game_slug text, p_score integer, p_client_version text) FROM PUBLIC,anon,authenticated,service_role;
SET check_function_bodies=on;
