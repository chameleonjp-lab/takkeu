// OFFLINE ONLY. Generates reviewable SQL; never opens a DB or invokes a shell.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = value => createHash('sha256').update(value).digest('hex');
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${literal(JSON.stringify(value))}::jsonb`;
const header = '-- PROPOSAL ONLY: requires independent production approval. Project mlpnjgezrnhdxsxolyzj.\n';
const ownerCheck = "IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN RAISE EXCEPTION 'approved apply owner/database required'; END IF;";
const load = path => JSON.parse(readFileSync(path, 'utf8'));
const dataFingerprint = `SELECT jsonb_build_object(
  'games',(SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY game_slug)) FROM public.games t),
  'players',(SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY normalized_name)) FROM public.players t),
  'scores',(SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY normalized_name,game_slug)) FROM public.game_scores t),
  'runs',(SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id)) FROM public.score_runs t),
  'sessions',(SELECT md5(string_agg(md5((to_jsonb(t)-'takkeu_rules_version'-'takkeu_clear_verified')::text),'' ORDER BY play_id)) FROM private.game_play_sessions t))`;

function catalogAssertion(expected, label) {
  const sql = readFileSync('scripts/release/catalog.sql', 'utf8');
  const query = sql.slice(sql.indexOf('SELECT jsonb_build_object('), sql.lastIndexOf('ROLLBACK;')).trim();
  return `${query.replace(/;$/, ' INTO actual;')}
  FOREACH field IN ARRAY ARRAY['functions','readonly_routines','event_triggers'] LOOP
  actual := jsonb_set(actual,ARRAY[field],(SELECT jsonb_agg((f-'source') || jsonb_build_object('body',
    encode(sha256(convert_to(replace(f->>'source',chr(13)||chr(10),chr(10)),'UTF8')),'hex')) ORDER BY ord)
    FROM jsonb_array_elements(actual->field) WITH ORDINALITY e(f,ord)));
  END LOOP;
  expected := ${json(expected)};
  FOREACH field IN ARRAY ARRAY['migrations','game','tables','functions','readonly_routines','event_triggers'] LOOP
    IF actual->field IS DISTINCT FROM expected->field THEN RAISE EXCEPTION '${label} contract mismatch: %',field; END IF;
  END LOOP;`;
}

export function prepareMigrationSql() {
  const contract = load('scripts/release/expected-contract.json');
  const baseline = load('scripts/release/production-baseline.json');
  const payload = readFileSync(contract.migration_file, 'utf8');
  const hash = sha(payload);
  if (hash !== 'b6a9828852e3b87840348814559353dec8b0286d6d6642dee7952b4fe9ef009b'
    || hash !== contract.migration_sha256) throw Error('Reviewed migration SHA256 mismatch');
  const tag = `$payload_${hash.slice(0,16)}$`;
  return `${header}-- Migration SHA256 ${hash}. No role/ACL preparation is implied by approval A.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL search_path=pg_catalog;
DO $apply_hall$
DECLARE actual jsonb; expected jsonb; field text; before_data jsonb; after_data jsonb;
BEGIN
  ${ownerCheck}
  IF NOT pg_try_advisory_xact_lock(hashtextextended('takkeu:20261027032043',0)) THEN RAISE EXCEPTION 'another target apply is active'; END IF;
  IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE
    (n.nspname='public' AND c.relname IN ('takkeu_hall_of_fame','takkeu_hall_of_fame_3500')) OR
    (n.nspname='private' AND c.relname IN ('takkeu_hall_counter_v1','takkeu_hall_counter_3500_v1')))
    OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.proname IN
      ('start_takkeu_clear_play_v1','start_takkeu_clear_play_v2','finish_takkeu_clear_play_v1','finish_takkeu_clear_play_v2',
       'register_takkeu_hall_v1','register_takkeu_hall_v2','get_takkeu_hall_v1','get_takkeu_hall_v2','enforce_takkeu_3500_result_v1','enforce_takkeu_3500_score_v1'))
    THEN RAISE EXCEPTION 'collision or partial application; investigate first'; END IF;
  ${catalogAssertion(baseline, 'pre-apply')}
  ${dataFingerprint} INTO before_data;
  EXECUTE ${tag}
${payload}
${tag};
  INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('20261027032043','takkeu_hall_of_fame');
  ${catalogAssertion(contract, 'post-apply')}
  ${dataFingerprint} INTO after_data;
  IF before_data IS DISTINCT FROM after_data THEN RAISE EXCEPTION 'changed existing business rows'; END IF;
  IF (SELECT count(*) FROM public.takkeu_hall_of_fame)<>0 OR (SELECT count(*) FROM public.takkeu_hall_of_fame_3500)<>0
    OR (SELECT next_number FROM private.takkeu_hall_counter_v1 WHERE singleton) IS DISTINCT FROM 1
    OR (SELECT next_number FROM private.takkeu_hall_counter_3500_v1 WHERE singleton) IS DISTINCT FROM 1
    THEN RAISE EXCEPTION 'new ledger initialization mismatch'; END IF;
