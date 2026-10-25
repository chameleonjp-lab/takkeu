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
  consume(events: readonly GameEvent[]): void; state(): RallyEffectsState; endTime(): number;
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
  config(400,'A','background-threads',null,'green-blue'),
  config(500,'A','green-perimeter',null,'green'),
  config(600,'A','green-net',null,'green'),
  config(700,'A','background-halo',null,'green-blue'),
  config(800,'B','rainbow-sparks',1.5,'rainbow-green'),
  config(900,'A','corner-posts',null,'green-blue'),
  config(1000,'B','shockwave',3.5,'green-blue',['corner-posts'],100),
  config(1250,'A','meteor',4,'green-blue'),
  config(1500,'A','tricolor-network',null,'green-blue-red',['green-perimeter','green-net','green-blue-world']),
  config(1750,'A','floor-wave',4,'green-blue-red'),
  //2000 combines A world persistence with its B2.5s arrival (consume creates both).
  config(2000,'A','star-world',2.5,'green-blue-red',['background-threads'],100),
  config(2250,'A','side-halos',3,'green-blue-red'),
  config(2500,'A','orbit-ribbon',null,'green-blue-red',['floor-wave']),
  config(2750,'A','multi-halos',null,'green-blue-red',['background-halo']),
  config(3000,'B','electric-opening',3.5,'green-blue-red',[],100),
  config(3250,'A','meteor-swarm',null,'green-blue-red',['meteor']),
  config(3500,'A','double-table-halos',null,'green-blue-red',['side-halos']),
  config(3750,'A','center-density',null,'green-blue-red'),
  config(4000,'B','final-assembly',4,'green-blue-red',['center-density'],100),
]);

/** No event-ID history: score/loss watermarks deduplicate even after buffers expire.
 * At 30 balls, the .6s outgoing flight alone permits fewer than 90 hits in 1.5s.
 * The defensive cap also bounds malformed external batches without affecting play. */
export const RALLY_EFFECT_LIMITS = Object.freeze({ hits: 512, cues: 512, losses: 100, hitSeconds: 1.5 });

function worldStage(score: number): readonly RallyEffectConfig[] {
  const stage = new Map<RallyEffectKind, RallyEffectConfig>();
  for (const entry of RALLY_EFFECTS) {
    if (entry.threshold > score) break;
    for (const replaced of entry.replaces) stage.delete(replaced);
    if (entry.kind === 'A') stage.set(entry.effect, entry);
    if (entry.threshold === 1000) stage.set('green-blue-world', config(1000,'A','green-blue-world',null,'green-blue'));
    if (entry.threshold === 4000) stage.set('final-world', config(4000,'A','final-world',null,'green-blue-red'));
  }
  return [...stage.values()];
}

const positionFact = (position: Point3 | undefined): { position?: Point3 } => position ? { position: { ...position } } : {};
const copyFact = <T extends { position?: Point3 }>(fact: T): T => ({ ...fact, ...positionFact(fact.position) });
const isCount = (value: number | undefined): value is number => value !== undefined && Number.isSafeInteger(value) && value > 0;
const validTime = (value: number): boolean => Number.isFinite(value) && value >= 0;

export function createRallyEffects(runId: string, bestAtStart: number): RallyEffectsController {
  const initialBest = Number.isSafeInteger(bestAtStart) && bestAtStart > 0 ? bestAtStart : 0;
  let score = 0, lostBallCount = 0, latestTime = 0;
  let best: RallyBest | null = null;
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
        stage = worldStage(score);
        if (score >= 50) hits.push({ id: event.id, score, at: event.time,
          smashReturn: event.smashReturn ?? false, ...positionFact(event.position) });
        const arrival = RALLY_EFFECTS.find(entry => entry.threshold === score && (entry.kind === 'B' || entry.threshold === 2000));
        if (arrival) arrivals.push({ id: event.id, threshold: score, at: event.time, config: arrival, ...positionFact(event.position) });
        const major = score === 1000 || score === 2000 || score === 3000 || score === 4000;
        if (major) cue(event,'major',score,2.5,100);
        else if ((score < 50 && score % 5 === 0) || (score >= 50 && score < 200 && score % 10 === 0) ||
          (score >= 200 && score <= 4000 && score % 100 === 0)) cue(event,'notice',score,1.8,10);
        if (initialBest > 0 && best === null && score > initialBest) {
          best = { score, at: event.time, ...positionFact(event.position) };
          cue(event,'best-record',score,2,50);
        }
      } else if (event.kind === 'ball-lost' && isCount(event.lossCount) && event.lossCount > lostBallCount && event.lossCount <= 100) {
        lostBallCount = event.lossCount;
        lossWindow = lossWindow.filter(at => event.time - at <= 2 + 1e-10);
        lossWindow.push(event.time);
        const rollingCount = lossWindow.length;
        losses.push({ id: event.id, count: lostBallCount, at: event.time, rollingCount, ...positionFact(event.position) });
        cue(event,'loss-spark',lostBallCount,.5);
        if (rollingCount >= 4) cue(event,'loss-impact',lostBallCount,.5,80);
        if ([10,20,30,40].includes(lostBallCount)) cue(event,'loss-wave',lostBallCount,1.2);
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
    runId, score, bestAtStart: initialBest, best: best === null ? null : copyFact(best), lostBallCount,
    stage: [...stage], arrivals: arrivals.map(copyFact), hits: hits.map(copyFact), losses: losses.map(copyFact), cues: cues.map(copyFact),
  });
  const endTime = (): number => Math.max(0,
    ...arrivals.map(arrival => arrival.at + (arrival.config.duration ?? 0)),
    ...hits.map(hit => hit.at + .3), ...cues.map(cue => cue.at + cue.duration));
  return { consume, state, endTime };
}
