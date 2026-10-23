import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { createSession } from '../../src/game/session';
import { ballCountAtScore } from '../../src/game/milestones';
import { advance } from '../helpers/fixtures';

describe('1球のラリー', () => {
  it('開始時は1球で、自分の接触1回だけを加点する', () => {
    const session = createSession(DEFAULT_CONFIG, 7);
    session.start();
    expect(session.snapshot().balls.filter(b => b.phase !== 'lost')).toHaveLength(1);
    const events = advance(session, 2.6);
    expect(session.snapshot().score).toBe(1);
    expect(events.filter(e => e.kind === 'player-hit')).toHaveLength(1);
    expect(session.snapshot().balls[0]?.phase).toBe('outgoing');
    expect(advance(session, 0.15).filter(e => e.kind === 'player-hit')).toHaveLength(0);
    expect(session.snapshot().score).toBe(1);
  });

  it('不可視と無関係に相手は必ず返球し、相手の打球や台バウンドは加点しない', () => {
    const session = createSession(DEFAULT_CONFIG, 7);
    session.start();
    const events = advance(session, 4.0);
    expect(events.filter(e => e.kind === 'opponent-hit')).toHaveLength(2);
    expect(events.filter(e => e.kind === 'player-hit')).toHaveLength(1);
    expect(session.snapshot().score).toBe(1);
    expect(session.snapshot().balls[0]?.phase).toBe('incoming');
    expect(new Set(events.map(e => e.id)).size).toBe(events.length);
    expect(events.every(e => e.runId === session.snapshot().runId)).toBe(true);
  });

  it('打球範囲を通り過ぎたら残球0とし、終了イベントを一度だけ発行する', () => {
    const session = createSession(DEFAULT_CONFIG, 7);
    session.start();
    const events = advance(session, 3, { x: -1.05, y: 0.15 });
    expect(session.snapshot().phase).toBe('gameover');
    expect(session.snapshot().balls.filter(b => b.phase !== 'lost')).toHaveLength(0);
    expect(events.filter(e => e.kind === 'ball-lost')).toHaveLength(1);
    expect(events.filter(e => e.kind === 'game-over')).toHaveLength(1);
    expect(events.map(e => e.time)).toEqual([...events.map(e => e.time)].sort((a, b) => a - b));
    expect(advance(session, 1)).toHaveLength(0);
  });

  it('停止とreadyでは時刻・球を変えず、再開とリトライで古い状態を残さない', () => {
    const session = createSession(DEFAULT_CONFIG, 7);
    const ready = session.snapshot();
    advance(session, 1);
    expect(session.snapshot()).toEqual(ready);
    session.start();
    advance(session, 2.6);
    session.pause('user');
    const paused = session.snapshot();
    expect(advance(session, 1)).toEqual([]);
    expect(session.snapshot()).toEqual(paused);
    session.resume();
    advance(session, 0.1);
    expect(session.snapshot().simTime).toBeGreaterThan(paused.simTime);
    session.reset(7);
    expect(session.snapshot().runId).not.toBe(ready.runId);
    expect(session.snapshot()).toMatchObject({ phase: 'ready', score: 0, simTime: 0, paddle: INITIAL_PADDLE, scheduledReturns: [] });
    session.start();
    expect(advance(session, 2.6).filter(e => e.kind === 'player-hit')).toHaveLength(1);
  });

  it('ラケットの速さを制限し、返球目標は打球後に追尾しない', () => {
    const session = createSession(DEFAULT_CONFIG, 19);
    session.start();
    const initial = session.snapshot();
    const stepped = session.step(DEFAULT_CONFIG.fixedDt, { target: { x: 1.05, y: 0.85 } }).snapshot;
    expect(Math.hypot(stepped.paddle.x, stepped.paddle.y - 0.5)).toBeCloseTo(DEFAULT_CONFIG.paddleSpeed * DEFAULT_CONFIG.fixedDt);
    expect(stepped.scheduledReturns).toEqual(initial.scheduledReturns);
  });

  it('開始1球から増球してラリーを繰り返し、打球済みの球だけが再加点できる', () => {
    const session = createSession(DEFAULT_CONFIG, 7);
    session.start();
    let playerHits = 0;
    let opponentHits = 0;
    for (let i = 0; i < 120 * 65; i++) {
      const state = session.snapshot();
      const target = state.scheduledReturns[0]?.target ?? state.paddle;
      const result = session.step(DEFAULT_CONFIG.fixedDt, { target });
      playerHits += result.events.filter(e => e.kind === 'player-hit').length;
      opponentHits += result.events.filter(e => e.kind === 'opponent-hit').length;
    }
    expect(session.snapshot().phase).toBe('running');
    expect(session.snapshot().score).toBeGreaterThanOrEqual(12);
    expect(playerHits).toBe(session.snapshot().score);
    expect(opponentHits).toBeGreaterThanOrEqual(playerHits);
    expect(session.snapshot().balls).toHaveLength(ballCountAtScore(session.snapshot().score));
  });
});
