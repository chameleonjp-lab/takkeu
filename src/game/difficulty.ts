import { DIFFICULTY } from './config';
import type { GameConfig } from './types';

export function speedMultiplier(score: number): number {
  return 1 + DIFFICULTY.speedGain * (1 - Math.exp(-Math.floor(score / DIFFICULTY.scoreInterval) / DIFFICULTY.speedDecay));
}

export function smashMultiplier(score: number): number {
  return score >= 540 ? DIFFICULTY.lateSmashSpeed : DIFFICULTY.smashSpeed;
}

export function remainingBallMultiplier(score: number, count: number): number {
  if (!Number.isInteger(score) || score < 100 || count !== 1) return 1;
  return 1.2;
}

export function flightDuration(config: GameConfig, score: number, smash: boolean, multiplier = speedMultiplier(score), remainingMultiplier = 1): number {
  // Preserve the existing base/smash floor, then apply the independent bonus.
  // Putting the bonus inside max() would silently cap the requested speed.
  return 2 * Math.max(smash ? DIFFICULTY.smashMinimumVisible : config.minimumVisibleSeconds,
    config.normalVisibleSeconds / (multiplier * (smash ? smashMultiplier(score) : 1))) / remainingMultiplier;
}
