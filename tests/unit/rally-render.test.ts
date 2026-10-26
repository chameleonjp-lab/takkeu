import { triangleAttribute } from '../helpers/triangleAttribute';
import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, NormalBlending, Vector3 } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { RallyCue, RallyEffectsState } from '../../src/game/rallyEffects';
import { RALLY_EFFECTS } from '../../src/game/rallyEffects';
import { createCelebrations, lossCelebration } from '../../src/game/celebrations';
import { createRallyEffectView, presentationPriority } from '../../src/render/rallyEffects';
import { createCamera, fitCamera } from '../../src/render/camera';
import { scenario } from '../helpers/scenarios';

const snapshot = (score:number,time=20) => ({...scenario(score,time).snapshot(),runId:'rally-render'});
function effectState(score:number, additions:Partial<RallyEffectsState>={}):RallyEffectsState {
  return {runId:'rally-render',score,bestAtStart:0,best:null,arrivals:[],hits:[],losses:[],cues:[],lostBallCount:0,stage:[],...additions};
}
function geometryValues(root:Group):number[] {
  const values:number[]=[];
  root.traverse(node=>{if(node instanceof Mesh){
    const p=triangleAttribute(node.geometry,'position');
    for(let i=0;i<node.geometry.drawRange.count*3;i++)values.push(p.array[i]!);
  }});
  return values;
}

describe('shared presentation priority budget',()=>{
  it.each([1000,2000,3000,4000])('smoothly dims lower tiers during %i and restores them over the last .3 seconds',(threshold)=>{
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

  it('dims actual ambient alpha while preserving cosmic backing, dedicated arrival alpha and geometry',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig),s=snapshot(4000,20.5);
    const world=view.worldRoot.getObjectByName('rally-world-lines') as Mesh,backdrop=view.worldRoot.getObjectByName('rally-world-glow') as Mesh;
    view.update(s,effectState(4000));const ambient=triangleAttribute(world.geometry,'color').getW(0),dark=triangleAttribute(backdrop.geometry,'color').getW(0),base=world.geometry.drawRange.count;
    const positions=Array.from(triangleAttribute(world.geometry,'position').array.slice(0,base*3));
    const major=effectState(4000,{arrivals:[{id:'major',threshold:4000,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===4000)!}]});
    view.update(s,major);
    expect(triangleAttribute(world.geometry,'color').getW(0)).toBeCloseTo(ambient*.45,6);
    expect(triangleAttribute(backdrop.geometry,'color').getW(0)).toBe(dark);
    expect(triangleAttribute(world.geometry,'color').getW(base)).toBeCloseTo(.55,6);
    expect(Array.from(triangleAttribute(world.geometry,'position').array.slice(0,base*3))).toEqual(positions);
    view.update(snapshot(4000,24.1),major);expect(triangleAttribute(world.geometry,'color').getW(0)).toBeGreaterThan(ambient*.8);
    expect(view.stats().geometries).toBe(4);view.dispose();
  });

  it('keeps the hundredth spark at its real position with nonzero lower-tier alpha while final geometry stays at full strength',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig),s=snapshot(0,20.2);
    const loss={id:'100',count:100,at:20,rollingCount:4,position:{x:.7,y:.5,z:1.95}};
    const world=view.worldRoot.getObjectByName('rally-world-lines') as Mesh;
    view.update(s,effectState(0,{lostBallCount:99,losses:[loss]}));
    const positions=Array.from(triangleAttribute(world.geometry,'position').array.slice(0,12*6*3)),sparkAlpha=triangleAttribute(world.geometry,'color').getW(0);
    const state=effectState(0,{lostBallCount:100,losses:[loss],cues:[{id:'final',kind:'loss-final',value:100,at:20,duration:2,priority:100}]});
    view.update({...s,phase:'gameover'},state);const colors=triangleAttribute(world.geometry,'color');
    expect(colors.getW(0)).toBeGreaterThan(0);expect(colors.getW(0)).toBeCloseTo(sparkAlpha*.45,6);
    expect(Array.from(triangleAttribute(world.geometry,'position').array.slice(0,12*6*3))).toEqual(positions);
    expect(colors.getW(12*6)).toBeCloseTo(.45,6);expect(state.losses).toHaveLength(1);view.dispose();
  });
});

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
      const p=triangleAttribute(mesh.geometry,'position'),c=triangleAttribute(mesh.geometry,'color'),x:number[]=[];
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
      const p=triangleAttribute(mesh.geometry,'position'),c=triangleAttribute(mesh.geometry,'color'),alphas:number[]=[];
      for(let i=0;i<mesh.geometry.drawRange.count;i++)if(Math.abs(p.getZ(i))>1.5&&p.getY(i)>.045)alphas.push(c.getW(i));
      return Math.max(...alphas);
    };
    const early=cornerAlpha(900),mid=cornerAlpha(950),late=cornerAlpha(999);
    expect(mid).toBeGreaterThan(early+.15);expect(late).toBeGreaterThan(mid+.15);view.dispose();
  });
});

