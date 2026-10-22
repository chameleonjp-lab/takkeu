import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import type { GameEvent, GameSession, PaddlePoint } from '../../src/game/types';

export function advance(session: GameSession, seconds: number, target: PaddlePoint = INITIAL_PADDLE): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DEFAULT_CONFIG.fixedDt); i++) {
    events.push(...session.step(DEFAULT_CONFIG.fixedDt, { target }).events);
  }
  return events;
}
