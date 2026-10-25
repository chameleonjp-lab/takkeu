import { expect, it } from 'vitest';
import { createRallyEffects, RALLY_EFFECTS, RALLY_EFFECT_LIMITS } from '../../src/game/rallyEffects';
import type { GameEvent } from '../../src/game/types';

const runId = 'rally-test';
const point = { x: .25, y: .4, z: 1.95 };
const hit = (score: number, at = score / 10, extra: Partial<GameEvent> = {}): GameEvent => ({ id: `${runId}:h${score}`, runId, kind: 'player-hit', time: at, rallyScore: score, position: { ...point }, ...extra });
const loss = (count: number, at = count / 10, extra: Partial<GameEvent> = {}): GameEvent => ({ id: `${runId}:l${count}`, runId, kind: 'ball-lost', time: at, lossCount: count, position: { x: count / 100, y: .3, z: 2.2 }, ...extra });

it('declares every threshold with category, duration, color, priority and replacement rules', () => {
  expect(RALLY_EFFECTS.map(c => c.threshold)).toEqual([50,100,200,300,400,500,600,700,800,900,1000,1250,1500,1750,2000,2250,2500,2750,3000,3250,3500,3750,4000]);
  for (const config of RALLY_EFFECTS) {
    expect(['A', 'B', 'C']).toContain(config.kind);
    expect(config.color).toBeTruthy();
    expect(config.priority).toBeGreaterThan(0);
    expect(Array.isArray(config.replaces)).toBe(true);
  }
  expect(RALLY_EFFECTS.find(c => c.threshold === 50)).toMatchObject({ kind: 'C', duration: .3 });
  for (const [threshold, duration] of [[100,1.2],[200,1.2],[300,1.5],[800,1.5],[1000,3.5],[2000,2.5],[3000,3.5],[4000,4]]) {
    expect(RALLY_EFFECTS.find(c => c.threshold === threshold)?.duration).toBe(duration);
  }
});

it.each([50,100,200,300,400,500,600,700,800,900,1000,1250,1500,1750,2000,2250,2500,2750,3000,3250,3500,3750,4000])('records threshold %i exactly at its confirmed score and never replays it', threshold => {
  const effects = createRallyEffects(runId, 0);
  effects.consume([hit(threshold - 1, 1)]);
  expect(effects.state().arrivals.some(a => a.threshold === threshold)).toBe(false);
  effects.consume([hit(threshold, 2)]);
  const config = RALLY_EFFECTS.find(c => c.threshold === threshold)!;
  expect(effects.state().score).toBe(threshold);
  if (config.kind === 'B' || threshold === 2000) expect(effects.state().arrivals.some(a => a.threshold === threshold)).toBe(true);
  else expect(effects.state().stage.some(c => c.threshold === threshold) || effects.state().hits.some(h => h.score === threshold)).toBe(true);
  effects.consume([hit(threshold + 1, 2.01)]);
  const arrivals = effects.state().arrivals.filter(a => a.threshold === threshold);
  effects.consume([hit(threshold, 2), hit(threshold, 3, { id: 'new-id-same-score' })]);
  expect(effects.state().arrivals.filter(a => a.threshold === threshold)).toEqual(arrivals);
});

it('preserves each hit and arrival in a same-frame batch, copies positions and ignores foreign runs', () => {
  const effects = createRallyEffects(runId, 99);
  const events = [hit(100, 1), hit(200, 1, { position: { x: -.7, y: .6, z: 1.95 } }), hit(300, 1)];
  effects.consume(events);
  effects.consume(events);
  effects.consume([hit(500, 1, { runId: 'other' })]);
  expect(effects.state().arrivals.map(a => a.threshold)).toEqual([100,200,300]);
  expect(effects.state().hits.map(h => h.score)).toEqual([100,200,300]);
  expect(effects.state().hits[1]?.position?.x).toBe(-.7);
  (events[1]!.position as {x:number}).x = 50;
  expect(effects.state().hits[1]?.position?.x).toBe(-.7);
  const snapshot = effects.state();
  (snapshot.hits[1]!.position as {x:number}).x = 60;
  expect(effects.state().hits[1]?.position?.x).toBe(-.7);
});

it('captures a nonzero run-start best once and never treats the first run as a record', () => {
  const effects = createRallyEffects(runId, 99);
  effects.consume([hit(99, 1)]);
  expect(effects.state().best).toBeNull();
  effects.consume([hit(100, 2), hit(101, 2.1), hit(102, 2.2)]);
  expect(effects.state().best).toMatchObject({ score: 100, at: 2, position: point });
  expect(effects.state().cues.filter(c => c.kind === 'best-record')).toHaveLength(1);
  const first = createRallyEffects(runId, 0);
  first.consume([hit(1), hit(4000)]);
  expect(first.state().best).toBeNull();
});

