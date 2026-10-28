import assert from 'node:assert/strict';

// Validate observed drawing, never the requested stage or sampler RAF alone.
export function assertRenderingEvidence(row,expectedScore){
 assert.equal(row.first.score,555,'Unexpected physical start');
 assert.equal(row.final.phase,'running','Scene stopped');
 assert.ok(row.final.score<3500,'Production ending must remain active');
 assert.equal(row.samples.length>0,true,'No samples');
 let last=0;
 for(const sample of row.samples){
  assert.equal(sample.renderedScore,expectedScore,'Wrong rendered stage');
  assert.ok(sample.renderCount>last,'Rendering stopped while sampling continued');
  assert.ok(sample.drawCalls>0,'No draw calls');
  assert.ok(sample.physicalScore>=555&&sample.physicalScore<3500,'Unexpected physical score');
  last=sample.renderCount;
 }
 assert.ok(row.renderEvidence.count>last,'Final capture did not draw');
 assert.equal(row.renderEvidence.score,expectedScore);
 assert.ok(row.renderEvidence.litPixels>100,'Blank canvas');
 assert.equal(row.renderEvidence.capture,false,'Readback was not completed');
}
