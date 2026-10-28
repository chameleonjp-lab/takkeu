import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildContract } from '../helpers/releaseContract.mjs';
import { verifyDatabase } from '../../scripts/release/guards.mjs';
test('reviewed contract equals offline production baseline plus actual migration; all partial security states fail',async()=>{
  const contract=JSON.parse(readFileSync('scripts/release/expected-contract.json','utf8'));
  assert.deepEqual(await buildContract(),contract);
  assert.equal(contract.tables.length,11);assert.equal(contract.functions.length,22);
  const observation={...structuredClone(contract),read_only:true,least_privilege:true,project:'mlpnjgezrnhdxsxolyzj'};
  assert.doesNotThrow(()=>verifyDatabase(observation,contract));
  for(const field of ['tables','functions','readonly_routines','event_triggers']) for(let i=0;i<contract[field].length;i++) {
    const partial=structuredClone(observation);partial[field].splice(i,1);assert.throws(()=>verifyDatabase(partial,contract));
  }
  for(const table of observation.tables) {
    for(const field of ['columns','column_acls','constraints','indexes','policies','privileges','triggers']) {
      const broken=structuredClone(observation);broken.tables.find(t=>t.name===table.name)[field]=['incorrect'];assert.throws(()=>verifyDatabase(broken,contract));
    }
  }
  for(const field of ['args','body','definer','config','owner','result','privileges','public_execute']) {
    const broken=structuredClone(observation);broken.functions[0][field]='incorrect';assert.throws(()=>verifyDatabase(broken,contract));
  }
});
