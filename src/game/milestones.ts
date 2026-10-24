/** M01 accelerates every rally. Fixed presentation milestones stay independent of ball rewards. */
export const MILESTONES = [10, 30, 40, 70, 100, 130, 150, 160, 190, 210, 240, 270, 300, 330, 360, 380, 390, 410, 420, 450, 460, 470, 480, 490, 500, 510, 520, 530, 540, 555] as const;

// Each threshold grants its first reward immediately and replaces the prior cadence.
// Keep the early 5/10/20/30/40 rewards; the final tier also supersedes old 470 rules.
const BALL_REWARDS = [
  { from: 5, every: 5, balls: 1 },
  { from: 10, every: 10, balls: 1 },
  { from: 50, every: 4, balls: 1 },
  { from: 140, every: 3, balls: 1 },
  { from: 220, every: 2, balls: 1 },
  { from: 280, every: 1, balls: 1 },
  { from: 310, every: 1, balls: 2 },
  { from: 390, every: 1, balls: 3 },
] as const;

/** Total balls earned, including the initial ball; losses are never replenished. */
export function ballCountAtScore(score: number): number {
  let total = 1;
  for (let i = 0; i < BALL_REWARDS.length; i++) {
    const tier = BALL_REWARDS[i]!;
    if (score < tier.from) break;
    const end = Math.min(score, (BALL_REWARDS[i + 1]?.from ?? Infinity) - 1);
    total += (1 + Math.floor((end - tier.from) / tier.every)) * tier.balls;
  }
  return total;
}

/** One-based index of an additional ball reward (the initial ball is not a reward). */
export function ballRewardScore(index: number): number {
  for (let i = 0; i < BALL_REWARDS.length; i++) {
    const tier = BALL_REWARDS[i]!;
    const count = Math.ceil(((BALL_REWARDS[i + 1]?.from ?? Infinity) - tier.from) / tier.every) * tier.balls;
    if (index <= count) return tier.from + Math.floor((index - 1) / tier.balls) * tier.every;
    index -= count;
  }
  throw new RangeError('Ball reward index must be positive.');
}
