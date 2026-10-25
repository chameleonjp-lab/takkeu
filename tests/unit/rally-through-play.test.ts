import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createRallyEffects, RALLY_EFFECTS } from '../../src/game/rallyEffects';
import { createSimulationState, snapshotSimulation, startSimulation, stepSimulation } from '../../src/game/simulation';
import type { GameEvent } from '../../src/game/types';

/** Evidence replay starts at zero. Only paddle input and normal pause lifecycle
 * are supplied: no score, ball, speed, RNG, trajectory or progression setters. */
it('plays from zero through4001 with real physics and identical RNG with/without presentation', () => {
  const started = performance.now();
  const simulation = createSimulationState(7);
  startSimulation(simulation,DEFAULT_CONFIG);
  const baseline = structuredClone(simulation);
  const effects = createRallyEffects(simulation.runId,99);
  let snapshot = snapshotSimulation(simulation);
  let baselineSnapshot = snapshotSimulation(baseline);
  const scores: number[] = [];
  const thresholdCounts = new Map(RALLY_EFFECTS.map(config => [config.threshold,0]));
  const arrivalCounts = new Map<number,number>();
  const arrivalIds = new Set<string>();
  const stageFirstSeen = new Map<string,{score:number;time:number}>();
  const eventCounts: Partial<Record<GameEvent['kind'],number>> = {};
  let ticks = 0, maxBalls = snapshot.balls.length, pausedSteps = 0;
  let paused = false, eventEquivalent = true;
  let lossEvents = 0, maxScoreIncrement = 0;
  let failure: string | null = null;
  try {
    while (snapshot.score < 4001 && snapshot.phase === 'running' && ticks < 120 * 1200) {
      const target = snapshot.scheduledReturns[0]?.target ?? snapshot.paddle;
      const beforeScore = snapshot.score;
      const result = stepSimulation(simulation,DEFAULT_CONFIG,DEFAULT_CONFIG.fixedDt,{target});
      const withoutEffects = stepSimulation(baseline,DEFAULT_CONFIG,DEFAULT_CONFIG.fixedDt,{target});
      ticks++;
      snapshot = result.snapshot;
      baselineSnapshot = withoutEffects.snapshot;
      effects.consume(result.events);
      eventEquivalent &&= JSON.stringify(result.events) === JSON.stringify(withoutEffects.events);
      maxScoreIncrement = Math.max(maxScoreIncrement,snapshot.score-beforeScore);
      maxBalls = Math.max(maxBalls,snapshot.balls.length);
      for (const event of result.events) {
        eventCounts[event.kind] = (eventCounts[event.kind] ?? 0)+1;
        if (event.kind === 'ball-lost') lossEvents++;
        if (event.kind === 'player-hit') {
          scores.push(event.rallyScore!);
          if (thresholdCounts.has(event.rallyScore!)) thresholdCounts.set(event.rallyScore!,thresholdCounts.get(event.rallyScore!)!+1);
        }
      }
      const presentation = effects.state();
      for (const arrival of presentation.arrivals) if (!arrivalIds.has(arrival.id)) {
        arrivalIds.add(arrival.id);
        arrivalCounts.set(arrival.threshold,(arrivalCounts.get(arrival.threshold) ?? 0)+1);
      }
      for (const stage of presentation.stage) if (!stageFirstSeen.has(stage.effect)) {
        stageFirstSeen.set(stage.effect,{score:snapshot.score,time:snapshot.simTime});
      }
      if (!paused && snapshot.score >= 1000) {
        // These are precisely the phase/reason updates made by GameSession.pause/resume.
        simulation.phase = baseline.phase = 'paused';
        simulation.pauseReason = baseline.pauseReason = 'user';
        const stopped = snapshotSimulation(simulation);
        const stoppedEffects = effects.state();
        for (let n=0;n<60;n++) {
          const pausedResult = stepSimulation(simulation,DEFAULT_CONFIG,DEFAULT_CONFIG.fixedDt,{target});
          const pausedBaseline = stepSimulation(baseline,DEFAULT_CONFIG,DEFAULT_CONFIG.fixedDt,{target});
          effects.consume(pausedResult.events);
          expect(pausedResult.events).toEqual([]);
          expect(pausedBaseline.events).toEqual([]);
          pausedSteps++;
        }
        // Retrying the last confirmed delivery must not replay an arrival or record cue.
        effects.consume(result.events);
        expect(effects.state()).toEqual(stoppedEffects);
        expect(snapshotSimulation(simulation)).toEqual(stopped);
        expect(snapshotSimulation(baseline)).toEqual(stopped);
        simulation.phase = baseline.phase = 'running';
        simulation.pauseReason = baseline.pauseReason = null;
        paused = true;
      }
    }
    expect(scores).toEqual(Array.from({length:4001},(_,i) => i+1));
    expect(snapshot).toMatchObject({score:4001,phase:'running'});
    expect(effects.state().score).toBe(4001);
    expect(maxBalls).toBeLessThanOrEqual(30);
    expect(snapshot.lostBallCount).toBeLessThanOrEqual(99);
    expect(lossEvents).toBe(snapshot.lostBallCount);
    expect([...thresholdCounts.values()]).toEqual(RALLY_EFFECTS.map(() => 1));
    expect([...arrivalCounts.keys()].sort((a,b) => a-b)).toEqual([100,200,300,800,1000,2000,3000,4000]);
    expect([...arrivalCounts.values()].every(count => count === 1)).toBe(true);
    for (const config of RALLY_EFFECTS.filter(config => config.kind === 'A')) expect(stageFirstSeen.has(config.effect)).toBe(true);
    expect(stageFirstSeen.has('green-blue-world')).toBe(true);
    expect(stageFirstSeen.has('final-world')).toBe(true);
    expect(effects.state().best?.score).toBe(100);
    expect(pausedSteps).toBe(60);
    expect(eventEquivalent).toBe(true);
    expect(simulation.randomState).toBe(baseline.randomState);
    expect(snapshot).toEqual(baselineSnapshot);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    mkdirSync('docs/verification/rally-4000',{recursive:true});
    writeFileSync('docs/verification/rally-4000/through-play.json',`${JSON.stringify({
      kind:'actual-fixed-step-play',seed:7,input:'earliest scheduledReturns target each fixed tick',
      productionStateSetters:false,fixedDt:DEFAULT_CONFIG.fixedDt,ticks,pausedSteps,
      simulatedSeconds:snapshot.simTime,wallDurationMs:performance.now()-started,
      score:snapshot.score,phase:snapshot.phase,losses:snapshot.lostBallCount,lossEvents,maxBalls,maxScoreIncrement,
      playerHitEvents:scores.length,firstPlayerHitScore:scores[0] ?? null,lastPlayerHitScore:scores.at(-1) ?? null,
      thresholdCounts:Object.fromEntries(thresholdCounts),arrivalCounts:Object.fromEntries(arrivalCounts),
      stages:Object.fromEntries(stageFirstSeen),eventCounts,
      controllerScore:effects.state().score,controllerBest:effects.state().best,
      randomState:simulation.randomState,baselineRandomState:baseline.randomState,
      randomEquivalent:simulation.randomState===baseline.randomState,
      finalSnapshotEquivalent:JSON.stringify(snapshot)===JSON.stringify(baselineSnapshot),eventEquivalent,
      result:failure===null?'passed':'failed',failure,
    },null,2)}\n`);
  }
},120_000);
