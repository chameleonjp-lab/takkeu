# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: direct-input.spec.ts >> 実canvasのtap/drag/releaseが投影位置に一致し保持する 280×360
- Location: tests/browser/direct-input.spec.ts:33:3

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 1
Received:   1.0867987553907947
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
  5   | // 25ms = one 60Hz render interval + one 120Hz physics interval. A 12ms
  6   | // clock advance can end before the first eligible render; this is not a latency allowance.
  7   | async function begin(page: Page, size = { width: 390, height: 844 }) {
  8   |   await page.setViewportSize(size);
  9   |   await page.clock.install({ time: new Date('2026-10-23T14:00:00Z') });
  10  |   await page.clock.pauseAt(new Date('2026-10-23T14:00:01Z'));
  11  |   await page.goto('/tests/fixtures/stage3.html');
  12  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  13  | }
  14  | async function projection(page: Page, point: { x: number; y: number }, clamp = true) {
  15  |   return page.evaluate(async ({ point, clamp }) => {
  16  |     const cameraUrl = '/src/render/camera.ts', configUrl = '/src/game/config.ts';
  17  |     const { createCamera, fitCamera } = await import(cameraUrl);
  18  |     const { DEFAULT_CONFIG: config, clampPaddle } = await import(configUrl);
  19  |     const rect = document.querySelector('canvas')!.getBoundingClientRect();
  20  |     const camera = createCamera(); fitCamera(camera, rect.width, rect.height, config);
  21  |     const target = clamp ? clampPaddle(point, config) : point;
  22  |     const p = camera.position.clone().set(target.x, target.y, config.paddleZ).project(camera);
  23  |     return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2, target };
  24  |   }, { point, clamp });
  25  | }
  26  | async function aligned(page: Page, expected: { x: number; y: number }) {
  27  |   const paddle = await page.evaluate(() => window.stage3.snapshot().paddle);
  28  |   const screen = await projection(page, paddle, false);
> 29  |   expect(Math.hypot(screen.x - expected.x, screen.y - expected.y)).toBeLessThan(1);
      |                                                                    ^ Error: expect(received).toBeLessThan(expected)
  30  | }
  31  | 
  32  | for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 280, height: 360 }]) {
  33  |   test(`実canvasのtap/drag/releaseが投影位置に一致し保持する ${size.width}×${size.height}`, async ({ page }, info) => {
  34  |     await begin(page, size);
  35  |     expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual({ x: 0, y: .5 });
  36  |     const canvas = page.locator('canvas'), box = (await canvas.boundingBox())!;
  37  |     expect(box).toEqual({ x: 0, y: 0, width: size.width, height: size.height });
  38  |     await expect(canvas).toBeFocused();
  39  |     await expect(page.locator('[data-game] button:visible, [data-game] a:visible')).toHaveCount(0);
  40  |     for (const y of [.15, .5, .85]) for (const x of [-2, 0, 2]) {
  41  |       const p = await projection(page, { x, y });
  42  |       const before = await page.evaluate(() => window.stage3.snapshot().paddle);
  43  |       await page.mouse.move(p.x, p.y); await page.clock.runFor(25);
  44  |       expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(before);
  45  |       await page.mouse.down(); await page.clock.runFor(25); await aligned(page, p);
  46  |       const next = await projection(page, { x: x === 0 ? .35 : 0, y: .5 });
  47  |       await page.mouse.move(next.x, next.y); await page.clock.runFor(25); await aligned(page, next);
  48  |       await page.mouse.up(); const held = await page.evaluate(() => window.stage3.snapshot().paddle);
  49  |       await page.clock.runFor(25); expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(held);
  50  |     }
  51  |     // Outside drag follows capture, clamps, and releases without cancelling.
  52  |     const p = await projection(page, { x: 0, y: .5 });
  53  |     await page.mouse.move(p.x, p.y); await page.mouse.down();
  54  |     await page.mouse.move(-80, -80); await page.clock.runFor(25); await page.mouse.up();
  55  |     const held = await page.evaluate(() => window.stage3.snapshot());
  56  |     expect(held.phase).toBe('running');
  57  |     const edge = await projection(page, { x: -100, y: 100 }); await aligned(page, edge);
  58  |     await page.clock.runFor(32); expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(held.paddle);
  59  |     await page.screenshot({ path: info.outputPath('direct-held.png') });
  60  |     await info.attach('direct-input-state.json', { body: JSON.stringify({ viewport: size, box, held }), contentType: 'application/json' });
  61  |   });
  62  | }
  63  | 
  64  | test('二本指は両releaseで停止し、追加指やドラッグでは停止しない', async ({ page }, info) => {
  65  |   await begin(page);
  66  |   const canvas = page.locator('canvas');
  67  |   const a = { pointerId: 21, pointerType: 'touch', isPrimary: true, button: 0, clientX: 150, clientY: 450 };
  68  |   const b = { ...a, pointerId: 22, isPrimary: false, clientX: 250 };
  69  |   await canvas.dispatchEvent('pointerdown', a); await page.clock.runFor(20);
  70  |   await canvas.dispatchEvent('pointerdown', b); await page.clock.runFor(20);
  71  |   expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('running');
  72  |   await canvas.dispatchEvent('pointerup', a);
  73  |   expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('running');
  74  |   await canvas.dispatchEvent('pointerup', b);
  75  |   await expect(page.getByRole('dialog')).toBeVisible();
  76  |   const paused = await page.evaluate(() => window.stage3.snapshot());
  77  |   await page.clock.runFor(1000); expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused);
  78  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  79  |   await page.screenshot({ path: info.outputPath('two-finger-paused.png') });
  80  |   await page.getByRole('button', { name: 'つづける', exact: true }).click();
  81  |   await canvas.dispatchEvent('pointerdown', a);
  82  |   await canvas.dispatchEvent('pointermove', { ...a, clientX: 180 });
  83  |   await canvas.dispatchEvent('pointerdown', b);
  84  |   await canvas.dispatchEvent('pointerup', a); await canvas.dispatchEvent('pointerup', b);
  85  |   await page.clock.runFor(20);
  86  |   expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('running');
  87  |   // Cancel is interruption, never the gesture and never an implicit resume.
  88  |   await canvas.dispatchEvent('pointerdown', { ...a, pointerType: 'pen' });
  89  |   await canvas.dispatchEvent('pointercancel', { ...a, pointerType: 'pen' });
  90  |   expect(await page.evaluate(() => window.stage3.snapshot().pauseReason)).toBe('input-lost');
  91  | });
  92  | 
  93  | test('情報上の入力・safe area・resize連発・メニューに古い入力が残らない', async ({ page }, info) => {
  94  |   await begin(page);
  95  |   await page.addStyleTag({ content: ':root { --safe-top: 44px; --safe-bottom: 34px; --safe-left: 8px; --safe-right: 8px; }' });
  96  |   const hud = await page.locator('.hud').boundingBox();
  97  |   expect(hud!.y).toBeGreaterThanOrEqual(44);
  98  |   expect(hud!.x).toBeGreaterThanOrEqual(8);
  99  |   expect(await page.locator('canvas').boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  100 |   expect(await page.locator('.hud').evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');
  101 |   await page.mouse.click(hud!.x + 8, hud!.y + 8); await page.clock.runFor(25);
  102 |   const inputState = await page.evaluate(() => window.stage3.snapshot());
  103 |   expect(inputState.paddle).not.toEqual({ x: 0, y: .5 });
  104 |   await page.keyboard.press('Escape');
  105 |   expect(await page.getByRole('dialog').evaluate(e => Number.parseFloat(getComputedStyle(e).paddingBottom))).toBeGreaterThanOrEqual(34);
  106 |   const paused = await page.evaluate(() => ({ state: window.stage3.snapshot(), renders: window.stage3.metrics().viewRenders }));
  107 |   await page.evaluate(() => { for (let i = 0; i < 20; i++) window.dispatchEvent(new Event('resize')); });
  108 |   await page.clock.runFor(300);
  109 |   expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused.state);
  110 |   expect(await page.evaluate(() => window.stage3.metrics().viewRenders)).toBe(paused.renders);
  111 |   await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible();
  112 |   // Neither volume interaction nor menu pointer input reaches the paddle.
  113 |   await page.getByRole('dialog').getByLabel('効果音の音量', { exact: true }).fill('0.3');
  114 |   expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused.state);
  115 |   await page.setViewportSize({ width: 844, height: 390 }); await page.clock.runFor(200);
  116 |   expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBe(paused.state.simTime);
  117 |   await page.getByRole('button', { name: 'つづける', exact: true }).click();
  118 |   await page.locator('canvas').dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 100, clientY: 100 });
  119 |   await page.clock.runFor(25); expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(paused.state.paddle);
  120 |   await page.screenshot({ path: info.outputPath('resized-resumed.png') });
  121 | });
  122 | 
```