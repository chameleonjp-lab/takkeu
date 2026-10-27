import type { GameEvent, Point3 } from './types';

/** A remains in the world; B plays on arrival; C follows confirmed actions. */
export type RallyEffectCategory = 'A' | 'B' | 'C';
export type RallyEffectKind = 'hit-ring' | 'perimeter' | 'crossing-network' | 'gold-rays' |
  'background-threads' | 'green-perimeter' | 'green-net' | 'background-halo' | 'rainbow-sparks' |
  'corner-posts' | 'shockwave' | 'green-blue-world' | 'meteor' | 'tricolor-network' | 'floor-wave' |
  'star-world' | 'side-halos' | 'orbit-ribbon' | 'multi-halos' | 'electric-opening' |
  'meteor-swarm' | 'double-table-halos' | 'center-density' | 'final-assembly' | 'final-world';
export type RallyEffectConfig = Readonly<{
  threshold: number; kind: RallyEffectCategory; effect: RallyEffectKind;
  /** Arrival/action duration, or the loop period for a permanent animated world. */
  duration: number | null; color: string; priority: number; replaces: readonly RallyEffectKind[];
}>;
export type RallyHit = Readonly<{ id: string; score: number; at: number; position?: Point3; smashReturn: boolean }>;
export type RallyArrival = Readonly<{ id: string; threshold: number; at: number; position?: Point3; config: RallyEffectConfig }>;
export type RallyLoss = Readonly<{ id: string; count: number; at: number; position?: Point3; rollingCount: number }>;
export type RallyBest = Readonly<{ score: number; at: number; position?: Point3 }>;
export type RallyCueKind = 'notice' | 'major' | 'best-record' | 'loss-spark' | 'loss-impact' |
  'loss-wave' | 'loss-net' | 'loss-number' | 'loss-warning' | 'loss-gold' | 'loss-final';
export type RallyCue = Readonly<{
  id: string; kind: RallyCueKind; value: number; at: number; duration: number;
  position?: Point3; priority: number;
}>;
export type RallyEffectsState = Readonly<{
  runId: string; score: number; bestAtStart: number; best: RallyBest | null;
  lostBallCount: number; stage: readonly RallyEffectConfig[];
  arrivals: readonly RallyArrival[]; hits: readonly RallyHit[]; losses: readonly RallyLoss[]; cues: readonly RallyCue[];
}>;
export type RallyEffectsController = Readonly<{
  consume(events: readonly GameEvent[]): void; interrupt(): void; state(): RallyEffectsState; endTime(): number;
}>;

const config = (threshold: number, kind: RallyEffectCategory, effect: RallyEffectKind, duration: number | null,
  color: string, replaces: readonly RallyEffectKind[] = [], priority = 10): RallyEffectConfig =>
  Object.freeze({ threshold, kind, effect, duration, color, priority, replaces: Object.freeze([...replaces]) });

/** Presentation thresholds are deliberately independent of progression/ball rewards. */
export const RALLY_EFFECTS: readonly RallyEffectConfig[] = Object.freeze([
  config(50,'C','hit-ring',.3,'gold'),
  config(100,'B','perimeter',1.2,'green'),
  config(200,'B','crossing-network',1.2,'green-blue'),
  config(300,'B','gold-rays',1.5,'gold'),
  config(500,'B','green-perimeter',1.2,'green'),
  config(800,'B','rainbow-sparks',1.5,'rainbow-green'),
  config(1000,'B','shockwave',2,'green-blue',[],100),
  config(1500,'B','tricolor-network',1.5,'green-blue-red'),
  config(2000,'B','tricolor-network',2,'green-blue-red',[],100),
  config(2500,'B','perimeter',1.5,'green-blue-red'),
  config(2750,'B','crossing-network',1.1,'green-blue-red'),
  config(3000,'B','electric-opening',2,'green-blue-red',[],100),
  config(3500,'B','final-assembly',2.8,'green-blue-gold',[],110),
]);

/** No event-ID history: score/loss watermarks deduplicate even after buffers expire.
 * At 30 balls, the .6s outgoing flight alone permits fewer than 90 hits in 1.5s.
 * The defensive cap also bounds malformed external batches without affecting play. */
export const RALLY_EFFECT_LIMITS = Object.freeze({ hits: 512, cues: 512, losses: 100, hitSeconds: 1.5 });

const positionFact = (position: Point3 | undefined): { position?: Point3 } => position ? { position: { ...position } } : {};
const copyFact = <T extends { position?: Point3 }>(fact: T): T => ({ ...fact, ...positionFact(fact.position) });
const isCount = (value: number | undefined): value is number => value !== undefined && Number.isSafeInteger(value) && value > 0;
const validTime = (value: number): boolean => Number.isFinite(value) && value >= 0;

