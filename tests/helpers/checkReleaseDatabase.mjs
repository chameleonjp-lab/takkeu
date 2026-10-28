import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { readCatalog } from '../../scripts/release/database.mjs';
import { summarizeCatalog, verifyDatabase } from '../../scripts/release/guards.mjs';

// Native PostgreSQL, socket-local Docker only. Never accepts production credentials.
const container=`takkeu-release-contract-${process.pid}`;
const image='postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe';
const dockerArgs=['--host=unix:///var/run/docker.sock'];
const env={...process.env};
for(const key of Object.keys(env))if(key.startsWith('PG')||key.startsWith('DOCKER_'))delete env[key];
const docker=(args,input)=>execFileSync('docker',[...dockerArgs,...args],{env,input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const query=sql=>docker(['exec','-i',container,'psql','-X','-w','-q','-At','-U','postgres','-v','ON_ERROR_STOP=1'],sql);
const run=(role='release_reader',sql=readFileSync('scripts/release/catalog.sql','utf8'))=>
  readCatalog({},()=>{
    const result=spawnSync('docker',[...dockerArgs,'exec','-i','-e','PGOPTIONS=-c default_transaction_read_only=on',container,
      'psql','-X','-w','-q','-At','-U',role,'-d','postgres','-v','ON_ERROR_STOP=1'],{env,input:sql,encoding:'utf8',timeout:25000,maxBuffer:4*1024*1024});
    if(result.status!==0){mkdirSync('artifacts/release-safety',{recursive:true});writeFileSync('artifacts/release-safety/local-psql-last-error.log',result.stderr ?? 'process failed');}
    return result;
  });
const contract=JSON.parse(readFileSync('scripts/release/expected-contract.json','utf8'));
const cases=[];
function rejected(name,fn){assert.throws(fn);cases.push({name,result:'blocked'});}
let started=false;
try{
  docker(['run','-d','--rm','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust',image]);started=true;
  const deadline=Date.now()+35000;
  for(;;){try{docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);break;}catch(e){if(Date.now()>deadline)throw e;await new Promise(r=>setTimeout(r,200));}}
  query(readFileSync('tests/sql/release-production-schema.sql','utf8'));
  rejected('unapplied migration',()=>verifyDatabase(summarizeCatalog(run()),contract));
  query('BEGIN;'+readFileSync(contract.migration_file,'utf8')+"\nINSERT INTO supabase_migrations.schema_migrations VALUES ('20261027032043','takkeu_hall_of_fame'); COMMIT;");
  // A normal role can override its transaction default and create a persistent
  // large object through PUBLIC pg_catalog privileges; no application grants.
  query('SET ROLE release_reader; BEGIN READ WRITE; SELECT pg_catalog.lo_create(0); ROLLBACK; RESET ROLE;');
  rejected('PUBLIC large-object writer',()=>verifyDatabase(summarizeCatalog(run()),contract));
  // This is a disposable-fixture restriction, NOT proposed production SQL.
  query(`DO $$DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='pg_catalog' AND p.proname IN ('lo_create','lo_creat','lo_from_bytea','lo_put','lowrite','lo_truncate','lo_truncate64','lo_unlink')
    LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC',f.sig); END LOOP; END$$;`);
  const snapshot=summarizeCatalog(run());
  try{verifyDatabase(snapshot,contract);}catch(error){mkdirSync('artifacts/release-safety',{recursive:true});writeFileSync('artifacts/release-safety/catalog-mismatch.json',JSON.stringify(snapshot,null,2));throw error;}
  cases.push({name:'complete reviewed schema and least-privilege reader',result:'matched'});
  query(`CREATE FUNCTION private.unreviewed_writer() RETURNS integer LANGUAGE sql VOLATILE AS $$INSERT INTO public.players(normalized_name,display_name) VALUES('LocalWriteProbe','LocalWriteProbe'); SELECT 1;$$;
    REVOKE ALL ON FUNCTION private.unreviewed_writer() FROM PUBLIC;
    CREATE FUNCTION public.unreviewed_stable_wrapper() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT private.unreviewed_writer();$$;`);
  assert.equal(query("SET ROLE release_reader; BEGIN READ WRITE; SELECT public.unreviewed_stable_wrapper(); RESET ROLE; SELECT count(*) FROM public.players WHERE normalized_name='LocalWriteProbe'; ROLLBACK;").trim().split('\n').at(-1),'1');
  rejected('STABLE wrapper with transitive write rejected',()=>verifyDatabase(summarizeCatalog(run()),contract));
  query('DROP FUNCTION public.unreviewed_stable_wrapper(); DROP FUNCTION private.unreviewed_writer();');
  query(`CREATE FUNCTION public.unreviewed_trigger_writer() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$BEGIN INSERT INTO public.players(normalized_name,display_name) VALUES('TriggerWriteProbe','TriggerWriteProbe'); RETURN NEW; END;$$;`);
  assert.equal(query("SET ROLE release_reader; BEGIN READ WRITE; CREATE TEMP TABLE permission_probe(n integer); CREATE TRIGGER write_probe AFTER INSERT ON permission_probe FOR EACH ROW EXECUTE FUNCTION public.unreviewed_trigger_writer(); INSERT INTO permission_probe VALUES(1); RESET ROLE; SELECT count(*) FROM public.players WHERE normalized_name='TriggerWriteProbe'; ROLLBACK;").trim().split('\n').at(-1),'1');
  rejected('PUBLIC trigger bound to own temp table cannot bypass reader gate',()=>verifyDatabase(summarizeCatalog(run()),contract));
  query('DROP FUNCTION public.unreviewed_trigger_writer();');
  query(`CREATE FUNCTION private.unreviewed_event_writer() RETURNS event_trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$BEGIN INSERT INTO public.players(normalized_name,display_name) VALUES('EventWriteProbe','EventWriteProbe'); END;$$;
    REVOKE ALL ON FUNCTION private.unreviewed_event_writer() FROM PUBLIC;
    CREATE EVENT TRIGGER unreviewed_event_write ON ddl_command_end WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION private.unreviewed_event_writer();`);
  assert.equal(query("SET ROLE release_reader; BEGIN READ WRITE; CREATE TEMP TABLE event_permission_probe(n integer); RESET ROLE; SELECT count(*) FROM public.players WHERE normalized_name='EventWriteProbe'; ROLLBACK;").trim().split('\n').at(-1),'1');
  rejected('automatic event trigger with inaccessible definer writer rejected',()=>verifyDatabase(summarizeCatalog(run()),contract));
  query('DROP EVENT TRIGGER unreviewed_event_write; DROP FUNCTION private.unreviewed_event_writer();');
  rejected('administrator connection',()=>verifyDatabase(summarizeCatalog(run('postgres')),contract));
  for(const [name,alter,restore] of [
    ['partial RPC', 'ALTER FUNCTION public.get_takkeu_hall_v2(integer) RENAME TO missing_hall', 'ALTER FUNCTION public.missing_hall(integer) RENAME TO get_takkeu_hall_v2'],
    ['RLS disabled','ALTER TABLE public.takkeu_hall_of_fame_3500 DISABLE ROW LEVEL SECURITY','ALTER TABLE public.takkeu_hall_of_fame_3500 ENABLE ROW LEVEL SECURITY'],
    ['score identity removed','ALTER TABLE public.score_runs ALTER COLUMN id DROP IDENTITY','ALTER TABLE public.score_runs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY'],
    ['trigger disabled','ALTER TABLE public.score_runs DISABLE TRIGGER enforce_takkeu_3500_score_v1','ALTER TABLE public.score_runs ENABLE TRIGGER enforce_takkeu_3500_score_v1'],
    ['event trigger disabled','ALTER EVENT TRIGGER ensure_rls DISABLE','ALTER EVENT TRIGGER ensure_rls ENABLE'],
    ['event handler settings drift','ALTER FUNCTION public.rls_auto_enable() SET search_path=public','ALTER FUNCTION public.rls_auto_enable() SET search_path=pg_catalog'],
    ['readonly transitive helper drift',"ALTER FUNCTION private.get_game_player_counts_v1(text) SET search_path=public","ALTER FUNCTION private.get_game_player_counts_v1(text) SET search_path=''"],
    ['direct anon writes','GRANT INSERT ON public.takkeu_hall_of_fame_3500 TO anon','REVOKE INSERT ON public.takkeu_hall_of_fame_3500 FROM anon'],
    ['reader can write','GRANT INSERT ON public.players TO release_reader','REVOKE INSERT ON public.players FROM release_reader'],
    ['reader column write','GRANT UPDATE(score) ON public.score_runs TO release_reader','REVOKE UPDATE(score) ON public.score_runs FROM release_reader'],
    ['reader direct large-object grant','GRANT EXECUTE ON FUNCTION pg_catalog.lo_create(oid) TO release_reader','REVOKE EXECUTE ON FUNCTION pg_catalog.lo_create(oid) FROM release_reader'],
    ['reader server-file large-object capability','GRANT EXECUTE ON FUNCTION pg_catalog.lo_import(text) TO release_reader','REVOKE EXECUTE ON FUNCTION pg_catalog.lo_import(text) FROM release_reader'],
    ['reader history write','GRANT UPDATE ON supabase_migrations.schema_migrations TO release_reader','REVOKE UPDATE ON supabase_migrations.schema_migrations FROM release_reader'],
    ['anon column write','GRANT UPDATE(score) ON public.score_runs TO anon','REVOKE UPDATE(score) ON public.score_runs FROM anon'],
    ['anon column read','GRANT SELECT(best_score) ON public.game_scores TO anon','REVOKE SELECT(best_score) ON public.game_scores FROM anon'],
    ['reader can call mutator','GRANT EXECUTE ON FUNCTION public.register_takkeu_hall_v2(uuid,uuid,text,text) TO release_reader','REVOKE EXECUTE ON FUNCTION public.register_takkeu_hall_v2(uuid,uuid,text,text) FROM release_reader'],
    ['history missing',"DELETE FROM supabase_migrations.schema_migrations WHERE version='20261027032043'","INSERT INTO supabase_migrations.schema_migrations VALUES ('20261027032043','takkeu_hall_of_fame')"],
    ['verification permission missing','REVOKE SELECT(version,name) ON supabase_migrations.schema_migrations FROM release_reader','GRANT SELECT(version,name) ON supabase_migrations.schema_migrations TO release_reader'],
  ]) {query(alter+';');rejected(name,()=>verifyDatabase(summarizeCatalog(run()),contract));query(restore+';');}
  const eventDefinition=query("SELECT pg_get_functiondef('public.rls_auto_enable()'::regprocedure);");
  query(eventDefinition.replace('DECLARE','-- unreviewed handler body\nDECLARE'));
  rejected('existing automatic event-handler body drift',()=>verifyDatabase(summarizeCatalog(run()),contract));query(eventDefinition);
  const readonlyDefault=query("SELECT pg_get_functiondef('public.get_hito_wo_yurusuna_first_ranking(integer)'::regprocedure);");
  assert.ok(readonlyDefault.includes('DEFAULT 20'));
  query(readonlyDefault.replace('DEFAULT 20','DEFAULT 21'));
  rejected('readonly default-argument drift',()=>verifyDatabase(summarizeCatalog(run()),contract));query(readonlyDefault);
  // Empty PostgreSQL ACL arrays left by REVOKE are equivalent to no column ACL.
  // Check arbitrary write RPCs outside the previously incomplete name blacklist.
  query("CREATE FUNCTION public.unreviewed_mutator() RETURNS void LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'must never be called'; END;$$;");
  rejected('unreviewed publicly executable volatile RPC',()=>verifyDatabase(summarizeCatalog(run()),contract));
  query('DROP FUNCTION public.unreviewed_mutator();');
  query('CREATE ROLE writer; GRANT UPDATE ON public.players TO writer; ALTER ROLE release_reader NOINHERIT; GRANT writer TO release_reader;');
  rejected('non-inherited writer role membership',()=>verifyDatabase(summarizeCatalog(run()),contract));
  query('REVOKE writer FROM release_reader; DROP OWNED BY writer; DROP ROLE writer;');
  for(const name of ['takkeu_guest_plays_v1','takkeu_progress_v1','takkeu_progress_signals_v1']){
    query(`ALTER TABLE private.${name} RENAME TO missing_dependency;`);
    rejected(`missing ${name}`,()=>verifyDatabase(summarizeCatalog(run()),contract));
    query(`ALTER TABLE private.missing_dependency RENAME TO ${name};`);
  }
  rejected('actual PostgreSQL statement timeout',()=>run('release_reader',"BEGIN READ ONLY; SET LOCAL statement_timeout='30ms'; SELECT pg_sleep(0.2); ROLLBACK;"));
  rejected('write attempted inside read-only transaction',()=>run('postgres',"BEGIN READ ONLY; INSERT INTO public.players(normalized_name,display_name) VALUES('NoWrite','NoWrite'); ROLLBACK;"));
  verifyDatabase(summarizeCatalog(run()),contract);
  assert.equal(query('SELECT count(*) FROM public.players;').trim(),'0');
  mkdirSync('artifacts/release-safety',{recursive:true});
  writeFileSync('artifacts/release-safety/native-db-gates.json',JSON.stringify({version:query('SELECT version();'),image,cases,playerRows:0,result:'passed'},null,2)+'\n');
  console.log(`Native PostgreSQL release gates: ${cases.length} cases passed; no production connection.`);
}finally{if(started)docker(['rm','-f',container]);}
