import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { prepareMigrationSql, preparePermissionSql } from '../../scripts/release/prepare-production.mjs';

// Disposable PG17 only. This helper never accepts a host, password or project URL.
const container=`takkeu-readiness-${process.pid}`;
const image='postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe';
const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('PG')||k.startsWith('DOCKER_'))delete env[k];
const docker=args=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{env,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const args=['--host=unix:///var/run/docker.sock','exec','-i',container,'psql','-X','-w','-q','-At','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
const query=sql=>execFileSync('docker',args,{env,input:sql,encoding:'utf8',maxBuffer:8*1024*1024}).trim();
const rpc=sql=>JSON.parse(query(sql).split('\n').find(s=>s.startsWith('{')));
const id=n=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
const cases=[];let started=false;
function pass(name){cases.push({name,result:'passed'});}
function blocked(name,sql){assert.throws(()=>query(sql));pass(name);}
const version='takkeu-web-clear-3500-1';
function prepare(n,name,client=version,rpcName='start_takkeu_clear_play_v2',score=3500){
  const p=rpc(`SELECT public.${rpcName}('${id(n)}','${name}','takkeu','${client}');`).play_id;
  query(`UPDATE private.game_play_sessions SET started_at=clock_timestamp()-interval '180 seconds' WHERE play_id='${p}';`);
  return {play:p,sub:id(n+1000),name,client,score};
}
function finish(row,score=row.score,lost=0,result='clear'){
  const fn=row.client==='takkeu-web-clear-1'?'finish_takkeu_clear_play_v1':row.client===version?'finish_takkeu_clear_play_v2':'finish_takkeu_play_v2';
  return rpc(`SELECT public.${fn}('${row.play}','${row.name}','takkeu','${result}',1,${score},'${row.client}',${score},${lost});`);
}
const submit=r=>query(`SELECT * FROM public.submit_score_idempotent_v1('${r.play}','${r.sub}','${r.name}','takkeu',${r.score},'${r.client}');`);
const register=r=>rpc(`SELECT public.register_takkeu_hall_${r.client==='takkeu-web-clear-1'?'v1':'v2'}('${r.play}','${r.sub}','${r.name}','${r.client}');`);
async function race(row){return new Promise((resolve,reject)=>{
  const child=spawn('docker',args,{env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);
  child.on('exit',code=>code?reject(Error(stderr)):resolve(JSON.parse(stdout.split('\n').find(s=>s.startsWith('{')))));
  child.stdin.end(`BEGIN; SELECT public.register_takkeu_hall_v2('${row.play}','${row.sub}','${row.name}','${version}')||jsonb_build_object('backend_pid',pg_backend_pid()); SELECT pg_sleep(.15); COMMIT;`);
});}
try{
  docker(['run','-d','--rm','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust',image]);started=true;
  const end=Date.now()+35000;for(;;){try{docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);break;}catch(e){if(Date.now()>end)throw e;await new Promise(r=>setTimeout(r,200));}}
  query(readFileSync('tests/sql/release-production-schema.sql','utf8'));
  query(readFileSync('tests/sql/public-rpc-contract.sql','utf8'));
  query(`INSERT INTO public.games(game_slug,title,game_url,submission_mode,score_order,score_min,score_max,is_active)
    SELECT s,s,'https://example.invalid','shared','desc',0,100000000,true FROM unnest(ARRAY['sainome_300_seconds','saisupi','binkarabin','semekome','hito_wo_yurusuna']) s;
    INSERT INTO public.players(normalized_name,display_name,created_at) VALUES ('Existing','Existing',now());
    INSERT INTO public.game_scores(normalized_name,game_slug,display_name,first_score,best_score,play_count,first_score_at,best_score_at,updated_at)
      VALUES ('Existing','takkeu','Existing',4001,4001,1,now(),now(),now());`);
  query(`INSERT INTO public.players(normalized_name,display_name,created_at) VALUES('HistoricalBot','HistoricalBot',now());
    INSERT INTO public.game_scores(normalized_name,game_slug,display_name,first_score,best_score,play_count,ranking_status)
    VALUES('HistoricalBot','takkeu','HistoricalBot',7927,45773300,1,'provisional_bot');`);
  const apply=prepareMigrationSql();
  const pending=rpc(`SELECT public.start_game_play_v1('${id(700)}','PendingBefore','takkeu','takkeu-web-ranking-1');`).play_id;
  query(`UPDATE private.game_play_sessions SET started_at=clock_timestamp()-interval '180 seconds' WHERE play_id='${pending}';`);
  blocked('late transaction failure rolls back complete DDL/history',apply.replace('INSERT INTO supabase_migrations.schema_migrations','PERFORM 1/0; INSERT INTO supabase_migrations.schema_migrations'));
  assert.equal(query("SELECT count(*) FROM information_schema.columns WHERE table_schema='private' AND table_name='game_play_sessions' AND column_name='takkeu_rules_version';"),'0');
  query(apply);pass('exact migration, transaction postconditions and unchanged existing data');
  assert.equal(rpc(`SELECT public.finish_game_play_v1('${pending}','PendingBefore','takkeu','game_over',1,4003,'takkeu-web-ranking-1',4003);`).accepted,true);
  query(`SELECT * FROM public.submit_score_idempotent_v1('${pending}','${id(1700)}','PendingBefore','takkeu',4003,'takkeu-web-ranking-1');`);
  assert.equal(query(`SELECT takkeu_final_lost_balls IS NULL FROM private.game_play_sessions WHERE play_id='${pending}';`),'t');pass('pre-migration legacy pending submits without inventing loss count');
  blocked('duplicate apply refused without changing committed objects',apply);
  assert.equal(query("SELECT best_score FROM public.game_scores WHERE normalized_name='Existing';"),'4001');
  assert.equal(query("SELECT best_score||':'||ranking_status FROM public.game_scores WHERE normalized_name='HistoricalBot';"),'45773300:provisional_bot');pass('historical 45million provisional record preserved without shrinking max');
  const inventory=rpc(`SELECT jsonb_build_object(
    'tables',(SELECT count(*) FROM pg_class WHERE relkind='r' AND relname IN ('takkeu_hall_of_fame','takkeu_hall_of_fame_3500','takkeu_hall_counter_v1','takkeu_hall_counter_3500_v1')),
    'columns',(SELECT count(*) FROM pg_attribute WHERE attrelid='private.game_play_sessions'::regclass AND attname IN ('takkeu_rules_version','takkeu_clear_verified')),
    'functions',(SELECT count(*) FROM pg_proc WHERE proname IN ('start_takkeu_clear_play_v1','start_takkeu_clear_play_v2','finish_takkeu_clear_play_v1','finish_takkeu_clear_play_v2','register_takkeu_hall_v1','register_takkeu_hall_v2','get_takkeu_hall_v1','get_takkeu_hall_v2','enforce_takkeu_3500_result_v1','enforce_takkeu_3500_score_v1')),
    'triggers',(SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('enforce_takkeu_3500_result_v1','enforce_takkeu_3500_score_v1')),
    'constraints',(SELECT count(*) FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE c.contype<>'n' AND (t.relname IN ('takkeu_hall_of_fame','takkeu_hall_of_fame_3500','takkeu_hall_counter_v1','takkeu_hall_counter_3500_v1') OR c.conname='takkeu_clear_rules_v1')),
    'indexes',(SELECT count(*) FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid WHERE t.relname IN ('takkeu_hall_of_fame','takkeu_hall_of_fame_3500','takkeu_hall_counter_v1','takkeu_hall_counter_3500_v1')),
    'counter_rows',(SELECT count(*) FROM private.takkeu_hall_counter_v1)+(SELECT count(*) FROM private.takkeu_hall_counter_3500_v1));`);
  assert.deepEqual(inventory,{tables:4,columns:2,functions:10,triggers:2,constraints:21,indexes:8,counter_rows:2});pass('inventory 4 tables/2 columns/10 functions/2 triggers/21 constraints/8 indexes');
  const a=prepare(1,'NativeClear');
  assert.equal(finish(a,3000).accepted,false);assert.equal(finish(a,3501).accepted,false);assert.equal(finish(a,3500,100).accepted,false);
  assert.equal(finish(a).accepted,true);assert.equal(register(a).reason,'score_not_submitted');submit(a);assert.equal(register(a).hall_number,1);pass('3500 only, losses below100, submitted score required');
  const same=prepare(2,'NativeClear');assert.equal(finish(same).accepted,true);submit(same);
  const raceSame=await Promise.all([race(a),race(same)]);assert.ok(raceSame.every(r=>r.hall_number===1));assert.notEqual(raceSame[0].backend_pid,raceSame[1].backend_pid);
  const others=[prepare(3,'NativeB'),prepare(4,'NativeC')];for(const r of others){assert.equal(finish(r).accepted,true);submit(r);}
  const raceOther=await Promise.all(others.map(race));assert.deepEqual(raceOther.map(r=>r.hall_number).sort(),[2,3]);assert.notEqual(raceOther[0].backend_pid,raceOther[1].backend_pid);
  assert.equal(register(a).hall_number,1);assert.equal(query('SELECT next_number FROM private.takkeu_hall_counter_3500_v1;'),'4');pass('same/different names on distinct backends and lost-response retry stable');
  const old=prepare(5,'Old3000','takkeu-web-clear-1','start_takkeu_clear_play_v1',3000);assert.equal(finish(old).accepted,true);submit(old);assert.equal(register(old).hall_number,1);
  const legacy=prepare(6,'Existing','takkeu-web-ranking-1','start_game_play_v1',4002);assert.equal(finish(legacy,4002,1,'game_over').accepted,true);submit(legacy);assert.equal(query("SELECT best_score FROM public.game_scores WHERE normalized_name='Existing';"),'4002');pass('old3000 separate ledger, legacy4001 preserved and pending4002 accepted');
  assert.equal(query("SELECT first_score FROM public.game_scores WHERE normalized_name='Existing';"),'4001');
  for(const [n,status]of ['bot','provisional_bot','hidden'].entries()){
    const row=prepare(10+n,`Moderated${n}`);assert.equal(finish(row).accepted,true);submit(row);
    query(`UPDATE public.game_scores SET ranking_status='${status}' WHERE normalized_name='${row.name}';`);assert.equal(register(row).reason,'hall_ineligible');
  }pass('BOT/provisionalBOT/hidden cannot receive numbers; categories unchanged');
  for(const role of ['anon','authenticated','service_role']){
    for(const fn of ['start_takkeu_clear_play_v2(uuid,text,text,text)','finish_takkeu_clear_play_v2(uuid,text,text,text,integer,integer,text,integer,integer)','register_takkeu_hall_v2(uuid,uuid,text,text)','get_takkeu_hall_v2(integer)'])assert.equal(query(`SELECT has_function_privilege('${role}','public.${fn}','EXECUTE');`),'t');
  }
  for(const role of ['anon','authenticated'])for(const table of ['public.takkeu_hall_of_fame','public.takkeu_hall_of_fame_3500','private.takkeu_hall_counter_v1','private.takkeu_hall_counter_3500_v1'])blocked(`${role} direct ${table} denied`,`SET ROLE ${role}; SELECT * FROM ${table};`);
  for(const role of ['anon','authenticated']){
    for(const table of ['public.takkeu_hall_of_fame','public.takkeu_hall_of_fame_3500'])blocked(`${role} direct insert ${table} denied`,`SET ROLE ${role}; INSERT INTO ${table}(hall_number,normalized_name,display_name,first_play_id) VALUES(999,'Existing','Existing','${a.play}');`);
    for(const table of ['private.takkeu_hall_counter_v1','private.takkeu_hall_counter_3500_v1'])blocked(`${role} direct counter update denied`,`SET ROLE ${role}; UPDATE ${table} SET next_number=999;`);
  }
  const permissions=preparePermissionSql();
  query('ALTER FUNCTION public.check_player_name(text) SET search_path=pg_catalog;');
  blocked('changed search_path refuses permission proposal',permissions.apply);
  query('ALTER FUNCTION public.check_player_name(text) SET search_path=public;');
  query('ALTER FUNCTION public.submit_hito_wo_yurusuna_score(text,integer,integer,text) RETURNS NULL ON NULL INPUT;');
  blocked('late STRICT drift rolls back earlier permission changes',permissions.apply);
  query('ALTER FUNCTION public.submit_hito_wo_yurusuna_score(text,integer,integer,text) CALLED ON NULL INPUT;');
  assert.equal(query("SELECT has_function_privilege('release_reader','public.check_player_name(text)','EXECUTE');"),'t');
  function parity(role){const output=query(`BEGIN; SET ROLE ${role};
    SELECT public.record_game_play('Caller','sainome_300_seconds','play','offline');
    SELECT public.record_game_play('Caller','saisupi','play','offline');
    SELECT public.record_game_play('Caller','binkarabin','retire','offline');
    SELECT public.record_play_event('Caller','binkarabin','retire',1,3,3,'offline','${id(800)}');
    SELECT * FROM public.submit_hito_wo_yurusuna_score('Caller',17,2,'offline');
    SELECT * FROM public.check_player_name('Caller'); SELECT * FROM public.get_game_ranking('semekome',10);
    SELECT * FROM public.get_best_score_ranking_with_metadata('hito_wo_yurusuna',10);
    SELECT * FROM public.get_first_try_ranking_with_metadata('hito_wo_yurusuna',10);
    SELECT * FROM public.get_player_score_summary_with_metadata('hito_wo_yurusuna','Caller');
    RESET ROLE; SELECT jsonb_build_object('events',(SELECT count(*) FROM public.game_play_events),'sainome',(SELECT play_count FROM public.game_scores WHERE game_slug='sainome_300_seconds' AND normalized_name='Caller'),'hito',(SELECT best_score FROM public.game_scores WHERE game_slug='hito_wo_yurusuna' AND normalized_name='Caller')); ROLLBACK;`);
    const receipts=output.split('\n').filter(s=>s.startsWith('{')).map(s=>JSON.parse(s));
    assert.equal(receipts.length,5);assert.ok(receipts.slice(0,4).every(r=>r.accepted===true));
    const state=receipts.at(-1);assert.deepEqual(state,{events:4,sainome:1,hito:17});return state;}
  const before={};for(const role of ['anon','authenticated','service_role'])before[role]=parity(role);
  query(permissions.apply);pass('eight scoped ACL changes satisfy exact body/ACL preconditions');
  for(const role of ['anon','authenticated','service_role'])assert.deepEqual(parity(role),before[role]);pass('actual read/write caller paths preserve anon/authenticated/service outputs');
  for(const t of permissions.targets)assert.equal(query(`SELECT has_function_privilege('release_reader','${t.signature}','EXECUTE');`),'f');pass('PUBLIC-only reader loses only the reviewed eight entrypoints');
  // A8 is insufficient: reader still has large-object writes on an ordinary primary.
  assert.equal(query("SELECT has_function_privilege('release_reader','pg_catalog.lo_create(oid)','EXECUTE');"),'t');pass('A8 still cannot establish genuinely readonly credential');
  query(permissions.restore);pass('exact original eight ACLs restored');
  for(const role of ['anon','authenticated','service_role'])assert.deepEqual(parity(role),before[role]);
  mkdirSync('artifacts/production-readiness',{recursive:true});writeFileSync('artifacts/production-readiness/pg17.json',JSON.stringify({image,version:query('SELECT version();'),cases,raceSame,raceOther,result:'passed',productionConnection:false},null,2)+'\n');
  console.log(`PG17 production readiness: ${cases.length} checks passed; no production connection.`);
}finally{if(started)docker(['rm','-f',container]);}
