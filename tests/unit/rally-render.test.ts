import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, NormalBlending, Vector3 } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { RallyEffectsState } from '../../src/game/rallyEffects';
import { RALLY_EFFECTS } from '../../src/game/rallyEffects';
import { createRallyEffectView } from '../../src/render/rallyEffects';
import { createCamera, fitCamera } from '../../src/render/camera';
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

describe('late rally world replacements and arrivals',()=>{
  it.each([
    [1249,[],['meteor']],[1250,['meteor'],[]],[1499,['meteor','green-perimeter','green-net','green-blue-crossing'],['tricolor-crossing']],
    [1500,['tricolor-crossing'],['green-perimeter','green-net','green-blue-crossing']],
    [1749,[],['floor-wave']],[1750,['floor-wave'],[]],
    [1999,['background-threads'],['star-world']],[2000,['star-world','tricolor-crossing','single-halo'],['background-threads']],
    [2249,[],['side-halos']],[2250,['side-halos'],[]],
    [2499,['floor-wave'],['orbit-ribbon']],[2500,['orbit-ribbon'],['floor-wave']],
    [2749,['single-halo'],['multi-halos']],[2750,['multi-halos'],['single-halo']],
    [3249,['meteor'],['meteor-swarm']],[3250,['meteor-swarm'],['meteor']],
    [3499,['side-halos'],['double-table-halos']],[3500,['double-table-halos'],['side-halos']],
    [3749,[],['center-density']],[3750,['center-density'],[]],[3999,['center-density'],['final-world']],
    [4000,['final-world','star-world','tricolor-crossing','multi-halos','double-table-halos'],['center-density']],
    [4001,['final-world','star-world','tricolor-crossing'],['center-density']],
  ])('applies the exact replacement boundaries at %i',(score,yes,no)=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());view.update(snapshot(score));
    for(const effect of yes)expect(view.stats().activeEffects).toContain(effect);
    for(const effect of no)expect(view.stats().activeEffects).not.toContain(effect);
    view.dispose();
  });

  it.each([[2000,2.5,'star-transition'],[3000,3.5,'electric-opening'],[4000,4,'final-assembly']])(
    'shows %i arrival only from a confirmed event and clears exactly at its deadline',(threshold,duration,name)=>{
      const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
      const state=effectState(threshold,{arrivals:[{id:`arrival-${threshold}`,threshold,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===threshold)!}]});
      view.update(snapshot(threshold,20.5));expect(view.stats().activeEffects).not.toContain(name);
      view.update(snapshot(threshold,19.99),state);expect(view.stats().activeEffects).not.toContain(name);
      view.update(snapshot(threshold,20.5),state);expect(view.stats().activeEffects).toContain(name);
      view.update(snapshot(threshold,20+duration),state);expect(view.stats().activeEffects).not.toContain(name);
      view.dispose();
    });

  it('puts stars in front of the opaque far wall, in the unchanged camera viewport above the opaque court',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group()),camera=createCamera();fitCamera(camera,1280,720,DEFAULT_CONFIG);
    view.update(snapshot(2000));
    const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh;
    const p=mesh.geometry.getAttribute('position'),c=mesh.geometry.getAttribute('color'),projected=new Vector3();let visible=0;
    for(let i=0;i<mesh.geometry.drawRange.count;i++)if(c.getX(i)>.4&&c.getY(i)>.58&&c.getZ(i)>.8){
      expect(p.getZ(i)).toBeGreaterThan(-6);expect(p.getZ(i)).toBeLessThan(-3);
      projected.set(p.getX(i),p.getY(i),p.getZ(i)).project(camera);
      if(Math.abs(projected.x)<1&&Math.abs(projected.y)<1){
        // Every ray reaches y=0 beyond the far edge, so the opaque table cannot hide it.
        const crossing=camera.position.z+(p.getZ(i)-camera.position.z)*camera.position.y/(camera.position.y-p.getY(i));
        expect(crossing).toBeLessThan(-DEFAULT_CONFIG.tableHalfLength);visible++;
      }
    }
    expect(visible).toBeGreaterThan(250);
    const backing=view.worldRoot.getObjectByName('rally-world-glow') as Mesh;
    expect((backing.material as {blending:number}).blending).toBe(NormalBlending);
    view.dispose();
  });

  it('gives green, blue and red lightning different widths and travel speeds with smooth motion and decay',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const widths=()=>{
      const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh,p=mesh.geometry.getAttribute('position'),c=mesh.geometry.getAttribute('color');
      const values=new Map<string,number>(),alphas=new Map<string,number[]>();
      for(let i=0;i<mesh.geometry.drawRange.count;i+=6){
        const key=c.getY(i)>.8&&c.getX(i)<.1?'green':c.getZ(i)>.9&&c.getX(i)<.1?'blue':c.getX(i)>.8&&c.getY(i)<.1?'red':null;
        if(!key)continue;
        const width=Math.hypot(p.getX(i)-p.getX(i+1),p.getY(i)-p.getY(i+1),p.getZ(i)-p.getZ(i+1));
        values.set(key,width);const list=alphas.get(key)??[];list.push(c.getW(i));alphas.set(key,list);
      }
      return {values,alphas};
    };
    view.update(snapshot(1500,22));const result=widths();
    expect(result.values.get('green')).toBeCloseTo(.011,4);expect(result.values.get('blue')).toBeCloseTo(.016,4);expect(result.values.get('red')).toBeCloseTo(.021,4);
    for(const values of result.alphas.values())expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(.3);
    const before=geometryValues(view.worldRoot);view.update(snapshot(1500,22.001));const after=geometryValues(view.worldRoot);
    const largest=Math.max(...before.map((value,i)=>Math.abs(value-after[i]!)));
    expect(largest).toBeGreaterThan(0);expect(largest).toBeLessThan(.015);view.dispose();
  });

  it('renders the 4000 assembly as four distinct phases with overlapping fading rings at the end',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const state=effectState(4000,{arrivals:[{id:'4000',threshold:4000,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===4000)!}]});
    const phases:string[]=[],vertices:number[]=[];
    for(const age of [.45,1.35,2.35,3.45]){
      view.update(snapshot(4000,20+age),state);phases.push(view.stats().finalPhase!);vertices.push(view.stats().worldQuads);
    }
    expect(phases).toEqual(['converge','assemble','expand','overlap-fade']);
    expect(vertices[3]).toBeGreaterThan(vertices[2]!);view.dispose();
  });

  it('evolves the green perimeter and net into three intersecting traveling table channels at 1500',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);view.update(snapshot(1500,22));
    const mesh=rig.getObjectByName('rally-table-lines') as Mesh,p=mesh.geometry.getAttribute('position'),c=mesh.geometry.getAttribute('color');
    const perimeter=new Set<string>(),net=new Set<string>();
    for(let i=0;i<mesh.geometry.drawRange.count;i++){
      const color=c.getX(i)>.7?'red':c.getZ(i)>.8?'blue':c.getY(i)>.7?'green':null;
      if(!color)continue;
      if(Math.abs(p.getZ(i))<.02&&p.getY(i)>.1)net.add(color);
      if(Math.abs(p.getZ(i))>1.75||Math.abs(p.getX(i))>.98)perimeter.add(color);
    }
    expect([...perimeter].sort()).toEqual(['blue','green','red']);expect([...net].sort()).toEqual(['blue','green','red']);view.dispose();
  });

  it('keeps actual arrival geometry in the unchanged landscape camera during all four 4000 phases',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group()),camera=createCamera();fitCamera(camera,1280,720,DEFAULT_CONFIG);
    const state=effectState(4000,{arrivals:[{id:'4000',threshold:4000,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===4000)!}]});
    const projected=new Vector3();
    for(const age of [.45,1.35,2.35,3.45]){
      view.update(snapshot(4000,20+age));const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh,base=mesh.geometry.drawRange.count;
      view.update(snapshot(4000,20+age),state);const p=mesh.geometry.getAttribute('position');let visible=0;
      const visibleRings=new Set<number>();
      for(let i=base;i<mesh.geometry.drawRange.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);projected.set(x,y,z).project(camera);
        if(Math.abs(projected.x)>=1||Math.abs(projected.y)>=.94||y<-.79)continue;
        const ratio=camera.position.y/(camera.position.y-y),crossZ=camera.position.z+(z-camera.position.z)*ratio,crossX=camera.position.x+(x-camera.position.x)*ratio;
        if(crossZ>=-1.8&&Math.abs(crossX)<1)continue;
        visible++;if(age>3)visibleRings.add(Math.floor((i-base)/(96*6)));
      }
      expect(visible,`age ${age}`).toBeGreaterThan(12);
      if(age>3)expect([...visibleRings].sort()).toEqual([0,1,2,3]);
    }
    view.dispose();
  });

  it('keeps the 3000 opening and rainbow wave inside the unchanged landscape camera during expansion',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group()),camera=createCamera();fitCamera(camera,1280,720,DEFAULT_CONFIG);
    const state=effectState(3000,{arrivals:[{id:'3000',threshold:3000,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===3000)!}]});
    const projected=new Vector3();
    for(const age of [.4,1.8,3.3]){
      view.update(snapshot(3000,20+age));const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh,base=mesh.geometry.drawRange.count;
      view.update(snapshot(3000,20+age),state);const p=mesh.geometry.getAttribute('position');let visible=0;
      for(let i=base;i<mesh.geometry.drawRange.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);projected.set(x,y,z).project(camera);
        if(Math.abs(projected.x)<1&&Math.abs(projected.y)<.94&&y>-.79)visible++;
      }
      expect(visible,`age ${age}`).toBeGreaterThan(12);
    }
    view.dispose();
  });

  it('propagates electric strands along the 2500 orbit band instead of only drawing a smooth ellipse',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);view.update(snapshot(2500));
    const mesh=rig.getObjectByName('rally-table-lines') as Mesh,p=mesh.geometry.getAttribute('position');
    const y:number[]=[];
    for(let i=0;i<mesh.geometry.drawRange.count;i++)if(p.getY(i)<-.025&&p.getY(i)>-.13)y.push(p.getY(i));
    expect(Math.max(...y)-Math.min(...y)).toBeGreaterThan(.025);view.dispose();
  });

  it('adds genuinely branching tricolor lightning to the 3250 meteor swarm',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const junctions=(score:number)=>{
      view.update(snapshot(score,22));const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh,p=mesh.geometry.getAttribute('position'),c=mesh.geometry.getAttribute('color');
      const degree=new Map<string,number>();
      for(let i=0;i<mesh.geometry.drawRange.count;i+=6){
        if(!(c.getX(i)<.1&&c.getY(i)>.8||c.getX(i)<.1&&c.getZ(i)>.9||c.getX(i)>.8&&c.getY(i)<.1))continue;
        for(const [a,b] of [[i,i+1],[i+4,i+5]]){
          const key=[(p.getX(a!)+p.getX(b!))/2,(p.getY(a!)+p.getY(b!))/2,(p.getZ(a!)+p.getZ(b!))/2].map(v=>v.toFixed(3)).join(',');
          degree.set(key,(degree.get(key)??0)+1);
        }
      }
      return [...degree.values()].filter(value=>value>=3).length;
    };
    expect(junctions(3250)-junctions(3249)).toBeGreaterThanOrEqual(8);view.dispose();
  });

  it('intertwines the 3500 electric strands in three dimensions around the double table halos',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);view.update(snapshot(3499));
    const mesh=rig.getObjectByName('rally-table-lines') as Mesh,base=mesh.geometry.drawRange.count;
    view.update(snapshot(3500));const p=mesh.geometry.getAttribute('position'),ys:number[]=[];
    for(let i=base;i<mesh.geometry.drawRange.count;i++)ys.push(p.getY(i));
    expect(Math.max(...ys)-Math.min(...ys)).toBeGreaterThan(.24);view.dispose();
  });

  it('smoothly yields an older large arrival to a newer one without replaying or extending either event',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const old={id:'1000',threshold:1000,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===1000)!};
    const recent={id:'3000',threshold:3000,at:20.2,config:RALLY_EFFECTS.find(c=>c.threshold===3000)!};
    view.update(snapshot(3000,20.3));const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh,base=mesh.geometry.drawRange.count;
    view.update(snapshot(3000,20.3),effectState(1000,{arrivals:[old]}));const end=mesh.geometry.drawRange.count;
    const maxAlpha=()=>{const c=mesh.geometry.getAttribute('color'),a:number[]=[];for(let i=base;i<end;i++)a.push(c.getW(i));return Math.max(...a);};
    const oldAlpha=maxAlpha(),state=effectState(3000,{arrivals:[old,recent]});
    view.update(snapshot(3000,20.3),state);expect(maxAlpha()).toBeLessThan(oldAlpha*.8);expect(maxAlpha()).toBeGreaterThan(oldAlpha*.6);
    view.update(snapshot(3000,20.56),state);expect(view.stats().activeEffects).not.toContain('thousand-shockwave');expect(view.stats().activeEffects).toContain('electric-opening');
    expect(state.arrivals).toHaveLength(2);
    view.update(snapshot(3000,23.7),state);expect(view.stats().activeEffects).not.toContain('electric-opening');view.dispose();
  });

  it('does not resurrect an older longer arrival after the newer arrival expires, including context reconstruction',()=>{
    const old={id:'1000',threshold:1000,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===1000)!};
    const latest={id:'2000',threshold:2000,at:20.2,config:RALLY_EFFECTS.find(c=>c.threshold===2000)!};
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    view.update(snapshot(2000,20.6),effectState(2000,{arrivals:[old,latest]}));
    view.update(snapshot(2000,22.8),effectState(2000,{arrivals:[old]}));
    expect(view.stats().activeEffects).not.toContain('thousand-shockwave');view.dispose();
    const restored=createRallyEffectView(DEFAULT_CONFIG,new Group());
    restored.update(snapshot(2000,22.8),effectState(2000,{arrivals:[old]}));
    expect(restored.stats().activeEffects).not.toContain('thousand-shockwave');restored.dispose();
  });

  it('has fixed resources at every later tier, lower density in low quality and static distinguishable reduced-motion worlds',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
    const buffers:unknown[]=[];for(const root of [rig,view.worldRoot])root.traverse(n=>{if(n instanceof Mesh)buffers.push(n.geometry.getAttribute('position').array);});
    for(const score of [1500,2000,3000,4000]){
      view.update(snapshot(score));const standard=view.stats().tableQuads+view.stats().worldQuads;
      view.update(snapshot(score),undefined,'low');expect(view.stats().tableQuads+view.stats().worldQuads).toBeLessThan(standard);
      view.update(snapshot(score,20),undefined,'standard',true);const first=geometryValues(view.worldRoot);
      view.update(snapshot(score,24),undefined,'standard',true);expect(geometryValues(view.worldRoot)).toEqual(first);
    }
    const after:unknown[]=[];for(const root of [rig,view.worldRoot])root.traverse(n=>{if(n instanceof Mesh)after.push(n.geometry.getAttribute('position').array);});
    expect(after).toEqual(buffers);expect(view.stats().geometries).toBe(4);expect(view.stats().drawCalls).toBeLessThanOrEqual(4);
    expect(view.stats().worldQuads+view.stats().tableQuads).toBeLessThan(view.stats().capacity);view.dispose();
  });
});
