import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const PROJECT = 'mlpnjgezrnhdxsxolyzj';
export const REPOSITORY = 'chameleonjp-lab/takkeu';
export const digest = text => createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex');
export function assertDispatch(e) {
  if (e.event !== 'workflow_dispatch' || e.ref !== 'refs/heads/main' || e.repository !== REPOSITORY
    || e.actor !== 'chameleonjp-lab' || e.triggeringActor !== 'chameleonjp-lab' || e.approval !== 'true'
    || !/^[0-9a-f]{40}$/.test(e.expected ?? '') || e.workflowSha !== e.expected) {
    throw Error('Release requires an explicit owner-approved dispatch of the full current main SHA.');
  }
}
export async function verifyGithub(expected, get) {
  if (!/^[0-9a-f]{40}$/.test(expected ?? '')) throw Error('Invalid release SHA');
  const main = await get('/git/ref/heads/main');
  if (main?.object?.sha !== expected) throw Error('main moved; release stopped');
  const response = await get(`/actions/workflows/ci.yml/runs?head_sha=${expected}&branch=main&event=push&per_page=100`);
  if (!Array.isArray(response?.workflow_runs) || !Number.isSafeInteger(response.total_count)
    || response.total_count < 1 || response.total_count > 100 || response.workflow_runs.length !== response.total_count
    || response.workflow_runs.some(r=>!Number.isSafeInteger(r?.id)||r.id<1)
    || response.workflow_runs.some(r=>r.head_sha!==expected||r.head_branch!=='main'||r.event!=='push'
      ||r.workflow_id!==392845635||r.path!=='.github/workflows/ci.yml'||typeof r.status!=='string')
    || new Set(response.workflow_runs.map(r=>r.id)).size !== response.total_count) throw Error('CI evidence unavailable');
  const latest = [...response.workflow_runs].sort((a,b)=>b.id-a.id)[0];
  if (latest?.head_sha !== expected || latest.head_branch !== 'main' || latest.event !== 'push'
    || latest.workflow_id !== 392845635 || latest.path !== '.github/workflows/ci.yml'
    || latest.status !== 'completed' || latest.conclusion !== 'success') throw Error('Latest main CI has not succeeded');
  return {main_sha:expected,ci_run_id:latest.id};
}
export function summarizeCatalog(snapshot) {
  const result = structuredClone(snapshot);
  for(const field of ['functions','readonly_routines','event_triggers']) result[field] = result[field].map(({source,...fn})=>({...fn,body:digest(source)}));
  return result;
}
export function verifyDatabase(snapshot, contract) {
  if (!snapshot || snapshot.format!==1 || contract?.format!==1 || snapshot.read_only !== true || snapshot.least_privilege !== true || snapshot.project !== PROJECT) {
    throw Error('DB observation is not a verified least-privilege read-only production check');
  }
  for (const field of ['migrations','game','tables','functions','readonly_routines','event_triggers']) {
    if (!Array.isArray(contract?.migrations) || !contract.migrations.length || !Array.isArray(contract.tables) || !contract.tables.length
      || !Array.isArray(contract.functions) || !contract.functions.length || !Array.isArray(contract.readonly_routines) || !contract.readonly_routines.length
      || !Array.isArray(contract.event_triggers) || !contract.event_triggers.length
      || !isDeepStrictEqual(snapshot[field],contract[field])) {
      throw Error(`DB contract mismatch: ${field}; release stopped`);
    }
  }
}
