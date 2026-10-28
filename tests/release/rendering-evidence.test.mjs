import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertRenderingEvidence} from '../helpers/renderingEvidence.mjs';
function observed(){
 return {first:{score:555},final:{phase:'running',score:800},samples:[
  {renderedScore:4000,renderCount:1,drawCalls:26,physicalScore:555},
  {renderedScore:4000,renderCount:2,drawCalls:26,physicalScore:800}
 ],renderEvidence:{count:3,score:4000,litPixels:1000,capture:false}};
}
test('accepts diagnostic4000 only with actual continued drawing and physical scores below3500',()=>{
 assert.doesNotThrow(()=>assertRenderingEvidence(observed(),4000));
});
test('rejects sampling-only fast frames, skipped rendering and a wrong stage',()=>{
 for(const mutate of [
  r=>r.samples[1].renderCount=1,
  r=>r.samples[0].renderCount=0,
  r=>r.samples[0].drawCalls=0,
  r=>r.samples[1].renderedScore=555,
  r=>r.samples=[],
  r=>r.renderEvidence.count=2
 ]){
  const row=observed();mutate(row);assert.throws(()=>assertRenderingEvidence(row,4000));
 }
});
test('rejects blank or incomplete capture and production ending bypass',()=>{
 for(const mutate of [
  r=>r.renderEvidence.litPixels=0,
  r=>r.renderEvidence.capture=true,
  r=>r.first.score=4000,
  r=>r.samples[1].physicalScore=3500,
  r=>r.final.score=4000,
  r=>r.final.phase='gameover'
 ]){
  const row=observed();mutate(row);assert.throws(()=>assertRenderingEvidence(row,4000));
 }
});
