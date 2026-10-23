import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG as config } from '../../src/game/config';
import { createSession } from '../../src/game/session';
import { advance } from '../helpers/fixtures';
import { projectBall } from '../../src/game/viewpoint';
import { incoming, scenario } from '../helpers/scenarios';

describe('ワンバウンド後の見える接触', () => {
  it('新しい視点で最初のバウンドに重なるラケットが返球できる', () => {
    const game = createSession(config, 7);
    game.start();
    const paddle = projectBall({ x: 0, y: config.ballRadius, z: 0.858 }, config);
    advance(game, 1.4, paddle);
    expect(game.snapshot().score, 'バウンド前は加点しない').toBe(0);
    const events = advance(game, 0.15, paddle);
    expect(game.snapshot().score, '奥行きの判定面まで待たず、見える接触で返す').toBe(1);
    expect(events.filter(e => e.kind === 'player-hit')).toHaveLength(1);
    expect(events.find(e => e.kind === 'player-hit')!.time).toBeGreaterThanOrEqual(1.44 - 1e-9);
    expect(advance(game, 0.7, paddle).filter(e => e.kind === 'player-hit')).toHaveLength(0);
  });

  it('空振りした球も手前を通り抜けるまで消さない', () => {
    const game = createSession(config, 7);
    game.start();
    const paddle = { x: config.paddleMinX, y: config.paddleMinY };
    advance(game, 2.08, paddle);
    expect(game.snapshot().phase, '予定到着時刻だけでは失球にしない').toBe('running');
    expect(game.snapshot().balls[0]!.position.z).toBeGreaterThan(config.paddleZ);
    expect(game.snapshot().score).toBe(0);
    const events = advance(game, 1, paddle);
    expect(game.snapshot().phase).toBe('gameover');
    expect(events.filter(e => e.kind === 'ball-lost')).toHaveLength(1);
    expect(events.filter(e => e.kind === 'game-over')).toHaveLength(1);
  });

  it('到着目標を知らなくても、見えている球に合わせ続ければラリーが続く', () => {
    const game = createSession(config, 23); game.start();
    for (let tick = 0; tick < 120 * 65; tick++) {
      const snapshot = game.snapshot();
      const visible = snapshot.balls.find(ball => ball.phase === 'incoming' && ball.position.z >= 0);
      const target = visible ? projectBall(visible.position, config) : snapshot.paddle;
      game.step(config.fixedDt, { target });
      expect(game.snapshot().phase).toBe('running');
    }
    expect(game.snapshot().score).toBeGreaterThanOrEqual(12);
  });

  it('バウンドをまたぐ刻みでも、バウンド前の重なりだけでは返球しない', () => {
    const s = scenario(0, 1.797);
    const ball = incoming(1, 2.5, { x: 0, y: 0.5 }, 1.797, 2.5);
    s.state.balls = [ball]; s.state.paddle = projectBall({ x: 0, y: config.ballRadius, z: 0.858 }, config);
    const result = s.step(s.state.paddle);
    expect(result.events.filter(event => event.kind === 'player-hit')).toHaveLength(1);
    expect(result.events[0]!.time).toBeCloseTo(1.8, 9);
    expect(s.step(s.state.paddle).events.filter(event => event.kind === 'player-hit')).toHaveLength(0);
  });
});
