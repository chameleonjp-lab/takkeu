import { DIFFICULTY } from './config';
import { scheduleReturn } from './scheduler';
import type { ReturnRequest } from './scheduler';
import type { GameConfig, ReturnPlan } from './types';

export function chooseReturnKind(score: number, plannedDepartAt: number, committedSmashDepartures: readonly number[], randomValue: number): 'normal' | 'smash' {
  return score >= 450 && randomValue < DIFFICULTY.smashProbability
    && committedSmashDepartures.every(time => Math.abs(time - plannedDepartAt) >= DIFFICULTY.smashSeparation - 1e-10) ? 'smash' : 'normal';
}
export function planOpponentReturn(request: Omit<ReturnRequest, 'smash'> & { score: number; randomValue: number }, reserved: readonly ReturnPlan[], committedSmashDepartures: readonly number[], config: GameConfig): ReturnPlan {
  const smash = chooseReturnKind(request.score, request.earliestDepartAt + DIFFICULTY.smashWarning, committedSmashDepartures, request.randomValue) === 'smash';
  const plan = scheduleReturn({ ...request, smash }, reserved, config);
  // Arrival insertion can delay departure into a later committed smash's exclusion window.
  if (plan.smash && chooseReturnKind(request.score, plan.departAt, committedSmashDepartures, request.randomValue) !== 'smash') {
    return scheduleReturn({ ...request, smash: false }, reserved, config);
  }
  return plan;
}
