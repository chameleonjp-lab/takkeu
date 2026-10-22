import type { GameConfig, PaddlePoint } from './types';

export const DEFAULT_CONFIG: GameConfig = Object.freeze({
  tableHalfWidth: 1, tableHalfLength: 1.8, tableY: 0,
  paddleZ: 1.95, paddleMinX: -1.05, paddleMaxX: 1.05,
  paddleMinY: 0.15, paddleMaxY: 0.85, paddleSpeed: 6,
  ballRadius: 0.045, paddleRadius: 0.20,
  fixedDt: 1 / 120, maxStepsPerFrame: 12, slowFrameSeconds: 0.10,
  normalVisibleSeconds: 1.25, minimumVisibleSeconds: 0.60,
  maxBalls: 4, pulseHalfPeriod: 0.3, audioVoiceLimit: 8,
  maxPixelRatio: 1.5, maxDrawingPixels: 2_000_000,
});

export const INITIAL_PADDLE: PaddlePoint = Object.freeze({ x: 0, y: 0.5 });
export const TRAJECTORY = Object.freeze({ bounceFraction: 0.72, flightArcHeight: 0.35, bounceArcHeight: 0.10 });

export function clampPaddle(point: PaddlePoint, config: GameConfig): PaddlePoint {
  return {
    x: Math.min(config.paddleMaxX, Math.max(config.paddleMinX, point.x)),
    y: Math.min(config.paddleMaxY, Math.max(config.paddleMinY, point.y)),
  };
}
