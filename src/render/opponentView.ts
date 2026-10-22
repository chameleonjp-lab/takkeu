import type { GameEvent, GameSnapshot } from '../game/types';
import type { createObjects } from './objects';

export function resolveOpponentPose(snapshot: GameSnapshot, events: readonly GameEvent[] = []) {
  const warning = snapshot.scheduledReturns.find(p => p.smash && p.warningAt !== null && p.warningAt <= snapshot.simTime + 1e-10 && snapshot.simTime < p.departAt);
  const latestDeparture = Math.max(-Infinity,
    ...snapshot.scheduledReturns.filter(p => p.departAt <= snapshot.simTime).map(p => p.departAt),
    ...events.filter(e => e.runId === snapshot.runId && e.kind === 'opponent-hit').map(e => e.time));
  const age = snapshot.simTime - latestDeparture;
  const swing = age >= 0 && age < 0.24 ? Math.sin(Math.PI * age / 0.24) : 0;
  const preparing = !!warning;
  // Fixed pose cue only; never expose a hidden ball's target or path.
  return { preparing, armAngle: preparing ? -1.1 : swing * 0.65, racketY: preparing ? 0.60 : 0.5 + swing * 0.10,
    racketAngle: preparing ? -0.6 : swing * 0.4, lean: preparing ? -0.07 : swing * 0.035 };
}
export function updateOpponentView(objects: ReturnType<typeof createObjects>, snapshot: GameSnapshot, events: readonly GameEvent[]): void {
  const pose = resolveOpponentPose(snapshot, events);
  objects.opponentArm.rotation.x = pose.armAngle;
  objects.opponentPaddle.position.y = pose.racketY;
  objects.opponentPaddle.rotation.z = pose.racketAngle;
  objects.opponentBody.rotation.z = pose.lean;
}
