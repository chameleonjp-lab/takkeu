# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: quality.spec.ts >> 開始から実際に返球して5・10・20の増球を通過し、21ラリーへ進む
- Location: tests/browser/quality.spec.ts:12:1

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: page.evaluate: Target page, context or browser has been closed
```

# Page snapshot

```yaml
- main [ref=e1]:
  - generic [ref=e2]:
    - generic "卓球ゲームの描画領域" [active] [ref=e5]
    - generic:
      - generic:
        - generic: RALLY
        - status "ラリー数": "20"
      - generic:
        - generic: 残球数
        - status "残球数": "4"
    - generic:
      - generic:
        - status: 残球数4。
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { ballCountAtScore } from '../../src/game/milestones';
  3   | import type {} from '../helpers/appHarness';
  4   | import type { GameSnapshot } from '../../src/game/types';
  5   | 
  6   | // Functional load/UI checks retain traces, screenshots and state attachments.
  7   | // Native input videos are recorded in contact/direct-input/basic-play instead.
  8   | // Avoid encoding every software-GPU frame here: a full-canvas 30s run completed
  9   | // all assertions but exhausted the unchanged 180s limit during artifact teardown.
  10  | test.use({ video: 'off' });
  11  | 
  12  | test('開始から実際に返球して5・10・20の増球を通過し、21ラリーへ進む', async ({ page }, info) => {
  13  |   test.setTimeout(180_000);
  14  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  15  |   await page.goto('/tests/fixtures/stage3.html');
  16  |   // Only input is automated: start the real session without replacing its score or balls.
  17  |   await page.evaluate(() => window.stage3.autoPlay(true));
  18  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  19  |   const checkpoints = [{ score: 5, balls: 2 }, { score: 10, balls: 3 }, { score: 20, balls: 4 }];
  20  |   const reached: { threshold: number; state: GameSnapshot }[] = [];
  21  |   for (let i = 0; i < 480; i++) {
  22  |     await page.clock.runFor(250);
> 23  |     const state = await page.evaluate(() => window.stage3.snapshot());
      |                              ^ Error: page.evaluate: Target page, context or browser has been closed
  24  |     expect(state.phase).toBe('running');
  25  |     const checkpoint = checkpoints[reached.length];
  26  |     if (checkpoint && state.score >= checkpoint.score) {
  27  |       expect(state.balls).toHaveLength(checkpoint.balls);
  28  |       expect(state.progression.awardedBallCount).toBe(checkpoint.balls - 1);
  29  |       await expect(page.getByLabel('残球数', { exact: true })).toContainText(String(checkpoint.balls));
  30  |       reached.push({ threshold: checkpoint.score, state });
  31  |       await page.screenshot({ path: info.outputPath(`cadence-${checkpoint.score}.png`) });
  32  |     }
  33  |     if (state.score >= 21) {
  34  |       await page.screenshot({ path: info.outputPath('cadence-after-020.png') });
  35  |       break;
  36  |     }
  37  |   }
  38  |   expect(reached.map(row => row.threshold)).toEqual([5, 10, 20]);
  39  |   const state = await page.evaluate(() => window.stage3.snapshot());
  40  |   expect(state.score).toBeGreaterThanOrEqual(21); expect(state.score).toBeLessThan(30);
  41  |   expect(state.balls).toHaveLength(4);
  42  |   const events = await page.evaluate(() => window.stage3.metrics().events);
  43  |   expect(events.filter(e => e.kind === 'milestone').map(e => e.milestone)).toEqual([5, 10, 20]);
  44  |   expect(events.filter(e => e.kind === 'ball-lost')).toEqual([]);
  45  |   await info.attach('cadence-play.json', { body: JSON.stringify({ reached, final: state, events }, null, 2), contentType: 'application/json' });
  46  | });
  47  | 
  48  | test('縦横・44pxボタン・200%文字・ラベル・安全余白を確認', async ({ page }, info) => {
  49  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  50  |   await page.goto('/');
  51  |   await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  52  |   await page.getByRole('button', { name: '設定', exact: true }).click();
  53  |   await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  54  |   await expect(page.getByLabel('操作感度', { exact: true })).toHaveCount(0);
  55  |   await expect(page.locator('[data-settings]').getByLabel('効果音の音量', { exact: true })).toBeVisible();
  56  |   await expect(page.getByLabel('描画品質', { exact: true })).toBeVisible();
  57  |   await page.getByRole('button', { name: '戻る', exact: true }).click();
  58  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  59  |   await page.screenshot({ path: info.outputPath('home-text-200.png'), fullPage: true });
  60  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  61  |   await page.keyboard.press('Escape');
  62  |   await page.screenshot({ path: info.outputPath('paused-text-200.png'), fullPage: true });
  63  |   const dialog = page.getByRole('dialog');
  64  |   await expect(dialog).toHaveAttribute('aria-modal', 'true');
  65  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  66  |   await page.keyboard.press('Shift+Tab'); await expect(dialog.getByLabel('効果音の音量', { exact: true })).toBeFocused();
  67  |   await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  68  |   await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  69  |   await page.addStyleTag({ content: 'html { font-size: 100%; }' });
  70  |   for (const size of [{ width: 402, height: 874 }, { width: 874, height: 402 }, { width: 1280, height: 720 }]) {
  71  |     await page.setViewportSize(size); await page.clock.runFor(32);
  72  |     await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  73  |     await page.clock.runFor(32);
  74  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  75  |     await page.screenshot({ path: info.outputPath(`game-${size.width}x${size.height}.png`) });
  76  |     await page.keyboard.press('Escape');
  77  |     for (const button of await page.getByRole('button').all()) {
  78  |       if (!await button.isVisible()) continue;
  79  |       await button.scrollIntoViewIfNeeded();
  80  |       const box = (await button.boundingBox())!;
  81  |       expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
  82  |       expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(size.width - 12);
  83  |       await expect(button).toBeInViewport();
  84  |     }
  85  |     await dialog.getByLabel('効果音の音量', { exact: true }).scrollIntoViewIfNeeded();
  86  |     await expect(dialog.getByLabel('効果音の音量', { exact: true })).toBeInViewport();
  87  |     await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  88  |   }
  89  |   await info.attach('menu-accessibility.yml', { body: await page.locator('main').ariaSnapshot(), contentType: 'text/yaml' });
  90  | });
  91  | 
  92  | test('450の47球と以後の増球・スマッシュ・高速接触を30ゲーム秒維持する', async ({ page }, info) => {
  93  |   test.setTimeout(180_000);
  94  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  95  |   await page.goto('/tests/fixtures/stage3.html');
  96  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  97  |   await page.evaluate(() => { window.stage3.show(450); window.stage3.autoPlay(true); });
  98  |   expect(await page.evaluate(() => window.stage3.snapshot().balls.length)).toBe(47);
  99  |   const samples = [];
  100 |   for (let i = 0; i < 30; i++) {
  101 |     await page.clock.runFor(1000);
  102 |     const row = await page.evaluate(() => ({ state: window.stage3.snapshot(), resources: window.stage3.resources() }));
  103 |     expect(row.state.phase).toBe('running'); expect(row.state.balls.filter(b => b.phase !== 'lost')).toHaveLength(ballCountAtScore(row.state.score));
  104 |     expect(row.resources!.drawCalls).toBeLessThan(160); samples.push(row);
  105 |   }
  106 |   expect(samples.at(-1)!.state.score).toBeGreaterThan(500);
  107 |   const servedIds = await page.evaluate(() => [...new Set(window.stage3.metrics().events.filter(e => e.kind === 'opponent-hit').map(e => e.ballId))]);
  108 |   for (let id = 1; id <= 47; id++) expect(servedIds).toContain(id);
  109 |   expect(await page.evaluate(() => window.stage3.metrics().smashDepartures)).toBeGreaterThan(0);
  110 |   await info.attach('growing-ball-load.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  111 | });
  112 | 
  113 | test('WebGL初期化不可と復旧失敗でもホームと自己ベストを保つ', async ({ page }) => {
  114 |   await page.addInitScript(() => {
  115 |     const native = HTMLCanvasElement.prototype.getContext;
  116 |     HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: Parameters<typeof native>) {
  117 |       if (String(args[0]) === 'webgl2') return null;
  118 |       return native.apply(this, args);
  119 |     } as typeof native;
  120 |   });
  121 |   await page.goto('/'); await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  122 |   await expect(page.getByRole('alert')).toContainText('WebGL 2を利用できません');
  123 |   await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
```