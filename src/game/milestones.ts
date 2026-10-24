/** M01 accelerates every rally. Fixed presentation milestones stay independent of ball rewards. */
export const MILESTONES = [10, 30, 40, 70, 100, 130, 150, 160, 190, 210, 240, 270, 300, 330, 360, 380, 390, 410, 420, 450, 460, 470, 480, 490, 500, 510, 520, 530, 540, 555] as const;

export const MAX_BALLS = 30;

// Keep early rewards and 50/4; start the final cadence at 141 so the
// preceding 138 reward remains at least three rallies away.
const BALL_REWARDS = [
  { from: 5, every: 5 },
  { from: 10, every: 10 },
  { from: 50, every: 4 },
  { from: 141, every: 3 },
] as const;

/** Uncapped total earned, including the initial ball and rewards discarded at the live cap. */
export function earnedBallCountAtScore(score: number): number {
  let total = 1;
  for (let i = 0; i < BALL_REWARDS.length; i++) {
    const tier = BALL_REWARDS[i]!;
    if (score < tier.from) break;
    const end = Math.min(score, (BALL_REWARDS[i + 1]?.from ?? Infinity) - 1);
    total += 1 + Math.floor((end - tier.from) / tier.every);
  }
  return total;
}

/** Pristine live stock without losses; discarded rewards never become reserve stock. */
export function ballCountAtScore(score: number): number {
  return Math.min(MAX_BALLS, earnedBallCountAtScore(score));
}

/** One-based index of an additional ball reward (the initial ball is not a reward). */
export function ballRewardScore(index: number): number {
  for (let i = 0; i < BALL_REWARDS.length; i++) {
    const tier = BALL_REWARDS[i]!;
    const count = Math.ceil(((BALL_REWARDS[i + 1]?.from ?? Infinity) - tier.from) / tier.every);
    if (index <= count) return tier.from + (index - 1) * tier.every;
    index -= count;
  }
  throw new RangeError('Ball reward index must be positive.');
}
