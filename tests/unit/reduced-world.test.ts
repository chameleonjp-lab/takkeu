import { expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createCelebrations, rallyCelebration, lossCelebration } from '../../src/game/celebrations';
import { createObjects } from '../../src/render/objects';
import { createCelebrationView } from '../../src/render/celebrations';
import { applyPresentation } from '../../src/render/presentation';
import { createFireworks } from '../../src/render/particles';
import { scenario } from '../helpers/scenarios';

it('reduced motion freezes court colors while preserving actual ball and paddle coordinates',()=>{
  const objects=createObjects(DEFAULT_CONFIG),snapshot=scenario(510,20).snapshot();
  applyPresentation(objects,snapshot,true);
  const uniforms=JSON.stringify(objects.opponentField.material.uniforms);
  applyPresentation(objects,{...snapshot,simTime:20.5,paddle:{x:.2,y:.5}},true);
  expect(JSON.stringify(objects.opponentField.material.uniforms)).toBe(uniforms);
  expect(objects.playerPaddle.position.x).toBe(.2);objects.dispose();
});

it('reduced motion keeps legacy electricity static and disables decorative table shaking',()=>{
  const objects=createObjects(DEFAULT_CONFIG),view=createCelebrationView(DEFAULT_CONFIG,objects.tableRig);
  let celebrations=rallyCelebration(createCelebrations(),555,20);
  for(let n=1;n<=4;n++)celebrations=lossCelebration(celebrations,n,20);
  const base={...scenario(555,20.1).snapshot(),celebrations};
  view.update(base,true);
  const positions=Array.from(view.lightning.geometry.attributes.position!.array);
  expect(objects.tableRig.position.length()).toBe(0);
  view.update({...base,simTime:20.2},true);
  expect(Array.from(view.lightning.geometry.attributes.position!.array)).toEqual(positions);
  expect(view.stats().edgeBolts).toBe(48);view.dispose();objects.dispose();
});
it('reduced motion retains a fading firework marker without particle travel',()=>{
  const f=createFireworks(),snapshot={...scenario(530,20).snapshot(),runId:'reduce'};
  f.update(snapshot,[{id:'hit',runId:'reduce',kind:'player-hit',time:20,position:{x:.2,y:.5,z:1.95},effect:'racket-firework'}],'standard',true);
  const positions=Array.from(f.geometry.attributes.position!.array);
  f.update({...snapshot,simTime:20.3},[],'standard',true);
  expect(Array.from(f.geometry.attributes.position!.array)).toEqual(positions);
  expect(f.active()).toBe(24);f.dispose();
});
it('dims ordinary fireworks for higher-priority cues without dropping their particles',()=>{
  const f=createFireworks(),snapshot={...scenario(1000,20).snapshot(),runId:'priority'};
  f.update(snapshot,[{id:'hit',runId:'priority',kind:'player-hit',time:20,position:{x:.2,y:.5,z:1.95},effect:'racket-firework'}],'standard',false,.4);
  expect(f.active()).toBe(24);expect(f.geometry.getAttribute('opacity').getX(0)).toBeCloseTo(.32);f.dispose();
});
