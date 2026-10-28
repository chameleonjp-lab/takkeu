import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PROJECT, summarizeCatalog, verifyDatabase, digest } from './guards.mjs';

export function connectionEnvironment(e) {
  const direct=e.PGHOST===`db.${PROJECT}.supabase.co`;
  const pooler=/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(e.PGHOST ?? '') && e.PGUSER?.endsWith(`.${PROJECT}`);
  if ((!direct&&!pooler) || e.PGDATABASE!=='postgres' || !['5432','6543'].includes(e.PGPORT)
    || !e.PGUSER || !e.PGPASSWORD || /[\r\n]/.test(e.PGUSER+e.PGHOST)) throw Error('Read-only production connection is missing or targets another project');
  return {PATH:e.PATH,PGHOST:e.PGHOST,PGPORT:e.PGPORT,PGDATABASE:e.PGDATABASE,PGUSER:e.PGUSER,PGPASSWORD:e.PGPASSWORD,
    PGSSLMODE:'verify-full',PGSSLROOTCERT:'system',PGCONNECT_TIMEOUT:'10',PGAPPNAME:'takkeu-release-preflight',
    PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000'};
}
export function readCatalog(env, run=spawnSync) {
  const result=run('psql',['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-f','scripts/release/catalog.sql'],
    {env,encoding:'utf8',timeout:25000,maxBuffer:4*1024*1024});
  // Do not forward stderr: connection errors can contain credential material.
  if (result.error || result.signal || result.status!==0) throw Error('Read-only database verification unavailable; release stopped');
  try { return JSON.parse(result.stdout); } catch { throw Error('Invalid database verification response'); }
}
export function checkDatabase(env=process.env) {
  const contract=JSON.parse(readFileSync('scripts/release/expected-contract.json','utf8'));
  if(digest(readFileSync(contract.migration_file,'utf8'))!==contract.migration_sha256) throw Error('Migration differs from reviewed contract');
  const snapshot=summarizeCatalog(readCatalog(connectionEnvironment(env)));
  verifyDatabase(snapshot,contract);
  return {observed_at:snapshot.observed_at,project:PROJECT,migration:'20261027032043',read_only:snapshot.read_only,least_privilege:snapshot.least_privilege,
    tables:snapshot.tables.length,functions:snapshot.functions.length,result:'matched'};
}
