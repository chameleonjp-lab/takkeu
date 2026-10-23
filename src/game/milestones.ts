/** M01 accelerates every rally. Fixed presentation milestones stay independent of ball rewards. */
export const MILESTONES = [10, 30, 40, 70, 100, 130, 150, 160, 190, 210, 240, 270, 300, 330, 360, 380, 390, 410, 420, 450, 460, 470, 480, 490, 500, 510, 520, 530, 540, 555] as const;

/** Total balls earned, including the initial ball; losses are never replenished. */
export function ballCountAtScore(score: number): number {
  if (score < 5) return 1;
  if (score >= 470) return 49 + Math.floor((score - 470) / 2);
  return 2 + Math.floor(score / 10);
}

/** One-based index of an additional ball reward (the initial ball is not a reward). */
export function ballRewardScore(index: number): number {
  return index === 1 ? 5 : index <= 48 ? (index - 1) * 10 : 470 + (index - 48) * 2;
}
