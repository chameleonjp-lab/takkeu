-- New 3000-goal plays only. No historical scores are rewritten or backfilled.
-- Stage this migration before deploying the matching client; do not apply it
-- to the shared production database as part of tests.
alter table private.game_play_sessions
  add column takkeu_rules_version text,
  add column takkeu_clear_verified boolean not null default false,
  add constraint takkeu_clear_rules_v1 check (
    (takkeu_rules_version is null or (game_slug = 'takkeu' and takkeu_rules_version = 'goal-3000-v1'))
    and (not takkeu_clear_verified or takkeu_rules_version is not distinct from 'goal-3000-v1')
  );

create table public.takkeu_hall_of_fame (
  hall_number integer primary key check (hall_number > 0),
  normalized_name text not null unique references public.players(normalized_name),
  display_name text not null check (char_length(display_name) between 1 and 20),
  first_play_id uuid not null unique references private.game_play_sessions(play_id),
  registered_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.takkeu_hall_of_fame enable row level security;
revoke all on table public.takkeu_hall_of_fame from public, anon, authenticated;

-- Serialize first registrations, including different names, without consuming
-- another sequence value on retries or same-name repeat clears.
create table private.takkeu_hall_counter_v1 (
  singleton boolean primary key default true check (singleton),
  next_number integer not null check (next_number > 0)
);
insert into private.takkeu_hall_counter_v1 values (true, 1);
alter table private.takkeu_hall_counter_v1 enable row level security;
revoke all on table private.takkeu_hall_counter_v1 from public, anon, authenticated;

create function public.start_takkeu_clear_play_v1(
  p_start_id uuid, p_display_name text, p_game_slug text, p_client_version text
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_result jsonb;
  v_session private.game_play_sessions%rowtype;
begin
  if p_game_slug is distinct from 'takkeu' or p_client_version is distinct from 'takkeu-web-clear-1' then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'invalid_clear_contract');
  end if;
  v_result := public.start_game_play_v1(p_start_id, p_display_name, p_game_slug, p_client_version);
  if coalesce((v_result ->> 'accepted')::boolean, false) is not true then return v_result; end if;
  select * into strict v_session from private.game_play_sessions
    where play_id = (v_result ->> 'play_id')::uuid for update;
  if (v_result ->> 'duplicate')::boolean and v_session.takkeu_rules_version is distinct from 'goal-3000-v1' then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'start_requires_new_rules');
  end if;
  update private.game_play_sessions set takkeu_rules_version = 'goal-3000-v1'
    where play_id = v_session.play_id;
  return v_result || pg_catalog.jsonb_build_object('rules_version', 'goal-3000-v1');
end;
$function$;

create function public.finish_takkeu_clear_play_v1(
  p_play_id uuid, p_display_name text, p_game_slug text, p_result_type text,
  p_reached_wave integer, p_score integer, p_client_version text,
  p_ranking_score integer, p_lost_balls integer
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_result jsonb;
  v_session private.game_play_sessions%rowtype;
begin
  if p_game_slug is distinct from 'takkeu' or p_client_version is distinct from 'takkeu-web-clear-1'
    or p_score is null or p_score not between 0 and 3000 or p_result_type is null
    or p_result_type not in ('clear', 'game_over', 'retire')
    or (p_result_type = 'clear') is distinct from (p_score = 3000)
    or p_reached_wave is distinct from 1
    or (p_result_type = 'clear' and (p_lost_balls is null or p_lost_balls not between 0 and 99)) then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'invalid_clear_result');
  end if;
  select * into v_session from private.game_play_sessions where play_id = p_play_id for update;
  if not found or v_session.takkeu_rules_version is distinct from 'goal-3000-v1' then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'new_rule_play_required');
  end if;
  -- Preserve current server-time score limits, session identity, loss monotonicity
  -- and idempotent finish validation. Do not duplicate or relax those checks.
  v_result := public.finish_takkeu_play_v2(p_play_id, p_display_name, p_game_slug,
    p_result_type, p_reached_wave, p_score, p_client_version, p_ranking_score, p_lost_balls);
  if coalesce((v_result ->> 'accepted')::boolean, false) is not true then return v_result; end if;
  update private.game_play_sessions set takkeu_clear_verified = (p_result_type = 'clear') where play_id = p_play_id;
  return v_result || pg_catalog.jsonb_build_object('rules_version', 'goal-3000-v1');
