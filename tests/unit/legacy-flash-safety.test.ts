import { expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createCelebrations, lossCelebration, rallyCelebration } from '../../src/game/celebrations';
import { createObjects } from '../../src/render/objects';
import { createCelebrationView } from '../../src/render/celebrations';
import { scenario } from '../helpers/scenarios';

function stress() {
  let celebrations=createCelebrations();
  for(let i=1;i<=100;i++)celebrations=lossCelebration(celebrations,i,20);
  celebrations=rallyCelebration(celebrations,1111,20);
  const objects=createObjects(DEFAULT_CONFIG),view=createCelebrationView(DEFAULT_CONFIG,objects.tableRig);
  return {objects,view,snapshot:{...scenario(4000,20.05).snapshot(),celebrations}};
}
it('keeps the maximum legacy net burst near the net with a fixed visible density',()=>{
  const {objects,view,snapshot}=stress();view.update(snapshot);
  expect(view.stats().netBolts).toBeLessThanOrEqual(24);
  const p=view.lightning.geometry.getAttribute('position');
  let maxY=-Infinity;
  for(let i=0;i<view.lightning.geometry.drawRange.count;i++)maxY=Math.max(maxY,p.getY(i));
  expect(maxY).toBeLessThan(1.2);
  // All existing 14 digit events remain; only the unsafe spatial burst is bounded.
  expect(view.stats().numbers).toHaveLength(14);view.dispose();objects.dispose();
});
it('uses a damped low-frequency shake without frame-to-frame table jumps',()=>{
  const {objects,view,snapshot}=stress();let maximumStep=0;
  view.update({...snapshot,simTime:20});let previous=objects.tableRig.position.clone();
  for(let n=1;n<54;n++){
    view.update({...snapshot,simTime:20+n/60});
    maximumStep=Math.max(maximumStep,objects.tableRig.position.distanceTo(previous));
    previous.copy(objects.tableRig.position);
  }
  expect(maximumStep).toBeLessThan(.012);view.dispose();objects.dispose();
});
it('dims competing legacy electricity without dimming the protected loss digits',()=>{
  const {objects,view,snapshot}=stress();view.update({...snapshot,simTime:20.31},false,.4);
  const colors=view.lightning.geometry.getAttribute('color');
  let alpha=0;for(let i=0;i<view.lightning.geometry.drawRange.count;i++)alpha=Math.max(alpha,colors.getW(i));
  expect(alpha).toBeLessThanOrEqual(.361);
  const digits=view.numbers.geometry.getAttribute('color');
  let digitAlpha=0;for(let i=0;i<view.numbers.geometry.drawRange.count;i++)digitAlpha=Math.max(digitAlpha,digits.getW(i));
  expect(digitAlpha).toBe(1);expect(view.stats().numbers).toHaveLength(14);view.dispose();objects.dispose();
});
