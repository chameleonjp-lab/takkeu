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

/** Use the whole visible paddle range instead of clamping world-centred noise. */
export function choosePlayerTarget(source: RandomSource & { lastTargetBand: number }, config: GameConfig): PaddlePoint {
  const band = (source.lastTargetBand + 1 + Math.floor(randomUnit(source) * 2)) % 3;
  source.lastTargetBand = band;
  const y = 0.32 + randomUnit(source) * 0.32;
  const range = paddleHorizontalRange(y, config);
  const fraction = (band + 0.12 + randomUnit(source) * 0.76) / 3;
  return clampPaddle({ x: range.min + (range.max - range.min) * fraction, y }, config);
}

export function chooseOpponentTarget(source: RandomSource, config: GameConfig): PaddlePoint {
  return { x: (randomUnit(source) * 2 - 1) * config.tableHalfWidth * 0.8, y: 0.38 + randomUnit(source) * 0.22 };
}
