import {expect,it}from'vitest';
import{Group,InstancedMesh,Mesh}from'three';
import{DEFAULT_CONFIG}from'../../src/game/config';
import type{RallyEffectsState}from'../../src/game/rallyEffects';
import{createRallyEffectView}from'../../src/render/rallyEffects';
import{createObjects}from'../../src/render/objects';
import{applyPresentation,resolvePresentation}from'../../src/render/presentation';
import{createCelebrationView}from'../../src/render/celebrations';
import{createCelebrations,lossCelebration,rallyCelebration}from'../../src/game/celebrations';
import{scenario}from'../helpers/scenarios';
const snap=(score=4000,time=20.1)=>({...scenario(score,time).snapshot(),runId:'feedback'});
const state=(extra:Partial<RallyEffectsState>={}):RallyEffectsState=>({runId:'feedback',score:4000,bestAtStart:0,best:null,arrivals:[],hits:[],losses:[],cues:[],lostBallCount:0,stage:[],...extra});
const positions=(rig:Group)=>{const a:number[]=[];rig.traverse(n=>{if(n instanceof Mesh)a.push(...Array.from(n.geometry.getAttribute('position').array as ArrayLike<number>).slice(0,n.geometry.drawRange.count*3));});return a;};
it('high-rally decoration has no perpetual GPU work and only two shared feedback batches',()=>{
 const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig);
 for(const score of[1500,2600,3000,4000,5000]){v.update(snap(score));expect(v.stats().drawCalls).toBe(0);expect(v.stats().tableQuads+v.stats().worldQuads).toBe(0);}
 expect(v.stats().geometries).toBe(2);expect(v.stats().capacity).toBeLessThanOrEqual(7000);v.dispose();
});
it('30 distinct simultaneous hits retain independent feedback with at most360 quads and no event mutation',()=>{
 const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig),s=state({hits:Array.from({length:30},(_,i)=>({id:String(i),score:4000+i,at:20,smashReturn:false,position:{x:(i%6-2.5)*.2,y:.4+Math.floor(i/6)*.05,z:1.95}}))});
 const before=JSON.stringify(s);v.update(snap(),s);expect(v.stats().tableQuads).toBeGreaterThanOrEqual(30);expect(v.stats().tableQuads).toBeLessThanOrEqual(360);expect(v.stats().activeEffects).toContain('hit-ring');expect(JSON.stringify(s)).toBe(before);v.dispose();
});
it('coincident same-time light is drawn once while every hit fact remains',()=>{
 const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig),hits=Array.from({length:30},(_,i)=>({id:String(i),score:4000+i,at:20,smashReturn:false,position:{x:.4,y:.5,z:1.95}}));
 v.update(snap(),state({hits:[hits[0]!]}));const single=v.stats().tableQuads,one=positions(rig);expect(single).toBeGreaterThan(0);
 v.update(snap(),state({hits}));expect(v.stats().tableQuads).toBe(single);expect(single).toBeLessThanOrEqual(12);expect(positions(rig)).toEqual(one);expect(hits).toHaveLength(30);v.dispose();
});
it('feedback expires on simulation time, ignores foreign runs and stays still in reduced motion',()=>{
 const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig),s=state({hits:[{id:'hit',score:50,at:20,smashReturn:false,position:{x:.4,y:.5,z:1.95}}]});
 v.update(snap(4000,20.05),s,'standard',true);const a=positions(rig);v.update(snap(4000,20.2),s,'standard',true);expect(positions(rig)).toEqual(a);
 v.update(snap(4000,20.3),s);expect(v.stats().drawCalls).toBe(0);v.update(snap(),{...s,runId:'old'});expect(v.stats().drawCalls).toBe(0);v.dispose();
});
it('the100th actual loss retains its marker and a short final outline without advancing balls',()=>{
 const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig),s=state({lostBallCount:100,losses:[{id:'lost100',count:100,at:20,rollingCount:4,position:{x:.7,y:.16,z:2.3}}],cues:[{id:'end',kind:'loss-final',value:100,at:20,duration:2,priority:100}]}),snapshot={...snap(),phase:'gameover' as const};
 const before=JSON.stringify(snapshot);v.update(snapshot,s);expect(v.stats().activeEffects).toContain('loss-sparks');expect(v.stats().activeEffects).toContain('loss-final');expect(v.stats().worldQuads).toBeGreaterThan(0);expect(v.stats().tableQuads).toBeGreaterThan(0);expect(JSON.stringify(snapshot)).toBe(before);
 v.update({...snapshot,simTime:20.5},s);expect(v.stats().activeEffects).not.toContain('loss-sparks');expect(v.stats().activeEffects).toContain('loss-final');v.update({...snapshot,simTime:22},s);expect(v.stats().drawCalls).toBe(0);v.dispose();
});
it('30 balls keep three instanced draws, their physical radius and transforms within11000 triangles',()=>{
 const objects=createObjects(DEFAULT_CONFIG),base=snap(),balls=Array.from({length:30},(_,i)=>({id:i+1,phase:'incoming' as const,smash:false,position:{x:(i%6-2.5)*.2,y:.4,z:.8}}));applyPresentation(objects,{...base,balls});
 const batches:InstancedMesh[]=[];objects.root.traverse(n=>{if(n instanceof InstancedMesh)batches.push(n);});expect(batches).toHaveLength(3);expect(batches.every(b=>b.count===30)).toBe(true);
 const triangles=batches.reduce((n,b)=>n+(b.geometry.index?.count??b.geometry.getAttribute('position').count)*b.count/3,0);expect(triangles).toBeLessThanOrEqual(11000);
 for(const b of batches.filter(b=>b.geometry.type==='SphereGeometry')){b.geometry.computeBoundingSphere();expect(b.geometry.boundingSphere!.radius).toBeCloseTo(DEFAULT_CONFIG.ballRadius,6);}objects.dispose();
});
it('broad century flashes are absent from1000 while loss digits and the earlier presentation remain',()=>{
 const objects=createObjects(DEFAULT_CONFIG),v=createCelebrationView(DEFAULT_CONFIG,objects.tableRig);let c=createCelebrations();for(let i=1;i<=100;i++)c=lossCelebration(c,i,20);c=rallyCelebration(c,4000,20);
 v.update({...snap(),celebrations:c});expect(v.stats().environment).toBeNull();expect(v.stats().numbers).toHaveLength(14);expect((v.worldRoot.children[0]as Mesh).geometry.drawRange.count).toBe(0);
 v.update({...snap(900),celebrations:rallyCelebration(createCelebrations(),900,20)});expect(v.stats().environment).not.toBeNull();v.dispose();objects.dispose();
});
it('dark high-rally backdrop replaces the animated field without changing earlier unlocks or ball visibility',()=>{
 expect(resolvePresentation(snap(1499)).opponentField).toBe(true);
 for(const score of[1500,2600,3000,4000]){const s=snap(score);expect(resolvePresentation(s).opponentField).toBe(false);expect(resolvePresentation(s).balls).toEqual(resolvePresentation({...s,score:1499}).balls);}
});
it('high-rally lightning and camera-independent table shake are replaced by local feedback while loss digits remain',()=>{
 const objects=createObjects(DEFAULT_CONFIG),v=createCelebrationView(DEFAULT_CONFIG,objects.tableRig);let c=createCelebrations();for(let i=1;i<=100;i++)c=lossCelebration(c,i,20);c=rallyCelebration(c,1111,20);
 v.update({...snap(),celebrations:c});expect(v.stats().netBolts).toBe(0);expect(v.stats().edgeBolts).toBe(0);expect(v.stats().numbers).toHaveLength(14);expect(v.lightning.geometry.drawRange.count).toBe(0);expect(objects.tableRig.position.length()).toBe(0);v.dispose();objects.dispose();
});
it('capacity reserves the final outline alongside the maximum512 distinct hit facts',()=>{
 const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig),hits=Array.from({length:512},(_,i)=>({id:String(i),score:4000+i,at:20,smashReturn:false,position:{x:(i%32-15.5)*.05,y:.2+Math.floor(i/32)*.04,z:1.95}}));
 const s=state({score:4512,hits,lostBallCount:100,cues:[{id:'end',kind:'loss-final',value:100,at:20,duration:2,priority:100}]});
 v.update({...snap(4512),phase:'gameover'},s);expect(v.stats().tableQuads).toBe(512*12+4);expect(v.stats().activeEffects).toContain('loss-final');expect(hits).toHaveLength(512);v.dispose();
});
