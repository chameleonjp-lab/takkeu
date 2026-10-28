import { assertDispatch, verifyGithub, REPOSITORY } from './guards.mjs';
const e=process.env;
try {
  assertDispatch({event:e.GITHUB_EVENT_NAME,ref:e.GITHUB_REF,repository:e.GITHUB_REPOSITORY,
    expected:e.EXPECTED_SHA,workflowSha:e.GITHUB_SHA,actor:e.GITHUB_ACTOR,triggeringActor:e.GITHUB_TRIGGERING_ACTOR,approval:e.APPROVE_PRODUCTION});
  if (!e.GH_TOKEN) throw Error('GitHub read token missing');
  const get=async path=>{
    const r=await fetch(`https://api.github.com/repos/${REPOSITORY}${path}`,{
      headers:{Authorization:`Bearer ${e.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw Error('GitHub release evidence unavailable');
    return r.json();
  };
  console.log(JSON.stringify({observed_at:new Date().toISOString(),...await verifyGithub(e.EXPECTED_SHA,get)}));
} catch { console.error('GitHub release gate failed (dispatch approval, SHA or latest main CI). No deploy.');process.exitCode=1; }
