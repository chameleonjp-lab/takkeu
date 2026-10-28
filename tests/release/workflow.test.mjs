import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { assertDispatch, verifyGithub, verifyDatabase } from '../../scripts/release/guards.mjs';

const workflow=parse(readFileSync('.github/workflows/deploy.yml','utf8'));
const sha='a'.repeat(40);
const context={event:'workflow_dispatch',ref:'refs/heads/main',repository:'chameleonjp-lab/takkeu',expected:sha,
  workflowSha:sha,actor:'chameleonjp-lab',triggeringActor:'chameleonjp-lab',approval:'true'};
const contract=JSON.parse(readFileSync('scripts/release/expected-contract.json','utf8'));
const database={...contract,read_only:true,least_privilege:true,project:'mlpnjgezrnhdxsxolyzj'};
const ci={id:1,workflow_id:392845635,path:'.github/workflows/ci.yml',event:'push',head_branch:'main',head_sha:sha,status:'completed',conclusion:'success'};
// Evaluate the actual workflow graph and its known job if expression. Real
// predicates are used; deploy-pages is replaced by a counter, never called.
async function exercise(options={}){
  const e={...context,...options.event};let deployments=0;const states={};let checks=0;
  if(!Object.hasOwn(workflow.on,e.event))return {deployments,states};
  for(const [name,job] of Object.entries(workflow.jobs)){
    if(job.if){assert.equal(job.if,"github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'");if(e.event!=='workflow_dispatch'||e.ref!=='refs/heads/main'){states[name]='skipped';continue;}}
    if([job.needs??[]].flat().some(n=>states[n]!=='success')){states[name]='skipped';continue;}
    try{
      if(job.uses){assert.equal(job.uses,'./.github/workflows/ci.yml');if(options.validation===false)throw Error('CI failed');}
      for(const step of job.steps??[]){
        if(step.run?.includes('scripts/release/check-github.mjs')){
          assertDispatch(e);checks++;
          await verifyGithub(e.expected,async path=>path.includes('git/ref/')?{object:{sha:options.mainMoved&&checks>1?'b'.repeat(40):sha}}:
            {total_count:1,workflow_runs:[{...ci,...options.ci}]});
        }
        if(step.run?.includes('npm run verify:release') && options.distribution===false)throw Error('Distribution failed');
        if(step.run?.includes('scripts/release/check-database.mjs')){
          if(options.databaseUnavailable)throw Error('DB auth/timeout');
          verifyDatabase(options.database??database,contract);
        }
        if(step.uses?.startsWith('actions/deploy-pages@'))deployments++;
      }
      states[name]='success';
    }catch{states[name]='failure';}
  }
  return {deployments,states};
}
test('actual workflow graph blocks every emergency failure mode and permits the approved complete path without publishing',async()=>{
  for(const options of [
    {event:{event:'push'}},{event:{approval:'false'}},{event:{expected:'b'.repeat(40),workflowSha:'b'.repeat(40)}},
    {event:{ref:'refs/heads/old'}},{ci:{conclusion:'failure'}},{validation:false},{distribution:false},
    {database:{...database,migrations:[]}},{database:{...database,functions:database.functions.slice(1)}},
    {database:{...database,least_privilege:false}},{databaseUnavailable:true},{mainMoved:true},
  ])assert.equal((await exercise(options)).deployments,0,JSON.stringify(options).slice(0,100));
  assert.equal((await exercise()).deployments,1);
});
test('all publishing paths use the single manual graph; normal CI has no production secrets',()=>{
  for(const file of readdirSync('.github/workflows')){
    const source=readFileSync(`.github/workflows/${file}`,'utf8');const parsed=parse(source);
    if(/deploy-pages@|pages: write/.test(source)){
      assert.equal(file,'deploy.yml');assert.deepEqual(Object.keys(parsed.on),['workflow_dispatch']);
      assert.equal(parsed.concurrency.group,'takkeu-pages');assert.equal(parsed.concurrency['cancel-in-progress'],false);
      assert.deepEqual(parsed.jobs.deploy.needs,['validation','verify-build']);assert.equal(parsed.jobs.deploy.environment.name,'github-pages');
      const steps=parsed.jobs.deploy.steps;const db=steps.findIndex(s=>s.run==='node scripts/release/check-database.mjs');
      const lastMain=steps.findIndex(s=>s.name?.startsWith('Recheck main immediately'));const deploy=steps.findIndex(s=>s.uses?.startsWith('actions/deploy-pages@'));
      assert.ok(db>=0&&db<lastMain&&lastMain<deploy);assert.equal(deploy,steps.length-1);
    }else{assert.doesNotMatch(source,/TAKKEU_RELEASE_PG|check-database|secrets: inherit/);}
  }
});
