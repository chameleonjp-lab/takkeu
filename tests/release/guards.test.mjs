import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertDispatch, verifyGithub, verifyDatabase } from '../../scripts/release/guards.mjs';

const sha = 'a'.repeat(40);
const event = { event: 'workflow_dispatch', ref: 'refs/heads/main', expected: sha, workflowSha: sha,
  actor: 'chameleonjp-lab', triggeringActor: 'chameleonjp-lab', approval: 'true', repository: 'chameleonjp-lab/takkeu' };
test('only explicitly owner-approved dispatch of full main SHA is eligible', () => {
  assert.doesNotThrow(() => assertDispatch(event));
  for (const changes of [{event:'push'},{event:'pull_request'},{approval:'false'},{approval:''},
    {expected:sha.slice(0,7)},{ref:'refs/heads/feature'},{workflowSha:'b'.repeat(40)},
    {actor:'github-actions[bot]'},{triggeringActor:'someone'},{repository:'another/takkeu'}]) {
    assert.throws(() => assertDispatch({...event,...changes}));
  }
});
const ci = {id:7,workflow_id:392845635,path:'.github/workflows/ci.yml',event:'push',head_branch:'main',head_sha:sha,status:'completed',conclusion:'success'};
function api(main=sha,runs=[ci]) { return async path => path.includes('git/ref/') ? {object:{sha:main}} : {total_count:runs.length,workflow_runs:runs}; }
test('GitHub gate uses latest main push CI, rejects stale SHA, failure, pending and API errors', async () => {
  await verifyGithub(sha,api());
  for (const runs of [[],[{...ci,status:'in_progress',conclusion:null}],[{...ci,conclusion:'failure'}],
    [{...ci,event:'pull_request'}],[{...ci,head_sha:'b'.repeat(40)}],[{...ci,workflow_id:1}],
    [{...ci},{...ci,id:8,conclusion:'failure'}]]) await assert.rejects(verifyGithub(sha,api(sha,runs)));
  await assert.rejects(verifyGithub(sha,api('b'.repeat(40))));
  await assert.rejects(verifyGithub(sha,async()=>{throw Error('timeout');}));
});
test('malformed or incomplete CI API evidence fails closed',async()=>{
  for(const response of [
    {workflow_runs:[ci]}, {total_count:'1',workflow_runs:[ci]}, {total_count:2,workflow_runs:[ci]},
    {total_count:1,workflow_runs:[{...ci,id:undefined}]},
    {total_count:2,workflow_runs:[ci,{...ci,id:'garbled',status:'in_progress',conclusion:null}]},
    {total_count:2,workflow_runs:[ci,{...ci,id:6,status:undefined}]},
  ]) await assert.rejects(verifyGithub(sha,async path=>path.includes('git/ref/')?{object:{sha}}:response));
});
test('DB gate requires complete exact contract and least-privilege read-only observation', () => {
  const contract={format:1,migrations:[{version:'20261027032043',name:'takkeu_hall_of_fame'}],game:{score_max:100000000},
    tables:[{schema:'public',name:'hall',rls:true,columns:[{name:'id',type:'integer'}],policies:[],privileges:[]}],
    functions:[{schema:'public',name:'start_v2',args:'uuid',body:'reviewed',definer:true,config:['search_path=""']} ],readonly_routines:[{name:'pure_read',body:'reviewed'}],event_triggers:[{name:'ensure_rls',body:'reviewed'}]};
  const observation={...structuredClone(contract),read_only:true,least_privilege:true,project:'mlpnjgezrnhdxsxolyzj'};
  assert.doesNotThrow(()=>verifyDatabase(observation,contract));
  for (const mutate of [x=>x.migrations=[],x=>x.tables=[],x=>x.functions=[],x=>x.event_triggers=[],x=>delete x.event_triggers,x=>x.event_triggers[0].body='different',x=>x.read_only=false,
    x=>x.format=2,
    x=>x.least_privilege=false,x=>x.project='wrong',x=>x.functions[0].body='different',x=>x.functions[0].args='text',
    x=>x.functions[0].definer=false,x=>x.functions[0].config=[],x=>x.tables[0].rls=false,
    x=>x.tables[0].policies=['allow all'],x=>x.game.score_max=3500]) {
    const invalid=structuredClone(observation);mutate(invalid);assert.throws(()=>verifyDatabase(invalid,contract));
  }
  for(const invalid of [null,{},'timeout']) assert.throws(()=>verifyDatabase(invalid,contract));
});
test('every publishing workflow is manual, gated and serialized; CI remains automatic', () => {
  const deploy=readFileSync('.github/workflows/deploy.yml','utf8');
  const ci=readFileSync('.github/workflows/ci.yml','utf8');
  assert.doesNotMatch(deploy,/^  (push|pull_request|workflow_run|schedule):/m);
  assert.match(deploy,/^  workflow_dispatch:/m);
  assert.match(deploy,/approve_production:/);
  assert.match(deploy,/cancel-in-progress: false/);
  assert.match(deploy,/node scripts\/release\/check-database.mjs/g);
  assert.match(deploy,/needs: \[validation, verify-build\]/);
  assert.match(ci,/^  push:\n    branches: \[main/m);
  assert.doesNotMatch(ci,/pages: write|id-token: write|check-database/);
});
