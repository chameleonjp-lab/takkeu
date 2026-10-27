import { writeFile } from 'node:fs/promises';
import { expect, test } from '../helpers/browserTest';
import { wav } from '../helpers/wav';
import { installAudioProbe } from '../helpers/audioProbe';

test('renders a bounded musical fanfare through the production volume, fallback and game-over graph', async ({ page }, info) => {
  await page.goto('/tests/fixtures/audio-fanfare.html');
  const rows = await page.evaluate(async () => {
    const audioUrl = '/src/audio/audio.ts', configUrl = '/src/game/config.ts';
    const { createAudio } = await import(/* @vite-ignore */ audioUrl), { DEFAULT_CONFIG } = await import(/* @vite-ignore */ configUrl);
    const rows = [];
    for (const rate of [44100, 48000]) for (const mode of ['standard', 'low', 'quiet', 'dense', 'game-over', 'muted', 'zero', 'fallback']) {
      const ctx = new OfflineAudioContext(1, Math.ceil(rate * 2.1), rate);
      const facade = new Proxy(ctx, { get(target, key) {
        if (key === 'state') return 'running';
        if (key === 'resume' || key === 'suspend' || key === 'close') return async () => {};
        if (mode === 'fallback' && key === 'createWaveShaper') return undefined;
        const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
      }, set(target, key, value) { return Reflect.set(target, key, value, target); } });
      const audio = createAudio(DEFAULT_CONFIG, () => facade); audio.reset('fanfare');
      if (!await audio.unlock()) throw new Error('Offline audio lifecycle adaptation failed');
      audio.setQuality(mode === 'low' ? 'low' : 'standard');
      audio.setVolume(mode === 'quiet' ? .2 : mode === 'dense' ? 1 : mode === 'zero' ? 0 : .65);
      audio.consume([{ kind: 'player-hit', id: '100', runId: 'fanfare', time: 0, ballId: 1, rallyScore: 100 }]);
      if (mode === 'dense') audio.consume(Array.from({ length: 100 }, (_, i) => ({
        kind: i % 2 ? 'player-hit' : 'smash-warning', id: `dense-${i}`, runId: 'fanfare', time: 0, ballId: i + 2, rallyScore: 101,
      })));
      if (mode === 'game-over') audio.consume([{ kind: 'game-over', id: 'end', runId: 'fanfare', time: 0 }]);
      if (mode === 'muted') audio.setMuted(true);
      const signal = Array.from((await ctx.startRendering()).getChannelData(0));
      const peak = signal.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
      const rms = (from: number, to: number) => {
        const part = signal.slice(Math.floor(from * rate), Math.floor(to * rate));
        return Math.sqrt(part.reduce((sum, value) => sum + value * value, 0) / part.length);
      };
      rows.push({ rate, mode, signal, peak, finite: signal.every(Number.isFinite),
        phraseRms: rms(0, 1.8), chordRms: rms(.75, 1.1), tailRms: rms(1.3, 1.6), silencePeak: signal.slice(Math.ceil(1.81 * rate)).reduce((max, value) => Math.max(max, Math.abs(value)), 0) });
      await audio.dispose();
    }
    return rows;
  });
  for (const row of rows) {
    expect(row.finite).toBe(true); expect(row.peak).toBeLessThan(.8); expect(row.silencePeak).toBeLessThan(.00001);
    if (row.mode === 'muted' || row.mode === 'zero') expect(row.peak).toBe(0);
    else {
      expect(row.chordRms).toBeGreaterThan(.001);
      expect(row.tailRms).toBeGreaterThan(.0001);
    }
    if (row.rate === 48000 && ['standard', 'low', 'game-over', 'fallback'].includes(row.mode)) {
      const path = info.outputPath(`fanfare-${row.mode}.wav`);
      await writeFile(path, wav(row.signal, row.rate));
      await info.attach(`fanfare-${row.mode}.wav`, { path, contentType: 'audio/wav' });
    }
  }
  for (const rate of [44100, 48000]) {
    const at = (mode: string) => rows.find(row => row.rate === rate && row.mode === mode)!;
    expect(at('quiet').phraseRms / at('standard').phraseRms).toBeCloseTo(.2 / .65, 3);
    expect(at('game-over').chordRms / at('standard').chordRms).toBeCloseTo(1, 3);
  }
  const path = info.outputPath('fanfare-measurements.json');
  await writeFile(path, JSON.stringify(rows.map(({ signal: _, ...row }) => row), null, 2));
  await info.attach('fanfare-measurements.json', { path, contentType: 'application/json' });
});

