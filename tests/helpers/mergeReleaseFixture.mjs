import assert from 'node:assert/strict';
export const sha='a'.repeat(40),repo='chameleonjp-lab/takkeu',owner={login:'chameleonjp-lab',id:283055705,type:'User'};
export const marker={format:1,release:'takkeu-3500-production-ab-final-20261028',pull_request:34,head_ref:'release/3500-production-ab-final-20261028',client_version:'takkeu-web-clear-3500-1'};
const run={id:7,run_attempt:1,name:'CI',workflow_id:392845635,path:'.github/workflows/ci.yml',event:'push',head_branch:'main',head_sha:sha,status:'completed',conclusion:'success',repository:{id:1429598143,full_name:repo},head_repository:{id:1429598143,full_name:repo},actor:owner,triggering_actor:owner};
const pr={number:34,state:'closed',merged:true,merged_at:'2026-10-28T12:00:00Z',draft:false,merge_commit_sha:sha,merged_by:owner,base:{ref:'main',repo:{id:1429598143,full_name:repo}},head:{ref:marker.head_ref,repo:{id:1429598143,full_name:repo}},changed_files:1};
const event={action:'completed',repository:{id:1429598143,full_name:repo},workflow_run:run};
const context={eventName:'workflow_run',ref:'refs/heads/main',repository:repo,actor:owner.login,triggeringActor:owner.login,runId:'8'};
export function fixture(overrides={}){
  const responses={
    '':{id:1429598143,full_name:repo,owner,default_branch:'main'},
    '/git/ref/heads/main':{object:{sha}},
    '/actions/runs/7':run,
    [`/actions/workflows/ci.yml/runs?head_sha=${sha}&branch=main&event=push&per_page=100`]:{total_count:1,workflow_runs:[run]},
    '/pulls/34':pr,'/pulls/34/files?per_page=100&page=1':[{filename:'scripts/release/release-target.json',status:'added'}],
    '/pages':{html_url:'https://chameleonjp-lab.github.io/takkeu/',build_type:'workflow',https_enforced:true,cname:null},
    '/environments/github-pages':{protection_rules:[{type:'branch_policy'}],deployment_branch_policy:{protected_branches:false,custom_branch_policies:true}},
    '/environments/github-pages/deployment-branch-policies':{total_count:1,branch_policies:[{name:'main',type:'branch'}]},
    [`/deployments?sha=${sha}&environment=github-pages&per_page=100`]:[],
    ...overrides};
  return {expected:sha,event:structuredClone(event),context:structuredClone(context),marker:structuredClone(marker),get:async path=>{assert.ok(Object.hasOwn(responses,path),`unexpected API ${path}`);return structuredClone(responses[path]);}};
}
