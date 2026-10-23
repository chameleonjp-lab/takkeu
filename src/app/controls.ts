import type { GameConfig, GameSession } from '../game/types';
import { createSwipeController } from '../input/swipe';
import type { InputMapping } from '../input/swipe';
import type { InputTimeline } from '../input/timeline';
import type { createLoop } from './loop';

type ControlOptions = { session: GameSession; timeline: InputTimeline; loop: ReturnType<typeof createLoop>; config: GameConfig; mapping: InputMapping; onInterruption(): void; onPauseGesture?(): void };

export function createControls(surface: HTMLElement, { session, timeline, loop, mapping, onInterruption, onPauseGesture }: ControlOptions) {
  const normalize = (timestamp: number): number => timestamp > 1e12 ? timestamp - performance.timeOrigin : timestamp;
  return createSwipeController(surface, {
    mapping,
    beforeInput(timestamp) { if (Number.isFinite(timestamp)) loop.flushInput(normalize(timestamp)); },
    onTarget(sample) { if (session.snapshot().phase === 'running') timeline.enqueue(sample); },
    toSimTime(timestamp) { return loop.toSimTime(normalize(timestamp)); },
    onInterruption, onPauseGesture, canStart: () => session.snapshot().phase === 'running',
  });
}
