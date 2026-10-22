import { expect, it } from 'vitest';
import { createAudio } from '../../src/audio/audio';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { planOpponentReturn } from '../../src/game/opponent';
import { createObjects } from '../../src/render/objects';
import { applyPresentation } from '../../src/render/presentation';
import { updateOpponentView } from '../../src/render/opponentView';
import { fakeAudioContext } from '../helpers/audioContext';
import { scenario } from '../helpers/scenarios';
import type { GameSnapshot } from '../../src/game/types';

it('4球・スマッシュで描画頻度や消音を変えても、計算・時刻・予約・イベントが一致する', async () => {
  const make = () => {
    const s = scenario(450);
    for (let id = 1; id <= 4; id++) {
      const plan = planOpponentReturn({ ballId: id, earliestDepartAt: 20, preferredTarget: { x: id % 2 ? -1 : 1, y: 0.5 }, speedMultiplier: 2.2, score: 450, randomValue: 0 }, s.snapshot().scheduledReturns, s.state.committedSmashDepartures, DEFAULT_CONFIG);
      if (plan.smash) s.state.committedSmashDepartures.push(plan.departAt);
      const from = { x: 0, y: 0.5, z: -DEFAULT_CONFIG.paddleZ };
      s.state.balls.push({ id, phase: 'queued', position: from, from, plan, warningSent: false });
    }
    return s;
  };
  const baseline = make(), observed = make();
  const objects = createObjects(DEFAULT_CONFIG);
  const { context, voices } = fakeAudioContext();
  const audio = createAudio(DEFAULT_CONFIG, () => context); audio.reset(observed.state.runId); await audio.unlock();
  const comparable = ({ runId: _runId, ...snapshot }: GameSnapshot) => snapshot;
  let warnings = 0;
  for (let tick = 0; tick < 240; tick++) {
    const target = baseline.snapshot().scheduledReturns[0]?.target ?? baseline.state.paddle;
    const a = baseline.step(target), b = observed.step(target);
    const before = structuredClone(observed.snapshot());
    if (tick % 3 === 0) { applyPresentation(objects, b.snapshot); updateOpponentView(objects, b.snapshot, b.events); }
    audio.setMuted(tick % 60 > 40); audio.consume(b.events); audio.consume(b.events);
    expect(observed.snapshot()).toEqual(before);
    expect(comparable(a.snapshot)).toEqual(comparable(b.snapshot));
    expect(a.events.map(({ id: _id, runId: _runId, ...event }) => event)).toEqual(b.events.map(({ id: _id, runId: _runId, ...event }) => event));
    warnings += b.events.filter(e => e.kind === 'smash-warning').length;
  }
  expect(warnings).toBeGreaterThan(0); expect(voices.length).toBeGreaterThan(0);
  expect(observed.state.randomState).toBe(baseline.state.randomState);
  expect(observed.state.committedSmashDepartures).toEqual(baseline.state.committedSmashDepartures);
  objects.dispose(); await audio.dispose();
});
