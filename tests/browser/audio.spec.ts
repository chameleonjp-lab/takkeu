import { expect, test } from '@playwright/test';
import { wav } from '../helpers/wav';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const probe = { contexts: [] as AudioContext[], started: [] as string[], live: new Set<OscillatorNode>(), failResume: false, failNodes: false };
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor() { super(); probe.contexts.push(this); }
      override async resume() { if (probe.failResume) throw new Error('Autoplay denied'); return super.resume(); }
      override createOscillator() {
        if (probe.failNodes) throw new Error('Audio nodes unavailable');
        const node = super.createOscillator(), start = node.start.bind(node), disconnect = node.disconnect.bind(node);
        node.start = when => { probe.started.push(node.type); probe.live.add(node); start(when); };
        node.disconnect = () => { probe.live.delete(node); disconnect(); };
        return node;
      }
    };
    Object.assign(window, { audioProbe: probe });
  });
});
declare global { interface Window { audioProbe: { contexts: AudioContext[]; started: string[]; live: Set<OscillatorNode>; failResume: boolean; failNodes: boolean } } }

test('打球ノード生成失敗を案内し、一時停止メニューから明示的に音声を再試行できる', async ({ page }) => {
  // Seed 7 returns the next ball to a wing. Keeping the paddle in the centre
  // must not produce a second player hit or replay the failed first hit.
  await page.clock.install({ time: new Date(-1000) }); await page.clock.pauseAt(new Date(7));
  await page.goto('/'); await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe('running');
  await page.evaluate(() => { window.audioProbe.failNodes = true; });
  await page.clock.runFor(2700);
  await expect(page.locator('[data-audio-notice]')).toBeVisible();
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  await expect(page.locator('canvas')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.audioProbe.failNodes = false; });
  await page.getByRole('button', { name: '音声を再試行', exact: true }).click();
  await expect(page.locator('[data-audio-notice]')).toBeHidden();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.audioProbe.started)).toHaveLength(0);
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  let elapsed = 0;
  while (elapsed < 2600 && await page.evaluate(() => window.audioProbe.started.length === 0)) {
    await page.clock.runFor(50); elapsed += 50;
  }
  // Recovery must wait for the next new opponent hit, without replaying the
  // earlier failed player hit. Observe it before the next legitimate return.
  expect(await page.evaluate(() => window.audioProbe.started)).toEqual(['sine']);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  await page.clock.runFor(2600 - elapsed);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  expect(await page.evaluate(() => window.audioProbe.started)).toEqual(['sine']);
});

test('開始・自他の実ノード・ミュート・ブラウザ音声中断と手動復帰', async ({ page }, info) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/'); await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe('running');
  await page.clock.runFor(2700);
  const types = await page.evaluate(() => window.audioProbe.started);
  expect(types).toContain('sine'); expect(types).toContain('triangle');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '音：オン', exact: true }).click();
  expect(await page.evaluate(() => window.audioProbe.live.size)).toBe(0);
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  const count = types.length; await page.clock.runFor(500);
  expect(await page.evaluate(() => window.audioProbe.started.length)).toBe(count);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '音：オフ', exact: true }).click();
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]!.state)).toBe('running');
  await page.evaluate(() => window.audioProbe.contexts[0]!.suspend());
  await expect(page.getByRole('heading', { name: 'ひと休み' })).toBeVisible();
  await page.clock.runFor(5000);
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]!.state)).toBe('running');
  expect(await page.evaluate(() => window.audioProbe.started.length)).toBe(count);
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(1);
  await info.attach('audio-context.json', { body: JSON.stringify({ types, result: 'native nodes and state verified; listening not performed' }), contentType: 'application/json' });
});

test('音声再開拒否でも無音で継続し、ミュートと明示的な音声の再試行が使える', async ({ page }, info) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/'); await page.evaluate(() => { window.audioProbe.failResume = true; });
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect(page.locator('[data-audio-notice]')).toBeVisible();
  await page.clock.runFor(2700); await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  await page.screenshot({ path: info.outputPath('audio-unavailable.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await expect(page.locator('canvas')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '音声を再試行', exact: true }).click();
  await expect(page.locator('[data-audio-notice]')).toBeVisible();
  await page.getByRole('button', { name: '音：オン', exact: true }).click();
  await expect(page.locator('[data-audio-notice]')).toBeHidden();
  await page.getByRole('button', { name: '音：オフ', exact: true }).click();
  await expect(page.locator('[data-audio-notice]')).toBeVisible();
  await page.evaluate(() => { window.audioProbe.failResume = false; });
  await page.getByRole('button', { name: '音声を再試行', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]!.state)).toBe('running');
  await expect(page.locator('[data-audio-notice]')).toBeHidden();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.audioProbe.started.length)).toBe(0);
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await expect(page.locator('canvas')).toBeFocused();
});

test('実Web Audioで自他・予告・4球・最大重なりを合成しピークと無音でないことを検査', async ({ page }, info) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const url = '/src/audio/tones.ts';
    const { playPlayerHit, playOpponentHit, playSmashWarning } = await import(/* @vite-ignore */ url);
    const rows = [];
    for (const mode of ['player', 'opponent', 'warning', 'four', 'sixteen']) {
      const ctx = new OfflineAudioContext(1, 11025, 44100), output = ctx.createGain();
      output.gain.value = 0.85 / (16 * 0.16); output.connect(ctx.destination);
      if (mode === 'player') playPlayerHit(ctx, output);
      else if (mode === 'opponent') playOpponentHit(ctx, output);
      else if (mode === 'warning') playSmashWarning(ctx, output);
      else {
        for (let i = 0; i < (mode === 'four' ? 4 : 16); i++) (i % 3 === 0 ? playSmashWarning : i % 2 === 0 ? playPlayerHit : playOpponentHit)(ctx, output);
      }
      const signal = Array.from((await ctx.startRendering()).getChannelData(0));
      rows.push({ mode, signal, peak: Math.max(...signal.map(Math.abs)), rms: Math.sqrt(signal.reduce((s, v) => s + v * v, 0) / signal.length) });
    }
    return rows;
  });
  for (const row of results) {
    expect(row.peak).toBeLessThan(0.85); expect(row.rms).toBeGreaterThan(0.002);
    await info.attach(`${row.mode}.wav`, { body: wav(row.signal), contentType: 'audio/wav' });
  }
  await info.attach('waveform-measurements.json', { body: JSON.stringify(results.map(({ signal: _, ...row }) => row), null, 2), contentType: 'application/json' });
});
