# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: direct-input.spec.ts >> 実canvasのtap/drag/releaseが投影位置に一致し保持する 390×844
- Location: tests/browser/direct-input.spec.ts:31:3

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 1
Received:   160.72677347444707
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
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | import type {} from '../helpers/appHarness';
  3   | 
  4   | test.use({ video: 'on' });
  5   | async function begin(page: Page, size = { width: 390, height: 844 }) {
  6   |   await page.setViewportSize(size);
  7   |   await page.clock.install({ time: new Date('2026-10-23T14:00:00Z') });
  8   |   await page.clock.pauseAt(new Date('2026-10-23T14:00:01Z'));
  9   |   await page.goto('/tests/fixtures/stage3.html');
  10  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  11  | }
  12  | async function projection(page: Page, point: { x: number; y: number }, clamp = true) {
  13  |   return page.evaluate(async ({ point, clamp }) => {
  14  |     const cameraUrl = '/src/render/camera.ts', configUrl = '/src/game/config.ts';
  15  |     const { createCamera, fitCamera } = await import(cameraUrl);
  16  |     const { DEFAULT_CONFIG: config, clampPaddle } = await import(configUrl);
  17  |     const rect = document.querySelector('canvas')!.getBoundingClientRect();
  18  |     const camera = createCamera(); fitCamera(camera, rect.width, rect.height, config);
  19  |     const target = clamp ? clampPaddle(point, config) : point;
  20  |     const p = camera.position.clone().set(target.x, target.y, config.paddleZ).project(camera);
  21  |     return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2, target };
  22  |   }, { point, clamp });
  23  | }
  24  | async function aligned(page: Page, expected: { x: number; y: number }) {
  25  |   const paddle = await page.evaluate(() => window.stage3.snapshot().paddle);
  26  |   const screen = await projection(page, paddle, false);
> 27  |   expect(Math.hypot(screen.x - expected.x, screen.y - expected.y)).toBeLessThan(1);
      |                                                                    ^ Error: expect(received).toBeLessThan(expected)
  28  | }
  29  | 
  30  | for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 280, height: 360 }]) {
  31  |   test(`実canvasのtap/drag/releaseが投影位置に一致し保持する ${size.width}×${size.height}`, async ({ page }, info) => {
  32  |     await begin(page, size);
  33  |     expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual({ x: 0, y: .5 });
  34  |     const canvas = page.locator('canvas'), box = (await canvas.boundingBox())!;
  35  |     expect(box).toEqual({ x: 0, y: 0, width: size.width, height: size.height });
  36  |     await expect(canvas).toBeFocused();
  37  |     await expect(page.locator('[data-game] button:visible, [data-game] a:visible')).toHaveCount(0);
  38  |     for (const y of [.15, .5, .85]) for (const x of [-2, 0, 2]) {
  39  |       const p = await projection(page, { x, y });
  40  |       const before = await page.evaluate(() => window.stage3.snapshot().paddle);
  41  |       await page.mouse.move(p.x, p.y); await page.clock.runFor(12);
  42  |       expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(before);
  43  |       await page.mouse.down(); await page.clock.runFor(12); await aligned(page, p);
  44  |       const next = await projection(page, { x: x === 0 ? .35 : 0, y: .5 });
  45  |       await page.mouse.move(next.x, next.y); await page.clock.runFor(12); await aligned(page, next);
  46  |       await page.mouse.up(); const held = await page.evaluate(() => window.stage3.snapshot().paddle);
  47  |       await page.clock.runFor(12); expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(held);
  48  |     }
  49  |     // Outside drag follows capture, clamps, and releases without cancelling.
  50  |     const p = await projection(page, { x: 0, y: .5 });
  51  |     await page.mouse.move(p.x, p.y); await page.mouse.down();
  52  |     await page.mouse.move(-80, -80); await page.clock.runFor(12); await page.mouse.up();
  53  |     const held = await page.evaluate(() => window.stage3.snapshot());
  54  |     expect(held.phase).toBe('running');
  55  |     const edge = await projection(page, { x: -100, y: 100 }); await aligned(page, edge);
  56  |     await page.clock.runFor(32); expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(held.paddle);
  57  |     await page.screenshot({ path: info.outputPath('direct-held.png') });
  58  |     await info.attach('direct-input-state.json', { body: JSON.stringify({ viewport: size, box, held }), contentType: 'application/json' });
  59  |   });
  60  | }
  61  | 
  62  | test('二本指は両releaseで停止し、追加指やドラッグでは停止しない', async ({ page }, info) => {
  63  |   await begin(page);
  64  |   const canvas = page.locator('canvas');
  65  |   const a = { pointerId: 21, pointerType: 'touch', button: 0, clientX: 150, clientY: 450 };
  66  |   const b = { ...a, pointerId: 22, clientX: 250 };
  67  |   await canvas.dispatchEvent('pointerdown', a); await page.clock.runFor(20);
  68  |   await canvas.dispatchEvent('pointerdown', b); await page.clock.runFor(20);
  69  |   expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('running');
  70  |   await canvas.dispatchEvent('pointerup', a);
  71  |   expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('running');
  72  |   await canvas.dispatchEvent('pointerup', b);
  73  |   await expect(page.getByRole('dialog')).toBeVisible();
  74  |   const paused = await page.evaluate(() => window.stage3.snapshot());
  75  |   await page.clock.runFor(1000); expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused);
  76  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  77  |   await page.screenshot({ path: info.outputPath('two-finger-paused.png') });
  78  |   await page.getByRole('button', { name: 'つづける', exact: true }).click();
  79  |   await canvas.dispatchEvent('pointerdown', a);
  80  |   await canvas.dispatchEvent('pointermove', { ...a, clientX: 180 });
  81  |   await canvas.dispatchEvent('pointerdown', b);
  82  |   await canvas.dispatchEvent('pointerup', a); await canvas.dispatchEvent('pointerup', b);
  83  |   await page.clock.runFor(20);
  84  |   expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('running');
  85  |   // Cancel is interruption, never the gesture and never an implicit resume.
  86  |   await canvas.dispatchEvent('pointerdown', { ...a, pointerType: 'pen' });
  87  |   await canvas.dispatchEvent('pointercancel', { ...a, pointerType: 'pen' });
  88  |   expect(await page.evaluate(() => window.stage3.snapshot().pauseReason)).toBe('input-lost');
  89  | });
  90  | 
  91  | test('情報上の入力・safe area・resize連発・メニューに古い入力が残らない', async ({ page }, info) => {
  92  |   await begin(page);
  93  |   await page.addStyleTag({ content: ':root { --safe-top: 44px; --safe-bottom: 34px; --safe-left: 8px; --safe-right: 8px; }' });
  94  |   const hud = await page.locator('.hud').boundingBox();
  95  |   expect(await page.locator('.hud').evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');
  96  |   await page.mouse.click(hud!.x + 8, hud!.y + 8); await page.clock.runFor(12);
  97  |   const inputState = await page.evaluate(() => window.stage3.snapshot());
  98  |   expect(inputState.paddle).not.toEqual({ x: 0, y: .5 });
  99  |   await page.keyboard.press('Escape');
  100 |   const paused = await page.evaluate(() => ({ state: window.stage3.snapshot(), renders: window.stage3.metrics().viewRenders }));
  101 |   await page.evaluate(() => { for (let i = 0; i < 20; i++) window.dispatchEvent(new Event('resize')); });
  102 |   await page.clock.runFor(300);
  103 |   expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused.state);
  104 |   expect(await page.evaluate(() => window.stage3.metrics().viewRenders)).toBe(paused.renders);
  105 |   await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible();
  106 |   // Neither volume interaction nor menu pointer input reaches the paddle.
  107 |   await page.getByRole('dialog').getByLabel('効果音の音量', { exact: true }).fill('0.3');
  108 |   expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused.state);
  109 |   await page.setViewportSize({ width: 844, height: 390 }); await page.clock.runFor(200);
  110 |   expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBe(paused.state.simTime);
  111 |   await page.getByRole('button', { name: 'つづける', exact: true }).click();
  112 |   await page.locator('canvas').dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
  113 |   await page.clock.runFor(12); expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(paused.state.paddle);
  114 |   await page.screenshot({ path: info.outputPath('resized-resumed.png') });
  115 | });
  116 | 
```