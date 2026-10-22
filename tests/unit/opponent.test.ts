import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { chooseReturnKind, planOpponentReturn } from '../../src/game/opponent';
import { resolveOpponentPose } from '../../src/render/opponentView';
import { resolvePresentation } from '../../src/render/presentation';
import { createAudio } from '../../src/audio/audio';
import { fakeAudioContext } from '../helpers/audioContext';
import { incoming, scenario } from '../helpers/scenarios';
import type { GameEvent, ReturnPlan } from '../../src/game/types';

const outgoing = (id: number, arriveAt = 20.001) => {
  const ball = incoming(id, arriveAt);
  return { ...ball, phase: 'outgoing' as const, from: { x: 0, y: 0.5, z: DEFAULT_CONFIG.paddleZ }, plan: { ...ball.plan, landingZ: -DEFAULT_CONFIG.paddleZ } };
};
const request = (ballId = 1, earliestDepartAt = 20) => ({ ballId, earliestDepartAt, preferredTarget: { x: -1.05, y: 0.15 }, speedMultiplier: 2.2, score: 450, randomValue: 0.1 });

describe('450以降の相手の返球', () => {
  it('449では通常、450から20%の候補を有効にする', () => {
    expect(chooseReturnKind(449, 10, [], 0)).toBe('normal');
    expect(chooseReturnKind(450, 10, [], 0.199999)).toBe('smash');
    expect(chooseReturnKind(450, 10, [], 0.20)).toBe('normal');
    expect(chooseReturnKind(9999, 10, [], 0.9)).toBe('normal');
  });
  it('実行済み・予約済みの前後2.0秒内を除外し、ちょうど2秒は許可する', () => {
    for (const committed of [8.001, 11.999]) expect(chooseReturnKind(450, 10, [committed], 0)).toBe('normal');
    expect(chooseReturnKind(450, 10, [8, 12], 0)).toBe('smash');
  });
  it('4球が同時にスマッシュ候補でも全打球間隔と到着前後の移動余裕を守る', () => {
    const reserved: ReturnPlan[] = [], history: number[] = [];
    for (let id = 1; id <= 4; id++) {
      const plan = planOpponentReturn({ ...request(id), preferredTarget: { x: id % 2 ? -1.05 : 1.05, y: id % 2 ? 0.15 : 0.85 } }, reserved, history, DEFAULT_CONFIG);
      reserved.push(plan); if (plan.smash) history.push(plan.departAt);
    }
    expect(history.length).toBeGreaterThan(0);
    expect(reserved.some(p => !p.smash)).toBe(true);
    for (let i = 0; i < history.length; i++) for (let j = i + 1; j < history.length; j++) expect(Math.abs(history[i]! - history[j]!)).toBeGreaterThanOrEqual(2);
    const sorted = reserved.sort((a, b) => a.arriveAt - b.arriveAt);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!, b = sorted[i]!;
      expect(b.arriveAt - a.arriveAt + 1e-10).toBeGreaterThanOrEqual(0.12 + Math.hypot(a.target.x - b.target.x, a.target.y - b.target.y) / 6);
    }
    for (const plan of sorted.filter(p => p.smash)) {
      expect(plan.departAt - plan.warningAt!).toBeCloseTo(0.4, 10);
      expect(plan.arriveAt - plan.netCrossAt).toBeGreaterThanOrEqual(0.5 - 1e-10);
    }
  });
  it('配球で打球が遅れた最終時刻でもスマッシュ間隔を再確認する', () => {
    const base = planOpponentReturn(request(2, 0), [], [], DEFAULT_CONFIG);
    const fixed = [1.4, 1.7, 4].map((arriveAt, i) => ({ ...base, ballId: i + 2, arriveAt, departAt: arriveAt - 1, target: { x: 1.05, y: 0.85 }, smash: i === 2 }));
    const plan = planOpponentReturn(request(1, 0), fixed, [3], DEFAULT_CONFIG);
    expect(plan.smash).toBe(false);
    expect(fixed[2]!.departAt).toBe(3);
  });
  it('通常とスマッシュの1.2倍・最低視認時間を初期値どおり予約する', () => {
    const normal = planOpponentReturn({ ...request(), speedMultiplier: 1, randomValue: 0.9 }, [], [], DEFAULT_CONFIG);
    const smash = planOpponentReturn({ ...request(), speedMultiplier: 1 }, [], [], DEFAULT_CONFIG);
    expect(normal.arriveAt - normal.netCrossAt).toBeCloseTo(1.25);
    expect(smash.arriveAt - smash.netCrossAt).toBeCloseTo(1.25 / 1.2);
    expect(smash.warningAt).toBeGreaterThanOrEqual(20 - 1e-10);
  });
  it('449→450の接触後の新規予約からスマッシュを使い、予告と打球と加点を1回ずつ出す', async () => {
    const s = scenario(449);
    // The 450 reward consumes two random values before the next return.
    s.state.randomState = 6;
    s.state.balls = [incoming(1, 20.001, INITIAL_PADDLE, 20, 0.1), outgoing(2, 20.005)];
    const all: GameEvent[] = [...s.step().events];
    const committed = s.snapshot().scheduledReturns.find(p => p.ballId === 2)!;
    expect(s.state.score).toBe(450);
    expect(committed.smash).toBe(true);
    while (s.state.simTime < committed.warningAt! + DEFAULT_CONFIG.fixedDt) all.push(...s.step(committed.target).events);
    expect(resolveOpponentPose(s.snapshot()).preparing).toBe(true);
    expect(resolvePresentation(s.snapshot()).balls[2]!.visible).toBe(false);
    const { context, voices } = fakeAudioContext();
    const audio = createAudio(DEFAULT_CONFIG, () => context); audio.reset(s.state.runId); await audio.unlock();
    audio.consume(all);
    for (; s.state.simTime < committed.arriveAt + 0.05;) {
      const before = structuredClone(s.snapshot());
      const events = s.step(committed.target).events;
      all.push(...events); audio.consume(events); audio.consume(events);
      expect(before.score).toBeLessThanOrEqual(s.state.score);
    }
    expect(all.filter(e => e.kind === 'smash-warning' && e.ballId === 2)).toHaveLength(1);
    expect(all.filter(e => e.kind === 'opponent-hit' && e.ballId === 2)).toHaveLength(1);
    expect(all.filter(e => e.kind === 'player-hit' && e.ballId === 2)).toHaveLength(1);
    expect(all.filter(e => e.kind === 'player-hit').map(e => e.ballId).sort()).toEqual([1, 2, 3]);
    expect(s.state.score).toBe(452); expect(s.state.phase).toBe('running');
    expect(voices).toHaveLength(all.filter(e => ['player-hit', 'opponent-hit', 'smash-warning'].includes(e.kind)).length);
    expect(voices.some(v => v.frequencies[0] === 440)).toBe(true);
    await audio.dispose();
  });
  it('予告中の別球による加速でも確定時刻・倍率を変えず、停止では時計も予告も保持する', () => {
    const s = scenario(454); s.state.randomState = 2;
    s.state.balls = [outgoing(2), incoming(1, 20.15)];
    s.step();
    const committed = structuredClone(s.snapshot().scheduledReturns.find(p => p.ballId === 2)!);
    expect(committed.smash).toBe(true);
    s.state.phase = 'paused';
    const paused = s.snapshot();
    for (let i = 0; i < 100; i++) expect(s.step().events).toEqual([]);
    expect(s.snapshot()).toEqual(paused);
    expect(resolveOpponentPose(s.snapshot()).preparing).toBe(true);
    s.state.phase = 'running';
    for (let i = 0; i < 30; i++) s.step();
    expect(s.state.score).toBe(455);
    expect(s.snapshot().scheduledReturns.find(p => p.ballId === 2)).toEqual(committed);
  });
});