test('naturally ends the protected fanfare after game-over and releases every native source', async ({ page }, info) => {
  await page.addInitScript(installAudioProbe);
  await page.goto('/tests/fixtures/audio-fanfare.html');
  const metrics = await page.evaluate(async () => {
    const audioUrl = '/src/audio/audio.ts', configUrl = '/src/game/config.ts';
    const { createAudio } = await import(/* @vite-ignore */ audioUrl), { DEFAULT_CONFIG } = await import(/* @vite-ignore */ configUrl);
    const ctx = new AudioContext(), audio = createAudio(DEFAULT_CONFIG, () => ctx), baseline = window.audioResources();
    audio.reset('native'); if (!await audio.unlock()) throw new Error('Native audio unlock failed');
    audio.consume([{ kind: 'player-hit', id: '100', runId: 'native', time: 0, ballId: 1, rallyScore: 100 }]);
    audio.consume(Array.from({ length: 100 }, (_, i) => ({ kind: i % 2 ? 'player-hit' : 'smash-warning', id: `dense-${i}`, runId: 'native', time: 0, rallyScore: 101, ballId: i + 2 })));
    const dense = window.audioResources();
    audio.consume([{ kind: 'game-over', id: 'end', runId: 'native', time: 0 }]);
    const finishing = window.audioResources();
    await new Promise(resolve => setTimeout(resolve, 1950));
    const ended = window.audioResources();
    await audio.dispose(); return { baseline, dense, finishing, ended, disposed: window.audioResources(), state: ctx.state };
  });
  expect(metrics.dense.layeredVoices).toBeLessThanOrEqual(16); expect(metrics.dense.liveSources).toBeLessThanOrEqual(160);
  expect(metrics.finishing.layeredVoices).toBe(1); expect(metrics.finishing.liveSources).toBeGreaterThanOrEqual(6);
  expect(metrics.ended.liveSources).toBe(metrics.baseline.liveSources); expect(metrics.ended.liveNodes).toBe(metrics.baseline.liveNodes + 3);
  expect(metrics.disposed.liveNodes).toBe(metrics.baseline.liveNodes); expect(metrics.state).toBe('closed');
  const path = info.outputPath('native-fanfare-resources.json');
  await writeFile(path, JSON.stringify(metrics, null, 2)); await info.attach('native-fanfare-resources.json', { path, contentType: 'application/json' });
});

test('3500 clear fanfare retains its native tail and naturally releases every source',async({page},info)=>{
 await page.addInitScript(installAudioProbe);await page.goto('/tests/fixtures/audio-fanfare.html');
 const metrics=await page.evaluate(async()=>{
  const audioUrl='/src/audio/audio.ts',configUrl='/src/game/config.ts';
  const {createAudio}=await import(/* @vite-ignore */ audioUrl),{DEFAULT_CONFIG}=await import(/* @vite-ignore */ configUrl);
  const ctx=new AudioContext(),audio=createAudio(DEFAULT_CONFIG,()=>ctx),baseline=window.audioResources();audio.reset('clear3500');if(!await audio.unlock())throw Error('Audio unlock failed');
  audio.consume([{kind:'player-hit',id:'3500',runId:'clear3500',time:0,ballId:1,rallyScore:3500},{kind:'game-clear',id:'clear',runId:'clear3500',time:0}]);
  const start=window.audioResources();await new Promise(r=>setTimeout(r,1800));const tail=window.audioResources();await new Promise(r=>setTimeout(r,1300));const end=window.audioResources();await audio.dispose();return {baseline,start,tail,end,disposed:window.audioResources()};
 });
 expect(metrics.start.layeredVoices).toBe(1);expect(metrics.tail.liveSources).toBeGreaterThan(metrics.baseline.liveSources);expect(metrics.end.liveSources).toBe(metrics.baseline.liveSources);expect(metrics.disposed.liveNodes).toBe(metrics.baseline.liveNodes);
 await info.attach('3500-native-fanfare',{body:JSON.stringify(metrics),contentType:'application/json'});
});
