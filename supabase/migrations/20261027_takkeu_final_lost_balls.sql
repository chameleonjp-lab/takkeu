-- Takkeu: persist the actual final number of balls lost for named plays.
-- Existing and unnamed starts remain backward compatible; historical values stay NULL.
alter table private.game_play_sessions
  add column if not exists takkeu_final_lost_balls integer;

alter table private.game_play_sessions
  add constraint takkeu_final_lost_balls_range_v1
  check (takkeu_final_lost_balls is null
         or (game_slug = 'takkeu' and takkeu_final_lost_balls between 0 and 100));

-- A single server transaction finalizes the old scoring contract and the loss count.
-- This preserves the existing score/time verification and idempotent submission path.
create or replace function public.finish_takkeu_play_v2(
  p_play_id uuid,
  p_display_name text,
  p_game_slug text,
  p_result_type text,
  p_reached_wave integer,
  p_score integer,
  p_client_version text,
  p_ranking_score integer,
  p_lost_balls integer
)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_session private.game_play_sessions%rowtype;
  v_result jsonb;
begin
  if p_play_id is null
     or p_display_name is null
     or p_game_slug is distinct from 'takkeu'
     or p_result_type is null
     or p_score is null
     or p_client_version is null
     or p_lost_balls is null
     or p_lost_balls not between 0 and 100 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'invalid_input');
  end if;

  -- Empty stock and the 100th loss both cause game over; do not assert 100 losses.
  if p_result_type = 'game_over' and p_lost_balls = 0 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'game_over_needs_loss');
  end if;

  select * into v_session
  from private.game_play_sessions
  where play_id = p_play_id
  for update;

  if not found or v_session.game_slug <> 'takkeu' then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'play_unavailable');
  end if;

  if v_session.normalized_name is distinct from public.normalize_player_name(p_display_name)
     or v_session.client_version is distinct from p_client_version then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'play_payload_mismatch');
  end if;

  -- A legacy finished play has no trustworthy final count; never infer or backfill it.
  if v_session.finished_at is not null and v_session.takkeu_final_lost_balls is null then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'legacy_finish_without_lost_balls');
  end if;

  if v_session.takkeu_final_lost_balls is not null
     and v_session.takkeu_final_lost_balls <> p_lost_balls then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'lost_balls_conflict');
  end if;

  -- A reported final count cannot go backwards from an already stored snapshot.
  if exists (
    select 1 from private.takkeu_progress_v1 as progress
    where progress.play_id = p_play_id
      and progress.last_lost_balls > p_lost_balls
  ) then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'lost_balls_below_last_progress');
  end if;

  v_result := public.finish_game_play_v1(
    p_play_id, p_display_name, p_game_slug,
    p_result_type, p_reached_wave, p_score,
    p_client_version, p_ranking_score
  );

  if coalesce((v_result ->> 'accepted')::boolean, false) is not true then
    return v_result;
  end if;

  update private.game_play_sessions
  set takkeu_final_lost_balls = p_lost_balls
  where play_id = p_play_id
    and (takkeu_final_lost_balls is null or takkeu_final_lost_balls = p_lost_balls);

  if not found then
    raise exception 'lost ball count did not persist' using errcode = 'PT500';
  end if;

  return v_result || pg_catalog.jsonb_build_object('lost_balls', p_lost_balls);
end;
$function$;

revoke all on function public.finish_takkeu_play_v2(
  uuid,text,text,text,integer,integer,text,integer,integer
) from public;
grant execute on function public.finish_takkeu_play_v2(
  uuid,text,text,text,integer,integer,text,integer,integer
) to anon, authenticated, service_role;

-- Copy the final count into the specific score run, not the best-score aggregate.
-- The shared submission RPC replaces metadata after inserting, hence the UPDATE hook.
create or replace function private.attach_takkeu_final_losses_v1()
returns trigger
language plpgsql security definer set search_path = ''
as $function$
declare
  v_count integer;
begin
  if new.game_slug <> 'takkeu' or new.play_id is null then
    return new;
  end if;

  select s.takkeu_final_lost_balls into v_count
  from private.game_play_sessions as s
  where s.play_id = new.play_id
    and s.game_slug = 'takkeu'
    and s.finished_at is not null
    and s.score = new.score;

  if v_count is not null then
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
                    || pg_catalog.jsonb_build_object('final_lost_balls', v_count);
  end if;

  return new;
end;
$function$;

create trigger attach_takkeu_final_losses_to_score_runs_v1
  before insert or update of metadata on public.score_runs
  for each row execute function private.attach_takkeu_final_losses_v1();

comment on column private.game_play_sessions.takkeu_final_lost_balls is
  'Takkeu final cumulative balls lost. NULL denotes legacy/unreported, not zero. Game over can occur before 100 if all balls are gone.';
comment on function public.finish_takkeu_play_v2(uuid,text,text,text,integer,integer,text,integer,integer) is
  'Takkeu-only final score and cumulative lost balls; delegates to finish_game_play_v1 for timing validation, atomically persists count.';
