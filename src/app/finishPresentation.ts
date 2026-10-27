import { celebrationEnd } from '../game/celebrations';
import type { GameSnapshot } from '../game/types';

/** Independent display clock. The committed snapshot, physics and simTime never change. */
export function createFinishPresentation() {
  let runId = '', startedAt: number | null = null, endsAt = 0, duration = 0, canceled = false;
  return {
    cancel(snapshot: GameSnapshot) {
      runId = snapshot.runId; canceled = true;
    },
    frame(snapshot: GameSnapshot, now: number, effectEnd = 0) {
      if (snapshot.runId !== runId || snapshot.phase !== 'gameover') {
        runId = snapshot.runId; startedAt = null; duration = 0; canceled = false;
      }
      if (snapshot.phase !== 'gameover') return { snapshot, finishing: false, presentationTime: snapshot.simTime };
      if (startedAt === null) {
        startedAt = now;
        duration = snapshot.endReason === 'clear' ? 2.8 : Math.max(0, Math.min(5, Math.max(celebrationEnd(snapshot.celebrations),
          Number.isFinite(effectEnd) ? effectEnd : 0) - snapshot.simTime));
        endsAt = snapshot.simTime + duration;
      }
      const elapsed = Math.max(0, (now - startedAt) / 1000);
      return { snapshot, presentationTime: canceled ? endsAt : Math.min(endsAt, snapshot.simTime + elapsed),
        finishing: !canceled && elapsed < duration };
    },
  };
}
