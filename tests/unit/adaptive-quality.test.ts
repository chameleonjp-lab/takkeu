import { expect, it } from 'vitest';
import { createAdaptiveQuality, ADAPTIVE_QUALITY } from '../../src/render/adaptiveQuality';
import { computeAdaptiveDrawingSize, computeDrawingSize } from '../../src/render/quality';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from '../../src/storage/preferences';

for(const hz of [60,120]){
  it(`${hz}Hz: sustained overload lowers one level, cooldown limits transitions, stable load restores`,()=>{
    const q=createAdaptiveQuality();let now=0;const changes:{at:number;level:number}[]=[];
    const feed=(ms:number,seconds:number)=>{const end=now+seconds*1000;while(now<end){now+=ms;const changed=q.sample(now);if(changed!==null)changes.push({at:now,level:changed});}};
    feed(1000/hz,5);expect(q.level()).toBe(0);
    feed(32,9.2);expect(q.level()).toBe(1);expect(changes).toHaveLength(1);
    feed(32,14);expect(q.level()).toBe(2);
    feed(32,30);expect(q.level()).toBe(2);
    feed(1000/hz,46);expect(q.level()).toBe(0);
    expect(changes.map(c=>c.level)).toEqual([1,2,1,0]);
    for(let i=1;i<changes.length;i++)expect(changes[i]!.at-changes[i-1]!.at).toBeGreaterThanOrEqual(ADAPTIVE_QUALITY.cooldownMs);
  });
}
it('isolated slow frame and one overloaded window do not lower resolution',()=>{
  const q=createAdaptiveQuality();let now=0;
  for(let i=0;i<400;i++)q.sample(now+=16.67);
  q.sample(now+=150);
  for(let i=0;i<200;i++)q.sample(now+=16.67);
  for(let i=0;i<90;i++)q.sample(now+=34);
  for(let i=0;i<400;i++)q.sample(now+=16.67);
  expect(q.level()).toBe(0);
});
it('alternating load never switches rapidly and interrupted history cannot trigger a stale decision',()=>{
  const q=createAdaptiveQuality();let now=0;const changes:number[]=[];
  for(let block=0;block<30;block++)for(let frame=0;frame<100;frame++){now+=block%2?16:33;if(q.sample(now)!==null)changes.push(now);}
  for(let i=1;i<changes.length;i++)expect(changes[i]!-changes[i-1]!).toBeGreaterThanOrEqual(10000);
  const level=q.level();q.suspend();now+=120000;
  expect(q.sample(now)).toBe(null);expect(q.level()).toBe(level);
  for(let i=0;i<200;i++)q.sample(now+=1000/120);
  expect(q.level()).toBe(level);
  q.reset();expect(q.level()).toBe(0);
});
it('gaps, nonfinite and backwards timestamps invalidate statistics; no-data cannot restore or lower',()=>{
  const q=createAdaptiveQuality();let now=0;
  for(let i=0;i<500;i++)q.sample(now+=32);
  const level=q.level();
  for(const bad of [NaN,Infinity,now-1,now+10000]){expect(q.sample(bad)).toBe(null);expect(q.level()).toBe(level);}
  q.suspend();expect(q.level()).toBe(level);
});
it('auto resolution has exact standard/low bounds and monotone intermediate sizes for CSS/DPR/orientation',()=>{
  for(const [w,h] of [[402,874],[874,402],[1280,720],[3000,2000]])for(const dpr of [1,2,3]){
    const high=computeDrawingSize(w!,h!,dpr,'standard'),low=computeDrawingSize(w!,h!,dpr,'low');
    expect(computeAdaptiveDrawingSize(w!,h!,dpr,0)).toEqual(high);
    expect(computeAdaptiveDrawingSize(w!,h!,dpr,2)).toEqual(low);
    const middle=computeAdaptiveDrawingSize(w!,h!,dpr,1);
    expect(middle.width).toBeGreaterThanOrEqual(low.width);expect(middle.width).toBeLessThanOrEqual(high.width);
    expect(middle.height).toBeGreaterThanOrEqual(low.height);expect(middle.height).toBeLessThanOrEqual(high.height);
  }
});
it('v1 keeps existing modes/default and roundtrips explicit auto; corrupt quality safely falls back',()=>{
  let json:string|null=null;const storage={getItem:()=>json,setItem:(_k:string,v:string)=>{json=v;}};
  for(const quality of ['standard','low','auto'] as const){const p={...DEFAULT_PREFERENCES,quality};expect(savePreferences(storage,p)).toBe(true);expect(loadPreferences(storage)).toEqual(p);}
  json=JSON.stringify({...DEFAULT_PREFERENCES,quality:'broken'});expect(loadPreferences(storage).quality).toBe('standard');
  json=null;expect(loadPreferences(storage).quality).toBe('standard');
});
it('a short burst straddling evaluation boundaries is not mistaken for sustained pressure',()=>{
  const q=createAdaptiveQuality();let now=0;
  while(now<3850)q.sample(now+=1000/60);
  while(now<4250)q.sample(now+=40);
  while(now<12000)q.sample(now+=1000/60);
  expect(q.level()).toBe(0);
});
it('warmup-crossing intervals are excluded in full before two complete evaluation windows',()=>{
  const q=createAdaptiveQuality();expect(q.sample(0)).toBe(null);
  for(let now=1000;now<=6000;now+=1000){expect(q.sample(now)).toBe(null);expect(q.level()).toBe(0);}
  expect(q.sample(7000)).toBe(1);
});
it('short suspension clears a primed bad window independently of the long-gap guard',()=>{
  const q=createAdaptiveQuality();let now=0;q.sample(now);
  for(let i=0;i<150;i++)q.sample(now+=32);
  expect(q.level()).toBe(0);
  q.suspend();q.sample(now+=200);
  for(let i=0;i<150;i++)q.sample(now+=32);
  expect(q.level()).toBe(0);
});
it('one four-second arrival burst spanning two evaluation boundaries does not lower quality',()=>{
 const q=createAdaptiveQuality();let now=0;q.sample(now);const changes:number[]=[];
 const feed=(ms:number,until:number)=>{while(now<until){const level=q.sample(now+=ms);if(level!==null)changes.push(level);}};
 feed(1000/60,3500);feed(40,7500);feed(1000/60,31000);
 expect(changes).toEqual([]);
});
