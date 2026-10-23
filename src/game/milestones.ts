/** M01 accelerates every rally. These are the 20 one-shot visual rows. */
export const MILESTONES = [10, 30, 40, 70, 100, 130, 150, 160, 190, 210, 240, 270, 300, 330, 360, 380, 390, 410, 420, 450] as const;

/** Total balls earned, including the initial ball; losses are never replenished. */
export function ballCountAtScore(score: number): number {
  if (score < 30) return 1;
  if (score < 40) return 2;
  if (score < 150) return 3;
  return 4 + Math.floor((score - 150) / 10);
}

/** One-based index of an additional ball reward (the initial ball is not a reward). */
export function ballRewardScore(index: number): number {
  return index === 1 ? 30 : index === 2 ? 40 : 150 + (index - 3) * 10;
}
