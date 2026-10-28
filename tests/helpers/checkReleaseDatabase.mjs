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
  const snapshot=summarizeCatalog(run());
  try{verifyDatabase(snapshot,contract);}catch(error){mkdirSync('artifacts/release-safety',{recursive:true});writeFileSync('artifacts/release-safety/catalog-mismatch.json',JSON.stringify(snapshot,null,2));throw error;}
  cases.push({name:'complete reviewed schema and least-privilege reader',result:'matched'});
  rejected('administrator connection',()=>verifyDatabase(summarizeCatalog(run('postgres')),contract));
  for(const [name,alter,restore] of [
    ['partial RPC', 'ALTER FUNCTION public.get_takkeu_hall_v2(integer) RENAME TO missing_hall', 'ALTER FUNCTION public.missing_hall(integer) RENAME TO get_takkeu_hall_v2'],
    ['RLS disabled','ALTER TABLE public.takkeu_hall_of_fame_3500 DISABLE ROW LEVEL SECURITY','ALTER TABLE public.takkeu_hall_of_fame_3500 ENABLE ROW LEVEL SECURITY'],
    ['trigger disabled','ALTER TABLE public.score_runs DISABLE TRIGGER enforce_takkeu_3500_score_v1','ALTER TABLE public.score_runs ENABLE TRIGGER enforce_takkeu_3500_score_v1'],
    ['direct anon writes','GRANT INSERT ON public.takkeu_hall_of_fame_3500 TO anon','REVOKE INSERT ON public.takkeu_hall_of_fame_3500 FROM anon'],
    ['reader can write','GRANT INSERT ON public.players TO release_reader','REVOKE INSERT ON public.players FROM release_reader'],
    ['reader column write','GRANT UPDATE(score) ON public.score_runs TO release_reader','REVOKE UPDATE(score) ON public.score_runs FROM release_reader'],
    ['reader history write','GRANT UPDATE ON supabase_migrations.schema_migrations TO release_reader','REVOKE UPDATE ON supabase_migrations.schema_migrations FROM release_reader'],
    ['anon column write','GRANT UPDATE(score) ON public.score_runs TO anon','REVOKE UPDATE(score) ON public.score_runs FROM anon'],
    ['anon column read','GRANT SELECT(best_score) ON public.game_scores TO anon','REVOKE SELECT(best_score) ON public.game_scores FROM anon'],
    ['reader can call mutator','GRANT EXECUTE ON FUNCTION public.register_takkeu_hall_v2(uuid,uuid,text,text) TO release_reader','REVOKE EXECUTE ON FUNCTION public.register_takkeu_hall_v2(uuid,uuid,text,text) FROM release_reader'],
    ['history missing',"DELETE FROM supabase_migrations.schema_migrations WHERE version='20261027032043'","INSERT INTO supabase_migrations.schema_migrations VALUES ('20261027032043','takkeu_hall_of_fame')"],
    ['verification permission missing','REVOKE SELECT(version,name) ON supabase_migrations.schema_migrations FROM release_reader','GRANT SELECT(version,name) ON supabase_migrations.schema_migrations TO release_reader'],
  ]) {query(alter+';');rejected(name,()=>verifyDatabase(summarizeCatalog(run()),contract));query(restore+';');}
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
