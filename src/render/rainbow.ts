import { DEFAULT_CONFIG } from '../game/config';
export type RGB = Readonly<{ r: number; g: number; b: number }>;
/** Continuous seven-hue palette, shared game-time clock, no wall-time animation. */
export function sampleRainbow(simTime: number, phase: number): RGB {
  const hue = ((phase + simTime * 0.12) % 1 + 1) % 1;
  const channel = (offset: number): number => 0.18 + 0.82 * Math.max(0, Math.min(1, Math.abs(((hue * 6 + offset) % 6) - 3) - 1));
  return { r: channel(0), g: channel(4), b: channel(2) };
}
export function samplePulse(simTime: number): number {
  return 0.825 + 0.175 * Math.cos(Math.PI * simTime / DEFAULT_CONFIG.pulseHalfPeriod);
}