it('generates normal notices at each required cadence and major notices replace normal ones', () => {
  const effects = createRallyEffects(runId, 0);
  const scores = [4,5,10,45,49,50,60,190,199,200,201,300,999,1000,2000,3000,4000,4001];
  effects.consume(scores.map(score => hit(score, 1)));
  expect(effects.state().cues.filter(c => c.kind === 'notice').map(c => c.value)).toEqual([5,10,45,50,60,190,200,300]);
  const main = effects.state().cues.filter(c => c.kind === 'major');
  expect(main.map(c => c.value)).toEqual([1000,2000,3000,4000]);
  expect(main.every(c => c.duration === 2.5)).toBe(true);
  expect(effects.state().cues.filter(c => c.kind === 'notice').every(c => c.duration === 1.8)).toBe(true);
  expect(effects.state().score).toBe(4001);
});

it('resolves all permanent replacements, preserves 4001+ and keeps transient end time independent of wall time', () => {
  const effects = createRallyEffects(runId, 0);
  effects.consume([hit(900, 10)]);
  expect(effects.state().stage.map(c => c.effect)).toContain('corner-posts');
  effects.consume([hit(1000, 11)]);
  expect(effects.state().stage.map(c => c.effect)).not.toContain('corner-posts');
  expect(effects.state().stage.map(c => c.effect)).toContain('green-blue-world');
  effects.consume([hit(4000, 20)]);
  expect(effects.state().stage.map(c => c.effect)).toContain('final-world');
  expect(effects.state().stage.map(c => c.effect)).not.toContain('center-density');
  expect(effects.state().stage.map(c => c.effect)).not.toContain('background-threads');
  expect(effects.state().stage.map(c => c.effect)).not.toContain('floor-wave');
  expect(effects.state().stage.map(c => c.effect)).not.toContain('meteor');
  expect(effects.endTime()).toBe(24);
  const paused = effects.state();
  effects.consume([]);
  expect(effects.state()).toEqual(paused);
  effects.consume([hit(4001, 25)]);
  expect(effects.state().score).toBe(4001);
  expect(effects.state().arrivals).toEqual([]);
});

it('retains every loss coordinate and counts a true rolling two-second window, not a pairwise streak', () => {
  const effects = createRallyEffects(runId, 0);
  effects.consume([loss(1,0),loss(2,1.5),loss(3,3),loss(4,4.5)]);
  expect(effects.state().cues.filter(c => c.kind === 'loss-impact')).toEqual([]);
  effects.consume([loss(5,4.6),loss(6,4.7),loss(7,4.8)]);
  const state = effects.state();
  expect(state.losses.map(l => l.count)).toEqual([3,4,5,6,7]);
  expect(state.losses.at(-1)?.rollingCount).toBe(5);
  expect(state.cues.filter(c => c.kind === 'loss-impact').map(c => c.value)).toEqual([6,7]);
  expect(state.cues.filter(c => c.kind === 'loss-spark').every(c => c.duration === .5)).toBe(true);
  expect(state.losses.at(-1)?.position?.x).toBe(.07);
  effects.consume([loss(7,4.8),loss(7,5,{id:'duplicate-count'})]);
  expect(effects.state().lostBallCount).toBe(7);
  const boundary = createRallyEffects(runId,0);
  boundary.consume([loss(1,1),loss(2,2),loss(3,2.5),loss(4,3)]);
  expect(boundary.state().losses.at(-1)?.rollingCount).toBe(4);
});

it('retains simultaneous losses, each special loss cue, final coordinates and exact end times', () => {
  const effects = createRallyEffects(runId, 0);
  const counts = [10,20,30,40,50,55,77,88,90,91,92,93,94,95,96,97,98,99,100];
  effects.consume(counts.map(count => loss(count, 10)));
  expect(effects.state().losses.map(l => l.count)).toEqual(counts);
  const cues = effects.state().cues;
  expect(cues.filter(c => c.kind === 'loss-wave').map(c => c.value)).toEqual([10,20,30,40]);
  expect(cues.find(c => c.kind === 'loss-net')?.value).toBe(50);
  expect(cues.filter(c => c.kind === 'loss-number').map(c => [c.value,c.duration])).toEqual([[55,.8],[77,.8],[88,.8]]);
  expect(cues.filter(c => c.kind === 'loss-warning').map(c => c.value)).toEqual([90,91,92,93,94,95,96,97,98,99]);
  expect(cues.find(c => c.kind === 'loss-gold')).toMatchObject({value:99,duration:1.2});
  expect(cues.find(c => c.kind === 'loss-final')).toMatchObject({value:100,position:{x:1,y:.3,z:2.2}});
  expect(effects.endTime()).toBeLessThanOrEqual(15);
});

