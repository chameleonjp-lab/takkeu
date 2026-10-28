-- PROPOSAL ONLY: requires independent production approval. Project mlpnjgezrnhdxsxolyzj.
-- B1 scoped application RPC ACL proposal. Does not establish a fully readonly DB credential (large-object blocker remains).
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'; SET LOCAL search_path=pg_catalog;
DO $scoped_acl$ DECLARE actual jsonb; BEGIN
IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN RAISE EXCEPTION 'approved apply owner/database required'; END IF;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.check_player_name(text)');
  IF actual IS DISTINCT FROM '[{"role":"PUBLIC","grantor":"postgres","grantable":false},{"role":"anon","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.check_player_name(text)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_display_name text' AND pg_get_function_result(p.oid)='TABLE(name_exists boolean, registered_display_name text)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='plpgsql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='c54f358e60d067711efc13f96de84e3f188fd8953304887621b8635c9091526f')
    THEN RAISE EXCEPTION 'RPC/ACL drift: check_player_name'; END IF;
GRANT EXECUTE ON FUNCTION public.check_player_name(text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.check_player_name(text) FROM PUBLIC;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.check_player_name(text)');
  IF actual IS DISTINCT FROM '[{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false},{"role":"service_role","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.check_player_name(text)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_display_name text' AND pg_get_function_result(p.oid)='TABLE(name_exists boolean, registered_display_name text)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='plpgsql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='c54f358e60d067711efc13f96de84e3f188fd8953304887621b8635c9091526f')
    THEN RAISE EXCEPTION 'RPC/ACL drift: check_player_name'; END IF;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_best_score_ranking_with_metadata(text,integer)');
  IF actual IS DISTINCT FROM '[{"role":"PUBLIC","grantor":"postgres","grantable":false},{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_best_score_ranking_with_metadata(text,integer)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_game_slug text, p_limit integer DEFAULT 10' AND pg_get_function_result(p.oid)='TABLE(rank_no integer, display_name text, best_score integer, play_count integer, best_score_at timestamp with time zone, metadata jsonb)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='sql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='7d20f280ffbf38a0095e689d6cc9ca35b3c26874495af12f720ce5079bd2cccf')
    THEN RAISE EXCEPTION 'RPC/ACL drift: get_best_score_ranking_with_metadata'; END IF;
GRANT EXECUTE ON FUNCTION public.get_best_score_ranking_with_metadata(text,integer) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_best_score_ranking_with_metadata(text,integer) FROM PUBLIC;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_best_score_ranking_with_metadata(text,integer)');
  IF actual IS DISTINCT FROM '[{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false},{"role":"service_role","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_best_score_ranking_with_metadata(text,integer)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_game_slug text, p_limit integer DEFAULT 10' AND pg_get_function_result(p.oid)='TABLE(rank_no integer, display_name text, best_score integer, play_count integer, best_score_at timestamp with time zone, metadata jsonb)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='sql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='7d20f280ffbf38a0095e689d6cc9ca35b3c26874495af12f720ce5079bd2cccf')
    THEN RAISE EXCEPTION 'RPC/ACL drift: get_best_score_ranking_with_metadata'; END IF;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_first_try_ranking_with_metadata(text,integer)');
  IF actual IS DISTINCT FROM '[{"role":"PUBLIC","grantor":"postgres","grantable":false},{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_first_try_ranking_with_metadata(text,integer)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_game_slug text, p_limit integer DEFAULT 10' AND pg_get_function_result(p.oid)='TABLE(rank_no integer, display_name text, first_score integer, play_count integer, first_score_at timestamp with time zone, metadata jsonb)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='sql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='2bbc2babf1e55573a7c15031af7aa4e40dfde8b97aee62d1067f86d6b2db7cad')
    THEN RAISE EXCEPTION 'RPC/ACL drift: get_first_try_ranking_with_metadata'; END IF;
