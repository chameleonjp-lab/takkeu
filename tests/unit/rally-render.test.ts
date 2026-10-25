import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { RallyEffectsState } from '../../src/game/rallyEffects';
import { RALLY_EFFECTS } from '../../src/game/rallyEffects';
import { createRallyEffectView } from '../../src/render/rallyEffects';
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

describe('bounded rally world renderer, 0–1000',()=>{
  it.each([
    [399,[]],[400,['background-threads']],[499,['background-threads']],
    [500,['background-threads','green-perimeter']],
    [600,['background-threads','green-perimeter','green-net']],
    [700,['background-threads','green-perimeter','green-net','single-halo']],
    [899,['background-threads','green-perimeter','green-net','single-halo']],
    [900,['background-threads','green-perimeter','green-net','single-halo','corner-gather']],
    [999,['background-threads','green-perimeter','green-net','single-halo','corner-gather']],
    [1000,['background-threads','green-perimeter','green-net','single-halo','green-blue-crossing']],
    [1001,['background-threads','green-perimeter','green-net','single-halo','green-blue-crossing']],
  ])('draws permanent stages at %i without inventing arrival effects',(score,want)=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
    view.update(snapshot(score));
    expect(view.stats().activeEffects).toEqual(want);
    expect(view.stats().worldQuads+view.stats().tableQuads>0).toBe(score>=400);
    view.dispose();
  });

  it('uses confirmed hit coordinates, retains a ring only for .3 seconds and ignores foreign state',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
    const hit={id:'hit50',score:50,at:20,position:{x:.65,y:.72,z:1.95},smashReturn:false};
    const state=effectState(50,{hits:[hit]});
    view.update(snapshot(50,20.1),state);
    expect(view.stats().activeEffects).toContain('hit-ring');
    const points=geometryValues(rig);
    expect(Math.min(...points.filter((_,i)=>i%3===0))).toBeGreaterThan(.3);
    expect(Math.max(...points.filter((_,i)=>i%3===0))).toBeLessThan(1);
    view.update(snapshot(50,20.3),state);
    expect(view.stats().activeEffects).not.toContain('hit-ring');
    view.update(snapshot(50,20.1),{...state,runId:'old'});
    expect(view.stats().tableQuads).toBe(0);
    view.dispose();
  });

  it('covers the entire table perimeter at 100 without enabling the unreleased court',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
    const state=effectState(100,{arrivals:[{id:'100',threshold:100,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===100)!}]});
    // Sample the lap's travel; the court itself remains outside this renderer.
    const depths:number[]=[];
    for(const time of [20.01,20.3,20.6,20.9,21.19]){
      view.update(snapshot(100,time),state);
      depths.push(...geometryValues(rig).filter((_,i)=>i%3===2));
    }
    expect(Math.min(...depths)).toBeLessThan(-1.79);expect(Math.max(...depths)).toBeGreaterThan(1.79);
    view.dispose();
  });

  it('prepares every fixed batch for initial shader compilation and upload, then clears on ready',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
    view.prepare();
    expect(view.stats().drawCalls).toBe(4);
    expect(view.stats().tableQuads).toBeGreaterThan(0);expect(view.stats().worldQuads).toBeGreaterThan(0);
    view.clear();
    expect(view.stats().drawCalls).toBe(0);
    view.update(snapshot(1000));expect(view.stats().activeEffects).toContain('green-blue-crossing');
    view.clear();expect(view.stats().activeEffects).toEqual([]);
    expect(view.stats().drawCalls).toBe(0);view.dispose();
  });

  it.each([[100,1.2,'perimeter-lap'],[200,1.2,'net-crossing'],[800,1.5,'edge-sparks'],[1000,3.5,'thousand-shockwave']])(
    'draws confirmed %i arrivals and clears at the exact deadline',(threshold,duration,name)=>{
      const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
      const state=effectState(threshold,{arrivals:[{id:`arrival-${threshold}`,threshold,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===threshold)!}]});
      view.update(snapshot(threshold,19.99),state);expect(view.stats().activeEffects).not.toContain(name);
      view.update(snapshot(threshold,20.4),state);expect(view.stats().activeEffects).toContain(name);
      view.update(snapshot(threshold,20+duration),state);expect(view.stats().activeEffects).not.toContain(name);
      view.dispose();
    });

  it('keeps fixed GPU buffers through replay, quality changes, pauses and repeated disposal',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
    const meshes:Mesh[]=[];view.worldRoot.traverse(n=>{if(n instanceof Mesh)meshes.push(n);});rig.traverse(n=>{if(n instanceof Mesh)meshes.push(n);});
    const buffers=meshes.map(n=>n.geometry.getAttribute('position').array);
    const dispose=meshes.map(n=>vi.spyOn(n.geometry,'dispose'));
    view.update(snapshot(1001,20));const full=view.stats();
    const same=geometryValues(view.worldRoot);
    view.update({...snapshot(1001,20),phase:'paused'});expect(geometryValues(view.worldRoot)).toEqual(same);
    for(let i=0;i<300;i++)view.update(snapshot(i%2?1001:900,20+i/60),undefined,i%3?'standard':'low',false);
    view.update(snapshot(1001,25),undefined,'low');expect(view.stats().worldQuads+view.stats().tableQuads).toBeLessThan(full.worldQuads+full.tableQuads);
    expect(meshes.map(n=>n.geometry.getAttribute('position').array)).toEqual(buffers);
    expect(view.stats().geometries).toBe(4);expect(view.stats().materials).toBe(4);expect(view.stats().nodes).toBeLessThanOrEqual(6);
    expect(view.stats().tableQuads+view.stats().worldQuads).toBeLessThanOrEqual(view.stats().capacity);
    view.dispose();view.dispose();for(const spy of dispose)expect(spy).toHaveBeenCalledTimes(1);
    expect(rig.children).toHaveLength(0);expect(view.worldRoot.children).toHaveLength(0);
  });

  it('freezes reduced-motion geometry while preserving distinct permanent stages',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    view.update(snapshot(700,20),undefined,'standard',true);const initial=geometryValues(view.worldRoot);
    view.update(snapshot(700,22),undefined,'standard',true);expect(geometryValues(view.worldRoot)).toEqual(initial);
    view.update(snapshot(1000,22),undefined,'standard',true);expect(geometryValues(view.worldRoot)).not.toEqual(initial);
    expect(view.stats().activeEffects).toContain('green-blue-crossing');view.dispose();
  });

  it('slowly expands and contracts the 700 halo rather than only rotating a fixed ellipse',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const radius=(time:number)=>{
      view.update(snapshot(700,time));const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh;
      const p=mesh.geometry.getAttribute('position'),c=mesh.geometry.getAttribute('color'),x:number[]=[];
      for(let i=0;i<mesh.geometry.drawRange.count;i++)if(Math.abs(c.getY(i)-.8)<1e-6&&Math.abs(c.getZ(i)-.35)<1e-6)x.push(p.getX(i));
      return (Math.max(...x)-Math.min(...x))/2;
    };
    const start=radius(0),expanded=radius(7),contracted=radius(21);
    expect(expanded-start).toBeGreaterThan(.07);expect(start-contracted).toBeGreaterThan(.07);view.dispose();
  });

  it('brightens the four corner posts progressively from 900 through 999',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
    const cornerAlpha=(score:number)=>{
      view.update(snapshot(score));const mesh=rig.getObjectByName('rally-table-lines') as Mesh;
      const p=mesh.geometry.getAttribute('position'),c=mesh.geometry.getAttribute('color'),alphas:number[]=[];
      for(let i=0;i<mesh.geometry.drawRange.count;i++)if(Math.abs(p.getZ(i))>1.5&&p.getY(i)>.045)alphas.push(c.getW(i));
      return Math.max(...alphas);
    };
    const early=cornerAlpha(900),mid=cornerAlpha(950),late=cornerAlpha(999);
    expect(mid).toBeGreaterThan(early+.15);expect(late).toBeGreaterThan(mid+.15);view.dispose();
  });
});
