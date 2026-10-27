import {expect,it} from 'vitest';
import {Group,Mesh} from 'three';
import {createRallyEffects,RALLY_EFFECTS} from '../../src/game/rallyEffects';
import {createRallyEffectView} from '../../src/render/rallyEffects';
import {createCelebrationView} from '../../src/render/celebrations';
import {createCelebrations,lossCelebration} from '../../src/game/celebrations';
import {createFinishPresentation} from '../../src/app/finishPresentation';
import {DEFAULT_CONFIG} from '../../src/game/config';
import {scenario} from '../helpers/scenarios';
const hit=(n:number,t=20)=>({id:`h${n}`,runId:'transient',kind:'player-hit' as const,time:t,rallyScore:n,position:{x:0,y:.5,z:1.95}});
const loss=(n:number,t=20)=>({id:`l${n}`,runId:'transient',kind:'ball-lost' as const,time:t,lossCount:n,position:{x:0,y:.3,z:2.2}});
const snapshot=(n:number,t=20.2)=>({...scenario(n,t).snapshot(),runId:'transient'});
it.each([[500,1.2],[1000,2],[1500,1.5],[2000,2],[2500,1.5],[2750,1.1],[3000,2],[3500,2.8]])('draws %i only during its bounded lifetime, reuses buffers and stops uploads', (score,duration)=>{
 const e=createRallyEffects('transient',0),rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig);
 e.consume([hit(score)]);const facts=e.state();e.consume([hit(score)]);expect(e.state()).toEqual(facts);
 expect(facts.arrivals).toHaveLength(1);expect(facts.arrivals[0]!.config.duration).toBe(duration);expect(facts.stage).toEqual([]);
 v.update(snapshot(score),facts);expect(v.stats().activeEffects).toContain(score===3500?'clear-electric':'rally-electric');expect(v.stats().tableQuads).toBeLessThanOrEqual(72);
 const attrs: {version:number}[]=[];rig.traverse(n=>{if(n instanceof Mesh)attrs.push(n.geometry.getAttribute('position'));});
 v.update(snapshot(score,20+duration),facts);const versions=attrs.map(a=>a.version);v.update(snapshot(score,21+duration),facts);
 expect(v.stats().drawCalls).toBe(0);expect(attrs.map(a=>a.version)).toEqual(versions);expect(v.stats().geometries).toBe(2);v.dispose();
});
it('has no permanent stage or old large arrival in 3001-3499 or above3500',()=>{
 expect(RALLY_EFFECTS.every(e=>e.kind!=='A'&&e.threshold<=3500)).toBe(true);
 for(const score of [3001,3250,3499,3501,4000]){const e=createRallyEffects('transient',0);e.consume([hit(score)]);expect(e.state().arrivals).toEqual([]);expect(e.state().stage).toEqual([]);}
});
it.each([1499,1500,3200])('gates ordinary feedback at1500 while every loss fact and milestone remains: %i',score=>{
 const e=createRallyEffects('transient',0),v=createRallyEffectView(DEFAULT_CONFIG,new Group());e.consume([hit(score),loss(49),loss(50)]);
 v.update(snapshot(score),e.state());expect(e.state().losses).toHaveLength(2);expect(v.stats().activeEffects.includes('hit-ring')).toBe(score<1500);
 expect(v.stats().activeEffects.includes('loss-sparks')).toBe(score<1500);expect(v.stats().activeEffects).toContain('loss-electric');v.dispose();
});
it.each([10,20,30,40,50,55,60,70,77,80,88,90,91,92,93,94,95,96,97,98,99,100])('shows loss %i independently at3200',count=>{
 const e=createRallyEffects('transient',0),v=createRallyEffectView(DEFAULT_CONFIG,new Group());e.consume([hit(3200),loss(count)]);v.update(snapshot(3200),e.state());expect(v.stats().activeEffects).toContain('loss-electric');expect(e.state().lostBallCount).toBe(count);v.dispose();
});
it('prioritizes 100 then99 over simultaneous other digits and clears old finish on interruption',()=>{
 const rig=new Group(),v=createCelebrationView(DEFAULT_CONFIG,rig);let c=createCelebrations();for(const n of [50,55,77,88,99,100])c=lossCelebration(c,n,20);
 v.update({...snapshot(3200),celebrations:c});expect(v.stats().numbers).toEqual([100]);v.dispose();
 const finish=createFinishPresentation(),end={...snapshot(3500,20),phase:'gameover' as const,endReason:'clear' as const};expect(finish.frame(end,100).finishing).toBe(true);finish.cancel(end);expect(finish.frame(end,200).finishing).toBe(false);expect(finish.frame(end,300).snapshot).toBe(end);
});
it('uses a distinct2750 pattern and a stronger2000 perimeter than1500',()=>{
 const rig=new Group(),v=createRallyEffectView(DEFAULT_CONFIG,rig);
 const render=(score:number)=>{const e=createRallyEffects('transient',0);e.consume([hit(score)]);v.update(snapshot(score),e.state());const p:number[]=[];rig.traverse(n=>{if(n instanceof Mesh)p.push(...Array.from(n.geometry.getAttribute('position').array as ArrayLike<number>).slice(0,n.geometry.drawRange.count*3));});return {p,quads:v.stats().tableQuads};};
 expect(render(2750).p).not.toEqual(render(2500).p);expect(render(2000).quads).toBeGreaterThan(render(1500).quads);v.dispose();
});
