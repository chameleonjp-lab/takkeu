# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: retry.spec.ts >> 再挑戦20回・ホーム往復20回でループ・購読・描画資源が増殖しない
- Location: tests/browser/retry.spec.ts:5:1

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1
Received:    3
```

# Page snapshot

```yaml
- main [ref=e1]:
  - generic [ref=e2]:
    - generic "卓球ゲームの描画領域" [active] [ref=e5]
    - generic:
      - generic:
        - generic: RALLY
        - status "ラリー数": "0"
      - generic:
        - generic: 残球数
        - status "残球数": "1"
    - generic:
      - generic:
        - status: プレイ中。残球数1。
```

# Test source

```ts
  1  | import { expect, test } from '../helpers/browserTest';
  2  | import { installRuntimeProbe } from '../helpers/runtimeProbe';
  3  | import type {} from '../helpers/appHarness';
  4  | 
  5  | test('再挑戦20回・ホーム往復20回でループ・購読・描画資源が増殖しない', async ({ page }, info) => {
  6  |   test.setTimeout(120_000);
  7  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  8  |   await page.addInitScript(installRuntimeProbe);
  9  |   await page.goto('/tests/fixtures/stage3.html');
  10 |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  11 |   // Warm every shader/geometry once before comparing the same running state.
  12 |   await page.evaluate(() => {window.stage3.show(555);window.stage3.autoPlay(true);}); await page.clock.runFor(1000);
  13 |   await page.keyboard.press('Escape');
  14 |   await page.getByRole('button', { name: '最初からやり直す', exact: true }).click(); await page.clock.runFor(32);
  15 |   await page.evaluate(()=>window.stage3.autoPlay(false));
  16 |   const measure = () => page.evaluate(() => ({ ...window.runtimeProbe.counts(), resources: window.stage3.resources(), views: window.stage3.metrics().viewCreates }));
  17 |   const baseline = await measure(), rows = [];
  18 |   expect(baseline.audioContexts).toBe(1);
  19 |   for (let i = 0; i < 20; i++) {
  20 |     await page.evaluate(() => window.stage3.finish()); await page.clock.runFor(16);
  21 |     await expect(page.getByRole('heading', { name: 'ナイスラリー！' })).toBeVisible();
  22 |     await page.getByRole('button', { name: 'もう一度', exact: true }).click(); await page.clock.runFor(32);
  23 |     const row = await measure(); rows.push({ kind: 'retry', i, ...row }); expect(row).toEqual(baseline);
> 24 |     expect(await page.evaluate(() => window.runtimeProbe.liveVoices())).toBeLessThanOrEqual(1);
     |                                                                         ^ Error: expect(received).toBeLessThanOrEqual(expected)
  25 |     expect(await page.evaluate(() => window.stage3.snapshot().score)).toBe(0);
  26 |   }
  27 |   for (let i = 0; i < 20; i++) {
  28 |     await page.keyboard.press('Escape');
  29 |     await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  30 |     await page.getByRole('button', { name: 'はじめる', exact: true }).click(); await page.clock.runFor(32);
  31 |     const row = await measure(); rows.push({ kind: 'home', i, ...row }); expect(row).toEqual(baseline);
  32 |     expect(await page.evaluate(() => window.runtimeProbe.liveVoices())).toBeLessThanOrEqual(1);
  33 |   }
  34 |   const firstRun = await page.evaluate(() => window.stage3.snapshot().runId);
  35 |   const events = await page.evaluate(() => window.stage3.metrics().events.filter(e => e.runId === window.stage3.snapshot().runId));
  36 |   expect(events.filter(e => e.kind === 'opponent-hit')).toHaveLength(1);
  37 |   await page.evaluate(() => window.stage3.dispose()); await page.clock.runFor(50);
  38 |   const disposed = await page.evaluate(() => window.runtimeProbe.counts());
  39 |   expect(disposed.pendingFrames).toBe(0); expect(disposed.listeners).toBeLessThan(baseline.listeners);
  40 |   expect(await page.evaluate(() => window.runtimeProbe.liveVoices())).toBe(0);
  41 |   await info.attach('retry-resources.json', { body: JSON.stringify({ baseline, rows, disposed, firstRun }, null, 2), contentType: 'application/json' });
  42 | });
  43 | 
```