GRANT EXECUTE ON FUNCTION public.get_first_try_ranking_with_metadata(text,integer) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_first_try_ranking_with_metadata(text,integer) FROM PUBLIC;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_first_try_ranking_with_metadata(text,integer)');
  IF actual IS DISTINCT FROM '[{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false},{"role":"service_role","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_first_try_ranking_with_metadata(text,integer)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_game_slug text, p_limit integer DEFAULT 10' AND pg_get_function_result(p.oid)='TABLE(rank_no integer, display_name text, first_score integer, play_count integer, first_score_at timestamp with time zone, metadata jsonb)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='sql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='2bbc2babf1e55573a7c15031af7aa4e40dfde8b97aee62d1067f86d6b2db7cad')
    THEN RAISE EXCEPTION 'RPC/ACL drift: get_first_try_ranking_with_metadata'; END IF;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_game_ranking(text,integer)');
  IF actual IS DISTINCT FROM '[{"role":"PUBLIC","grantor":"postgres","grantable":false},{"role":"anon","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_game_ranking(text,integer)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_game_slug text, p_limit integer DEFAULT 100' AND pg_get_function_result(p.oid)='TABLE(rank_no integer, display_name text, best_score integer, play_count integer, best_score_at timestamp with time zone)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='plpgsql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='f51d0e3c8398b87996df8f0c7437e11b9c48adf2148b21680c86265b24119553')
    THEN RAISE EXCEPTION 'RPC/ACL drift: get_game_ranking'; END IF;
GRANT EXECUTE ON FUNCTION public.get_game_ranking(text,integer) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_game_ranking(text,integer) FROM PUBLIC;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_game_ranking(text,integer)');
  IF actual IS DISTINCT FROM '[{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false},{"role":"service_role","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_game_ranking(text,integer)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_game_slug text, p_limit integer DEFAULT 100' AND pg_get_function_result(p.oid)='TABLE(rank_no integer, display_name text, best_score integer, play_count integer, best_score_at timestamp with time zone)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='plpgsql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='f51d0e3c8398b87996df8f0c7437e11b9c48adf2148b21680c86265b24119553')
    THEN RAISE EXCEPTION 'RPC/ACL drift: get_game_ranking'; END IF;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_player_score_summary_with_metadata(text,text)');
  IF actual IS DISTINCT FROM '[{"role":"PUBLIC","grantor":"postgres","grantable":false},{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_player_score_summary_with_metadata(text,text)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_game_slug text, p_normalized_name text' AND pg_get_function_result(p.oid)='TABLE(display_name text, first_score integer, best_score integer, play_count integer, first_score_at timestamp with time zone, best_score_at timestamp with time zone, first_metadata jsonb, best_metadata jsonb)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='sql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='77e42ebe6dd5f1c6d06e67b961f0af9554158be0d64105bfe6c6b9bcff35bf25')
    THEN RAISE EXCEPTION 'RPC/ACL drift: get_player_score_summary_with_metadata'; END IF;
GRANT EXECUTE ON FUNCTION public.get_player_score_summary_with_metadata(text,text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_player_score_summary_with_metadata(text,text) FROM PUBLIC;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_player_score_summary_with_metadata(text,text)');
  IF actual IS DISTINCT FROM '[{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false},{"role":"service_role","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.get_player_score_summary_with_metadata(text,text)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_game_slug text, p_normalized_name text' AND pg_get_function_result(p.oid)='TABLE(display_name text, first_score integer, best_score integer, play_count integer, first_score_at timestamp with time zone, best_score_at timestamp with time zone, first_metadata jsonb, best_metadata jsonb)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='sql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='77e42ebe6dd5f1c6d06e67b961f0af9554158be0d64105bfe6c6b9bcff35bf25')
    THEN RAISE EXCEPTION 'RPC/ACL drift: get_player_score_summary_with_metadata'; END IF;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.record_game_play(text,text,text,text)');
  IF actual IS DISTINCT FROM '[{"role":"PUBLIC","grantor":"postgres","grantable":false},{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.record_game_play(text,text,text,text)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_display_name text, p_game_slug text, p_result_type text DEFAULT ''play''::text, p_client_version text DEFAULT NULL::text' AND pg_get_function_result(p.oid)='jsonb'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='plpgsql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=\"\""]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='71e73b5df6071bb810fee94b38a7fad8e68f50a07267258a2b9942900ec1007d')
    THEN RAISE EXCEPTION 'RPC/ACL drift: record_game_play'; END IF;
