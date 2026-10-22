import { DIFFICULTY } from './config';

export function speedMultiplier(score: number): number {
  return 1 + DIFFICULTY.speedGain * (1 - Math.exp(-Math.floor(score / DIFFICULTY.scoreInterval) / DIFFICULTY.speedDecay));
}
