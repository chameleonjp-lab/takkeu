import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

// Disposable local Postgres only; no project URL, credentials or live data.
const container = `takkeu-hall-test-${process.pid}`;
const image = 'postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe';
const env = { ...process.env };
for (const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[key];
const docker = args => execFileSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { env, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
const args = ['--host=unix:///var/run/docker.sock', 'exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'];
const query = sql => execFileSync('docker', args, { env, encoding: 'utf8', input: sql, maxBuffer: 4 * 1024 * 1024 }).trim();
const receipt = value => JSON.parse(value.split('\n').find(line => line.startsWith('{')));
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
let started = false;
try {
  docker(['run', '-d', '--rm', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image]); started = true;
  const deadline = Date.now() + 30000;
  for (;;) {
    try { query('select 1;'); break; } catch (e) { if (Date.now() > deadline) throw e; await new Promise(r => setTimeout(r, 200)); }
  }
  for (const file of ['tests/sql/hall-schema.sql','tests/sql/shared-normalize-name.sql','tests/sql/shared-ranking-start.sql',
    'supabase/migrations/20261027_takkeu_submission_guard.sql','supabase/migrations/20261027_takkeu_rate_limit_refinement.sql',
    'supabase/migrations/20261027_takkeu_final_lost_balls.sql','supabase/migrations/20261027032043_takkeu_hall_of_fame.sql']) query(readFileSync(file, 'utf8'));
  const prepared = [];
  for (const [i, name] of ['Same','Same','Second','Third'].entries()) {
    const play = receipt(query(`select public.start_takkeu_clear_play_v1('${id(i+1)}','${name}','takkeu','takkeu-web-clear-1');`)).play_id;
    const sub = id(i + 101);
    query(`update private.game_play_sessions set started_at=clock_timestamp()-interval '180 seconds' where play_id='${play}';
      select public.finish_takkeu_clear_play_v1('${play}','${name}','takkeu','clear',1,3000,'takkeu-web-clear-1',3000,0);
      select * from public.submit_score_idempotent_v1('${play}','${sub}','${name}','takkeu',3000,'takkeu-web-clear-1');`);
    prepared.push({ play, sub, name });
  }
  function race(row) {
    const begin = performance.now();
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, { env, stdio: ['pipe','pipe','pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; }); child.on('error', reject);
      child.on('exit', code => code ? reject(new Error(stderr)) : resolve({ ...receipt(stdout), elapsedMs: performance.now() - begin }));
      child.stdin.end(`begin; select pg_sleep(.1); select public.register_takkeu_hall_v1('${row.play}','${row.sub}','${row.name}','takkeu-web-clear-1') || jsonb_build_object('backend_pid',pg_backend_pid()); select pg_sleep(.3); commit;`);
    });
  }
  const same = await Promise.all(prepared.slice(0, 2).map(race));
  assert(same.every(r => r.accepted)); assert.equal(same[0].hall_number, 1); assert.equal(same[1].hall_number, 1);
  assert.equal(same[0].registered_at, same[1].registered_at); assert.notEqual(same[0].backend_pid, same[1].backend_pid);
  const different = await Promise.all(prepared.slice(2).map(race));
  assert.deepEqual(different.map(r => r.hall_number).sort(), [2, 3]); assert.notEqual(different[0].backend_pid, different[1].backend_pid);
  assert.equal(query('select count(*) from public.takkeu_hall_of_fame;'), '3');
  assert.equal(query('select next_number from private.takkeu_hall_counter_v1;'), '4');
  mkdirSync('artifacts/goal-3000', { recursive: true });
  writeFileSync('artifacts/goal-3000/postgres-concurrency.json', JSON.stringify({ image, version: query('select version();'), same, different, entries: 3, nextNumber: 4, result: 'passed' }, null, 2) + '\n');
  console.log('Postgres: same-name race, distinct-name race, stable receipts and counter passed.');
} finally { if (started) docker(['rm', '-f', container]); }
