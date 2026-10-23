import { DIFFICULTY } from './config';
import type { GameConfig } from './types';

export function speedMultiplier(score: number): number {
  return 1 + DIFFICULTY.speedGain * (1 - Math.exp(-Math.floor(score / DIFFICULTY.scoreInterval) / DIFFICULTY.speedDecay));
}

export function smashMultiplier(score: number): number {
  return score >= 540 ? DIFFICULTY.lateSmashSpeed : DIFFICULTY.smashSpeed;
}

export function flightDuration(config: GameConfig, score: number, smash: boolean, multiplier = speedMultiplier(score)): number {
  return 2 * Math.max(smash ? DIFFICULTY.smashMinimumVisible : config.minimumVisibleSeconds,
    config.normalVisibleSeconds / (multiplier * (smash ? smashMultiplier(score) : 1)));
}
