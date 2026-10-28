// Disposable, socket-local PG17 and PostgREST only. Never accepts production credentials.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { prepareMigrationSql } from '../../scripts/release/prepare-production.mjs';
import { prepareInspectorSql, prepareInspectorRemovalSql, inspectorMetadata, INSPECTOR } from '../../scripts/release/prepare-rest-inspector.mjs';
import { fingerprintContract, expectedInspectorHash, verifyRpcRoutes } from '../../scripts/release/rest-contract.mjs';

const name=`takkeu-rest-${process.pid}`;const env={...process.env};
for(const k of Object.keys(env))if(k.startsWith('PG')||k.startsWith('DOCKER_'))delete env[k];
const docker=(args,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{env,input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024});
const query=sql=>docker(['exec','-i',name,'psql','-X','-q','-At','-v','ON_ERROR_STOP=1','-U','postgres'],sql).trim();
const bootstrap=sql=>docker(['exec','-i',name,'psql','-X','-q','-At','-v','ON_ERROR_STOP=1','-U','rest_test_admin','-d','postgres'],sql).trim();
const nonce=randomUUID();const request=`BEGIN READ ONLY; SET LOCAL ROLE anon; SET LOCAL request.method='GET'; SET LOCAL request.headers='{"x-takkeu-probe":"${nonce}"}'; SELECT public.${INSPECTOR}(); ROLLBACK;`;
const snapshot=()=>JSON.parse(query(request));
const expected=JSON.parse(readFileSync('scripts/release/expected-contract.json'));
const checks=[];const pass=name=>checks.push(name);
mkdirSync('artifacts/merge-release',{recursive:true});
let started=false;
try {
  docker(['run','-d','--rm','--name',name,'-p','127.0.0.1::3000','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER=rest_test_admin','-e','POSTGRES_DB=postgres','postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe']);started=true;
  const deadline=Date.now()+35000;
  for(;;){try{docker(['exec',name,'pg_isready','-h','127.0.0.1','-U','rest_test_admin']);break;}catch(e){if(Date.now()>deadline)throw e;await new Promise(r=>setTimeout(r,200));}}
  bootstrap('CREATE ROLE postgres LOGIN SUPERUSER CREATEROLE CREATEDB; ALTER DATABASE postgres OWNER TO postgres;');
  query(readFileSync('tests/sql/release-production-schema.sql','utf8'));
  // Supabase's application DDL owner is not a cluster superuser. Exercise PG17
  // CREATEROLE creator memberships/SET privileges under that real restriction.
  query('GRANT anon TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET TRUE; ALTER ROLE postgres NOSUPERUSER CREATEROLE CREATEDB;');
  const proposal=prepareInspectorSql();
  assert.throws(()=>query(proposal.replace(/^GRANT takkeu_release_inspector TO postgres WITH .*;$/gm,'')),error=>error.stderr?.includes('must be able to SET ROLE'));
  pass('without transaction-scoped creator SET, real nonsuperuser ownership transfer fails');
  assert.throws(()=>query(proposal.replace('NOTIFY pgrst',"SELECT 1/0; NOTIFY pgrst")));
  assert.equal(query("SELECT count(*) FROM pg_roles WHERE rolname='takkeu_release_inspector';"),'0');pass('late failure rolls back role, grants, policy and endpoint');
  query(proposal);pass('initial inspector apply');assert.throws(()=>query(proposal));pass('duplicate refuses');
  assert.deepEqual(snapshot().inspector_sha256,expectedInspectorHash());
  assert.notDeepEqual(snapshot().fingerprints,fingerprintContract(expected));pass('unapplied hall migration rejected');
  query(prepareMigrationSql());
  pass('both exact proposals apply with real NOSUPERUSER CREATEROLE owner');
  // The remaining intentional attack mutations need cluster-admin authority;
  // using it only after both real apply-owner paths have succeeded is deliberate.
  bootstrap('ALTER ROLE postgres SUPERUSER;');
  const result=snapshot();
  assert.deepEqual(result.fingerprints,fingerprintContract(expected));assert.deepEqual(result.inspector_sha256,expectedInspectorHash());assert.equal(result.nonce,nonce);
  pass('exact six-class contract through least-authority fixed endpoint');
  query(`ALTER FUNCTION public.${INSPECTOR}() SECURITY INVOKER;`);
  assert.throws(()=>snapshot());pass('INVOKER cannot read restricted migration history; no widening grants to anon');
  query(`ALTER FUNCTION public.${INSPECTOR}() SECURITY DEFINER;`);
  assert.throws(()=>query(request.replace("request.method='GET'","request.method='POST'")));pass('POST refused even in read-only transaction');
  assert.throws(()=>query(request.replace('BEGIN READ ONLY','BEGIN READ WRITE')));pass('direct read-write transaction refused');
  const functionDef=query(`SELECT pg_get_functiondef('public.${INSPECTOR}()'::regprocedure);`);
  query(`CREATE FUNCTION private.inspector_attack() RETURNS integer LANGUAGE sql VOLATILE SECURITY DEFINER AS $$ INSERT INTO public.players(normalized_name,display_name) VALUES ('NoWrite','NoWrite'); SELECT 1; $$; GRANT USAGE ON SCHEMA private TO takkeu_release_inspector; GRANT EXECUTE ON FUNCTION private.inspector_attack() TO takkeu_release_inspector;`);
  query(functionDef.replace('DECLARE snapshot','DECLARE snapshot').replace('BEGIN\n',"BEGIN\n PERFORM private.inspector_attack();\n"));
  assert.throws(()=>snapshot());assert.equal(query("SELECT count(*) FROM public.players WHERE normalized_name='NoWrite';"),'0');
  query(functionDef);query('DROP FUNCTION private.inspector_attack(); REVOKE USAGE ON SCHEMA private FROM takkeu_release_inspector;');pass('indirect VOLATILE definer write rejected by real READ ONLY transaction');
  for(const [name,sql,restore,field] of [
    ['function missing','ALTER FUNCTION public.get_takkeu_hall_v2(integer) RENAME TO missing_hall','ALTER FUNCTION public.missing_hall(integer) RENAME TO get_takkeu_hall_v2','functions'],
    ['rls disabled','ALTER TABLE public.takkeu_hall_of_fame_3500 DISABLE ROW LEVEL SECURITY','ALTER TABLE public.takkeu_hall_of_fame_3500 ENABLE ROW LEVEL SECURITY','tables'],
    ['direct write grant','GRANT INSERT ON public.takkeu_hall_of_fame_3500 TO anon','REVOKE INSERT ON public.takkeu_hall_of_fame_3500 FROM anon','tables'],
    ['trigger disabled','ALTER TABLE public.score_runs DISABLE TRIGGER enforce_takkeu_3500_score_v1','ALTER TABLE public.score_runs ENABLE TRIGGER enforce_takkeu_3500_score_v1','tables'],
    ['owner unsafe','ALTER ROLE takkeu_release_inspector LOGIN','ALTER ROLE takkeu_release_inspector NOLOGIN','inspector'],
    ['caller may SET ROLE inspector','GRANT takkeu_release_inspector TO anon','REVOKE takkeu_release_inspector FROM anon','inspector'],
    ['schema-create owner','GRANT CREATE ON SCHEMA public TO takkeu_release_inspector','REVOKE CREATE ON SCHEMA public FROM takkeu_release_inspector','inspector'],
    ['excess inspector grant','GRANT INSERT ON public.players TO takkeu_release_inspector','REVOKE INSERT ON public.players FROM takkeu_release_inspector','inspector'],
    ['inspector grant option','GRANT SELECT(game_slug) ON public.games TO takkeu_release_inspector WITH GRANT OPTION','REVOKE GRANT OPTION FOR SELECT(game_slug) ON public.games FROM takkeu_release_inspector','inspector'],
    ['inspector config policy drift',"ALTER POLICY takkeu_release_inspector_config ON public.games USING (true)","ALTER POLICY takkeu_release_inspector_config ON public.games USING(game_slug='takkeu')",'inspector'],
    ['self public execute',`GRANT EXECUTE ON FUNCTION public.${INSPECTOR}() TO PUBLIC`,`REVOKE EXECUTE ON FUNCTION public.${INSPECTOR}() FROM PUBLIC`,'inspector'],
  ]){query(sql);if(field==='inspector')assert.notDeepEqual(snapshot().inspector_sha256,expectedInspectorHash());else assert.notEqual(snapshot().fingerprints[field],fingerprintContract(expected)[field]);query(restore);pass(name);}
  const before=query('SELECT count(*) FROM private.game_play_sessions; SELECT count(*) FROM public.score_runs; SELECT next_number FROM private.takkeu_hall_counter_3500_v1; SELECT next_number FROM private.takkeu_hall_counter_v1;');
  for(let i=0;i<3;i++)snapshot();assert.equal(query('SELECT count(*) FROM private.game_play_sessions; SELECT count(*) FROM public.score_runs; SELECT next_number FROM private.takkeu_hall_counter_3500_v1; SELECT next_number FROM private.takkeu_hall_counter_v1;'),before);pass('no play, score, hall number or counter issued');
  assert.equal(query("SELECT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls FROM pg_roles WHERE rolname='takkeu_release_inspector';"),'f');
  for(const role of ['anon','authenticated'])assert.equal(query(`SELECT pg_has_role('${role}','takkeu_release_inspector','MEMBER');`),'f');pass('no caller membership or login/admin authority');
  query('CREATE ROLE rest_authenticator LOGIN NOINHERIT; GRANT anon TO rest_authenticator;');
  docker(['run','-d','--rm','--name',name+'-api','--network',`container:${name}`,
    '-e','PGRST_DB_URI=postgres://rest_authenticator@127.0.0.1/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon',
    'postgrest/postgrest:v16.5@sha256:1347d7552b88f17832912c06afbf7c43209af6eeeb60834b04aae12c9bd9d5cc']);
  const port=docker(['port',name,'3000/tcp']).trim().split(':').at(-1);const base=`http://127.0.0.1:${port}`;
  const restDeadline=Date.now()+35000;
  for(;;){try{const r=await fetch(base,{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{}if(Date.now()>restDeadline)throw Error('Disposable PostgREST did not start');await new Promise(r=>setTimeout(r,200));}
  const http=await fetch(`${base}/rpc/${INSPECTOR}`,{headers:{'x-takkeu-probe':nonce}});assert.equal(http.status,200);
  const json=await http.json();assert.deepEqual(json.fingerprints,fingerprintContract(expected));assert.deepEqual(json.inspector_sha256,expectedInspectorHash());assert.equal(json.nonce,nonce);
  assert.deepEqual(Object.keys(json).sort(),['format','project','read_only','nonce','observed_at','fingerprints','inspector_sha256'].sort());pass('real PostgREST GET exact contract and opaque response');
  assert.equal((await fetch(`${base}/rpc/${INSPECTOR}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);pass('real PostgREST POST rejected');
  assert.equal((await fetch(`${base}/rpc/${INSPECTOR}?p_table=players`)).status,404);pass('arbitrary object argument rejected by PostgREST');
  query(`CREATE FUNCTION private.inspector_http_attack() RETURNS integer LANGUAGE sql VOLATILE SECURITY DEFINER AS $$ INSERT INTO public.players(normalized_name,display_name) VALUES ('HttpNoWrite','HttpNoWrite'); SELECT 1; $$; GRANT USAGE ON SCHEMA private TO takkeu_release_inspector; GRANT EXECUTE ON FUNCTION private.inspector_http_attack() TO takkeu_release_inspector;`);
  query(functionDef.replace('BEGIN\n',"BEGIN\n PERFORM private.inspector_http_attack();\n"));
  const blocked=await fetch(`${base}/rpc/${INSPECTOR}`);assert.equal(blocked.status,405);assert.equal((await blocked.json()).code,'25006');assert.equal(query("SELECT count(*) FROM public.players WHERE normalized_name='HttpNoWrite';"),'0');
  query(functionDef);query('DROP FUNCTION private.inspector_http_attack(); REVOKE USAGE ON SCHEMA private FROM takkeu_release_inspector;');pass('real PostgREST GET blocks indirect SECURITY DEFINER write');
  const openapi=await(await fetch(base)).json();
  await verifyRpcRoutes(expected,{url:base,key:'disposable',fetcher:(u,o)=>fetch(u.replace('/rest/v1/','/'),o)});pass('eight exact signature HEAD routes and missing-route canary; no writes or response data');
  const routeObservations=[];
  for(const fn of expected.functions.filter(f=>f.schema==='public'&&/^(start_takkeu_clear_play|finish_takkeu_clear_play|register_takkeu_hall|get_takkeu_hall)_v[12]$/.test(f.name))){
    const params=new URLSearchParams(fn.args.split(', ').map(a=>{const [key,type]=a.split(' ');return [key,type==='uuid'?'00000000-0000-4000-8000-000000000000':type==='integer'?'0':''];}));
    const options=await fetch(`${base}/rpc/${fn.name}`,{method:'OPTIONS'});
    const head=await fetch(`${base}/rpc/${fn.name}?${params}`,{method:'HEAD'});
    routeObservations.push({name:fn.name,options:options.status,allow:options.headers.get('allow'),head:head.status});
  }
  const missing=await fetch(`${base}/rpc/not_a_real_takkeu_rpc`,{method:'OPTIONS'});
  writeFileSync('artifacts/merge-release/route-observations.json',JSON.stringify({routes:routeObservations,missing_options:missing.status},null,2));
  for(const fn of expected.functions.filter(f=>f.schema==='public'&&/^(start_takkeu_clear_play|finish_takkeu_clear_play|register_takkeu_hall|get_takkeu_hall)_v[12]$/.test(f.name)))assert.ok(openapi.paths[`/rpc/${fn.name}`]?.post);
  pass('eight old/new hall RPC routes visible in actual PostgREST schema cache');
  const removal=prepareInspectorRemovalSql();
  query(functionDef.replace('BEGIN\n','BEGIN\n -- changed inspector body\n'));
  assert.throws(()=>query(removal));query(functionDef);pass('recovery refuses changed inspector without removing anything');
  bootstrap('ALTER ROLE postgres NOSUPERUSER CREATEROLE CREATEDB;');
  query(removal);
  assert.equal(query("SELECT count(*) FROM pg_roles WHERE rolname='takkeu_release_inspector'; SELECT count(*) FROM pg_proc WHERE proname='get_takkeu_release_contract_v1'; SELECT count(*) FROM pg_policy WHERE polname='takkeu_release_inspector_config'; SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261028124434';"),'0\n0\n0\n0');
  query(proposal);assert.deepEqual(snapshot().fingerprints,fingerprintContract(expected));assert.equal(snapshot().inspector_sha256,expectedInspectorHash());
  pass('separately approved recovery and reapply work under nonsuperuser without touching hall contract');
  mkdirSync('artifacts/merge-release',{recursive:true});writeFileSync('artifacts/merge-release/rest-native.json',JSON.stringify({checks,result},null,2));
  console.log(`PG17 fixed GET inspector: ${checks.length} checks passed; no production connection.`);
} finally {if(started){try{docker(['rm','-f',name+'-api']);}catch{}docker(['rm','-f',name]);}}
