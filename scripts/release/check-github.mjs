import { readFileSync, appendFileSync } from 'node:fs';
import { authorizeMergeRelease } from './merge-authorization.mjs';
import { REPOSITORY } from './guards.mjs';
const e=process.env;
try {
  if (!e.GH_TOKEN) throw Error('GitHub read token missing');
  const get=async path=>{
    const r=await fetch(`https://api.github.com/repos/${REPOSITORY}${path}`,{method:'GET',redirect:'error',
      headers:{Authorization:`Bearer ${e.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw Error(`GitHub API unavailable: ${path.split('?')[0]} HTTP ${r.status}`);
    return r.json();
  };
  const event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH,'utf8'));
  const result=await authorizeMergeRelease({expected:e.EXPECTED_SHA,event,
    context:{eventName:e.GITHUB_EVENT_NAME,ref:e.GITHUB_REF,repository:e.GITHUB_REPOSITORY,actor:e.GITHUB_ACTOR,triggeringActor:e.GITHUB_TRIGGERING_ACTOR,runId:e.GITHUB_RUN_ID},
    get});
  if(e.GITHUB_OUTPUT)appendFileSync(e.GITHUB_OUTPUT,`sha=${result.main_sha}\nci_run_id=${result.ci_run_id}\n`);
  console.log(JSON.stringify({observed_at:new Date().toISOString(),...result}));
} catch(error) {
  console.error(`GitHub merge release gate failed: ${error.message}. No deploy.`);process.exitCode=1;
}
