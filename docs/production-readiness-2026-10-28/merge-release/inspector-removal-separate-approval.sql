-- RECOVERY PROPOSAL ONLY. Requires separate explicit approval; never run automatically.
-- Removes only the newly added inspector, after exact catalog/security checks.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'; SET LOCAL search_path=pg_catalog;
DO $remove_check$ DECLARE actual jsonb; BEGIN
  IF current_user<>'postgres' OR current_database()<>'postgres' THEN RAISE EXCEPTION 'approved postgres recovery owner required'; END IF;
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
  INTO actual FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
  WHERE n.nspname='public' AND p.proname='get_takkeu_release_contract_v1' AND p.pronargs=0;

  IF actual IS DISTINCT FROM '{"body_sha256":"a3b54c0ef6f284a38df472ebad9f68ae84f6432ef63efbaf115162aea7447475","owner":"takkeu_release_inspector","owner_login":false,"owner_super":false,"owner_bypassrls":false,"owner_createdb":false,"owner_createrole":false,"owner_replication":false,"owner_inherit":false,"owner_memberships":0,"owner_callers":[{"role":"postgres","admin":true,"inherit":false,"set":false}],"owner_schema_create":false,"owner_direct_acl":["column:public.games:game_slug:SELECT:false","column:public.games:is_active:SELECT:false","column:public.games:score_max:SELECT:false","column:public.games:score_min:SELECT:false","column:public.games:score_order:SELECT:false","column:public.games:submission_mode:SELECT:false","column:supabase_migrations.schema_migrations:name:SELECT:false","column:supabase_migrations.schema_migrations:version:SELECT:false","schema:public:USAGE:false","schema:supabase_migrations:USAGE:false"],"migration_applied":true,"config_table_rls":true,"config_policy":{"permissive":true,"cmd":"r","roles":["takkeu_release_inspector"],"qual":"(game_slug = ''takkeu''::text)","check":null},"language":"plpgsql","volatility":"s","definer":true,"strict":false,"config":["search_path=pg_catalog","statement_timeout=15s","lock_timeout=3s","row_security=on"],"args":"","result":"jsonb","public_execute":false,"privileges":[{"role":"anon","execute":true},{"role":"authenticated","execute":true},{"role":"service_role","execute":true}]}'::jsonb THEN RAISE EXCEPTION 'inspector changed; recovery requires fresh review'; END IF;
END $remove_check$;
GRANT takkeu_release_inspector TO postgres WITH INHERIT FALSE, SET TRUE;
SET LOCAL ROLE takkeu_release_inspector;
DROP FUNCTION public.get_takkeu_release_contract_v1();
RESET ROLE;
DROP POLICY takkeu_release_inspector_config ON public.games;
REVOKE SELECT(game_slug,is_active,submission_mode,score_order,score_min,score_max) ON public.games FROM takkeu_release_inspector;
REVOKE SELECT(version,name) ON supabase_migrations.schema_migrations FROM takkeu_release_inspector;
REVOKE USAGE ON SCHEMA public,supabase_migrations FROM takkeu_release_inspector;
-- Unknown dependencies stop this transaction; never DROP OWNED or CASCADE.
DROP ROLE takkeu_release_inspector;
DELETE FROM supabase_migrations.schema_migrations WHERE version='20261028124434' AND name='takkeu_release_rest_inspector';
NOTIFY pgrst,'reload schema';
COMMIT;
