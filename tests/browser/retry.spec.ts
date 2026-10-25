import { expect, test, waitForStart } from '../helpers/browserTest';
import { installRuntimeProbe } from '../helpers/runtimeProbe';
import type {} from '../helpers/appHarness';

test('再挑戦20回・ホーム往復20回でループ・購読・描画資源が増殖しない', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(installRuntimeProbe);
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await waitForStart(page);
  // Warm every shader/geometry once before comparing the same running state.
  await page.evaluate(() => {window.stage3.show(555);window.stage3.autoPlay(true);}); await page.clock.runFor(1000);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '最初からやり直す', exact: true }).click(); await waitForStart(page); await page.clock.runFor(32);
  await page.evaluate(()=>window.stage3.autoPlay(false));
  const measure = () => page.evaluate(() => ({ ...window.runtimeProbe.counts(), resources: window.stage3.resources(), views: window.stage3.metrics().viewCreates }));
  const baseline = await measure(), rows = [];
  expect(baseline.audioContexts).toBe(1);
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.stage3.finish()); await page.clock.runFor(16);
    await expect(page.locator('[data-result] h2')).toBeVisible();
    await page.getByRole('button', { name: 'もう一度', exact: true }).click(); await waitForStart(page); await page.clock.runFor(32);
    const row = await measure(); rows.push({ kind: 'retry', i, ...row }); expect(row).toEqual(baseline);
    expect(await page.evaluate(() => window.runtimeProbe.liveVoices())).toBeLessThanOrEqual(1);
    // One new opponent hit: at most kick + mid + square + noise, including
    // allocated/delayed sources; neither old run's sources nor tails survive.
    expect(await page.evaluate(() => window.runtimeProbe.liveSources())).toBeLessThanOrEqual(4);
    expect(await page.evaluate(() => window.stage3.snapshot().score)).toBe(0);
  }
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
    await page.getByRole('button', { name: 'はじめる', exact: true }).click(); await waitForStart(page); await page.clock.runFor(32);
    const row = await measure(); rows.push({ kind: 'home', i, ...row }); expect(row).toEqual(baseline);
    expect(await page.evaluate(() => window.runtimeProbe.liveVoices())).toBeLessThanOrEqual(1);
    // One new opponent hit: at most kick + mid + square + noise, including
    // allocated/delayed sources; neither old run's sources nor tails survive.
    expect(await page.evaluate(() => window.runtimeProbe.liveSources())).toBeLessThanOrEqual(4);
  }
  const firstRun = await page.evaluate(() => window.stage3.snapshot().runId);
  const events = await page.evaluate(() => window.stage3.metrics().events.filter(e => e.runId === window.stage3.snapshot().runId));
  expect(events.filter(e => e.kind === 'opponent-hit')).toHaveLength(1);
  await page.evaluate(() => window.stage3.dispose()); await page.clock.runFor(50);
  const disposed = await page.evaluate(() => window.runtimeProbe.counts());
  expect(disposed.pendingFrames).toBe(0); expect(disposed.listeners).toBeLessThan(baseline.listeners);
  expect(await page.evaluate(() => window.runtimeProbe.liveVoices())).toBe(0);
  expect(await page.evaluate(() => window.runtimeProbe.liveSources())).toBe(0);
  await info.attach('retry-resources.json', { body: JSON.stringify({ baseline, rows, disposed, firstRun }, null, 2), contentType: 'application/json' });
});
