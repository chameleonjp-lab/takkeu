import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { RallyCue, RallyEffectsState } from '../../src/game/rallyEffects';
import { RALLY_EFFECTS } from '../../src/game/rallyEffects';
import { createRallyEffectView, presentationPriority } from '../../src/render/rallyEffects';
import { scenario } from '../helpers/scenarios';

const snapshot = (score:number,time=20) => ({...scenario(score,time).snapshot(),runId:'rally-render'});
function effectState(score:number, additions:Partial<RallyEffectsState>={}):RallyEffectsState {
  return {runId:'rally-render',score,bestAtStart:0,best:null,arrivals:[],hits:[],losses:[],cues:[],lostBallCount:0,stage:[],...additions};
}
function geometryValues(root:Group):number[] {
  const values:number[]=[];
  root.traverse(node=>{if(node instanceof Mesh){
    const p=node.geometry.getAttribute('position');
    for(let i=0;i<node.geometry.drawRange.count*3;i++)values.push(p.array[i]!);
  }});
  return values;
}

describe('shared presentation priority budget',()=>{
  it.each([1000,2000,3000,3500])('smoothly dims lower tiers during %i and restores them over the last .3 seconds',(threshold)=>{
    const config=RALLY_EFFECTS.find(c=>c.threshold===threshold)!,duration=config.duration!;
    const state=effectState(threshold,{arrivals:[{id:`major-${threshold}`,threshold,at:20,config}]});
    expect(presentationPriority(snapshot(threshold,19.99),state)).toBe(1);
    expect(presentationPriority(snapshot(threshold,20),state)).toBe(1);
    expect(presentationPriority(snapshot(threshold,20.1),state)).toBeCloseTo(.725,6);
    expect(presentationPriority(snapshot(threshold,20.2),state)).toBeCloseTo(.45,6);
    expect(presentationPriority(snapshot(threshold,20+duration-.3),state)).toBeCloseTo(.45,6);
    expect(presentationPriority(snapshot(threshold,20+duration-.15),state)).toBeCloseTo(.725,6);
    expect(presentationPriority(snapshot(threshold,20+duration),state)).toBe(1);
    expect(presentationPriority(snapshot(threshold,20.5),{...state,runId:'old'})).toBe(1);
    expect(presentationPriority(snapshot(threshold,20.5))).toBe(1);
  });

  it('keeps the final background budget through termination even after the final cue is pruned',()=>{
    const final:RallyCue={id:'final',kind:'loss-final',value:100,at:20,duration:2,priority:100};
    const state=effectState(4000,{lostBallCount:100,cues:[final]});
    expect(presentationPriority(snapshot(4000,20),state)).toBe(1);
    expect(presentationPriority(snapshot(4000,20.2),state)).toBeCloseTo(.45,6);
    expect(presentationPriority(snapshot(4000,23),state)).toBeCloseTo(.45,6);
    expect(presentationPriority(snapshot(4000,23),{...state,cues:[]})).toBeCloseTo(.45,6);
  });

});

