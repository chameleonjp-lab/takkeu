/** Only event facts live in the simulation. Rendering never consumes game RNG. */
export type NumberNotice = Readonly<{ value: number; at: number }>;
export type CelebrationState = Readonly<{
  lastLossAt: number | null; lossStreak: number; numberNotices: readonly NumberNotice[];
  repdigitAt: number | null; centuryAt: number | null; centuryScore: number;
}>;
export type CelebrationPalette = 'rainbow' | 'black' | 'blue' | 'green' | 'gold' | 'white';
const specialColors: Readonly<Record<number, CelebrationPalette>> = { 55: 'black', 77: 'blue', 88: 'green', 99: 'gold' };
export const LOSS_BURST_SECONDS = .9;
export const CELEBRATION_SECONDS = 5;
export function createCelebrations(): CelebrationState {
  return { lastLossAt: null, lossStreak: 0, numberNotices: [], repdigitAt: null, centuryAt: null, centuryScore: 0 };
}
export function isRepdigit(score: number): boolean {
  return Number.isSafeInteger(score) && score >= 11 && /^([1-9])\1+$/.test(String(score));
}
const numberDuration = (value: number): number => specialColors[value] ? 3 : 2;
export function lossCelebration(state: CelebrationState, count: number, at: number): CelebrationState {
  const numberNotices = state.numberNotices.filter(n => at < n.at + numberDuration(n.value));
  if (count % 10 === 0 || count >= 90 || specialColors[count]) numberNotices.push({ value: count, at });
  return { ...state, lastLossAt: at,
    lossStreak: state.lastLossAt !== null && at - state.lastLossAt <= 2 + 1e-10 ? state.lossStreak + 1 : 1, numberNotices };
}
export function rallyCelebration(state: CelebrationState, score: number, at: number): CelebrationState {
  return { ...state, ...(isRepdigit(score) ? { repdigitAt: at } : {}),
    ...(score > 0 && Number.isSafeInteger(score) && score % 100 === 0 ? { centuryAt: at, centuryScore: score } : {}) };
}
const activeAge = (at: number | null, time: number, duration: number): number | null =>
  at !== null && time >= at && time < at + duration ? time - at : null;
export function celebrationFrame(state: CelebrationState, time: number) {
  const burstAge = activeAge(state.lastLossAt, time, LOSS_BURST_SECONDS);
  const strength = burstAge === null ? 0 : Math.pow(1 - burstAge / LOSS_BURST_SECONDS, .65);
  const centuryAge = activeAge(state.centuryAt, time, CELEBRATION_SECONDS);
  return {
    netBolts: burstAge === null ? 0 : 4 + Math.min(100, state.lossStreak) * 2,
    netSize: burstAge === null ? 0 : (.16 + .045 * Math.min(100, state.lossStreak)) * strength,
    burstAge, strength,
    shake: state.lossStreak < 4 ? 0 : Math.min(.055, .008 + (state.lossStreak - 4) * .003) * strength,
    edgeElectric: activeAge(state.repdigitAt, time, CELEBRATION_SECONDS) !== null,
    environment: centuryAge === null ? null : Math.floor((centuryAge + 1e-9) / .3) % 2 === 0 ? 'rainbow' as const : 'gold' as const,
    numbers: state.numberNotices.flatMap(n => {
      const duration = numberDuration(n.value), age = activeAge(n.at, time, duration);
      return age === null ? [] : [{ value: n.value, age, duration,
        palette: specialColors[n.value] ? Math.floor((age + 1e-9) / .3) % 2 === 0 ? 'rainbow' as const : specialColors[n.value]! : 'white' as const }];
    }),
  };
}
export function celebrationEnd(state: CelebrationState): number {
  return Math.max(0, state.lastLossAt === null ? 0 : state.lastLossAt + LOSS_BURST_SECONDS,
    state.repdigitAt === null ? 0 : state.repdigitAt + CELEBRATION_SECONDS,
    state.centuryAt === null ? 0 : state.centuryAt + CELEBRATION_SECONDS,
    ...state.numberNotices.map(n => n.at + numberDuration(n.value)));
}
