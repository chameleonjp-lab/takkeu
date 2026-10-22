import type { GameConfig, GameSession } from '../game/types';
import { createSwipeController } from '../input/swipe';
import type { InputMapping } from '../input/swipe';
import type { InputTimeline } from '../input/timeline';
import type { createLoop } from './loop';

type ControlOptions = { session: GameSession; timeline: InputTimeline; loop: ReturnType<typeof createLoop>; config: GameConfig; mapping: InputMapping; sensitivity?(): number; onInterruption(): void };

export function createControls(surface: HTMLElement, { session, timeline, loop, mapping, onInterruption, sensitivity = () => 1 }: ControlOptions) {
  const normalize = (timestamp: number): number => timestamp > 1e12 ? timestamp - performance.timeOrigin : timestamp;
  return createSwipeController(surface, {
    mapping, sensitivity,
    beforeInput(timestamp) { loop.flushInput(normalize(timestamp)); },
    onTarget(sample) { if (session.snapshot().phase === 'running') timeline.enqueue(sample); },
    onHold(sample) { timeline.clear(sample.target); },
    getPaddlePosition: () => session.snapshot().paddle,
    toSimTime(timestamp) { return loop.toSimTime(normalize(timestamp)); },
    onInterruption, canStart: () => session.snapshot().phase === 'running',
  });
}
