# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: quality.spec.ts >> 開始から実際に返球して5・10・20の増球を通過し、21ラリーへ進む
- Location: tests/browser/quality.spec.ts:15:1

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: page.evaluate: Test timeout of 180000ms exceeded.
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
  10  | // CI traces showed full-viewport software-GPU readbacks exhausting the budget.
  11  | // Keep API/DOM/source traces and explicit milestone screenshots; omit only the
  12  | // continuous trace screencast. Resolution, simulated duration and limits stay put.
  13  | test.use({ video: 'off', trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true } });
  14  | 
  15  | test('開始から実際に返球して5・10・20の増球を通過し、21ラリーへ進む', async ({ page }, info) => {
  16  |   test.setTimeout(180_000);
  17  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  18  |   await page.goto('/tests/fixtures/stage3.html');
  19  |   // Only input is automated: start the real session without replacing its score or balls.
  20  |   await page.evaluate(() => window.stage3.autoPlay(true));
  21  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  22  |   const checkpoints = [{ score: 5, balls: 2 }, { score: 10, balls: 3 }, { score: 20, balls: 4 }];
  23  |   const reached: { threshold: number; state: GameSnapshot }[] = [];
  24  |   for (let i = 0; i < 480; i++) {
  25  |     await page.clock.runFor(250);
> 26  |     const state = await page.evaluate(() => window.stage3.snapshot());
      |                              ^ Error: page.evaluate: Test timeout of 180000ms exceeded.
  27  |     expect(state.phase).toBe('running');
  28  |     const checkpoint = checkpoints[reached.length];
  29  |     if (checkpoint && state.score >= checkpoint.score) {
  30  |       expect(state.balls).toHaveLength(checkpoint.balls);
  31  |       expect(state.progression.awardedBallCount).toBe(checkpoint.balls - 1);
  32  |       await expect(page.getByLabel('残球数', { exact: true })).toContainText(String(checkpoint.balls));
  33  |       reached.push({ threshold: checkpoint.score, state });
  34  |       await page.screenshot({ path: info.outputPath(`cadence-${checkpoint.score}.png`) });
  35  |     }
  36  |     if (state.score >= 21) {
  37  |       await page.screenshot({ path: info.outputPath('cadence-after-020.png') });
  38  |       break;
  39  |     }
  40  |   }
  41  |   expect(reached.map(row => row.threshold)).toEqual([5, 10, 20]);
  42  |   const state = await page.evaluate(() => window.stage3.snapshot());
  43  |   expect(state.score).toBeGreaterThanOrEqual(21); expect(state.score).toBeLessThan(30);
  44  |   expect(state.balls).toHaveLength(4);
  45  |   const events = await page.evaluate(() => window.stage3.metrics().events);
  46  |   expect(events.filter(e => e.kind === 'milestone').map(e => e.milestone)).toEqual([5, 10, 20]);
  47  |   expect(events.filter(e => e.kind === 'ball-lost')).toEqual([]);
  48  |   await info.attach('cadence-play.json', { body: JSON.stringify({ reached, final: state, events }, null, 2), contentType: 'application/json' });
  49  | });
  50  | 
  51  | test('縦横・44pxボタン・200%文字・ラベル・安全余白を確認', async ({ page }, info) => {
  52  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  53  |   await page.goto('/');
  54  |   await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  55  |   await page.getByRole('button', { name: '設定', exact: true }).click();
  56  |   await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  57  |   await expect(page.getByLabel('操作感度', { exact: true })).toHaveCount(0);
  58  |   await expect(page.locator('[data-settings]').getByLabel('効果音の音量', { exact: true })).toBeVisible();
  59  |   await expect(page.getByLabel('描画品質', { exact: true })).toBeVisible();
  60  |   await page.getByRole('button', { name: '戻る', exact: true }).click();
  61  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  62  |   await page.screenshot({ path: info.outputPath('home-text-200.png'), fullPage: true });
  63  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  64  |   await page.keyboard.press('Escape');
  65  |   await page.screenshot({ path: info.outputPath('paused-text-200.png'), fullPage: true });
  66  |   const dialog = page.getByRole('dialog');
  67  |   await expect(dialog).toHaveAttribute('aria-modal', 'true');
  68  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  69  |   await page.keyboard.press('Shift+Tab'); await expect(dialog.getByLabel('効果音の音量', { exact: true })).toBeFocused();
  70  |   await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  71  |   await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  72  |   await page.addStyleTag({ content: 'html { font-size: 100%; }' });
  73  |   for (const size of [{ width: 402, height: 874 }, { width: 874, height: 402 }, { width: 1280, height: 720 }]) {
  74  |     await page.setViewportSize(size); await page.clock.runFor(32);
  75  |     await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  76  |     await page.clock.runFor(32);
  77  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  78  |     await page.screenshot({ path: info.outputPath(`game-${size.width}x${size.height}.png`) });
  79  |     await page.keyboard.press('Escape');
  80  |     for (const button of await page.getByRole('button').all()) {
  81  |       if (!await button.isVisible()) continue;
  82  |       await button.scrollIntoViewIfNeeded();
  83  |       const box = (await button.boundingBox())!;
  84  |       expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
  85  |       expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(size.width - 12);
  86  |       await expect(button).toBeInViewport();
  87  |     }
  88  |     await dialog.getByLabel('効果音の音量', { exact: true }).scrollIntoViewIfNeeded();
  89  |     await expect(dialog.getByLabel('効果音の音量', { exact: true })).toBeInViewport();
  90  |     await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  91  |   }
  92  |   await info.attach('menu-accessibility.yml', { body: await page.locator('main').ariaSnapshot(), contentType: 'text/yaml' });
  93  | });
  94  | 
  95  | test('450の47球と以後の増球・スマッシュ・高速接触を30ゲーム秒維持する', async ({ page }, info) => {
  96  |   test.setTimeout(180_000);
  97  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  98  |   await page.goto('/tests/fixtures/stage3.html');
  99  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  100 |   await page.evaluate(() => { window.stage3.show(450); window.stage3.autoPlay(true); });
  101 |   expect(await page.evaluate(() => window.stage3.snapshot().balls.length)).toBe(47);
  102 |   const samples = [];
  103 |   for (let i = 0; i < 30; i++) {
  104 |     await page.clock.runFor(1000);
  105 |     const row = await page.evaluate(() => ({ state: window.stage3.snapshot(), resources: window.stage3.resources() }));
  106 |     expect(row.state.phase).toBe('running'); expect(row.state.balls.filter(b => b.phase !== 'lost')).toHaveLength(ballCountAtScore(row.state.score));
  107 |     expect(row.resources!.drawCalls).toBeLessThan(160); samples.push(row);
  108 |   }
  109 |   expect(samples.at(-1)!.state.score).toBeGreaterThan(500);
  110 |   const servedIds = await page.evaluate(() => [...new Set(window.stage3.metrics().events.filter(e => e.kind === 'opponent-hit').map(e => e.ballId))]);
  111 |   for (let id = 1; id <= 47; id++) expect(servedIds).toContain(id);
  112 |   expect(await page.evaluate(() => window.stage3.metrics().smashDepartures)).toBeGreaterThan(0);
  113 |   await info.attach('growing-ball-load.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  114 | });
  115 | 
  116 | test('WebGL初期化不可と復旧失敗でもホームと自己ベストを保つ', async ({ page }) => {
  117 |   await page.addInitScript(() => {
  118 |     const native = HTMLCanvasElement.prototype.getContext;
  119 |     HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: Parameters<typeof native>) {
  120 |       if (String(args[0]) === 'webgl2') return null;
  121 |       return native.apply(this, args);
  122 |     } as typeof native;
  123 |   });
  124 |   await page.goto('/'); await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  125 |   await expect(page.getByRole('alert')).toContainText('WebGL 2を利用できません');
  126 |   await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
```