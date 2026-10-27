import type { CelebrationState } from '../game/celebrations';
import type { GameSnapshot } from '../game/types';

/** Retire interrupted drawing facts without touching simulation state or its clock. */
export function createPresentationBoundary() {
  let runId = '', retired: CelebrationState | null = null;
  return {
    interrupt(snapshot: GameSnapshot) { runId = snapshot.runId; retired = snapshot.celebrations; },
    frame(snapshot: GameSnapshot): GameSnapshot {
      if (!retired || runId !== snapshot.runId) return snapshot;
      const c = snapshot.celebrations;
      return { ...snapshot, celebrations: { ...c,
        lastLossAt: c.lastLossAt === retired.lastLossAt && c.lossStreak === retired.lossStreak ? null : c.lastLossAt,
        repdigitAt: c.repdigitAt === retired.repdigitAt ? null : c.repdigitAt,
        centuryAt: c.centuryAt === retired.centuryAt && c.centuryScore === retired.centuryScore ? null : c.centuryAt,
        numberNotices: c.numberNotices.filter(n => !retired!.numberNotices.some(old => old.value === n.value && old.at === n.at)),
      } };
    },
  };
}
