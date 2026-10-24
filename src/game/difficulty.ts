import { DIFFICULTY } from './config';
import type { GameConfig } from './types';

function baseSpeedMultiplier(score: number): number {
  return 1 + DIFFICULTY.speedGain * (1 - Math.exp(-Math.floor(score / DIFFICULTY.scoreInterval) / DIFFICULTY.speedDecay));
}

export function speedMultiplier(score: number): number {
  const speed = baseSpeedMultiplier(score);
  if (score < 300) return speed;
  // Boost each increment starting with rally 300, preserving the speed at 299.
  const before = baseSpeedMultiplier(299);
  return before + 1.1 * (speed - before);
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
