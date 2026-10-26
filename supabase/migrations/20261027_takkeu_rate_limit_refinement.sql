-- Tighten Takkeu-only maximum after checking the 30-ball return travel floor.
-- A 0.6s outbound plus 0.72 * 0.4s incoming earliest contact
-- gives at most 30 / 0.888 = 33.79 hits/second, before 150-hit burst headroom.
-- Other games and the shared function signature are unchanged.
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
  -- 35 hits/s gives headroom above the 30-ball game's physics bound.
  -- The 150-hit allowance protects against short bursts and existing runs.
  if v_game_slug = 'takkeu' and p_score > 0
     and p_score::numeric > 35::numeric * greatest(0::numeric,
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