GRANT EXECUTE ON FUNCTION public.record_game_play(text,text,text,text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.record_game_play(text,text,text,text) FROM PUBLIC;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.record_game_play(text,text,text,text)');
  IF actual IS DISTINCT FROM '[{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false},{"role":"service_role","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.record_game_play(text,text,text,text)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_display_name text, p_game_slug text, p_result_type text DEFAULT ''play''::text, p_client_version text DEFAULT NULL::text' AND pg_get_function_result(p.oid)='jsonb'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='plpgsql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=\"\""]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='71e73b5df6071bb810fee94b38a7fad8e68f50a07267258a2b9942900ec1007d')
    THEN RAISE EXCEPTION 'RPC/ACL drift: record_game_play'; END IF;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.record_play_event(text,text,text,integer,integer,integer,text,text)');
  IF actual IS DISTINCT FROM '[{"role":"PUBLIC","grantor":"postgres","grantable":false},{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.record_play_event(text,text,text,integer,integer,integer,text,text)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_ranking_score integer DEFAULT NULL::integer, p_client_version text DEFAULT ''''::text, p_play_id text DEFAULT NULL::text' AND pg_get_function_result(p.oid)='jsonb'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='plpgsql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='a6efa677c2997c24d753c340055c8ba61d399aeb948708b08519fb343ad2454d')
    THEN RAISE EXCEPTION 'RPC/ACL drift: record_play_event'; END IF;
GRANT EXECUTE ON FUNCTION public.record_play_event(text,text,text,integer,integer,integer,text,text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.record_play_event(text,text,text,integer,integer,integer,text,text) FROM PUBLIC;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.record_play_event(text,text,text,integer,integer,integer,text,text)');
  IF actual IS DISTINCT FROM '[{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false},{"role":"service_role","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.record_play_event(text,text,text,integer,integer,integer,text,text)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_ranking_score integer DEFAULT NULL::integer, p_client_version text DEFAULT ''''::text, p_play_id text DEFAULT NULL::text' AND pg_get_function_result(p.oid)='jsonb'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='plpgsql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='a6efa677c2997c24d753c340055c8ba61d399aeb948708b08519fb343ad2454d')
    THEN RAISE EXCEPTION 'RPC/ACL drift: record_play_event'; END IF;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.submit_hito_wo_yurusuna_score(text,integer,integer,text)');
  IF actual IS DISTINCT FROM '[{"role":"PUBLIC","grantor":"postgres","grantable":false},{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.submit_hito_wo_yurusuna_score(text,integer,integer,text)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_display_name text, p_score integer, p_clear_wave integer, p_client_version text DEFAULT ''''::text' AND pg_get_function_result(p.oid)='TABLE(accepted boolean, result_normalized_name text, result_display_name text, result_first_score integer, result_best_score integer, result_play_count integer, is_first_play boolean, is_new_best boolean, result_clear_wave integer, result_first_clear_wave integer, result_best_clear_wave integer)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='plpgsql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='6fe9f35681179d6b106ce81df79344b12663984b548cadccc1d89119ccd56e6b')
    THEN RAISE EXCEPTION 'RPC/ACL drift: submit_hito_wo_yurusuna_score'; END IF;
GRANT EXECUTE ON FUNCTION public.submit_hito_wo_yurusuna_score(text,integer,integer,text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.submit_hito_wo_yurusuna_score(text,integer,integer,text) FROM PUBLIC;
SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure('public.submit_hito_wo_yurusuna_score(text,integer,integer,text)');
  IF actual IS DISTINCT FROM '[{"role":"anon","grantor":"postgres","grantable":false},{"role":"authenticated","grantor":"postgres","grantable":false},{"role":"postgres","grantor":"postgres","grantable":false},{"role":"service_role","grantor":"postgres","grantable":false}]'::jsonb OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('public.submit_hito_wo_yurusuna_score(text,integer,integer,text)')
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)='p_display_name text, p_score integer, p_clear_wave integer, p_client_version text DEFAULT ''''::text' AND pg_get_function_result(p.oid)='TABLE(accepted boolean, result_normalized_name text, result_display_name text, result_first_score integer, result_best_score integer, result_play_count integer, is_first_play boolean, is_new_best boolean, result_clear_wave integer, result_first_clear_wave integer, result_best_clear_wave integer)'
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)='plpgsql'
    AND p.proisstrict=false
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)='["search_path=public"]'::jsonb
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='6fe9f35681179d6b106ce81df79344b12663984b548cadccc1d89119ccd56e6b')
    THEN RAISE EXCEPTION 'RPC/ACL drift: submit_hito_wo_yurusuna_score'; END IF;
END $scoped_acl$;
COMMIT;
