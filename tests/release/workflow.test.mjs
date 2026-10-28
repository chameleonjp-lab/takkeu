import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { authorizeMergeRelease } from '../../scripts/release/merge-authorization.mjs';
import { checkDatabaseRest, fingerprintContract, expectedInspectorHash } from '../../scripts/release/rest-contract.mjs';
import { inspectorMetadata } from '../../scripts/release/prepare-rest-inspector.mjs';
import { fixture, sha } from '../helpers/mergeReleaseFixture.mjs';
const workflow=parse(readFileSync('.github/workflows/deploy.yml','utf8'));
const contract=JSON.parse(readFileSync('scripts/release/expected-contract.json'));
// Execute predicates from the actual YAML and the real gate functions. Only
// external API responses and deploy-pages are substituted. Never publish here.
async function exercise(options={}) {
  const f=fixture(options.api);options.mutate?.(f);let deployments=0,checks=0,dbChecks=0;const states={};
  if(!Object.hasOwn(workflow.on,f.context.eventName))return {deployments,states};
  const github={event_name:f.context.eventName,ref:f.context.ref,repository:f.context.repository,event:f.event};
  for(const [name,job] of Object.entries(workflow.jobs)) {
    if(job.if&&!Function('github',`return (${job.if});`)(github)){states[name]='skipped';continue;}
    if([job.needs??[]].flat().some(n=>states[n]!=='success')){states[name]='skipped';continue;}
    try {
      for(const step of job.steps??[]) {
        if(step.run?.includes('scripts/release/check-github.mjs')) {
          checks++;if(options.mainMoved&&checks>1)throw Error('main moved');await authorizeMergeRelease(f);
        }
        if(step.run?.includes('scripts/release/check-database-rest.mjs')) {
          dbChecks++;if(options.dbTimeout)throw Error('timeout');
          const c=structuredClone(contract);if(options.missingMigration)c.migrations=[];if(options.partialRpc)c.functions.pop();if(options.contractDrift)c.tables[0].rls=false;
          const nonce='test-probe';const now=Date.now();
          await checkDatabaseRest({nonce,now,fetcher:async(u,o)=>o.method==='HEAD'?new Response(null,{status:u.includes('takkeu_release_missing_v1')?404:200}):new Response(JSON.stringify({format:2,project:'mlpnjgezrnhdxsxolyzj',read_only:true,nonce,observed_at:new Date(now).toISOString(),fingerprints:fingerprintContract(options.dbMoved&&dbChecks>1?{...c,functions:[]}:c),inspector_sha256:expectedInspectorHash()}),{status:options.authFailed?401:200,headers:{'content-type':'application/json'}})});
        }
        if(step.run?.includes('npm run verify:release')&&options.distributionFailed)throw Error('distribution failed');
        if(step.run?.includes('distribution.mjs compare')&&options.ciBytesDiffer)throw Error('CI byte mismatch');
        if(step.run?.includes('distribution.mjs tar')&&options.uploadBytesDiffer)throw Error('uploaded tar differs');
        if(step.name?.startsWith('Recheck main immediately')&&options.lastMainMoved)throw Error('main moved at final fence');
        if(step.uses?.startsWith('actions/deploy-pages@'))deployments++;
      }
      states[name]='success';
    }catch{states[name]='failure';}
  }
  return {deployments,states};
}
test('actual workflow rejects all predeploy failures and reaches deploy only for owner-merged exact current main',async()=>{
  for(const options of [
    {mutate:f=>f.context.eventName='pull_request'},{mutate:f=>f.context.eventName='push'},{mutate:f=>f.event.workflow_run.event='pull_request'},
    {mutate:f=>f.event.workflow_run.head_branch='feature'},{mutate:f=>f.context.actor='other'},{mutate:f=>f.event.workflow_run.conclusion='failure'},
    {api:{'/pulls/32':{merged:false}}},{api:{'/pulls/32':{draft:true}}},
    {api:{'/git/ref/heads/main':{object:{sha:'b'.repeat(40)}}}},
    {missingMigration:true},{partialRpc:true},{contractDrift:true},{dbTimeout:true},{authFailed:true},
    {distributionFailed:true},{ciBytesDiffer:true},{uploadBytesDiffer:true},{mainMoved:true},{lastMainMoved:true},{dbMoved:true},
  ])assert.equal((await exercise(options)).deployments,0,JSON.stringify(options));
  assert.equal((await exercise()).deployments,1);
});
test('actual YAML uses only main CI completion, explicit SHA, same-run artifact, repeated DB/main checks and postdeploy byte checks',()=>{
  for(const file of readdirSync('.github/workflows')) {
    const source=readFileSync(`.github/workflows/${file}`,'utf8');const parsed=parse(source);
    if(!/deploy-pages@|pages: write/.test(source)){assert.doesNotMatch(source,/TAKKEU_RELEASE_PG|secrets: inherit/);continue;}
    assert.equal(file,'deploy.yml');assert.deepEqual(Object.keys(parsed.on),['workflow_run']);
    assert.deepEqual(parsed.on.workflow_run,{workflows:['CI'],types:['completed'],branches:['main']});
    assert.equal(parsed.env.EXPECTED_SHA,'${{ github.event.workflow_run.head_sha }}');
    assert.equal(parsed.concurrency.group,'takkeu-pages');assert.equal(parsed.concurrency['cancel-in-progress'],false);
    assert.deepEqual(parsed.jobs.deploy.needs,['preflight','verify-build']);assert.equal(parsed.jobs.deploy.environment.name,'github-pages');
    assert.ok(!Object.values(parsed.jobs).some(j=>j.uses)); // no redundant full CI workflow call
    const steps=parsed.jobs.deploy.steps;const db=steps.findIndex(s=>s.run==='node scripts/release/check-database-rest.mjs');
    const fence=steps.findIndex(s=>s.name?.startsWith('Recheck main immediately'));const deploy=steps.findIndex(s=>s.uses?.startsWith('actions/deploy-pages@'));
    assert.ok(db>=0&&db<fence&&fence<deploy);assert.match(steps[deploy+1].run,/distribution.mjs live/);
    const downloads=steps.filter(s=>s.uses?.startsWith('actions/download-artifact@'));assert.equal(downloads.length,2);
    for(const s of downloads){assert.equal(s.with['run-id'],undefined);assert.equal(s.with['github-token'],undefined);}
    assert.doesNotMatch(source,/secrets\.|PGPASSWORD|workflow_dispatch|approve_production/);
    assert.equal(parsed.jobs['verify-build'].steps.filter(s=>s.uses?.startsWith('actions/upload-pages-artifact@')).length,1);
  }
});