it('keeps bounded recent histories without retaining a growing event-id set', () => {
  const effects = createRallyEffects(runId, 0);
  for (let n=1;n<=10000;n++) effects.consume([hit(n,n/30)]);
  const state = effects.state();
  expect(state.score).toBe(10000);
  expect(state.hits.length).toBeLessThanOrEqual(RALLY_EFFECT_LIMITS.hits);
  expect(state.cues.length).toBeLessThanOrEqual(RALLY_EFFECT_LIMITS.cues);
  expect(state.arrivals.length).toBeLessThanOrEqual(RALLY_EFFECTS.length);
  expect(state.hits.every(h => h.at >= 10000/30 - 1.5)).toBe(true);
});

it('ignores invalid and legacy score events rather than manufacturing scores', () => {
  const effects = createRallyEffects(runId, 0);
  effects.consume([hit(NaN),hit(-1),hit(1.1),hit(10,NaN),{id:'legacy',runId,kind:'player-hit',time:1}]);
  expect(effects.state().score).toBe(0);
  expect(effects.endTime()).toBe(0);
});

it('ignores replayed score/loss facts completely, including their attempted time advance', () => {
  const effects = createRallyEffects(runId, 0);
  effects.consume([hit(100,1),loss(1,1.1)]);
  const before = effects.state();
  effects.consume([hit(100,999,{id:'replayed-score'}),loss(1,999,{id:'replayed-loss'})]);
  expect(effects.state()).toEqual(before);
});

it('retains all thirty same-frame action positions and all hundred simultaneous loss positions until expiry', () => {
  const effects = createRallyEffects(runId,0);
  effects.consume(Array.from({length:30},(_,i) => hit(50+i,1,{position:{x:i/100,y:.4,z:1.95}})));
  expect(effects.state().hits.map(h => h.position?.x)).toEqual(Array.from({length:30},(_,i) => i/100));
  effects.consume(Array.from({length:100},(_,i) => loss(i+1,1)));
  expect(effects.state().losses).toHaveLength(100);
  expect(effects.state().cues.filter(c => c.kind === 'loss-spark')).toHaveLength(100);
  effects.consume([{id:'clock',runId,kind:'opponent-hit',time:1.49999}]);
  expect(effects.state().cues.filter(c => c.kind === 'loss-spark')).toHaveLength(100);
  effects.consume([{id:'clock2',runId,kind:'opponent-hit',time:1.5}]);
  expect(effects.state().cues.filter(c => c.kind === 'loss-spark')).toHaveLength(0);
});

it.each([
  [1000,'corner-posts'], [1500,'green-perimeter'], [1500,'green-net'], [2000,'background-threads'],
  [2500,'floor-wave'], [2750,'background-halo'], [3250,'meteor'], [3500,'side-halos'], [4000,'center-density'],
])('replaces the %s previous permanent effect %s exactly at the new boundary', (threshold, replaced) => {
  const effects = createRallyEffects(runId,0);
  effects.consume([hit(Number(threshold)-1,1)]);
  expect(effects.state().stage.map(c => c.effect)).toContain(replaced);
  effects.consume([hit(Number(threshold),2)]);
  expect(effects.state().stage.map(c => c.effect)).not.toContain(replaced);
});

it.each([[100,1.2],[200,1.2],[300,1.5],[800,1.5],[1000,3.5],[2000,2.5],[3000,3.5],[4000,4]])('expires arrival %i at its exact %.1fs duration', (score, duration) => {
  const effects = createRallyEffects(runId,0);
  effects.consume([hit(score,10)]);
  effects.consume([{id:'clock1',runId,kind:'opponent-hit',time:10+duration-.00001}]);
  expect(effects.state().arrivals).toHaveLength(1);
  effects.consume([{id:'clock2',runId,kind:'opponent-hit',time:10+duration}]);
  expect(effects.state().arrivals).toHaveLength(0);
});

it('integrates the1000 green/blue world into the1500 tricolor lightning family without a duplicate old layer', () => {
  const effects = createRallyEffects(runId,0);
  effects.consume([hit(1499,1)]);
  expect(effects.state().stage.map(c => c.effect)).toContain('green-blue-world');
  effects.consume([hit(1500,2)]);
  const lightningFamily = effects.state().stage.map(c => c.effect).filter(effect =>
    ['green-blue-world','green-perimeter','green-net','tricolor-network'].includes(effect));
  expect(lightningFamily).toEqual(['tricolor-network']);
});
