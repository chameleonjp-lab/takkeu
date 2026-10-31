import { REPOSITORY, verifyGithub } from './guards.mjs';
export const REPOSITORY_ID=1429598143;
const OWNER_ID=283055705,OWNER='chameleonjp-lab';
const sameRepo=r=>r?.id===REPOSITORY_ID&&r.full_name===REPOSITORY;
const owner=r=>r?.id===OWNER_ID&&r.login===OWNER&&r.type==='User';
function requireThat(condition,message){if(!condition)throw Error(message);}
export async function authorizeMergeRelease({expected,event,context,get}) {
  requireThat(context.eventName==='workflow_run'&&context.ref==='refs/heads/main'&&context.repository===REPOSITORY
    &&context.actor===OWNER&&context.triggeringActor===OWNER,'Only owner main CI completion may release');
  const source=event?.workflow_run;
  requireThat(event?.action==='completed'&&sameRepo(event.repository)&&sameRepo(source?.repository)&&sameRepo(source?.head_repository)
    &&source.event==='push'&&source.head_branch==='main'&&source.conclusion==='success'&&source.status==='completed'
    &&source.head_sha===expected&&Number.isSafeInteger(source.id)&&source.id>0&&source.workflow_id===392845635
    &&source.path==='.github/workflows/ci.yml'&&source.name==='CI','Untrusted CI completion event');
  const repository=await get('');
  requireThat(sameRepo(repository)&&owner(repository.owner)&&repository.default_branch==='main','Repository identity changed');
  const ci=await verifyGithub(expected,get);
  requireThat(ci.ci_run_id===source.id,'Superseded CI run');
  const formalRun=await get(`/actions/runs/${source.id}`);
  requireThat(formalRun.id===source.id&&formalRun.run_attempt===source.run_attempt&&formalRun.run_attempt>=1
    &&sameRepo(formalRun.repository)&&sameRepo(formalRun.head_repository)&&owner(formalRun.actor)&&owner(formalRun.triggering_actor)
    &&formalRun.workflow_id===392845635&&formalRun.path==='.github/workflows/ci.yml'&&formalRun.name==='CI'
    &&formalRun.event==='push'&&formalRun.head_branch==='main'&&formalRun.head_sha===expected
    &&formalRun.status==='completed'&&formalRun.conclusion==='success','Official CI run mismatch');
  const associated=await get(`/commits/${expected}/pulls?per_page=100`);
  requireThat(Array.isArray(associated)&&associated.length<100,'Associated merge evidence unavailable');
  const candidates=associated.filter(pr=>pr?.merge_commit_sha===expected&&pr?.base?.ref==='main'&&sameRepo(pr.base.repo));
  requireThat(candidates.length===1&&Number.isSafeInteger(candidates[0].number)&&candidates[0].number>0,'Exact commit must identify one merged PR');
  const pr=await get(`/pulls/${candidates[0].number}`);
  requireThat(pr.number===candidates[0].number&&pr.state==='closed'&&pr.merged===true&&pr.draft===false
    &&Number.isFinite(Date.parse(pr.merged_at))&&pr.merge_commit_sha===expected&&owner(pr.merged_by)
    &&pr.base?.ref==='main'&&sameRepo(pr.base.repo)&&typeof pr.head?.ref==='string'&&pr.head.ref!=='main'&&sameRepo(pr.head.repo)
    &&Number.isSafeInteger(pr.changed_files)&&pr.changed_files>0&&pr.changed_files<=3000,'Official owner merge evidence missing');
  const files=[];
  for(let page=1;page<=Math.ceil(pr.changed_files/100);page++){
    const rows=await get(`/pulls/${pr.number}/files?per_page=100&page=${page}`);
    requireThat(Array.isArray(rows)&&rows.length<=100,'PR file evidence unavailable');files.push(...rows);
  }
  requireThat(files.length===pr.changed_files&&new Set(files.map(f=>f.filename)).size===files.length
    &&files.every(f=>typeof f.filename==='string'&&f.filename.length>0),'Reviewed PR file evidence unavailable');
  await verifyPagesEnvironment(get);
  const deployments=await get(`/deployments?sha=${expected}&environment=github-pages&per_page=100`);
  requireThat(Array.isArray(deployments)&&deployments.length<100,'Deployment history unavailable');
  for(const deployment of deployments){
    requireThat(Number.isSafeInteger(deployment.id)&&deployment.sha===expected&&deployment.environment==='github-pages','Deployment identity unavailable');
    const statuses=await get(`/deployments/${deployment.id}/statuses?per_page=100`);
    requireThat(Array.isArray(statuses)&&statuses.length<100,'Deployment status unavailable');
    requireThat(!statuses.some(s=>s.state==='success'),'SHA already published successfully');
  }
  requireThat((await get('/git/ref/heads/main'))?.object?.sha===expected,'main moved during authorization');
  return {...ci,release:`owner-merge-${pr.number}`,pull_request:pr.number,merged_by:pr.merged_by.login,merged_by_id:pr.merged_by.id,ci_run_attempt:formalRun.run_attempt,environment:'github-pages'};
}
export async function verifyPagesEnvironment(get) {
  const pages=await get('/pages');
  requireThat(pages?.html_url==='https://chameleonjp-lab.github.io/takkeu/'&&pages.build_type==='workflow'
    &&pages.https_enforced===true&&pages.cname===null,'Pages target/settings changed');
  const environment=await get('/environments/github-pages');
  requireThat(Array.isArray(environment?.protection_rules)&&environment.protection_rules.length===1
    &&environment.protection_rules[0].type==='branch_policy'&&environment.deployment_branch_policy?.protected_branches===false
    &&environment.deployment_branch_policy.custom_branch_policies===true,'Environment requires extra approval or lost branch protection');
  const branches=await get('/environments/github-pages/deployment-branch-policies');
  requireThat(branches?.total_count===1&&branches.branch_policies?.length===1&&branches.branch_policies[0].name==='main'
    &&branches.branch_policies[0].type==='branch','Environment must allow main only');
}
