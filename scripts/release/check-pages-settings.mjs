import { verifyPagesEnvironment } from './merge-authorization.mjs';
import { REPOSITORY } from './guards.mjs';

try {
  if(!process.env.GH_TOKEN)throw Error('GitHub read token missing');
  const allowed=new Set(['/pages','/environments/github-pages','/environments/github-pages/deployment-branch-policies']);
  const evidence={};
  const get=async path=>{
    if(!allowed.has(path))throw Error('Unexpected settings route');
    const response=await fetch(`https://api.github.com/repos/${REPOSITORY}${path}`,{method:'GET',redirect:'error',
      headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
      signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`GitHub settings API HTTP ${response.status}`);
    const data=await response.json();
    if(path==='/pages')evidence.pages={html_url:data.html_url,build_type:data.build_type,https_enforced:data.https_enforced,cname:data.cname};
    if(path==='/environments/github-pages')evidence.environment={protection_rules:data.protection_rules,deployment_branch_policy:data.deployment_branch_policy};
    if(path.endsWith('/deployment-branch-policies'))evidence.branches=data;
    return data;
  };
  await verifyPagesEnvironment(get);
  console.log(JSON.stringify({observed_at:new Date().toISOString(),result:'matched',repository:REPOSITORY,...evidence}));
} catch(error) {
  console.error(`Pages read-only readiness failed: ${error.message}. No deploy.`);
  process.exitCode=1;
}