END $apply_hall$;
COMMIT;
`;
}

const names = new Set(['check_player_name','get_game_ranking','get_best_score_ranking_with_metadata',
  'get_first_try_ranking_with_metadata','get_player_score_summary_with_metadata','record_game_play','record_play_event','submit_hito_wo_yurusuna_score']);
// Match PostgreSQL COLLATE "C", including uppercase PUBLIC before role names.
const sortAcl = rows => rows.sort((a,b)=>a.role<b.role?-1:a.role>b.role?1:Number(a.grantable)-Number(b.grantable));
const aclQuery = `SELECT COALESCE(jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable)
  ORDER BY COALESCE(r.rolname,'PUBLIC') COLLATE "C",a.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE'`;
function permissionAssert(target, acl) {
  return `SELECT (${aclQuery}) INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure(${literal(target.signature)});
  IF actual IS DISTINCT FROM ${json(acl)} OR NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure(${literal(target.signature)})
    AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='v'
    AND pg_get_function_arguments(p.oid)=${literal(target.arguments)} AND pg_get_function_result(p.oid)=${literal(target.result)}
    AND (SELECT lanname FROM pg_language WHERE oid=p.prolang)=${literal(target.language)}
    AND p.proisstrict=${target.strict?'true':'false'}
    AND COALESCE(to_jsonb(p.proconfig),'null'::jsonb)=${json(target.config)}
    AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=${literal(target.source_sha256)})
    THEN RAISE EXCEPTION 'RPC/ACL drift: ${target.name}'; END IF;`;
}
export function preparePermissionSql() {
  const inventory = load('scripts/release/reviewed-public-rpcs.json');
  const targets = inventory.functions.filter(f=>f.schema==='public'&&names.has(f.name)).map(f=>{
    if(f.owner!=='postgres'||!f.definer||f.volatility!=='v'||!f.public_execute)throw Error('Unreviewed permission target');
    const signature=`public.${f.name}(${f.identity_args.split(', ').map(a=>a.replace(/^p_\w+ /,'')).join(',')})`;
    const original=sortAcl(f.acl.map(a=>{const m=/^([^=]*)=(X\*?)\/postgres$/.exec(a);if(!m)throw Error('Unreviewed ACL');return{role:m[1]||'PUBLIC',grantor:'postgres',grantable:m[2]==='X*'};}));
    const after=original.filter(a=>a.role!=='PUBLIC');
    for(const role of ['anon','authenticated','service_role'])if(!after.some(a=>a.role===role))after.push({role,grantor:'postgres',grantable:false});
    return{name:f.name,signature,arguments:f.arguments,result:f.result,language:f.language,config:f.config,strict:f.strict,source_sha256:f.source_sha256,original,after:sortAcl(after)};
  });
  if(targets.length!==8)throw Error('Expected exactly eight reviewed RPCs');
  const wrap=(title,parts)=>`${header}-- ${title}. Does not establish a fully readonly DB credential (large-object blocker remains).
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'; SET LOCAL search_path=pg_catalog;
DO $scoped_acl$ DECLARE actual jsonb; BEGIN
${ownerCheck}
${parts.join('\n')}
END $scoped_acl$;
COMMIT;
`;
  const apply=wrap('B1 scoped application RPC ACL proposal',targets.flatMap(t=>[permissionAssert(t,t.original),
    `GRANT EXECUTE ON FUNCTION ${t.signature} TO anon, authenticated, service_role;`,
    `REVOKE EXECUTE ON FUNCTION ${t.signature} FROM PUBLIC;`,permissionAssert(t,t.after)]));
  const restore=wrap('Restore exact reviewed original EXECUTE ACL (abort on drift)',targets.flatMap(t=>[permissionAssert(t,t.after),
    `REVOKE EXECUTE ON FUNCTION ${t.signature} FROM PUBLIC, anon, authenticated, service_role;`,
    ...t.original.filter(a=>a.role!=='postgres').map(a=>`GRANT EXECUTE ON FUNCTION ${t.signature} TO ${a.role==='PUBLIC'?'PUBLIC':`"${a.role}"`}${a.grantable?' WITH GRANT OPTION':''};`),permissionAssert(t,t.original)]));
  return{apply,restore,targets};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const output=resolve(process.argv[2]??'artifacts/production-preparation');mkdirSync(output,{recursive:true});
  const permissions=preparePermissionSql();
  for(const [name,sql] of Object.entries({'migration-approved-only.sql':prepareMigrationSql(),'scoped-public-approved-only.sql':permissions.apply,'restore-scoped-public-approved-only.sql':permissions.restore})){
    writeFileSync(resolve(output,name),sql);console.log(`${name} sha256=${sha(sql)}`);
  }
}
