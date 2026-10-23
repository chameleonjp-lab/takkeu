import { DIFFICULTY } from './config';
import { scheduleReturn } from './scheduler';
import type { ReturnRequest } from './scheduler';
import type { GameConfig, ReturnPlan } from './types';

export function chooseReturnKind(score: number, _plannedDepartAt: number, _committedSmashDepartures: readonly number[], _randomValue: number): 'normal' | 'smash' {
  return score >= 450 ? 'smash' : 'normal';
}
export function planOpponentReturn(request: Omit<ReturnRequest, 'smash'> & { score: number; randomValue: number }, reserved: readonly ReturnPlan[], committedSmashDepartures: readonly number[], config: GameConfig): ReturnPlan {
  const smash = chooseReturnKind(request.score, request.earliestDepartAt + DIFFICULTY.smashWarning, committedSmashDepartures, request.randomValue) === 'smash';
  return scheduleReturn({ ...request, smash }, reserved, config);
}
