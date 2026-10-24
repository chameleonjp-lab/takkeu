begin isolation level repeatable read;
do $test$
declare
  v_id uuid := pg_catalog.gen_random_uuid();
  v_before record;
  v_after record;
  v_reply jsonb;
  v_duplicate jsonb;
begin
  assert to_regprocedure('public.start_takkeu_guest_play_v1(uuid,text,text)') is not null, 'guest RPC missing';
  assert has_function_privilege('anon', 'public.start_takkeu_guest_play_v1(uuid,text,text)', 'execute');
  assert not has_table_privilege('anon', 'private.takkeu_guest_plays_v1', 'select');
  assert not has_table_privilege('anon', 'private.takkeu_guest_plays_v1', 'insert');
  assert (select relrowsecurity from pg_class where oid = 'private.takkeu_guest_plays_v1'::regclass);
  select * into v_before from public.get_game_play_stats('takkeu');
  perform set_config('takkeu_test.start_id', v_id::text, true);
  perform set_config('takkeu_test.before_count', v_before.total_play_count::text, true);
  perform set_config('takkeu_test.before_players', (select count(*)::text from public.players), true);
  perform set_config('takkeu_test.before_scores', (select count(*)::text from public.game_scores where game_slug='takkeu'), true);
  perform set_config('takkeu_test.before_sessions', (select count(*)::text from private.game_play_sessions where game_slug='takkeu'), true);
  perform set_config('takkeu_test.other_stats', (select row_to_json(s)::text from public.get_game_play_stats('faitofuraito_normal') s), true);
  v_reply := public.start_takkeu_guest_play_v1(v_id, 'takkeu', 'takkeu-web-ranking-1');
  assert v_reply->>'accepted' = 'true' and v_reply->>'duplicate' = 'false';
  v_duplicate := public.start_takkeu_guest_play_v1(v_id, 'takkeu', 'takkeu-web-ranking-1');
  assert v_duplicate->>'duplicate' = 'true' and v_duplicate->>'play_id' = v_reply->>'play_id';
  assert (select count(*) from private.takkeu_guest_plays_v1 where start_id=v_id) = 1;
  select * into v_after from public.get_game_play_stats('takkeu');
  assert v_after.total_play_count = v_before.total_play_count + 1, 'guest total must increase once';
  assert v_after.player_count = v_before.player_count, 'guest must not become a named player';
  assert public.start_takkeu_guest_play_v1(v_id, 'takkeu', 'changed-version')->>'reason' = 'start_id_conflict';
  assert public.start_takkeu_guest_play_v1(pg_catalog.gen_random_uuid(), 'other-game', 'v1')->>'accepted' = 'false';
  assert public.start_takkeu_guest_play_v1(null, 'takkeu', 'v1')->>'accepted' = 'false';
  assert public.start_takkeu_guest_play_v1(pg_catalog.gen_random_uuid(), 'takkeu', ' ')->>'accepted' = 'false';
end;
$test$;
set local role anon;
do $test$
declare v_reply jsonb;
begin
  v_reply := public.start_takkeu_guest_play_v1(current_setting('takkeu_test.start_id')::uuid, 'takkeu', 'takkeu-web-ranking-1');
  assert v_reply->>'accepted' = 'true' and v_reply->>'duplicate' = 'true', 'anon must be able to retry';
end;
$test$;
reset role;
do $test$
begin
  assert (select total_play_count from public.get_game_play_stats('takkeu')) = current_setting('takkeu_test.before_count')::bigint + 1;
  assert (select count(*) from public.players) = current_setting('takkeu_test.before_players')::bigint;
  assert (select count(*) from public.game_scores where game_slug='takkeu') = current_setting('takkeu_test.before_scores')::bigint;
  assert (select count(*) from private.game_play_sessions where game_slug='takkeu') = current_setting('takkeu_test.before_sessions')::bigint;
  assert (select row_to_json(s)::text from public.get_game_play_stats('faitofuraito_normal') s) = current_setting('takkeu_test.other_stats');
end;
$test$;
select 'guest start +1, duplicate +0, anon grant, no player/score/session row, other game unchanged' as verified;
rollback;
