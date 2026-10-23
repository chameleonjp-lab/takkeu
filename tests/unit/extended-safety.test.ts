import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { flightDuration, speedMultiplier } from '../../src/game/difficulty';
import { retimeFlight } from '../../src/game/flightSpeed';
import { scheduleReturn } from '../../src/game/scheduler';
import { choosePlayerTarget } from '../../src/game/targets';
import { sampleReturn } from '../../src/game/trajectory';
import { createLoop } from '../../src/app/loop';
import { createSession } from '../../src/game/session';
import { createInputTimeline } from '../../src/input/timeline';
import { incoming, scenario } from '../helpers/scenarios';

describe('加速・予告・入力の境界',()=>{
  it('到着点は左右3帯へ散り、同じ帯を連続せず全て操作範囲へ収まる',()=>{
    const source={randomState:12345,lastTargetBand:1},bands=new Set<number>(),xs:number[]=[];
    for(let i=0;i<300;i++){
      const old=source.lastTargetBand,p=choosePlayerTarget(source,DEFAULT_CONFIG);
      expect(source.lastTargetBand).not.toBe(old);bands.add(source.lastTargetBand);xs.push(p.x);
      expect(p.y).toBeGreaterThanOrEqual(.32);expect(p.y).toBeLessThanOrEqual(.64);
    }
    expect(bands.size).toBe(3);expect(Math.min(...xs)).toBeLessThan(-.5);expect(Math.max(...xs)).toBeGreaterThan(.5);
  });
  it.each([[false,true],[true,false]])('540の増速でも混在球(%s/%s)の前後の移動余裕が残る',(firstSmash,secondSmash)=>{
    const make=(ballId:number,smash:boolean,x:number)=>({ballId,smash,score:539,speedMultiplier:speedMultiplier(539),earliestDepartAt:20,preferredTarget:{x,y:.5}});
    const a=scheduleReturn(make(1,firstSmash,-.1),[],DEFAULT_CONFIG),b=scheduleReturn(make(2,secondSmash,.1),[a],DEFAULT_CONFIG);
    const time=Math.max(a.departAt,b.departAt)+.001;
    expect(time).toBeLessThan(Math.min(a.arriveAt,b.arriveAt));
    const next=[a,b].map(plan=>retimeFlight(plan,time,539,540,DEFAULT_CONFIG)).sort((x,y)=>x.arriveAt-y.arriveAt);
    expect(next[1]!.arriveAt-next[0]!.arriveAt).toBeGreaterThanOrEqual(.12+.2/DEFAULT_CONFIG.paddleSpeed);
    for(let i=0;i<2;i++){
      const old=[a,b][i]!,updated=next.find(p=>p.ballId===old.ballId)!,from={x:0,y:.5,z:-1.95};
      const before=sampleReturn(old,from,time),after=sampleReturn(updated,from,time);
      for(const axis of ['x','y','z'] as const)expect(after[axis]).toBeCloseTo(before[axis],10);
    }
  });
  it('最低視認時間に達した軌道は倍率だけで過剰に縮めない',()=>{
    const config={...DEFAULT_CONFIG,minimumVisibleSeconds:.7};
    const plan=scheduleReturn({ballId:1,smash:false,score:300,speedMultiplier:speedMultiplier(300),earliestDepartAt:20,preferredTarget:INITIAL_PADDLE},[],config);
    const next=retimeFlight(plan,20.2,300,500,config);
    expect(next.arriveAt).toBe(plan.arriveAt);expect(next.departAt).toBe(plan.departAt);
    expect(flightDuration(config,500,false)).toBe(1.4);
  });
  it('予告後の539→540で早出し・予告の取り消し・二重音を生じない',()=>{
    const s=scenario(539);const out=incoming(2,20.001);
    s.state.balls=[{...out,phase:'outgoing',from:{x:0,y:.5,z:1.95},plan:{...out.plan,landingZ:-1.95}},incoming(1,20.30,INITIAL_PADDLE,20,.4)];
    const all=[...s.step().events],warning=all.find(e=>e.kind==='smash-warning'&&e.ballId===2)!;
    expect(warning).toBeDefined();
    for(let tick=0;tick<120&&s.state.score<540;tick++)all.push(...s.step().events);
    expect(s.state.score).toBe(540);
    const plan=s.snapshot().scheduledReturns.find(p=>p.ballId===2)!;
    expect(plan.warningAt).toBe(warning.time);expect(plan.departAt-warning.time).toBeGreaterThanOrEqual(.4-1e-10);
    while(s.state.simTime<plan.departAt+.02)all.push(...s.step(plan.target).events);
    expect(all.filter(e=>e.kind==='smash-warning'&&e.ballId===2)).toHaveLength(1);
    expect(all.find(e=>e.kind==='opponent-hit'&&e.ballId===2)!.time-warning.time).toBeGreaterThanOrEqual(.4-1e-10);
  });
  it('遅延を破棄した時は入力時刻も追いつき上限内に写像する',()=>{
    const session=createSession(DEFAULT_CONFIG,7);session.start();
    const loop=createLoop({session,config:DEFAULT_CONFIG,timeline:createInputTimeline(INITIAL_PADDLE),onEvents(){},onPause(){}});
    loop.resetClock(0);expect(loop.toSimTime(900)).toBeCloseTo(.1,10);
    loop.frame(900);expect(loop.toSimTime(920)).toBeCloseTo(.12,10);
  });
});
