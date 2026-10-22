import { BALL_MILESTONES, MILESTONES } from './milestones';
import { DIFFICULTY } from './config';
import type { ProgressionState } from './types';

export type ProgressionUpdate = Readonly<{
  state: ProgressionState; crossed: readonly number[]; addedBalls: number; speedTier: number;
}>;

export function advanceProgression(state: ProgressionState, previousScore: number, nextScore: number, simTime: number): ProgressionUpdate {
  const crossed = MILESTONES.filter(value => previousScore < value && value <= nextScore && !state.appliedMilestones.includes(value));
  const appliedMilestones = [...state.appliedMilestones, ...crossed].sort((a, b) => a - b);
  const ballGlowUntil = appliedMilestones.includes(30) ? null : crossed.includes(10) ? simTime + DIFFICULTY.temporaryGlowSeconds : state.ballGlowUntil;
  return {
    state: { appliedMilestones, ballGlowUntil }, crossed,
    addedBalls: crossed.filter(value => BALL_MILESTONES.includes(value)).length,
    speedTier: Math.floor(nextScore / DIFFICULTY.scoreInterval),
  };
}
