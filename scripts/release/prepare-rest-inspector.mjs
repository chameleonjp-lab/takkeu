// OFFLINE generator only. No connection, credential, arbitrary identifier or SQL input.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './guards.mjs';

export const INSPECTOR='get_takkeu_release_contract_v1';
export const INSPECTOR_OWNER='takkeu_release_inspector';
export const INSPECTOR_MIGRATION='20261028124434';
export const inspectorMigrationFile=`supabase/migrations/${INSPECTOR_MIGRATION}_takkeu_release_rest_inspector.sql`;
export function inspectorSource() {
  const catalog=readFileSync('scripts/release/catalog.sql','utf8');
  let query=catalog.slice(catalog.indexOf('SELECT jsonb_build_object('),catalog.lastIndexOf('ROLLBACK;')).trim();
  // The old all-capabilities proof concerns a DB login, which this API never gives
  // callers. Keep its entire catalog contract, excluding only the login proof.
  query=query.slice(0,query.indexOf(" 'least_privilege',"))+query.slice(query.indexOf(" 'migrations',"));
  return `
DECLARE snapshot jsonb; field text; fingerprints jsonb := '{}'::jsonb; self jsonb;
BEGIN
  IF current_setting('request.method',true) IS DISTINCT FROM 'GET'
     OR current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'read-only GET required' USING ERRCODE='25006';
  END IF;
  ${query.replace(/;$/,' INTO snapshot;')}
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
    'migration_applied',EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version='${INSPECTOR_MIGRATION}' AND name='takkeu_release_rest_inspector'),
    'config_table_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.games'::regclass),
    'config_policy',(SELECT jsonb_build_object('permissive',polpermissive,'cmd',polcmd,'roles',polroles::oid[]::text,'qual',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) - 'roles' || jsonb_build_object('roles',(SELECT jsonb_agg(pg_get_userbyid(v) ORDER BY pg_get_userbyid(v)) FROM unnest(polroles) v)) FROM pg_policy WHERE polrelid='public.games'::regclass AND polname='takkeu_release_inspector_config'),
    'language',l.lanname,'volatility',p.provolatile,'definer',p.prosecdef,'strict',p.proisstrict,
    'config',p.proconfig,'args',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),
    'public_execute',EXISTS(SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'),
    'privileges',(SELECT jsonb_agg(jsonb_build_object('role',gr.rolname,'execute',has_function_privilege(gr.oid,p.oid,'EXECUTE')) ORDER BY gr.rolname)
      FROM pg_roles gr WHERE gr.rolname IN ('anon','authenticated','service_role')))
  INTO self FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
  WHERE n.nspname='public' AND p.proname='${INSPECTOR}' AND p.pronargs=0;
  RETURN jsonb_build_object('format',2,'project','mlpnjgezrnhdxsxolyzj','read_only',true,
    'nonce',current_setting('request.headers',true)::jsonb->>'x-takkeu-probe','observed_at',clock_timestamp(),
    'fingerprints',fingerprints,'inspector_sha256',encode(sha256(convert_to(self::text,'UTF8')),'hex'));
END;
`;
}
export function inspectorMetadata() {
  return {body_sha256:digest(inspectorSource()),owner:INSPECTOR_OWNER,owner_login:false,owner_super:false,owner_bypassrls:false,
    owner_createdb:false,owner_createrole:false,owner_replication:false,owner_inherit:false,owner_memberships:0,
    owner_callers:[{role:'postgres',admin:true,inherit:false,set:false}],owner_schema_create:false,
    owner_direct_acl:[...['game_slug','is_active','submission_mode','score_order','score_min','score_max'].map(c=>`column:public.games:${c}:SELECT`),...['version','name'].map(c=>`column:supabase_migrations.schema_migrations:${c}:SELECT`),'schema:public:USAGE','schema:supabase_migrations:USAGE'].map(v=>v+':false').sort(),
    migration_applied:true,config_table_rls:true,config_policy:{permissive:true,cmd:'r',roles:[INSPECTOR_OWNER],qual:"(game_slug = 'takkeu'::text)",check:null},
    language:'plpgsql',volatility:'s',definer:true,strict:false,
    config:['search_path=pg_catalog','statement_timeout=15s','lock_timeout=3s','row_security=on'],args:'',result:'jsonb',public_execute:false,
    privileges:['anon','authenticated','service_role'].map(role=>({role,execute:true}))};
}
export function prepareInspectorSql() {
  return `-- APPROVAL B REQUIRED. Fixed public opaque contract API; no application RPC is executed.
-- Project mlpnjgezrnhdxsxolyzj. No changes to existing game routine ACLs or PUBLIC privileges.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
DO $owner$ BEGIN IF current_user<>'postgres' OR current_database()<>'postgres' THEN RAISE EXCEPTION 'approved postgres apply owner required'; END IF; END $owner$;
CREATE ROLE ${INSPECTOR_OWNER} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
-- PG17 nonsuperuser CREATEROLE grants ADMIN automatically, but not SET.
-- Enable creator SET only until ownership transfer; keep INHERIT disabled.
GRANT ${INSPECTOR_OWNER} TO postgres WITH INHERIT FALSE, SET TRUE;
GRANT USAGE ON SCHEMA public, supabase_migrations TO ${INSPECTOR_OWNER};
GRANT SELECT(version,name) ON supabase_migrations.schema_migrations TO ${INSPECTOR_OWNER};
GRANT SELECT(game_slug,is_active,submission_mode,score_order,score_min,score_max) ON public.games TO ${INSPECTOR_OWNER};
CREATE POLICY takkeu_release_inspector_config ON public.games FOR SELECT TO ${INSPECTOR_OWNER} USING(game_slug='takkeu');
CREATE FUNCTION public.${INSPECTOR}() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog SET statement_timeout='15s' SET lock_timeout='3s' SET row_security=on
AS $inspector$${inspectorSource()}$inspector$;
REVOKE ALL ON FUNCTION public.${INSPECTOR}() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.${INSPECTOR}() TO anon,authenticated,service_role;
-- Transfer needs CREATE on the schema; remove it within this uncommitted transaction.
GRANT CREATE ON SCHEMA public TO ${INSPECTOR_OWNER};
ALTER FUNCTION public.${INSPECTOR}() OWNER TO ${INSPECTOR_OWNER};
REVOKE CREATE ON SCHEMA public FROM ${INSPECTOR_OWNER};
GRANT ${INSPECTOR_OWNER} TO postgres WITH INHERIT FALSE, SET FALSE;
INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${INSPECTOR_MIGRATION}','takkeu_release_rest_inspector');
NOTIFY pgrst,'reload schema';
COMMIT;
`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const out=resolve(process.argv[2]??'artifacts/merge-release/proposals');mkdirSync(out,{recursive:true});
  const sql=prepareInspectorSql();writeFileSync(resolve(out,'inspector-approved-only.sql'),sql);
  console.log(`inspector-approved-only.sql sha256=${digest(sql)}`);
}
