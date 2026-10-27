import { expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createCelebrations, rallyCelebration } from '../../src/game/celebrations';
import { createObjects } from '../../src/render/objects';
import { createCelebrationView } from '../../src/render/celebrations';
import { sampleRandomMotion } from '../../src/render/rainbow';
import { scenario } from '../helpers/scenarios';
import { applyPresentation } from '../../src/render/presentation';

it('crossfades the retained early century environment without a color jump; high-rally overlays are removed',()=>{
  const objects=createObjects(DEFAULT_CONFIG),view=createCelebrationView(DEFAULT_CONFIG,objects.tableRig);
  const s={...scenario(900,20.299).snapshot(),celebrations:rallyCelebration(createCelebrations(),900,20)};
  view.update(s);
  const geometry=(view.worldRoot.children[0] as import('three').Mesh).geometry;
  const before=Array.from(geometry.getAttribute('color').array);
  view.update({...s,simTime:20.301});
  const after=geometry.getAttribute('color').array;
  expect(Math.max(...before.map((value,i)=>Math.abs(value-after[i]!)))).toBeLessThan(.02);
  expect(view.stats().environment).not.toBeNull();
  view.update({...s,score:1000});expect(view.stats().environment).toBeNull();expect(geometry.drawRange.count).toBe(0);
  view.update({...s,simTime:25});expect(view.stats().environment).toBeNull();view.dispose();objects.dispose();
});
it('keeps wide-field brightness modulation subtle while retaining its original period',()=>{
  const objects=createObjects(DEFAULT_CONFIG),base=scenario(510,0).snapshot();
  const value=(time:number)=>{applyPresentation(objects,{...base,simTime:time});return objects.opponentField.material.uniforms.uPulse!.value as number;};
  const values=[0,.15,.3,.45,.6].map(value);
  expect(Math.max(...values)-Math.min(...values)).toBeLessThanOrEqual(.125);
  expect(value(0)).toBeCloseTo(value(2*DEFAULT_CONFIG.pulseHalfPeriod));
  expect(value(0)).toBeGreaterThan(value(DEFAULT_CONFIG.pulseHalfPeriod));objects.dispose();
});
it('keeps procedural color-field motion gradual without removing irregular movement',()=>{
  let max=0;
  for(let i=0;i<1200;i++){
    const a=sampleRandomMotion(i/60,729),b=sampleRandomMotion((i+1)/60,729);
    max=Math.max(max,Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  }
  expect(max).toBeLessThan(.02);
  expect(sampleRandomMotion(2,729)).not.toEqual(sampleRandomMotion(3,729));
});
