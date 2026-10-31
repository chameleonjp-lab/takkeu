import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeMergeRelease } from '../../scripts/release/merge-authorization.mjs';
import { fixture, sha } from '../helpers/mergeReleaseFixture.mjs';
const owner={login:'chameleonjp-lab',id:283055705,type:'User'};
const source=fixture();const run=source.event.workflow_run;
const pr=await source.get('/pulls/35');
test('formal owner merge plus successful exact main CI authorizes',async()=>{
  assert.equal((await authorizeMergeRelease(fixture())).main_sha,sha);
});
test('PR-only/draft/branch/direct-push/non-owner/unmerged/stale/failed/forged run all stop',async()=>{
  for(const mutate of [
    x=>x.context.eventName='pull_request',x=>x.context.actor='other',x=>x.context.triggeringActor='other',x=>x.context.ref='refs/heads/feature',
    x=>x.event.workflow_run.event='pull_request',x=>x.event.workflow_run.head_branch='feature',x=>x.event.workflow_run.head_repository.id=42,
    x=>x.event.workflow_run.conclusion='failure',x=>x.event.workflow_run.id=9,x=>x.expected='b'.repeat(40),
  ]){const x=fixture();mutate(x);await assert.rejects(authorizeMergeRelease(x));}
  for(const changes of [{merged:false},{draft:true},{merged_by:{...owner,id:1}},{merged_by:{...owner,login:'other'}},{merge_commit_sha:'b'.repeat(40)},{base:{...pr.base,ref:'feature'}},{base:{...pr.base,repo:{id:42}}},{head:{...pr.head,repo:{id:42}}},{changed_files:2}])await assert.rejects(authorizeMergeRelease(fixture({'/pulls/35':{...pr,...changes}})));
  for(const changes of [{conclusion:'failure'},{status:'in_progress'},{event:'pull_request'},{workflow_id:1},{head_branch:'elsewhere'},{run_attempt:2},{actor:{...owner,id:1}}])await assert.rejects(authorizeMergeRelease(fixture({'/actions/runs/7':{...run,...changes}})));
  await assert.rejects(authorizeMergeRelease(fixture({'/git/ref/heads/main':{object:{sha:'b'.repeat(40)}}})));
  await assert.rejects(authorizeMergeRelease(fixture({[`/commits/${sha}/pulls?per_page=100`]:[]})));
});
test('extra environment approval, unsupported Pages settings, previous SHA deployment and API failures stop',async()=>{
  for(const data of [
    {'/environments/github-pages':{protection_rules:[{type:'required_reviewers'}]}},
    {'/environments/github-pages/deployment-branch-policies':{total_count:1,branch_policies:[{name:'*',type:'branch'}]}},
    {'/pages':{html_url:'https://evil.invalid/',build_type:'workflow',https_enforced:true,cname:null}},
    {[`/deployments?sha=${sha}&environment=github-pages&per_page=100`]:[{id:9,sha,environment:'github-pages'}],'/deployments/9/statuses?per_page=100':[{state:'success'}]},
  ])await assert.rejects(authorizeMergeRelease(fixture(data)));
  const f=fixture();f.get=async()=>{throw Error('API denied/timeout')};await assert.rejects(authorizeMergeRelease(f));
});

test('a future reviewed owner PR can release its exact merge SHA without changing a marker',async()=>{
  const f=fixture(), get=f.get;
  const next={...pr,number:99,head:{...pr.head,ref:'fix/common-spec'}};
  f.get=path=>path===`/commits/${sha}/pulls?per_page=100`?Promise.resolve([next]):
    path==='/pulls/99'?Promise.resolve(next):
    path==='/pulls/99/files?per_page=100&page=1'?Promise.resolve([{filename:'src/ui/screens.ts',status:'modified'}]):get(path);
  assert.equal((await authorizeMergeRelease(f)).pull_request,99);
});
test('ambiguous or unbounded associated PR results refuse deployment',async()=>{
  for(const candidates of [[pr,pr],Array(100).fill(pr),null]) {
    await assert.rejects(authorizeMergeRelease(fixture({[`/commits/${sha}/pulls?per_page=100`]:candidates})));
  }
});
