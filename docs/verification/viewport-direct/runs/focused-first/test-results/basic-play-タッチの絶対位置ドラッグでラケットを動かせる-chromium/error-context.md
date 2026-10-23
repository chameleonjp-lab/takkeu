# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: basic-play.spec.ts >> タッチの絶対位置ドラッグでラケットを動かせる
- Location: tests/browser/basic-play.spec.ts:64:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'ナイスラリー！' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'ナイスラリー！' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'ナイスラリー！' })

```

```yaml
- main:
  - text: RALLY
  - status "ラリー数": "1"
  - text: 残球数
  - status "残球数": "1"
  - status: プレイ中。残球数1。
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test.use({ video: 'on' });
  4  | 
  5  | test.beforeEach(async ({ page }) => {
  6  |   const now = new Date('2026-10-22T12:00:00Z');
  7  |   await page.clock.install({ time: now });
  8  |   await page.clock.pauseAt(new Date(now.getTime() + 1000));
  9  |   await page.goto('/');
  10 | });
  11 | 
  12 | test('開始→直接配置・ドラッグ→返球→失球→結果→再挑戦', async ({ page }, testInfo) => {
  13 |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  14 |   const surface = page.getByTestId('input-surface');
  15 |   await expect(surface).toBeVisible();
  16 |   const box = (await surface.boundingBox())!;
  17 |   // Project the intended visible centre independently, then click the actual canvas.
  18 |   const centre = await page.evaluate(async () => {
  19 |     const cameraUrl = '/src/render/camera.ts', configUrl = '/src/game/config.ts';
  20 |     const { createCamera, fitCamera } = await import(cameraUrl);
  21 |     const { DEFAULT_CONFIG } = await import(configUrl);
  22 |     const rect = document.querySelector('canvas')!.getBoundingClientRect();
  23 |     const camera = createCamera(); fitCamera(camera, rect.width, rect.height, DEFAULT_CONFIG);
  24 |     const p = camera.position.clone().set(0, .5, DEFAULT_CONFIG.paddleZ).project(camera);
  25 |     return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  26 |   });
  27 |   await page.mouse.move(centre.x, centre.y);
  28 |   await page.mouse.down();
  29 |   await page.clock.runFor(2700);
  30 |   await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  31 |   await page.mouse.up();
  32 |   await page.screenshot({ path: testInfo.outputPath('playing.png') });
  33 |   await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
  34 |   await page.mouse.down();
  35 |   await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.3);
  36 |   await page.clock.runFor(300);
  37 |   await page.mouse.up();
  38 |   await page.clock.runFor(5000);
  39 |   await expect(page.getByRole('heading', { name: 'ナイスラリー！' })).toBeVisible();
  40 |   await expect(page.getByLabel('今回のラリー数')).toHaveText('1');
  41 |   await page.getByRole('button', { name: 'もう一度', exact: true }).click();
  42 |   await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
  43 |   await expect(page.getByLabel('残球数')).toContainText('1');
  44 |   await page.clock.runFor(2700);
  45 |   await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  46 | });
  47 | 
  48 | test('停止中は描画を保持し、再開操作でだけ進む', async ({ page }, testInfo) => {
  49 |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  50 |   await page.clock.runFor(1800);
  51 |   await page.keyboard.press('Escape');
  52 |   await expect(page.getByRole('heading', { name: 'ひと休み' })).toBeVisible();
  53 |   const before = await page.locator('canvas').screenshot();
  54 |   await page.clock.runFor(5000);
  55 |   const after = await page.locator('canvas').screenshot();
  56 |   await testInfo.attach('paused-before', { body: before, contentType: 'image/png' });
  57 |   await testInfo.attach('paused-after', { body: after, contentType: 'image/png' });
  58 |   expect(before.equals(after), '停止中の画面が一致する').toBe(true);
  59 |   await page.getByRole('button', { name: 'つづける', exact: true }).click();
  60 |   await page.clock.runFor(1000);
  61 |   await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  62 | });
  63 | 
  64 | test('タッチの絶対位置ドラッグでラケットを動かせる', async ({ page }) => {
  65 |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  66 |   const surface = page.getByTestId('input-surface');
  67 |   const box = (await surface.boundingBox())!;
  68 |   const position = { x: box.x + box.width * 0.15, y: box.y + box.height * 0.8 };
  69 |   await surface.dispatchEvent('pointerdown', { pointerId: 10, pointerType: 'touch', clientX: position.x, clientY: position.y, button: 0 });
  70 |   await surface.dispatchEvent('pointermove', { pointerId: 10, pointerType: 'touch', clientX: position.x + box.width * 0.8, clientY: position.y - 100 });
  71 |   await page.clock.runFor(300);
  72 |   await surface.dispatchEvent('pointerup', { pointerId: 10, pointerType: 'touch', clientX: position.x + box.width * 0.8, clientY: position.y - 100 });
  73 |   await page.clock.runFor(2700);
> 74 |   await expect(page.getByRole('heading', { name: 'ナイスラリー！' })).toBeVisible();
     |                                                                ^ Error: expect(locator).toBeVisible() failed
  75 |   await expect(page.getByLabel('今回のラリー数')).toHaveText('0');
  76 | });
  77 | 
```