describe('loss renderer follows immutable event facts through the finish clock',()=>{
  const cue=(kind:RallyCue['kind'],value:number,duration:number,at=20):RallyCue=>({id:`${kind}-${value}`,kind,value,duration,at,priority:10,position:{x:.2,y:.5,z:1.95}});
  it('draws each simultaneous loss at its own confirmed world coordinate and clears exactly at .5 seconds',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const losses=[{id:'a',count:1,at:20,rollingCount:1,position:{x:-.65,y:.3,z:1.95}},{id:'b',count:2,at:20,rollingCount:2,position:{x:.55,y:.75,z:1.95}}];
    const state=effectState(0,{losses,lostBallCount:2});view.update(snapshot(0,20.12),state);
    expect(view.stats().activeEffects).toContain('loss-sparks');const points=geometryValues(view.worldRoot);
    const x=points.filter((_,i)=>i%3===0);expect(Math.min(...x)).toBeLessThan(-.6);expect(Math.max(...x)).toBeGreaterThan(.5);
    for(let i=0;i<points.length;i+=3)expect(Math.min(...losses.map(loss=>Math.hypot(points[i]!-loss.position.x,points[i+1]!-loss.position.y,points[i+2]!-loss.position.z)))).toBeLessThan(.3);
    view.update(snapshot(0,20.5),state);expect(view.stats().worldQuads).toBe(0);
    view.update(snapshot(0,20.12),{...state,runId:'old'});expect(view.stats().worldQuads).toBe(0);view.dispose();
  });

  it.each([
    ['loss-impact',4,.5,'loss-impact'],['loss-wave',10,1.2,'loss-wave'],['loss-wave',20,1.2,'loss-wave'],
    ['loss-wave',30,1.2,'loss-wave'],['loss-wave',40,1.2,'loss-wave'],['loss-net',50,1.2,'loss-net'],
    ['loss-gold',99,1.2,'loss-gold'],['loss-final',100,2,'loss-final'],
  ] as const)('draws %s %i through its exact deadline',(kind,value,duration,name)=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig),state=effectState(0,{cues:[cue(kind,value,duration)]});
    view.update(snapshot(0,19.99),state);expect(view.stats().activeEffects).not.toContain(name);
    view.update({...snapshot(0,20.15),phase:'gameover'},state);expect(view.stats().activeEffects).toContain(name);
    expect(view.stats().tableQuads+view.stats().worldQuads).toBeGreaterThan(0);
    view.update({...snapshot(0,20+duration),phase:'gameover'},state);expect(view.stats().activeEffects).not.toContain(name);
    expect(rig.position.toArray()).toEqual([0,0,0]);view.dispose();
  });

  it.each([55,77,88])('starts a .8 second halo from the existing special %i number position',(value)=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig),state=effectState(0,{cues:[cue('loss-number',value,.8)]});
    const celebrations=lossCelebration(createCelebrations(),value,20);
    view.update({...snapshot(0,20.1),celebrations},state);expect(view.stats().activeEffects).toContain('loss-number-halos');
    const points=geometryValues(rig),z=points.filter((_,i)=>i%3===2);expect(Math.min(...z)).toBeGreaterThan(.15);expect(Math.max(...z)).toBeLessThan(1.75);
    view.update({...snapshot(0,20.8),celebrations},state);expect(view.stats().activeEffects).not.toContain('loss-number-halos');view.dispose();
  });

  it('uses the existing multi-number grid for simultaneous special-number halos without modifying it',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
    const celebrations=lossCelebration(lossCelebration(createCelebrations(),55,20),77,20),original=JSON.stringify(celebrations);
    view.update({...snapshot(0,20.1),celebrations},effectState(0,{cues:[cue('loss-number',55,.8),cue('loss-number',77,.8)]}));
    const mesh=rig.getObjectByName('rally-table-lines') as Mesh,p=triangleAttribute(mesh.geometry,'position');
    const center=(offset:number)=>{let x=0,z=0;for(let i=offset;i<offset+32*6;i++){x+=p.getX(i);z+=p.getZ(i);}return {x:x/(32*6),z:z/(32*6)};};
    expect(center(0).x).toBeLessThan(-.3);expect(center(32*6).x).toBeGreaterThan(.3);
    expect(center(0).z).toBeCloseTo(.93,2);expect(center(32*6).z).toBeCloseTo(.93,2);
    expect(JSON.stringify(celebrations)).toBe(original);view.dispose();
  });

  it.each([[89,false],[90,true],[99,true],[100,false]])('keeps warning posts persistent for loss count %i',(count,on)=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);view.update(snapshot(0,200),effectState(0,{lostBallCount:count}));
    expect(view.stats().activeEffects.includes('loss-warning-posts')).toBe(on);
    if(on){const points=geometryValues(rig);expect(points.some((v,i)=>i%3===0&&v< -1.05)).toBe(true);expect(points.some((v,i)=>i%3===0&&v>1.05)).toBe(true);}
    view.dispose();
  });

  it('keeps the last real spark and outward finish visible after physics stops and releases them on a new run',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const state=effectState(4000,{lostBallCount:100,losses:[{id:'last',count:100,at:20,rollingCount:4,position:{x:.8,y:.3,z:1.95}}],cues:[cue('loss-final',100,2)]});
    view.update({...snapshot(4000,20.2),phase:'gameover'},state);expect(view.stats().activeEffects).toContain('loss-sparks');expect(view.stats().activeEffects).toContain('loss-final');
    view.update({...snapshot(4000,21.8),phase:'gameover'},state);expect(view.stats().activeEffects).toContain('loss-final');
    view.update({...snapshot(0,0),runId:'new',phase:'ready'},state);expect(view.stats().activeEffects).toEqual([]);view.dispose();
  });

  it('lets the final loss take priority over major arrivals and never restores them after the loss cue expires',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const arrival={id:'4000',threshold:4000,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===4000)!};
    const state=effectState(4000,{lostBallCount:100,arrivals:[arrival],cues:[cue('loss-final',100,2,20.1)]});
    view.update({...snapshot(4000,20.5),phase:'gameover'},state);expect(view.stats().activeEffects).not.toContain('final-assembly');expect(view.stats().activeEffects).toContain('loss-final');
    view.update({...snapshot(4000,22.3),phase:'gameover'},{...state,cues:[]});expect(view.stats().activeEffects).not.toContain('final-assembly');view.dispose();
  });

  it('bounds simultaneous thirty-ball losses at 4000 and freezes reduced-motion spark positions',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
    const losses=Array.from({length:30},(_,i)=>({id:`loss-${i}`,count:70+i,at:20,rollingCount:i+1,position:{x:(i%6-2.5)*.25,y:.3+Math.floor(i/6)*.08,z:1.95}}));
    const cues=losses.map(loss=>({...cue('loss-impact',loss.count,.5),position:loss.position}));
    const state=effectState(4000,{lostBallCount:99,losses,cues});
    view.update(snapshot(4000,20.1),state);const standard=view.stats();expect(standard.tableQuads+standard.worldQuads).toBeLessThan(standard.capacity);
    view.update(snapshot(4000,20.1),state,'low');expect(view.stats().tableQuads+view.stats().worldQuads).toBeLessThan(standard.tableQuads+standard.worldQuads);
    view.update(snapshot(4000,20.1),state,'standard',true);const first=geometryValues(view.worldRoot);
    view.update(snapshot(4000,20.2),state,'standard',true);expect(geometryValues(view.worldRoot)).toEqual(first);
    expect(view.stats().geometries).toBe(4);view.dispose();
  });

  it('coalesces same-time perimeter waves into one drawing while retaining every source cue',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
    const cues=[10,20,30,40].map(value=>cue('loss-wave',value,1.2)),state=effectState(0,{cues}),original=JSON.stringify(state);
    const mesh=rig.getObjectByName('rally-table-lines') as Mesh;
    view.update(snapshot(0,20.3),effectState(0,{cues:[cues[0]!]}));
    const count=mesh.geometry.drawRange.count,positions=geometryValues(rig),colors=Array.from(triangleAttribute(mesh.geometry,'color').array.slice(0,count*4));
    view.update(snapshot(0,20.3),state);
    expect(mesh.geometry.drawRange.count).toBe(count);expect(geometryValues(rig)).toEqual(positions);
    expect(Array.from(triangleAttribute(mesh.geometry,'color').array.slice(0,count*4))).toEqual(colors);
    expect(JSON.stringify(state)).toBe(original);expect(state.cues).toHaveLength(4);view.dispose();
  });

  it('budgets overlapping different-time wave opacity continuously rather than adding four full-strength outlines',()=>{
    const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig),mesh=rig.getObjectByName('rally-table-lines') as Mesh;
    const cues=[10,20,30,40].map((value,i)=>cue('loss-wave',value,1.2,20+i*.05)),state=effectState(0,{cues});
    view.update(snapshot(0,20.4),state);const colors=triangleAttribute(mesh.geometry,'color');let summedAlpha=0;
    for(let i=0;i<mesh.geometry.drawRange.count;i+=6)summedAlpha+=colors.getW(i);
    // Four sides × sixteen independent segments per outline. Summing their
    // per-outline opacity gives an upper bound even if every outline overlaps.
    expect(summedAlpha/64).toBeLessThanOrEqual(.450001);expect(state.cues).toHaveLength(4);
    const staggered=effectState(0,{cues:[cue('loss-wave',10,1.2),cue('loss-wave',20,1.2,20.2)]});
    view.update(snapshot(0,20.199),staggered);const before=colors.getW(0);
    view.update(snapshot(0,20.201),staggered);expect(Math.abs(colors.getW(0)-before)).toBeLessThan(.01);view.dispose();
  });

  it('fades lower-priority perimeter waves away for the final loss without deleting wave facts',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const state=effectState(0,{lostBallCount:100,cues:[...[10,20,30,40].map(value=>cue('loss-wave',value,1.2)),cue('loss-final',100,2)]});
    view.update({...snapshot(0,20.4),phase:'gameover'},state);
    expect(view.stats().activeEffects).not.toContain('loss-wave');expect(view.stats().activeEffects).toContain('loss-final');
    expect(state.cues.filter(c=>c.kind==='loss-wave')).toHaveLength(4);view.dispose();
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
    const p=triangleAttribute(mesh.geometry,'position'),c=triangleAttribute(mesh.geometry,'color'),projected=new Vector3();let visible=0;
    for(let i=0;i<mesh.geometry.drawRange.count;i++)if(c.getX(i)>.4&&c.getY(i)>.58&&c.getZ(i)>.8){
      expect(p.getZ(i)).toBeGreaterThan(-6);expect(p.getZ(i)).toBeLessThan(-3);
      projected.set(p.getX(i),p.getY(i),p.getZ(i)).project(camera);
      if(Math.abs(projected.x)<1&&Math.abs(projected.y)<1){
        if(p.getY(i)<0){
          // Rays below the table reach its plane beyond the far edge.
          const crossing=camera.position.z+(p.getZ(i)-camera.position.z)*camera.position.y/(camera.position.y-p.getY(i));
          expect(crossing).toBeLessThan(-DEFAULT_CONFIG.tableHalfLength);
        }else{
          // Both endpoints are above y=0: the ray never crosses the opaque court.
          expect(Math.min(camera.position.y,p.getY(i))).toBeGreaterThanOrEqual(0);
        }
        visible++;
      }
    }
    expect(visible).toBeGreaterThan(250);
    const backing=view.worldRoot.getObjectByName('rally-world-glow') as Mesh;
    expect((backing.material as {blending:number}).blending).toBe(NormalBlending);
    view.dispose();
  });

  it.each([[390,844],[1280,720]])('covers most of the upper background at %i×%i while preserving the floor seam',(width,height)=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group()),camera=createCamera();fitCamera(camera,width,height,DEFAULT_CONFIG);view.update(snapshot(2000));
    const mesh=view.worldRoot.getObjectByName('rally-world-glow') as Mesh,p=triangleAttribute(mesh.geometry,'position');
    const xs:number[]=[],ys:number[]=[];
    for(let i=0;i<6;i++){xs.push(p.getX(i));ys.push(p.getY(i));}
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),planeZ=p.getZ(0);
    const seam=new Vector3(camera.position.x,-.8,-6.15).project(camera).y,ray=new Vector3();let covered=0;
    for(const x of [-.8,-.4,0,.4,.8])for(const fraction of [.15,.4,.7,.95]){
      ray.set(x,seam+(1-seam)*fraction,.5).unproject(camera);
      const ratio=(planeZ-camera.position.z)/(ray.z-camera.position.z),worldX=camera.position.x+(ray.x-camera.position.x)*ratio,worldY=camera.position.y+(ray.y-camera.position.y)*ratio;
      if(worldX>minX&&worldX<maxX&&worldY>minY&&worldY<maxY)covered++;
    }
    expect(covered).toBeGreaterThanOrEqual(18);
    // Far-floor points are either in front of the backdrop or below its visible
    // lower edge. The opaque rainbow floor therefore remains unobscured.
    let lowestBackdrop=Infinity;
    for(let i=0;i<mesh.geometry.drawRange.count;i++)lowestBackdrop=Math.min(lowestBackdrop,p.getY(i));
    for(const z of [-2,-4,-6]){
      const ratio=(planeZ-camera.position.z)/(z-camera.position.z),y=camera.position.y+(-.8-camera.position.y)*ratio;
      expect(ratio>1||y<lowestBackdrop).toBe(true);
    }
    view.dispose();
  });

  it('distributes star points and a slow large halo across the portrait upper background',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group()),camera=createCamera();fitCamera(camera,390,844,DEFAULT_CONFIG);view.update(snapshot(2000));
    const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh,p=triangleAttribute(mesh.geometry,'position'),c=triangleAttribute(mesh.geometry,'color'),v=new Vector3();
    const seam=new Vector3(camera.position.x,-.8,-6.15).project(camera).y,bands=[0,0,0],haloY:number[]=[];
    for(let i=0;i<mesh.geometry.drawRange.count;i++){
      v.set(p.getX(i),p.getY(i),p.getZ(i)).project(camera);if(Math.abs(v.x)>.95||v.y<=seam||v.y>=.98)continue;
      if(c.getX(i)>.4&&c.getY(i)>.58&&c.getZ(i)>.8){
        const band=Math.min(2,Math.floor((v.y-seam)/(1-seam)*3));bands[band]=bands[band]!+1;
      }
      if(p.getY(i)>1&&c.getX(i)<.2&&Math.abs(c.getY(i)-.3)<1e-6&&Math.abs(c.getZ(i)-.7)<1e-6)haloY.push(v.y);
    }
    for(const count of bands)expect(count).toBeGreaterThan(50);
    expect(haloY.length).toBeGreaterThan(24);expect(Math.min(...haloY)).toBeLessThan(.6);expect(Math.max(...haloY)).toBeGreaterThan(.8);view.dispose();
  });

  it('gives green, blue and red lightning different widths and travel speeds with smooth motion and decay',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const widths=()=>{
      const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh,p=triangleAttribute(mesh.geometry,'position'),c=triangleAttribute(mesh.geometry,'color');
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
    const mesh=rig.getObjectByName('rally-table-lines') as Mesh,p=triangleAttribute(mesh.geometry,'position'),c=triangleAttribute(mesh.geometry,'color');
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
      view.update(snapshot(4000,20+age),state);const p=triangleAttribute(mesh.geometry,'position');let visible=0;
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
      view.update(snapshot(3000,20+age),state);const p=triangleAttribute(mesh.geometry,'position');let visible=0;
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
    const mesh=rig.getObjectByName('rally-table-lines') as Mesh,p=triangleAttribute(mesh.geometry,'position');
    const y:number[]=[];
    for(let i=0;i<mesh.geometry.drawRange.count;i++)if(p.getY(i)<-.025&&p.getY(i)>-.13)y.push(p.getY(i));
    expect(Math.max(...y)-Math.min(...y)).toBeGreaterThan(.025);view.dispose();
  });

  it('adds genuinely branching tricolor lightning to the 3250 meteor swarm',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const junctions=(score:number)=>{
      view.update(snapshot(score,22));const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh,p=triangleAttribute(mesh.geometry,'position'),c=triangleAttribute(mesh.geometry,'color');
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
    view.update(snapshot(3500));const p=triangleAttribute(mesh.geometry,'position'),ys:number[]=[];
    for(let i=base;i<mesh.geometry.drawRange.count;i++)ys.push(p.getY(i));
    expect(Math.max(...ys)-Math.min(...ys)).toBeGreaterThan(.24);view.dispose();
  });

  it('smoothly yields an older large arrival to a newer one without replaying or extending either event',()=>{
    const view=createRallyEffectView(DEFAULT_CONFIG,new Group());
    const old={id:'1000',threshold:1000,at:20,config:RALLY_EFFECTS.find(c=>c.threshold===1000)!};
    const recent={id:'3000',threshold:3000,at:20.2,config:RALLY_EFFECTS.find(c=>c.threshold===3000)!};
    view.update(snapshot(3000,20.3));const mesh=view.worldRoot.getObjectByName('rally-world-lines') as Mesh,base=mesh.geometry.drawRange.count;
    view.update(snapshot(3000,20.3),effectState(1000,{arrivals:[old]}));const end=mesh.geometry.drawRange.count;
    const maxAlpha=()=>{const c=triangleAttribute(mesh.geometry,'color'),a:number[]=[];for(let i=base;i<end;i++)a.push(c.getW(i));return Math.max(...a);};
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
