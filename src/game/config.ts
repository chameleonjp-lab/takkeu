import type { GameConfig, PaddlePoint } from './types';
import { paddleHorizontalRange } from './viewpoint';

export const DEFAULT_CONFIG: GameConfig = Object.freeze({
  tableHalfWidth: 1, tableHalfLength: 1.8, tableY: 0,
  paddleZ: 1.95, paddleMinX: -1.05, paddleMaxX: 1.05,
  paddleMinY: 0.15, paddleMaxY: 0.85, paddleSpeed: 6,
  ballRadius: 0.045, paddleRadius: 0.12,
  fixedDt: 1 / 120, maxStepsPerFrame: 12, slowFrameSeconds: 0.10,
  normalVisibleSeconds: 1.25, minimumVisibleSeconds: 0.60,
  maxBalls: 4, pulseHalfPeriod: 0.3, audioVoiceLimit: 8,
  maxPixelRatio: 1.5, maxDrawingPixels: 2_000_000,
});

export const INITIAL_PADDLE: PaddlePoint = Object.freeze({ x: 0, y: 0.5 });
export const TRAJECTORY = Object.freeze({ bounceFraction: 0.72, flightArcHeight: 0.35, bounceArcHeight: 0.10 });
export const DIFFICULTY = Object.freeze({
  scoreInterval: 5, speedGain: 1.2, speedDecay: 40,
  temporaryGlowSeconds: 5, arrivalGap: 0.12, addedBallDelay: 1,
  smashProbability: 0.20, smashSpeed: 1.2, smashMinimumVisible: 0.50,
  smashSeparation: 2, smashWarning: 0.40,
});

export function clampPaddle(point: PaddlePoint, config: GameConfig): PaddlePoint {
  const y = Math.min(config.paddleMaxY, Math.max(config.paddleMinY, point.y));
  const range = paddleHorizontalRange(y, config);
  return {
    x: Math.min(range.max, Math.max(range.min, point.x)), y,
  };
}
