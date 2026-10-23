import { clampPaddle } from './config';
import { paddleHorizontalRange } from './viewpoint';
import type { GameConfig, PaddlePoint } from './types';

export type RandomSource = { randomState: number };
export function randomUnit(source: RandomSource): number {
  source.randomState ^= source.randomState << 13;
  source.randomState ^= source.randomState >>> 17;
  source.randomState ^= source.randomState << 5;
  return (source.randomState >>> 0) / 4294967296;
}

/** Keep the visible post-bounce path on the chosen wing, not just its endpoint. */
export function choosePlayerTarget(source: RandomSource, config: GameConfig, from: PaddlePoint): PaddlePoint {
  const band = from.x < -config.tableHalfWidth * 0.35 ? 0 : from.x > config.tableHalfWidth * 0.35 ? 2 : 1;
  const y = 0.32 + randomUnit(source) * 0.32;
  const range = paddleHorizontalRange(y, config);
  const variation = randomUnit(source);
  const fraction = band === 0 ? 0.02 + variation * 0.10 : band === 2 ? 0.82 + variation * 0.16 : 0.43 + variation * 0.14;
  return clampPaddle({ x: range.min + (range.max - range.min) * fraction, y }, config);
}

/** Choose the lane before the outgoing shot, so a return cannot cross the centre by accident. */
export function chooseOpponentTarget(source: RandomSource & { lastTargetBand: number }, config: GameConfig): PaddlePoint {
  const choice = randomUnit(source);
  const band = source.lastTargetBand === 1 ? (choice < 0.5 ? 0 : 2) : choice < 0.25 ? 1 : 2 - source.lastTargetBand;
  source.lastTargetBand = band;
  const variation = randomUnit(source);
  const x = band === 0 ? -0.72 - variation * 0.18 : band === 2 ? 0.60 + variation * 0.27 : -0.12 + variation * 0.24;
  return { x: x * config.tableHalfWidth, y: 0.38 + randomUnit(source) * 0.22 };
}
