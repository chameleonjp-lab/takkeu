# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: quality.spec.ts >> 450の47球と以後の増球・スマッシュ・高速接触を30ゲーム秒維持する
- Location: tests/browser/quality.spec.ts:86:1

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
        - status "ラリー数": "512"
      - generic:
        - generic: 残球数
        - status "残球数": "70"
      - status: スマッシュがくる！
    - generic:
      - generic:
        - status: 残球数70。
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { ballCountAtScore } from '../../src/game/milestones';
  3   | import type {} from '../helpers/appHarness';
  4   | import type { GameSnapshot } from '../../src/game/types';
  5   | 
  6   | test('開始から実際に返球して5・10・20の増球を通過し、21ラリーへ進む', async ({ page }, info) => {
  7   |   test.setTimeout(180_000);
  8   |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  9   |   await page.goto('/tests/fixtures/stage3.html');
  10  |   // Only input is automated: start the real session without replacing its score or balls.
  11  |   await page.evaluate(() => window.stage3.autoPlay(true));
  12  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  13  |   const checkpoints = [{ score: 5, balls: 2 }, { score: 10, balls: 3 }, { score: 20, balls: 4 }];
  14  |   const reached: { threshold: number; state: GameSnapshot }[] = [];
  15  |   for (let i = 0; i < 480; i++) {
  16  |     await page.clock.runFor(250);
  17  |     const state = await page.evaluate(() => window.stage3.snapshot());
  18  |     expect(state.phase).toBe('running');
  19  |     const checkpoint = checkpoints[reached.length];
  20  |     if (checkpoint && state.score >= checkpoint.score) {
  21  |       expect(state.balls).toHaveLength(checkpoint.balls);
  22  |       expect(state.progression.awardedBallCount).toBe(checkpoint.balls - 1);
  23  |       await expect(page.getByLabel('残球数', { exact: true })).toContainText(String(checkpoint.balls));
  24  |       reached.push({ threshold: checkpoint.score, state });
  25  |       await page.screenshot({ path: info.outputPath(`cadence-${checkpoint.score}.png`) });
  26  |     }
  27  |     if (state.score >= 21) {
  28  |       await page.screenshot({ path: info.outputPath('cadence-after-020.png') });
  29  |       break;
  30  |     }
  31  |   }
  32  |   expect(reached.map(row => row.threshold)).toEqual([5, 10, 20]);
  33  |   const state = await page.evaluate(() => window.stage3.snapshot());
  34  |   expect(state.score).toBeGreaterThanOrEqual(21); expect(state.score).toBeLessThan(30);
  35  |   expect(state.balls).toHaveLength(4);
  36  |   const events = await page.evaluate(() => window.stage3.metrics().events);
  37  |   expect(events.filter(e => e.kind === 'milestone').map(e => e.milestone)).toEqual([5, 10, 20]);
  38  |   expect(events.filter(e => e.kind === 'ball-lost')).toEqual([]);
  39  |   await info.attach('cadence-play.json', { body: JSON.stringify({ reached, final: state, events }, null, 2), contentType: 'application/json' });
  40  | });
  41  | 
  42  | test('縦横・44pxボタン・200%文字・ラベル・安全余白を確認', async ({ page }, info) => {
  43  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  44  |   await page.goto('/');
  45  |   await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  46  |   await page.getByRole('button', { name: '設定', exact: true }).click();
  47  |   await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  48  |   await expect(page.getByLabel('操作感度', { exact: true })).toHaveCount(0);
  49  |   await expect(page.locator('[data-settings]').getByLabel('効果音の音量', { exact: true })).toBeVisible();
  50  |   await expect(page.getByLabel('描画品質', { exact: true })).toBeVisible();
  51  |   await page.getByRole('button', { name: '戻る', exact: true }).click();
  52  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  53  |   await page.screenshot({ path: info.outputPath('home-text-200.png'), fullPage: true });
  54  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  55  |   await page.keyboard.press('Escape');
  56  |   await page.screenshot({ path: info.outputPath('paused-text-200.png'), fullPage: true });
  57  |   const dialog = page.getByRole('dialog');
  58  |   await expect(dialog).toHaveAttribute('aria-modal', 'true');
  59  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  60  |   await page.keyboard.press('Shift+Tab'); await expect(dialog.getByLabel('効果音の音量', { exact: true })).toBeFocused();
  61  |   await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  62  |   await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  63  |   await page.addStyleTag({ content: 'html { font-size: 100%; }' });
  64  |   for (const size of [{ width: 402, height: 874 }, { width: 874, height: 402 }, { width: 1280, height: 720 }]) {
  65  |     await page.setViewportSize(size); await page.clock.runFor(32);
  66  |     await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  67  |     await page.clock.runFor(32);
  68  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  69  |     await page.screenshot({ path: info.outputPath(`game-${size.width}x${size.height}.png`) });
  70  |     await page.keyboard.press('Escape');
  71  |     for (const button of await page.getByRole('button').all()) {
  72  |       if (!await button.isVisible()) continue;
  73  |       await button.scrollIntoViewIfNeeded();
  74  |       const box = (await button.boundingBox())!;
  75  |       expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
  76  |       expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(size.width - 12);
  77  |       await expect(button).toBeInViewport();
  78  |     }
  79  |     await dialog.getByLabel('効果音の音量', { exact: true }).scrollIntoViewIfNeeded();
  80  |     await expect(dialog.getByLabel('効果音の音量', { exact: true })).toBeInViewport();
  81  |     await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  82  |   }
  83  |   await info.attach('menu-accessibility.yml', { body: await page.locator('main').ariaSnapshot(), contentType: 'text/yaml' });
  84  | });
  85  | 
  86  | test('450の47球と以後の増球・スマッシュ・高速接触を30ゲーム秒維持する', async ({ page }, info) => {
  87  |   test.setTimeout(180_000);
  88  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  89  |   await page.goto('/tests/fixtures/stage3.html');
  90  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  91  |   await page.evaluate(() => { window.stage3.show(450); window.stage3.autoPlay(true); });
  92  |   expect(await page.evaluate(() => window.stage3.snapshot().balls.length)).toBe(47);
  93  |   const samples = [];
  94  |   for (let i = 0; i < 30; i++) {
  95  |     await page.clock.runFor(1000);
> 96  |     const row = await page.evaluate(() => ({ state: window.stage3.snapshot(), resources: window.stage3.resources() }));
      |                            ^ Error: page.evaluate: Target page, context or browser has been closed
  97  |     expect(row.state.phase).toBe('running'); expect(row.state.balls.filter(b => b.phase !== 'lost')).toHaveLength(ballCountAtScore(row.state.score));
  98  |     expect(row.resources!.drawCalls).toBeLessThan(160); samples.push(row);
  99  |   }
  100 |   expect(samples.at(-1)!.state.score).toBeGreaterThan(500);
  101 |   const servedIds = await page.evaluate(() => [...new Set(window.stage3.metrics().events.filter(e => e.kind === 'opponent-hit').map(e => e.ballId))]);
  102 |   for (let id = 1; id <= 47; id++) expect(servedIds).toContain(id);
  103 |   expect(await page.evaluate(() => window.stage3.metrics().smashDepartures)).toBeGreaterThan(0);
  104 |   await info.attach('growing-ball-load.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  105 | });
  106 | 
  107 | test('WebGL初期化不可と復旧失敗でもホームと自己ベストを保つ', async ({ page }) => {
  108 |   await page.addInitScript(() => {
  109 |     const native = HTMLCanvasElement.prototype.getContext;
  110 |     HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: Parameters<typeof native>) {
  111 |       if (String(args[0]) === 'webgl2') return null;
  112 |       return native.apply(this, args);
  113 |     } as typeof native;
  114 |   });
  115 |   await page.goto('/'); await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  116 |   await expect(page.getByRole('alert')).toContainText('WebGL 2を利用できません');
  117 |   await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
  118 |   await expect(page.locator('[data-home]').getByLabel('自己ベスト', { exact: true })).toHaveText('0');
  119 | });
  120 | 
```