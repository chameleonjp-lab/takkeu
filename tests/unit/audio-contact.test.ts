import { expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createAudio } from '../../src/audio/audio';
import { incoming, scenario } from '../helpers/scenarios';
import { layeredAudioContext } from '../helpers/audioContext';

it('接触前の球別smashと加点後scoreをplayer-hitへコピーし、次往復へ持ち越さない', () => {
  const s = scenario(3);
  const normal = incoming(1,20.004), smash = incoming(2,20.2,{x:.6,y:.5});
  smash.plan = { ...smash.plan, smash:true }; smash.warningSent = true;
  s.state.balls = [normal, smash];
  const first = s.step().events.find(e => e.kind==='player-hit')!;
  expect(first).toMatchObject({ballId:1, smashReturn:false, rallyScore:4});
  let second;
  for (let i=0;i<60 && !second;i++) second = s.step({x:.6,y:.5}).events.find(e => e.kind==='player-hit' && e.ballId===2);
  expect(second).toMatchObject({ballId:2, smashReturn:true, rallyScore:5});
  expect(smash.plan.smash).toBe(false); expect(second!.smashReturn).toBe(true);
  // The same ball ID is reused on a later normal flight.
  const at = s.state.simTime;
  s.state.balls = [incoming(2,at+.004,{x:.6,y:.5},at)];
  expect(s.step({x:.6,y:.5}).events.find(e=>e.kind==='player-hit')).toMatchObject({ballId:2,smashReturn:false,rallyScore:6});
  expect(first.rallyScore).toBe(4); expect(second!.rallyScore).toBe(5);
});

it('音声消費の有無はscore・配球とゲームPRNGへ影響しない', async () => {
  const a = scenario(449), b = scenario(449);
  a.state.balls = [incoming(1,20.004)]; b.state.balls = structuredClone(a.state.balls);
  const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
  audio.reset(a.state.runId); await audio.unlock();
  for (let i=0;i<600;i++) {
    const x = a.step(), y = b.step(); audio.consume(x.events);
    expect(a.state.randomState).toBe(b.state.randomState); expect(x.snapshot.score).toBe(y.snapshot.score);
    expect(x.snapshot.balls).toEqual(y.snapshot.balls); expect(x.snapshot.scheduledReturns).toEqual(y.snapshot.scheduledReturns);
  }
  await audio.dispose();
});