export function createRallyEffects(runId: string, bestAtStart: number): RallyEffectsController {
  const initialBest = Number.isSafeInteger(bestAtStart) && bestAtStart > 0 ? bestAtStart : 0;
  let score = 0, lostBallCount = 0, latestTime = 0;
  let best: RallyBest | null = null, bestVisible = true;
  let arrivals: RallyArrival[] = [], hits: RallyHit[] = [], losses: RallyLoss[] = [], cues: RallyCue[] = [];
  // Only the short rolling loss window lives here. The game caps total losses at100.
  let lossWindow: number[] = [];
  let stage: readonly RallyEffectConfig[] = [];

  const prune = (): void => {
    arrivals = arrivals.filter(arrival => latestTime < arrival.at + (arrival.config.duration ?? 0));
    hits = hits.filter(hit => latestTime < hit.at + RALLY_EFFECT_LIMITS.hitSeconds).slice(-RALLY_EFFECT_LIMITS.hits);
    losses = losses.filter(loss => latestTime <= loss.at + 2 + 1e-10).slice(-RALLY_EFFECT_LIMITS.losses);
    cues = cues.filter(cue => latestTime < cue.at + cue.duration).slice(-RALLY_EFFECT_LIMITS.cues);
    lossWindow = lossWindow.filter(at => latestTime - at <= 2 + 1e-10).slice(-RALLY_EFFECT_LIMITS.losses);
  };
  const cue = (event: GameEvent, kind: RallyCueKind, value: number, duration: number, priority = 10): void => {
    cues.push({ id: `${event.id}:${kind}`, kind, value, at: event.time, duration, priority, ...positionFact(event.position) });
  };
  const consume = (events: readonly GameEvent[]): void => {
    for (const event of events) {
      if (event.runId !== runId || !validTime(event.time)) continue;
      // A replay cannot move the presentation clock or expire other confirmed facts.
      if (event.kind === 'player-hit' && (!isCount(event.rallyScore) || event.rallyScore <= score)) continue;
      if (event.kind === 'ball-lost' && (!isCount(event.lossCount) || event.lossCount <= lostBallCount || event.lossCount > 100)) continue;
      // Pruning follows confirmed simulation facts, never wall time or rendering.
      latestTime = Math.max(latestTime, event.time);
      if (event.kind === 'player-hit' && isCount(event.rallyScore) && event.rallyScore > score) {
        score = event.rallyScore;
        stage = [];
        if (score >= 1500) hits = [];
        if (score >= 50 && score < 1500) hits.push({ id: event.id, score, at: event.time,
          smashReturn: event.smashReturn ?? false, ...positionFact(event.position) });
        const arrival = RALLY_EFFECTS.find(entry => entry.threshold === score && (entry.kind === 'B' || entry.threshold === 2000));
        if (arrival) arrivals.push({ id: event.id, threshold: score, at: event.time, config: arrival, ...positionFact(event.position) });
        const major = score === 1000 || score === 2000 || score === 3000 || score === 3500;
        if (major) cue(event,'major',score,2.5,100);
        else if ((score < 50 && score % 5 === 0) || (score >= 50 && score < 200 && score % 10 === 0) ||
          (score >= 200 && score <= 3500 && score % 100 === 0)) cue(event,'notice',score,1.8,10);
        if (initialBest > 0 && best === null && score > initialBest) {
          bestVisible = true; best = { score, at: event.time, ...positionFact(event.position) };
          cue(event,'best-record',score,2,50);
        }
      } else if (event.kind === 'ball-lost' && isCount(event.lossCount) && event.lossCount > lostBallCount && event.lossCount <= 100) {
        lostBallCount = event.lossCount;
        lossWindow = lossWindow.filter(at => event.time - at <= 2 + 1e-10);
        lossWindow.push(event.time);
        const rollingCount = lossWindow.length;
        losses.push({ id: event.id, count: lostBallCount, at: event.time, rollingCount, ...positionFact(event.position) });
        if (score < 1500) cue(event,'loss-spark',lostBallCount,.5);
        if (rollingCount >= 4) cue(event,'loss-impact',lostBallCount,.5,80);
        if ([10,20,30,40,60,70,80].includes(lostBallCount)) cue(event,'loss-wave',lostBallCount,1.2);
        if (lostBallCount === 50) cue(event,'loss-net',lostBallCount,1.2);
        if ([55,77,88].includes(lostBallCount)) cue(event,'loss-number',lostBallCount,.8);
        if (lostBallCount >= 90 && lostBallCount <= 99) cue(event,'loss-warning',lostBallCount,.8,80);
        if (lostBallCount === 99) cue(event,'loss-gold',lostBallCount,1.2,90);
        if (lostBallCount === 100) cue(event,'loss-final',lostBallCount,2,100);
      }
    }
    prune();
  };
  const state = (): RallyEffectsState => ({
    runId, score, bestAtStart: initialBest, best: best === null || !bestVisible ? null : copyFact(best), lostBallCount,
    stage: [...stage], arrivals: arrivals.map(copyFact), hits: hits.map(copyFact), losses: losses.map(copyFact), cues: cues.map(copyFact),
  });
  const endTime = (): number => Math.max(0,
    ...arrivals.map(arrival => arrival.at + (arrival.config.duration ?? 0)),
    ...hits.map(hit => hit.at + .3), ...cues.map(cue => cue.at + cue.duration));
  return { consume, state, endTime, interrupt() { arrivals=[];hits=[];losses=[];cues=[];bestVisible=false; } };
}
