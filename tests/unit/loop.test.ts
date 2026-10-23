import { describe, expect, it } from 'vitest';
import { createLoop } from '../../src/app/loop';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { createSession } from '../../src/game/session';
import { createInputTimeline } from '../../src/input/timeline';
import type { GameEvent } from '../../src/game/types';

describe('実際の固定刻みループ', () => {
  function run(hz: number) {
    const session = createSession(DEFAULT_CONFIG, 7);
    const timeline = createInputTimeline(INITIAL_PADDLE);
    timeline.enqueue({ at: 4.7, target: { x: -0.5, y: 0.55 } });
    timeline.enqueue({ at: 6, target: { x: 1.05, y: 0.15 } });
    const events: GameEvent[] = [];
    const loop = createLoop({ session, timeline, config: DEFAULT_CONFIG, onEvents: e => events.push(...e), onPause() {} });
    session.start(); loop.resetClock(0);
    for (let frame = 1; frame <= 12 * hz; frame++) loop.frame(frame * 1000 / hz);
    const { runId: _, ...state } = session.snapshot();
    return { state, events: events.map(e => ({ kind: e.kind, time: e.time })) };
  }
  it('30/60/120Hzの描画で、時刻付き入力から同じ得点・残球・進行となる', () => {
    expect(run(120).state.score).toBe(2);
    expect(run(30)).toEqual(run(120));
    expect(run(60)).toEqual(run(120));
  });
  it('1.50秒を超すフレームは追いつき計算せず停止し、再開前の時間を捨てる', () => {
    const session = createSession(DEFAULT_CONFIG, 7); session.start();
    const timeline = createInputTimeline(INITIAL_PADDLE);
    const reasons: string[] = [];
    const loop = createLoop({ session, timeline, config: DEFAULT_CONFIG, onEvents() {}, onPause: reason => reasons.push(reason) });
    loop.resetClock(0); loop.frame(20);
    const time = session.snapshot().simTime;
    loop.frame(1521);
    expect(session.snapshot()).toMatchObject({ phase: 'paused', simTime: time, pauseReason: 'slow-frame' });
    expect(reasons).toEqual(['slow-frame']);
    loop.frame(10_000);
    expect(session.snapshot().simTime).toBe(time);
    session.resume(); loop.resetClock(10_000); loop.frame(10_020);
    expect(session.snapshot().simTime).toBeCloseTo(time + 2 * DEFAULT_CONFIG.fixedDt);
  });
  it('1描画中の全刻みのイベントを音側へ一度ずつ渡し、描画にも集約する', () => {
    const config = { ...DEFAULT_CONFIG, normalVisibleSeconds: 0.02, minimumVisibleSeconds: 0.02 };
    const session = createSession(config, 7); session.start();
    const received: GameEvent[] = [];
    const loop = createLoop({ session, timeline: createInputTimeline(INITIAL_PADDLE), config, onEvents: e => received.push(...e), onPause() {} });
    loop.resetClock(0);
    loop.flushInput(50);
    expect(received.length).toBeGreaterThanOrEqual(1);
    const result = loop.frame(100);
    expect(received.length).toBeGreaterThanOrEqual(3);
    expect(result.events).toEqual(received);
    expect(new Set(received.map(e => e.id)).size).toBe(received.length);
  });

  it('入力処理で計算を進めても、1.50秒を超す描画遅延を隠さない', () => {
    const session = createSession(DEFAULT_CONFIG, 7); session.start();
    const loop = createLoop({ session, timeline: createInputTimeline(INITIAL_PADDLE), config: DEFAULT_CONFIG, onEvents() {}, onPause() {} });
    loop.resetClock(0); loop.flushInput(25); loop.flushInput(75);
    const time = session.snapshot().simTime;
    loop.frame(1501);
    expect(session.snapshot()).toMatchObject({ phase: 'paused', simTime: time, pauseReason: 'slow-frame' });
  });

  it('遅れて配送された入力の時刻で計算時計を巻き戻さない', () => {
    const session = createSession(DEFAULT_CONFIG, 7); session.start();
    const loop = createLoop({ session, timeline: createInputTimeline(INITIAL_PADDLE), config: DEFAULT_CONFIG, onEvents() {}, onPause() {} });
    loop.resetClock(0); loop.frame(20); loop.flushInput(10); loop.frame(40);
    expect(session.snapshot().simTime).toBeCloseTo(4 * DEFAULT_CONFIG.fixedDt);
  });
});
