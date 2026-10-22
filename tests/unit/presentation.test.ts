import { expect, it } from 'vitest';
import { createSession } from '../../src/game/session';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { isBallVisible, applyPresentation } from '../../src/render/presentation';
import { createObjects } from '../../src/render/objects';
import { advance } from '../helpers/fixtures';

it('相手の台・人物・ラケットと相手側の球だけを描画で隠し、返球処理は続く', () => {
  const session = createSession(DEFAULT_CONFIG, 7); session.start();
  const objects = createObjects(DEFAULT_CONFIG);
  applyPresentation(objects, session.snapshot());
  expect(objects.opponentCourt.visible).toBe(false);
  expect(objects.opponentEdges.visible).toBe(false);
  expect(objects.opponentPaddle.visible).toBe(false);
  expect(objects.opponentBody.visible).toBe(false);
  expect(objects.playerCourt.visible).toBe(true);
  expect(isBallVisible(session.snapshot().balls[0]!)).toBe(false);
  const events = advance(session, 5.3);
  expect(events.filter(e => e.kind === 'opponent-hit')).toHaveLength(2);
  expect(session.snapshot().score).toBe(1);
  expect(isBallVisible({ id: 1, phase: 'incoming', position: { x: 0, y: 0.5, z: 0 }, smash: false })).toBe(true);
  objects.dispose();
});
