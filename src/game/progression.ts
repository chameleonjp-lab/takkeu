import { ballCountAtScore, ballRewardScore, MILESTONES } from './milestones';
import { DIFFICULTY } from './config';
import type { ProgressionState } from './types';

export type ProgressionUpdate = Readonly<{
  state: ProgressionState; crossed: readonly number[]; addedBalls: number; speedTier: number;
}>;

export function advanceProgression(state: ProgressionState, previousScore: number, nextScore: number, simTime: number): ProgressionUpdate {
  const visuals = MILESTONES.filter(value => previousScore < value && value <= nextScore && !state.appliedMilestones.includes(value));
  const appliedMilestones = [...state.appliedMilestones, ...visuals].sort((a, b) => a - b);
  // A fixed visual history plus a counter keeps lost-ball history bounded.
  const before = Math.max(state.awardedBallCount, ballCountAtScore(previousScore) - 1);
  const after = Math.max(before, ballCountAtScore(nextScore) - 1);
  const rewards = Array.from({ length: after - before }, (_, i) => ballRewardScore(before + i + 1));
  const crossed = [...new Set([...visuals, ...rewards])].sort((a, b) => a - b);
  const ballGlowUntil = appliedMilestones.includes(30) ? null : crossed.includes(10) ? simTime + DIFFICULTY.temporaryGlowSeconds : state.ballGlowUntil;
  return {
    state: { appliedMilestones, ballGlowUntil, awardedBallCount: after }, crossed,
    addedBalls: rewards.length,
    speedTier: Math.floor(nextScore / DIFFICULTY.scoreInterval),
  };
}
