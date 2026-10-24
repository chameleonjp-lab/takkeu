# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: quality.spec.ts >> 450の47球と以後の増球・スマッシュ・高速接触を30ゲーム秒維持する
- Location: tests/browser/quality.spec.ts:98:1

# Error details

```
Error: page.evaluate: Target page, context or browser has been closed
```

# Test source

```ts
  10  | // API waits; no internal GPU profile establishes their sole cause.
  11  | // Keep API/DOM/source traces and explicit milestone screenshots; omit only the
  12  | // continuous trace screencast. Resolution, simulated duration and assertions stay.
  13  | test.use({ video: 'off', trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true } });
  14  | 
  15  | test('開始から実際に返球して5・10・20の増球を通過し、21ラリーへ進む', async ({ page }, info) => {
  16  |   // Full viewport has ~3.7x the old PC pixel count. Repeated CI API/teardown waits
  17  |   // exceeded 180s. This 360s functional budget applies locally and in CI;
  18  |   // the separate 25ms/95% real-time performance criterion is unchanged.
  19  |   test.setTimeout(360_000);
  20  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  21  |   await page.goto('/tests/fixtures/stage3.html');
  22  |   // Only input is automated: start the real session without replacing its score or balls.
  23  |   await page.evaluate(() => window.stage3.autoPlay(true));
  24  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  25  |   const checkpoints = [{ score: 5, balls: 2 }, { score: 10, balls: 3 }, { score: 20, balls: 4 }];
  26  |   const reached: { threshold: number; state: GameSnapshot }[] = [];
  27  |   for (let i = 0; i < 480; i++) {
  28  |     await page.clock.runFor(250);
  29  |     const state = await page.evaluate(() => window.stage3.snapshot());
  30  |     expect(state.phase).toBe('running');
  31  |     const checkpoint = checkpoints[reached.length];
  32  |     if (checkpoint && state.score >= checkpoint.score) {
  33  |       expect(state.balls).toHaveLength(checkpoint.balls);
  34  |       expect(state.progression.awardedBallCount).toBe(checkpoint.balls - 1);
  35  |       await expect(page.getByLabel('残球数', { exact: true })).toContainText(String(checkpoint.balls));
  36  |       reached.push({ threshold: checkpoint.score, state });
  37  |       await page.screenshot({ path: info.outputPath(`cadence-${checkpoint.score}.png`) });
  38  |     }
  39  |     if (state.score >= 21) {
  40  |       await page.screenshot({ path: info.outputPath('cadence-after-020.png') });
  41  |       break;
  42  |     }
  43  |   }
  44  |   expect(reached.map(row => row.threshold)).toEqual([5, 10, 20]);
  45  |   const state = await page.evaluate(() => window.stage3.snapshot());
  46  |   expect(state.score).toBeGreaterThanOrEqual(21); expect(state.score).toBeLessThan(30);
  47  |   expect(state.balls).toHaveLength(4);
  48  |   const events = await page.evaluate(() => window.stage3.metrics().events);
  49  |   expect(events.filter(e => e.kind === 'milestone').map(e => e.milestone)).toEqual([5, 10, 20]);
  50  |   expect(events.filter(e => e.kind === 'ball-lost')).toEqual([]);
  51  |   await info.attach('cadence-play.json', { body: JSON.stringify({ reached, final: state, events }, null, 2), contentType: 'application/json' });
  52  | });
  53  | 
  54  | test('縦横・44pxボタン・200%文字・ラベル・安全余白を確認', async ({ page }, info) => {
  55  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  56  |   await page.goto('/');
  57  |   await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  58  |   await page.getByRole('button', { name: '設定', exact: true }).click();
  59  |   await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  60  |   await expect(page.getByLabel('操作感度', { exact: true })).toHaveCount(0);
  61  |   await expect(page.locator('[data-settings]').getByLabel('効果音の音量', { exact: true })).toBeVisible();
  62  |   await expect(page.getByLabel('描画品質', { exact: true })).toBeVisible();
  63  |   await page.getByRole('button', { name: '戻る', exact: true }).click();
  64  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  65  |   await page.screenshot({ path: info.outputPath('home-text-200.png'), fullPage: true });
  66  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  67  |   await page.keyboard.press('Escape');
  68  |   await page.screenshot({ path: info.outputPath('paused-text-200.png'), fullPage: true });
  69  |   const dialog = page.getByRole('dialog');
  70  |   await expect(dialog).toHaveAttribute('aria-modal', 'true');
  71  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  72  |   await page.keyboard.press('Shift+Tab'); await expect(dialog.getByLabel('効果音の音量', { exact: true })).toBeFocused();
  73  |   await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  74  |   await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  75  |   await page.addStyleTag({ content: 'html { font-size: 100%; }' });
  76  |   for (const size of [{ width: 402, height: 874 }, { width: 874, height: 402 }, { width: 1280, height: 720 }]) {
  77  |     await page.setViewportSize(size); await page.clock.runFor(32);
  78  |     await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  79  |     await page.clock.runFor(32);
  80  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  81  |     await page.screenshot({ path: info.outputPath(`game-${size.width}x${size.height}.png`) });
  82  |     await page.keyboard.press('Escape');
  83  |     for (const button of await page.getByRole('button').all()) {
  84  |       if (!await button.isVisible()) continue;
  85  |       await button.scrollIntoViewIfNeeded();
  86  |       const box = (await button.boundingBox())!;
  87  |       expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
  88  |       expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(size.width - 12);
  89  |       await expect(button).toBeInViewport();
  90  |     }
  91  |     await dialog.getByLabel('効果音の音量', { exact: true }).scrollIntoViewIfNeeded();
  92  |     await expect(dialog.getByLabel('効果音の音量', { exact: true })).toBeInViewport();
  93  |     await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  94  |   }
  95  |   await info.attach('menu-accessibility.yml', { body: await page.locator('main').ariaSnapshot(), contentType: 'text/yaml' });
  96  | });
  97  | 
  98  | test('450の47球と以後の増球・スマッシュ・高速接触を30ゲーム秒維持する', async ({ page }, info) => {
  99  |   // Same 30 simulated seconds, rendering resolution and assertions. See the
  100 |   // viewport verification ledger for retained 180s CI failures and rationale.
  101 |   test.setTimeout(360_000);
  102 |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  103 |   await page.goto('/tests/fixtures/stage3.html');
  104 |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  105 |   await page.evaluate(() => { window.stage3.show(450); window.stage3.autoPlay(true); });
  106 |   expect(await page.evaluate(() => window.stage3.snapshot().balls.length)).toBe(47);
  107 |   const samples = [];
  108 |   for (let i = 0; i < 30; i++) {
  109 |     await page.clock.runFor(1000);
> 110 |     const row = await page.evaluate(() => ({ state: window.stage3.snapshot(), resources: window.stage3.resources() }));
      |                            ^ Error: page.evaluate: Target page, context or browser has been closed
  111 |     expect(row.state.phase).toBe('running'); expect(row.state.balls.filter(b => b.phase !== 'lost')).toHaveLength(ballCountAtScore(row.state.score));
  112 |     expect(row.resources!.drawCalls).toBeLessThan(160); samples.push(row);
  113 |   }
  114 |   expect(samples.at(-1)!.state.score).toBeGreaterThan(500);
  115 |   const servedIds = await page.evaluate(() => [...new Set(window.stage3.metrics().events.filter(e => e.kind === 'opponent-hit').map(e => e.ballId))]);
  116 |   for (let id = 1; id <= 47; id++) expect(servedIds).toContain(id);
  117 |   expect(await page.evaluate(() => window.stage3.metrics().smashDepartures)).toBeGreaterThan(0);
  118 |   await info.attach('growing-ball-load.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  119 | });
  120 | 
  121 | test('WebGL初期化不可と復旧失敗でもホームと自己ベストを保つ', async ({ page }) => {
  122 |   await page.addInitScript(() => {
  123 |     const native = HTMLCanvasElement.prototype.getContext;
  124 |     HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: Parameters<typeof native>) {
  125 |       if (String(args[0]) === 'webgl2') return null;
  126 |       return native.apply(this, args);
  127 |     } as typeof native;
  128 |   });
  129 |   await page.goto('/'); await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  130 |   await expect(page.getByRole('alert')).toContainText('WebGL 2を利用できません');
  131 |   await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
  132 |   await expect(page.locator('[data-home]').getByLabel('自己ベスト', { exact: true })).toHaveText('0');
  133 | });
  134 | 
```