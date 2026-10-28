-- APPROVAL B REQUIRED. Fixed public opaque contract API; no application RPC is executed.
-- Project mlpnjgezrnhdxsxolyzj. No changes to existing game routine ACLs or PUBLIC privileges.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
DO $owner$ BEGIN IF current_user<>'postgres' OR current_database()<>'postgres' THEN RAISE EXCEPTION 'approved postgres apply owner required'; END IF; END $owner$;
CREATE ROLE takkeu_release_inspector NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
-- PG17 nonsuperuser CREATEROLE grants ADMIN automatically, but not SET.
-- Enable creator SET only until ownership transfer; keep INHERIT disabled.
GRANT takkeu_release_inspector TO postgres WITH INHERIT FALSE, SET TRUE;
GRANT USAGE ON SCHEMA public, supabase_migrations TO takkeu_release_inspector;
GRANT SELECT(version,name) ON supabase_migrations.schema_migrations TO takkeu_release_inspector;
GRANT SELECT(game_slug,is_active,submission_mode,score_order,score_min,score_max) ON public.games TO takkeu_release_inspector;
CREATE POLICY takkeu_release_inspector_config ON public.games FOR SELECT TO takkeu_release_inspector USING(game_slug='takkeu');
CREATE FUNCTION public.get_takkeu_release_contract_v1() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog SET statement_timeout='15s' SET lock_timeout='3s' SET row_security=on
AS $inspector$
DECLARE snapshot jsonb; field text; fingerprints jsonb := '{}'::jsonb; self jsonb;
BEGIN
  IF current_setting('request.method',true) IS DISTINCT FROM 'GET'
     OR current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'read-only GET required' USING ERRCODE='25006';
  END IF;
  SELECT jsonb_build_object(
 'format',1, 'project','mlpnjgezrnhdxsxolyzj',
 'observed_at',clock_timestamp(),
 'read_only',current_setting('transaction_read_only')='on',
 'migrations',COALESCE((SELECT jsonb_agg(jsonb_build_object('version',version,'name',name) ORDER BY version) FROM supabase_migrations.schema_migrations WHERE version IN ('20261027032043')), '[]'::jsonb),
 -- Event handlers execute automatically, even without caller USAGE/EXECUTE.
 -- Pin all registrations and bodies, including disabled handlers and tags.
 'event_triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'name',e.evtname,'owner',pg_get_userbyid(e.evtowner),'event',e.evtevent,'enabled',e.evtenabled,'tags',e.evttags,
   'function_schema',n.nspname,'function_name',p.proname,'function_args',pg_get_function_identity_arguments(p.oid),
   'arguments',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'source',p.prosrc,
   'language',l.lanname,'definer',p.prosecdef,'function_owner',pg_get_userbyid(p.proowner),'config',p.proconfig,
   'volatility',p.provolatile,'strict',p.proisstrict) ORDER BY e.evtname)
   FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang),'[]'::jsonb),
 'game',(SELECT jsonb_build_object('game_slug',game_slug,'is_active',is_active,'submission_mode',submission_mode,'score_order',score_order,'score_min',score_min,'score_max',score_max) FROM public.games WHERE game_slug='takkeu'),
 'tables',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
   'columns',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attname) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'[]'::jsonb),
   'column_acls',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',a.attname,'acl',a.attacl::text[]) ORDER BY a.attname) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped AND cardinality(a.attacl)>0),'[]'::jsonb),
   'constraints',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',co.conname,'validated',co.convalidated,'definition',pg_get_constraintdef(co.oid)) ORDER BY co.conname) FROM pg_constraint co WHERE co.conrelid=c.oid AND co.contype<>'n'),'[]'::jsonb),
   'indexes',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',ic.relname,'valid',i.indisvalid,'ready',i.indisready,'definition',pg_get_indexdef(i.indexrelid)) ORDER BY ic.relname) FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),'[]'::jsonb),
   'policies',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',pol.policyname,'permissive',pol.permissive,'roles',pol.roles,'cmd',pol.cmd,'qual',pol.qual,'with_check',pol.with_check) ORDER BY pol.policyname) FROM pg_policies pol WHERE pol.schemaname=n.nspname AND pol.tablename=c.relname),'[]'::jsonb),
   'triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),'[]'::jsonb),
   'privileges',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'usage',has_schema_privilege(r.oid,n.oid,'USAGE'),'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_table_privilege(r.oid,c.oid,'INSERT'),'update',has_table_privilege(r.oid,c.oid,'UPDATE'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'),'truncate',has_table_privilege(r.oid,c.oid,'TRUNCATE'),'references',has_table_privilege(r.oid,c.oid,'REFERENCES'),'trigger',has_table_privilege(r.oid,c.oid,'TRIGGER'),'maintain',has_table_privilege(r.oid,c.oid,'MAINTAIN')) ORDER BY r.rolname) FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role'))
 ) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND ((n.nspname='public' AND c.relname IN ('players','game_scores','score_runs','takkeu_hall_of_fame','takkeu_hall_of_fame_3500')) OR (n.nspname='private' AND c.relname IN ('game_play_sessions','takkeu_hall_counter_v1','takkeu_hall_counter_3500_v1','takkeu_progress_v1','takkeu_progress_signals_v1','takkeu_guest_plays_v1')))), '[]'::jsonb),
 'functions',COALESCE((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'arguments',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'source',p.prosrc,'language',l.lanname,'definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'volatility',p.provolatile,'strict',p.proisstrict,
   'privileges',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'execute',has_function_privilege(r.oid,p.oid,'EXECUTE')) ORDER BY r.rolname) FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')),
   'public_execute',EXISTS(SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE (n.nspname='public' AND p.proname IN ('normalize_player_name','start_game_play_v1','finish_game_play_v1','finish_takkeu_play_v2','submit_score_idempotent_v1','start_takkeu_guest_play_v1','report_takkeu_progress_v1','get_best_score_ranking','get_takkeu_player_position_v1','start_takkeu_clear_play_v1','start_takkeu_clear_play_v2','finish_takkeu_clear_play_v1','finish_takkeu_clear_play_v2','register_takkeu_hall_v1','register_takkeu_hall_v2','get_takkeu_hall_v1','get_takkeu_hall_v2')) OR (n.nspname='private' AND p.proname IN ('enforce_takkeu_3500_result_v1','enforce_takkeu_3500_score_v1','attach_takkeu_final_losses_v1','guard_verified_score_write','guard_sabasaba_score_runs'))),'[]'::jsonb),
 'readonly_routines',COALESCE((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'arguments',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'source',p.prosrc,'language',l.lanname,'definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'volatility',p.provolatile,'strict',p.proisstrict,
   'privileges',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'execute',has_function_privilege(r.oid,p.oid,'EXECUTE')) ORDER BY r.rolname) FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')),
   'public_execute',EXISTS(SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE (n.nspname='public' AND p.proname IN ('get_disqualified_score_entries','get_first_try_ranking','get_game_play_stats','get_hito_wo_yurusuna_best_ranking','get_hito_wo_yurusuna_first_ranking','get_play_count_ranking','normalize_player_name')) OR (n.nspname='private' AND p.proname='get_game_player_counts_v1')),'[]'::jsonb)
) INTO snapshot;
  FOREACH field IN ARRAY ARRAY['functions','readonly_routines','event_triggers'] LOOP
    snapshot := jsonb_set(snapshot,ARRAY[field],(SELECT jsonb_agg((f-'source') || jsonb_build_object('body',
      encode(sha256(convert_to(replace(f->>'source',chr(13)||chr(10),chr(10)),'UTF8')),'hex')) ORDER BY ord)
      FROM jsonb_array_elements(snapshot->field) WITH ORDINALITY e(f,ord)));
  END LOOP;
  FOREACH field IN ARRAY ARRAY['migrations','game','tables','functions','readonly_routines','event_triggers'] LOOP
    fingerprints := fingerprints || jsonb_build_object(field,encode(sha256(convert_to((snapshot->field)::text,'UTF8')),'hex'));
  END LOOP;
  SELECT jsonb_build_object('body_sha256',encode(sha256(convert_to(replace(p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex'),
    'owner',r.rolname,'owner_login',r.rolcanlogin,'owner_super',r.rolsuper,'owner_bypassrls',r.rolbypassrls,
    'owner_createdb',r.rolcreatedb,'owner_createrole',r.rolcreaterole,'owner_replication',r.rolreplication,'owner_inherit',r.rolinherit,
    'owner_memberships',(SELECT count(*) FROM pg_auth_members m WHERE m.member=r.oid),
    -- Pin incoming as well as outgoing memberships, including effective flags.
    -- CREATEROLE's automatic grantor can differ from the explicit grantor.
    'owner_callers',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',pg_get_userbyid(m.member),
      'admin',m.admin,'inherit',m.inherit,'set',m.set) ORDER BY pg_get_userbyid(m.member)),'[]'::jsonb)
      FROM (SELECT member,bool_or(admin_option) admin,bool_or(inherit_option) inherit,bool_or(set_option) set FROM pg_auth_members WHERE roleid=r.oid GROUP BY member) m),
    'owner_schema_create',has_schema_privilege(r.oid,'public','CREATE'),
    'owner_direct_acl',(SELECT coalesce(jsonb_agg(v ORDER BY v COLLATE "C"),'[]'::jsonb) FROM (
      SELECT 'schema:'||ns.nspname||':'||a.privilege_type||':'||a.is_grantable::text v FROM pg_namespace ns CROSS JOIN LATERAL aclexplode(ns.nspacl) a WHERE a.grantee=r.oid
      UNION ALL SELECT 'relation:'||ns.nspname||'.'||c.relname||':'||a.privilege_type||':'||a.is_grantable::text FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE a.grantee=r.oid
      UNION ALL SELECT 'column:'||ns.nspname||'.'||c.relname||':'||at.attname||':'||a.privilege_type||':'||a.is_grantable::text FROM pg_attribute at JOIN pg_class c ON c.oid=at.attrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(at.attacl) a WHERE a.grantee=r.oid
      UNION ALL SELECT 'function:'||ns.nspname||'.'||f.proname||'('||pg_get_function_identity_arguments(f.oid)||'):'||a.privilege_type||':'||a.is_grantable::text FROM pg_proc f JOIN pg_namespace ns ON ns.oid=f.pronamespace CROSS JOIN LATERAL aclexplode(f.proacl) a WHERE a.grantee=r.oid AND f.proowner<>r.oid
      UNION ALL SELECT 'database:'||d.datname||':'||a.privilege_type||':'||a.is_grantable::text FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) a WHERE a.grantee=r.oid
    ) grants),
    'migration_applied',EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version='20261028124434' AND name='takkeu_release_rest_inspector'),
    'config_table_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.games'::regclass),
    'config_policy',(SELECT jsonb_build_object('permissive',polpermissive,'cmd',polcmd,'roles',polroles::oid[]::text,'qual',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) - 'roles' || jsonb_build_object('roles',(SELECT jsonb_agg(pg_get_userbyid(v) ORDER BY pg_get_userbyid(v)) FROM unnest(polroles) v)) FROM pg_policy WHERE polrelid='public.games'::regclass AND polname='takkeu_release_inspector_config'),
    'language',l.lanname,'volatility',p.provolatile,'definer',p.prosecdef,'strict',p.proisstrict,
    'config',p.proconfig,'args',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),
    'public_execute',EXISTS(SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'),
    'privileges',(SELECT jsonb_agg(jsonb_build_object('role',gr.rolname,'execute',has_function_privilege(gr.oid,p.oid,'EXECUTE')) ORDER BY gr.rolname)
      FROM pg_roles gr WHERE gr.rolname IN ('anon','authenticated','service_role')))
  INTO self FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
  WHERE n.nspname='public' AND p.proname='get_takkeu_release_contract_v1' AND p.pronargs=0;
  RETURN jsonb_build_object('format',2,'project','mlpnjgezrnhdxsxolyzj','read_only',true,
    'nonce',current_setting('request.headers',true)::jsonb->>'x-takkeu-probe','observed_at',clock_timestamp(),
    'fingerprints',fingerprints,'inspector_sha256',encode(sha256(convert_to(self::text,'UTF8')),'hex'));
END;
$inspector$;
REVOKE ALL ON FUNCTION public.get_takkeu_release_contract_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_takkeu_release_contract_v1() TO anon,authenticated,service_role;
-- Transfer needs CREATE on the schema; remove it within this uncommitted transaction.
GRANT CREATE ON SCHEMA public TO takkeu_release_inspector;
ALTER FUNCTION public.get_takkeu_release_contract_v1() OWNER TO takkeu_release_inspector;
REVOKE CREATE ON SCHEMA public FROM takkeu_release_inspector;
GRANT takkeu_release_inspector TO postgres WITH INHERIT FALSE, SET FALSE;
INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('20261028124434','takkeu_release_rest_inspector');
NOTIFY pgrst,'reload schema';
COMMIT;
