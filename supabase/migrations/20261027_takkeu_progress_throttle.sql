-- Throttle the optional telemetry endpoint without changing scoring or other games.
CREATE OR REPLACE FUNCTION public.report_takkeu_progress_v1(p_play_id uuid, p_display_name text, p_client_version text, p_score integer, p_sim_seconds numeric, p_ball_count integer, p_lost_balls integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session private.game_play_sessions%rowtype;
  v_prior private.takkeu_progress_v1%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_total_seconds numeric;
  v_delta_seconds numeric;
  v_signal text := null;
  v_high_density boolean;
begin
  if p_play_id is null or p_display_name is null or p_client_version is null
      or p_score is null or p_sim_seconds is null or p_ball_count is null
      or p_lost_balls is null then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'missing_input');
  end if;
  if p_score < 0 or p_ball_count not between 0 and 30
      or p_lost_balls not between 0 and 100 or p_sim_seconds < 0
      or p_sim_seconds > 43200 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'invalid_input');
  end if;
  select * into v_session from private.game_play_sessions
  where play_id = p_play_id and game_slug = 'takkeu'
    and normalized_name = public.normalize_player_name(p_display_name)
    and client_version = p_client_version
  for update;
  if not found or v_session.finished_at is not null then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'play_unavailable');
  end if;

  v_total_seconds := greatest(0::numeric,
      extract(epoch from v_now - v_session.started_at)::numeric);
  select * into v_prior from private.takkeu_progress_v1 where play_id = p_play_id for update;
  v_delta_seconds := case when found then
    greatest(0::numeric, extract(epoch from v_now - v_prior.last_report_at)::numeric)
  else v_total_seconds end;
  -- Per-play rate limit: excessive progress calls never update the private tables.
  if v_prior.play_id is not null and v_delta_seconds < 5 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'report_too_frequent');
  end if;
  if v_prior.play_id is not null and v_prior.report_count >= 240 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'report_limit_reached');
  end if;
  if p_sim_seconds > v_total_seconds + 5 then
    v_signal := 'sim_time_invalid';
  elsif v_prior.play_id is not null and (p_score < v_prior.last_score
      or p_sim_seconds < v_prior.last_sim_seconds
      or p_lost_balls < v_prior.last_lost_balls) then
    v_signal := 'non_monotonic';
  elsif p_score::numeric > 40::numeric * v_total_seconds + 150
      or (v_prior.play_id is not null
        and (p_score - v_prior.last_score)::numeric > 40::numeric * v_delta_seconds + 150) then
    v_signal := 'invalid_rate';
  end if;
  if v_signal is not null then
    insert into private.takkeu_progress_signals_v1
      (play_id, reason, latest_score, first_seen_at, last_seen_at, occurrence_count)
    values (p_play_id, v_signal, p_score, v_now, v_now, 1)
    on conflict (play_id, reason) do update set
      latest_score = excluded.latest_score,
      last_seen_at = excluded.last_seen_at,
      occurrence_count = private.takkeu_progress_signals_v1.occurrence_count + 1;
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', v_signal);
  end if;
  -- Heuristic only, can be legitimate multiball gameplay; never label BOT automatically.
  v_high_density := p_score::numeric > 30::numeric * v_total_seconds + 60;
  insert into private.takkeu_progress_v1
    (play_id, last_score, last_sim_seconds, last_ball_count,
     last_lost_balls, first_report_at, last_report_at, report_count, high_density_signal)
  values
    (p_play_id, p_score, p_sim_seconds, p_ball_count, p_lost_balls,
     v_now, v_now, 1, v_high_density)
  on conflict (play_id) do update set
    last_score = excluded.last_score,
    last_sim_seconds = excluded.last_sim_seconds,
    last_ball_count = excluded.last_ball_count,
    last_lost_balls = excluded.last_lost_balls,
    last_report_at = excluded.last_report_at,
    report_count = private.takkeu_progress_v1.report_count + 1,
    high_density_signal = private.takkeu_progress_v1.high_density_signal or excluded.high_density_signal;
  if v_high_density then
    insert into private.takkeu_progress_signals_v1
      (play_id, reason, latest_score, first_seen_at, last_seen_at, occurrence_count)
    values (p_play_id, 'high_density', p_score, v_now, v_now, 1)
    on conflict (play_id, reason) do update set
      latest_score = excluded.latest_score,
      last_seen_at = excluded.last_seen_at,
      occurrence_count = private.takkeu_progress_signals_v1.occurrence_count + 1;
  end if;
  return pg_catalog.jsonb_build_object('accepted', true, 'high_density_signal', v_high_density);
end;
$function$
;
