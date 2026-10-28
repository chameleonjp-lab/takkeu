import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { prepareMigrationSql } from '../../scripts/release/prepare-production.mjs';
import { prepareInspectorSql } from '../../scripts/release/prepare-rest-inspector.mjs';
import { marker } from '../helpers/mergeReleaseFixture.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
test('A/B production proposals remain byte-identical to the explicitly reviewed SQL',()=>{
  assert.equal(hash(readFileSync('supabase/migrations/20261027032043_takkeu_hall_of_fame.sql','utf8')),'b6a9828852e3b87840348814559353dec8b0286d6d6642dee7952b4fe9ef009b');
  assert.equal(hash(prepareMigrationSql()),'72536610960ad68664bd6da96de48de81832c4287eb3df4a296abc3627fffdc9');
  const b=readFileSync('supabase/migrations/20261028124434_takkeu_release_rest_inspector.sql','utf8');
  assert.equal(hash(b),'6cd7f3b046aee78e960d64363f14ac8b9c1b1e3490bd9c4f96180d6b1d8a7d34');
  assert.equal(prepareInspectorSql(),b);
});
test('release marker names the actual new PR and fixtures exercise that exact release',()=>{
  const target=JSON.parse(readFileSync('scripts/release/release-target.json','utf8'));
  assert.deepEqual(target,{format:1,release:'takkeu-3500-production-ab-final-20261028',pull_request:34,head_ref:'release/3500-production-ab-final-20261028',client_version:'takkeu-web-clear-3500-1'});
  assert.deepEqual(marker,target);
});
test('CI requires live public GET/HEAD proof before its aggregate verify can succeed',()=>{
  const source=readFileSync('.github/workflows/ci.yml','utf8'),ci=parse(source);
  const gate=ci.jobs['production-contract'];
  assert.deepEqual(ci.jobs.verify.needs,['core','browser','production-contract']);
  assert.match(ci.jobs.verify.steps[0].run,/needs\.production-contract\.result/);
  assert.equal(gate.if,undefined);
  const probe=gate.steps.find(s=>s.run?.includes('check-database-rest.mjs'));
  assert.ok(probe);assert.match(probe.run,/set -o pipefail/);
  assert.doesNotMatch(probe.run,/continue-on-error|\|\| true/);
  assert.ok(!Object.values(ci.jobs).some(j=>j['continue-on-error']));
  assert.ok(!gate.steps.some(s=>s['continue-on-error']));
  assert.equal(gate.steps.find(s=>s.uses?.startsWith('actions/upload-artifact@')).if,'always()');
  assert.doesNotMatch(source,/secrets\.|TAKKEU_RELEASE_PG|PGPASSWORD/);
});