describe('event feedback renderer',()=>{
  it.each(RALLY_EFFECTS.map(c=>c.threshold))('has no perpetual geometry at%i; arrivals belong to HUD/audio',score=>{
    const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig);
    v.update(snapshot(score));expect(v.stats().activeEffects).toEqual([]);expect(v.stats().drawCalls).toBe(0);
    const config=RALLY_EFFECTS.find(c=>c.threshold===score)!;
    v.update(snapshot(score,20.2),effectState(score,{arrivals:[{id:'arrival',threshold:score,at:20,config}]}));
    expect(v.stats().drawCalls).toBe(score>=500?1:0);v.dispose();
  });
  it('uses actual hit coordinates until the exact .3s deadline and ignores foreign state',()=>{
    const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig);
    const hit={id:'hit',score:50,at:20,position:{x:.65,y:.72,z:1.95},smashReturn:false},s=effectState(50,{hits:[hit]});
    v.update(snapshot(50,20.1),s);expect(v.stats().activeEffects).toContain('hit-ring');
    const p=geometryValues(rig),x=p.filter((_,i)=>i%3===0);expect(Math.min(...x)).toBeGreaterThan(.3);expect(Math.max(...x)).toBeLessThan(1);
    v.update(snapshot(50,20.3),s);expect(v.stats().drawCalls).toBe(0);
    v.update(snapshot(50,20.1),{...s,runId:'old'});expect(v.stats().drawCalls).toBe(0);v.dispose();
  });
  it('prepares both fixed buffers and clears every slot without allocating stage resources',()=>{
    const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig);
    v.prepare();expect(v.stats().drawCalls).toBe(2);v.clear();expect(v.stats().drawCalls).toBe(0);
    const meshes:Mesh[]=[];rig.traverse(n=>{if(n instanceof Mesh)meshes.push(n);});v.worldRoot.traverse(n=>{if(n instanceof Mesh)meshes.push(n);});
    const buffers=meshes.map(n=>n.geometry.getAttribute('position').array),dispose=meshes.map(n=>vi.spyOn(n.geometry,'dispose'));
    for(let retry=0;retry<20;retry++){
      const s=effectState(4000,{hits:[{id:String(retry),score:4000,at:20,position:{x:.4,y:.5,z:1.95},smashReturn:false}]});
      v.update(snapshot(4000,20.1),s,retry%2?'standard':'low');
      const paused=geometryValues(rig);v.update({...snapshot(4000,20.1),phase:'paused'},s);expect(geometryValues(rig)).toEqual(paused);
      v.clear();expect(v.stats().drawCalls).toBe(0);meshes.forEach((n,i)=>expect(n.geometry.getAttribute('position').array).toBe(buffers[i]));
    }
    expect(v.stats()).toMatchObject({geometries:2,materials:2,nodes:4});v.dispose();v.dispose();
    for(const spy of dispose)expect(spy).toHaveBeenCalledTimes(1);expect(rig.children).toHaveLength(0);expect(v.worldRoot.children).toHaveLength(0);
  });
  it('keeps independent simultaneous loss positions for .5s and never mutates source facts',()=>{
    const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig);
    const losses=[{id:'a',count:1,at:20,rollingCount:1,position:{x:-.65,y:.3,z:1.95}},{id:'b',count:2,at:20,rollingCount:2,position:{x:.55,y:.75,z:1.95}}];
    const s=effectState(1499,{losses,lostBallCount:2}),original=JSON.stringify(s);v.update(snapshot(1499,20.12),s);
    expect(v.stats().worldQuads).toBe(12);const p=geometryValues(v.worldRoot),x=p.filter((_,i)=>i%3===0);expect(Math.min(...x)).toBeLessThan(-.6);expect(Math.max(...x)).toBeGreaterThan(.5);
    for(let i=0;i<p.length;i+=3)expect(Math.min(...losses.map(l=>Math.hypot(p[i]!-l.position.x,p[i+1]!-l.position.y,p[i+2]!-l.position.z)))).toBeLessThan(.3);
    expect(JSON.stringify(s)).toBe(original);v.update(snapshot(1499,20.5),s);expect(v.stats().drawCalls).toBe(0);v.dispose();
  });
  it('coalesces coincident loss light while retaining100 independent loss facts',()=>{
    const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig),losses=Array.from({length:100},(_,i)=>({id:String(i),count:i+1,at:20,rollingCount:i+1,position:{x:.4,y:.3,z:1.95}}));
    v.update(snapshot(1499,20.1),effectState(1499,{losses}));expect(v.stats().worldQuads).toBe(6);expect(losses).toHaveLength(100);v.dispose();
  });
  it('does not merge different coordinates or different times when hash buckets collide',()=>{
    const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig),hits=Array.from({length:30},(_,i)=>({id:String(i),score:500+i,at:20+i%2*.000001,smashReturn:false,position:{x:.4+Math.floor(i/2)*.000001,y:.5,z:1.95}}));
    v.update(snapshot(1499,20.1),effectState(1499,{hits}));expect(v.stats().tableQuads).toBe(360);v.dispose();
  });
  it('keeps30 simultaneous losses in both manual qualities and freezes reduced-motion geometry',()=>{
    const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig),losses=Array.from({length:30},(_,i)=>({id:String(i),count:70+i,at:20,rollingCount:i+1,position:{x:(i%6-2.5)*.25,y:.3+Math.floor(i/6)*.08,z:1.95}})),s=effectState(1499,{losses,lostBallCount:99});
    for(const q of ['standard','low']as const){v.update(snapshot(1499,20.1),s,q);expect(v.stats().worldQuads).toBe(180);expect(v.stats().worldQuads+v.stats().tableQuads).toBeLessThanOrEqual(v.stats().capacity);}
    v.update(snapshot(1499,20.1),s,'standard',true);const before=geometryValues(v.worldRoot);v.update(snapshot(1499,20.2),s,'standard',true);expect(geometryValues(v.worldRoot)).toEqual(before);v.dispose();
  });
  it('keeps the final marker after physics stops, expires exactly and clears on retry',()=>{
    const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig),cue:RallyCue={id:'end',kind:'loss-final',value:100,at:20,duration:2,priority:100};
    const s=effectState(4000,{lostBallCount:100,losses:[{id:'last',count:100,at:20,rollingCount:4,position:{x:.8,y:.3,z:1.95}}],cues:[cue]});
    v.update({...snapshot(4000,19.99),phase:'gameover'},s);expect(v.stats().drawCalls).toBe(0);
    v.update({...snapshot(4000,20.2),phase:'gameover'},s);expect(v.stats().activeEffects).toEqual(['loss-electric','loss-final']);
    v.update({...snapshot(4000,21.8),phase:'gameover'},s);expect(v.stats().activeEffects).toEqual(['loss-electric','loss-final']);
    v.update({...snapshot(4000,22),phase:'gameover'},s);expect(v.stats().drawCalls).toBe(0);
    v.update({...snapshot(0,0),runId:'new',phase:'ready'},s);expect(v.stats().activeEffects).toEqual([]);v.dispose();
  });
  it('renders a shared perimeter for loss milestones without mutating cues',()=>{
    const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig);
    const kinds=['loss-impact','loss-wave','loss-net','loss-number','loss-warning','loss-gold']as const;
    const cues=kinds.map((kind,i)=>({id:String(i),kind,value:10+i,at:20,duration:1.2,priority:10,position:{x:.3,y:.5,z:1.95}}));
    const s=effectState(4000,{cues}),original=JSON.stringify(s);v.update(snapshot(4000,20.2),s);expect(v.stats().drawCalls).toBe(1);expect(JSON.stringify(s)).toBe(original);v.dispose();
  });
});
