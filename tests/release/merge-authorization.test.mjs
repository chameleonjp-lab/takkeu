import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeMergeRelease } from '../../scripts/release/merge-authorization.mjs';
import { fixture, sha, marker } from '../helpers/mergeReleaseFixture.mjs';
const owner={login:'chameleonjp-lab',id:283055705,type:'User'};
const source=fixture();const run=source.event.workflow_run;
const pr=await source.get('/pulls/32');
test('formal owner merge plus successful exact main CI and explicit release marker authorizes',async()=>{
  assert.equal((await authorizeMergeRelease(fixture())).main_sha,sha);
});
test('PR-only/draft/branch/direct-push/non-owner/unmerged/stale/failed/forged run all stop',async()=>{
  for(const mutate of [
    x=>x.context.eventName='pull_request',x=>x.context.actor='other',x=>x.context.triggeringActor='other',x=>x.context.ref='refs/heads/feature',
    x=>x.event.workflow_run.event='pull_request',x=>x.event.workflow_run.head_branch='feature',x=>x.event.workflow_run.head_repository.id=42,
    x=>x.event.workflow_run.conclusion='failure',x=>x.event.workflow_run.id=9,x=>x.expected='b'.repeat(40),x=>x.marker.pull_request=0,
  ]){const x=fixture();mutate(x);await assert.rejects(authorizeMergeRelease(x));}
  for(const changes of [{merged:false},{draft:true},{merged_by:{...owner,id:1}},{merged_by:{...owner,login:'other'}},{merge_commit_sha:'b'.repeat(40)},{base:{...pr.base,ref:'feature'}},{head:{...pr.head,repo:{id:42}}},{changed_files:2}])await assert.rejects(authorizeMergeRelease(fixture({'/pulls/32':{...pr,...changes}})));
  for(const changes of [{conclusion:'failure'},{status:'in_progress'},{event:'pull_request'},{workflow_id:1},{head_branch:'elsewhere'},{run_attempt:2},{actor:{...owner,id:1}}])await assert.rejects(authorizeMergeRelease(fixture({'/actions/runs/7':{...run,...changes}})));
  await assert.rejects(authorizeMergeRelease(fixture({'/git/ref/heads/main':{object:{sha:'b'.repeat(40)}}})));
  await assert.rejects(authorizeMergeRelease(fixture({'/pulls/32/files?per_page=100&page=1':[{filename:'other',status:'modified'}]})));
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
