import { expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { stepSimulation } from '../../src/game/simulation';
import { createFinishPresentation } from '../../src/app/finishPresentation';
import { createSession } from '../../src/game/session';
import { incoming, scenario } from '../helpers/scenarios';
import { ballLostAt } from '../helpers/losses';

function contact(score: number, count: number) {
  const s = scenario(score);
  s.state.balls = Array.from({ length: count }, (_, i) => incoming(i + 1, 20.05));
  const events = [];
  for (let i = 0; i < 12 && s.state.phase === 'running'; i++) events.push(...s.step().events);
  return { ...s, events };
}

it('ends exactly at the 3500th confirmed hit, even with 30 simultaneous contacts', () => {
  const s = contact(3499, 30);
  expect(s.snapshot()).toMatchObject({ score: 3500, phase: 'gameover', endReason: 'clear', lostBallCount: 0 });
  expect(s.snapshot().balls).toHaveLength(30);
  expect(s.events.filter(e => e.kind === 'player-hit').map(e => e.rallyScore)).toEqual([3500]);
  expect(s.events.filter(e => e.kind === 'game-clear')).toHaveLength(1);
  expect(s.events.some(e => e.kind === 'game-over' || e.kind === 'ball-lost')).toBe(false);
});

it('continues to process every one of 30 simultaneous returns before reaching the goal', () => {
  const s = contact(3469, 30);
  expect(s.snapshot()).toMatchObject({ score: 3499, phase: 'running', lostBallCount: 0 });
  expect(s.events.filter(e => e.kind === 'player-hit').map(e => e.rallyScore)).toEqual(Array.from({ length: 30 }, (_, i) => 3470 + i));
  expect(s.events.some(e => e.kind === 'game-clear')).toBe(false);
  expect(s.snapshot().balls).toHaveLength(30);
});

it('processes all 30 contacts when the last of them reaches exactly 3500', () => {
  const s = contact(3470, 30);
  expect(s.events.filter(e => e.kind === 'player-hit')).toHaveLength(30);
  expect(s.events.filter(e => e.kind === 'game-clear')).toHaveLength(1);
  expect(s.snapshot()).toMatchObject({ score: 3500, endReason: 'clear' });
});

it('freezes score, time and events after clear without changing fixed-step limits', () => {
  const s = contact(3499, 30), end = s.snapshot();
  for (let n = 0; n < 120; n++) {
    expect(stepSimulation(s.state, DEFAULT_CONFIG, DEFAULT_CONFIG.fixedDt, { target: { x: 1, y: .2 } })).toEqual({ snapshot: end, events: [] });
  }
  expect(DEFAULT_CONFIG).toMatchObject({ fixedDt: 1 / 120, maxStepsPerFrame: 12, slowFrameSeconds: 1.5 });
});

it('presents clear on an independent clock without changing the frozen snapshot', () => {
  const end = contact(3499, 1).snapshot(), finish = createFinishPresentation();
  const first = finish.frame(end, 100, end.simTime + 2.8);
  expect(first).toMatchObject({ snapshot: end, finishing: true, presentationTime: end.simTime });
  expect(finish.frame(end, 1500, end.simTime + 2.8)).toMatchObject({ snapshot: end, finishing: true, presentationTime: end.simTime + 1.4 });
  expect(finish.frame(end, 2901, end.simTime + 2.8).finishing).toBe(false);
  expect(finish.frame(end, 9900, end.simTime + 2.8).finishing).toBe(false);
});

it('passes through 3000 and scores 3001 without clearing', () => {
  const s = contact(2999, 2);
  expect(s.snapshot()).toMatchObject({ score: 3001, phase: 'running', endReason: null });
  expect(s.events.filter(e => e.kind === 'player-hit').map(e => e.rallyScore)).toEqual([3000,3001]);
  expect(s.events.some(e => e.kind === 'game-clear')).toBe(false);
});

it('keeps an ordinary failed run distinct from clear', () => {
  const s = scenario(3499);
  s.state.balls = [ballLostAt(1, 20.02, 20)];
  for (let n = 0; n < 30 && s.state.phase === 'running'; n++) s.step(INITIAL_PADDLE);
  expect(s.snapshot()).toMatchObject({ score: 3499, phase: 'gameover', endReason: 'loss', lostBallCount: 1 });
});

it('new sessions and resets have no previous clear outcome', () => {
  const s = createSession(DEFAULT_CONFIG, 7);
  expect(s.snapshot().endReason).toBeNull();
  s.start(); s.reset(8);
  expect(s.snapshot()).toMatchObject({ phase: 'ready', score: 0, endReason: null });
});

it.each(['loss-first', 'clear-first'] as const)('keeps the existing action order when terminal events compete: %s', order => {
  const s = scenario(3499); s.state.lostBallCount = 99;
  s.state.balls = order === 'loss-first'
    ? [ballLostAt(1, 20.001, 20), incoming(2, 20.5, INITIAL_PADDLE, 20, .5)]
    : [incoming(1, 20.05), ballLostAt(2, 20.1, 20)];
  const events = [];
  for (let n = 0; n < 30 && s.state.phase === 'running'; n++) events.push(...s.step().events);
  expect(s.snapshot()).toMatchObject(order === 'loss-first'
    ? { score: 3499, phase: 'gameover', endReason: 'loss', lostBallCount: 100 }
    : { score: 3500, phase: 'gameover', endReason: 'clear', lostBallCount: 99 });
  expect(events.filter(e => e.kind === 'game-clear')).toHaveLength(order === 'loss-first' ? 0 : 1);
  expect(events.filter(e => e.kind === 'game-over')).toHaveLength(order === 'loss-first' ? 1 : 0);
});