end;
$function$;

create function public.register_takkeu_hall_v1(
  p_play_id uuid, p_submission_id uuid, p_display_name text, p_client_version text
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_session private.game_play_sessions%rowtype;
  v_entry public.takkeu_hall_of_fame%rowtype;
  v_status text;
  v_number integer;
begin
  if p_play_id is null or p_submission_id is null or p_display_name is null
    or p_client_version is distinct from 'takkeu-web-clear-1' then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'invalid_clear_contract');
  end if;
  select * into v_session from private.game_play_sessions where play_id = p_play_id for update;
  if not found or v_session.game_slug <> 'takkeu'
    or v_session.client_version <> p_client_version
    or v_session.normalized_name is distinct from public.normalize_player_name(p_display_name)
    or v_session.takkeu_rules_version is distinct from 'goal-3000-v1'
    or not v_session.takkeu_clear_verified or v_session.finished_at is null
    or v_session.result_type <> 'clear' or v_session.score <> 3000
    or v_session.takkeu_final_lost_balls is null or v_session.takkeu_final_lost_balls not between 0 and 99 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'verified_clear_required');
  end if;
  if not exists (select 1 from public.score_runs r
    where r.play_id = p_play_id and r.submission_id = p_submission_id
      and r.game_slug = 'takkeu' and r.normalized_name = v_session.normalized_name
      and r.score = 3000 and r.client_version = p_client_version) then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'score_not_submitted');
  end if;
  select gs.ranking_status into v_status from public.game_scores gs
    where gs.game_slug = 'takkeu' and gs.normalized_name = v_session.normalized_name for share;
  if v_status is distinct from 'normal' then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'hall_ineligible');
  end if;
  select next_number into strict v_number from private.takkeu_hall_counter_v1 where singleton for update;
  select * into v_entry from public.takkeu_hall_of_fame where normalized_name = v_session.normalized_name;
  if not found then
    insert into public.takkeu_hall_of_fame(hall_number, normalized_name, display_name, first_play_id)
      values(v_number, v_session.normalized_name, v_session.display_name, p_play_id) returning * into v_entry;
    update private.takkeu_hall_counter_v1 set next_number = v_number + 1 where singleton;
  end if;
  return pg_catalog.jsonb_build_object('accepted', true, 'play_id', p_play_id, 'submission_id', p_submission_id,
    'rules_version', 'goal-3000-v1', 'hall_number', v_entry.hall_number, 'display_name', v_entry.display_name,
    'normalized_name', v_entry.normalized_name, 'registered_at', v_entry.registered_at);
end;
$function$;

-- Public, bounded, moderated data only. Private sessions and counter remain
-- inaccessible. Stable numbers are not reassigned when an entry is hidden.
create function public.get_takkeu_hall_v1(p_limit integer default 30)
returns table(hall_number integer, display_name text, normalized_name text, registered_at timestamptz)
language sql stable security definer set search_path = ''
as $function$
  select h.hall_number, h.display_name, h.normalized_name, h.registered_at
  from public.takkeu_hall_of_fame h join public.game_scores gs
    on gs.game_slug = 'takkeu' and gs.normalized_name = h.normalized_name
  where gs.ranking_status = 'normal'
  order by h.hall_number limit least(greatest(coalesce(p_limit, 30), 1), 100);
$function$;

revoke all on function public.start_takkeu_clear_play_v1(uuid,text,text,text) from public;
revoke all on function public.finish_takkeu_clear_play_v1(uuid,text,text,text,integer,integer,text,integer,integer) from public;
revoke all on function public.register_takkeu_hall_v1(uuid,uuid,text,text) from public;
revoke all on function public.get_takkeu_hall_v1(integer) from public;
grant execute on function public.start_takkeu_clear_play_v1(uuid,text,text,text) to anon, authenticated, service_role;
grant execute on function public.finish_takkeu_clear_play_v1(uuid,text,text,text,integer,integer,text,integer,integer) to anon, authenticated, service_role;
grant execute on function public.register_takkeu_hall_v1(uuid,uuid,text,text) to anon, authenticated, service_role;
grant execute on function public.get_takkeu_hall_v1(integer) to anon, authenticated, service_role;

comment on table public.takkeu_hall_of_fame is
  '3000-rally clears started under goal-3000-v1. One stable registration number per existing normalized player name. No legacy backfill; not a count of unique people.';
