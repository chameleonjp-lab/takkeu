-- Guest starts are count-only, isolated from named sessions and score tables.
create table private.takkeu_guest_plays_v1 (
  start_id uuid primary key,
  play_id uuid not null unique default pg_catalog.gen_random_uuid(),
  client_version text not null check (char_length(client_version) between 1 and 80),
  started_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index takkeu_guest_plays_v1_started_at_idx on private.takkeu_guest_plays_v1 (started_at);
alter table private.takkeu_guest_plays_v1 enable row level security;
revoke all on table private.takkeu_guest_plays_v1 from public, anon, authenticated;

-- This intentionally public definer endpoint can only append a validated
-- takkeu guest start. Direct writes to the private table remain forbidden.
create function public.start_takkeu_guest_play_v1(p_start_id uuid, p_game_slug text, p_client_version text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing private.takkeu_guest_plays_v1%rowtype;
  v_play_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_start_id is null or p_game_slug is null or p_client_version is null then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'required_input_missing');
  end if;
  if p_game_slug <> 'takkeu' or p_client_version <> pg_catalog.btrim(p_client_version)
     or pg_catalog.char_length(p_client_version) not between 1 and 80 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'invalid_input');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_start_id::text, 0::bigint));
  select * into v_existing from private.takkeu_guest_plays_v1 where start_id = p_start_id for update;
  if found then
    if v_existing.client_version <> p_client_version then
      return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'start_id_conflict');
    end if;
    return pg_catalog.jsonb_build_object('accepted', true, 'duplicate', true, 'start_id', p_start_id,
      'play_id', v_existing.play_id, 'game_slug', 'takkeu', 'client_version', v_existing.client_version);
  end if;
  if exists (select 1 from private.game_play_sessions where start_id = p_start_id) then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'start_id_conflict');
  end if;
  perform 1 from public.games where game_slug = 'takkeu' and is_active is true and submission_mode = 'shared' for share;
  if not found then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'game_not_available');
  end if;
  -- Coarse flood protection, not guest identification.
  if (select count(*) from private.takkeu_guest_plays_v1 where started_at >= v_now - interval '1 minute') >= 10000 then
    return pg_catalog.jsonb_build_object('accepted', false, 'reason', 'play_rate_limited');
  end if;
  insert into private.takkeu_guest_plays_v1 (start_id, client_version, started_at)
    values (p_start_id, p_client_version, v_now) returning play_id into v_play_id;
  return pg_catalog.jsonb_build_object('accepted', true, 'duplicate', false, 'start_id', p_start_id,
    'play_id', v_play_id, 'game_slug', 'takkeu', 'client_version', p_client_version);
end;
$function$;
revoke all on function public.start_takkeu_guest_play_v1(uuid, text, text) from public;
grant execute on function public.start_takkeu_guest_play_v1(uuid, text, text) to anon, authenticated, service_role;

-- Preserve the existing named-player aggregation for every game. Only the
-- takkeu total receives anonymous starts; player_count and rankings stay named.
create or replace function public.get_game_play_stats(p_game_slug text)
returns table(total_play_count bigint, player_count bigint)
language sql stable security definer set search_path = ''
as $function$
  select named.total_play_count + case
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_game_slug, ''))) = 'takkeu'
      then (select count(*) from private.takkeu_guest_plays_v1) else 0::bigint end,
    named.player_count
  from (
    select coalesce(sum(pc.play_count), 0)::bigint as total_play_count, count(*)::bigint as player_count
    from private.get_game_player_counts_v1(p_game_slug) as pc
  ) as named;
$function$;
