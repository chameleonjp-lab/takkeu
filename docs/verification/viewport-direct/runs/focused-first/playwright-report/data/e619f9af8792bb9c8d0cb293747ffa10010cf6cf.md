# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lifecycle.spec.ts >> 通常の指離れ・2本目・追跡喪失・回転で入力が残らない
- Location: tests/browser/lifecycle.spec.ts:11:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'ひと休み' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'ひと休み' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'ひと休み' })

```

```yaml
- main:
  - text: RALLY
  - status "ラリー数": "0"
  - text: 残球数
  - status "残球数": "1"
  - status: プレイ中。残球数1。
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import type {} from '../helpers/appHarness';
  3   | 
  4   | test.beforeEach(async ({ page }) => {
  5   |   const now = new Date('2026-10-22T13:00:00Z');
  6   |   await page.clock.install({ time: now }); await page.clock.pauseAt(new Date(now.getTime() + 1000));
  7   |   await page.goto('/tests/fixtures/stage3.html');
  8   |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  9   | });
  10  | 
  11  | test('通常の指離れ・2本目・追跡喪失・回転で入力が残らない', async ({ page }, testInfo) => {
  12  |   const surface = page.getByTestId('input-surface');
  13  |   const down = { pointerId: 1, pointerType: 'touch', button: 0, clientX: 120, clientY: 300 };
  14  |   await surface.dispatchEvent('pointerdown', down);
  15  |   await surface.dispatchEvent('pointermove', { ...down, clientX: 145, clientY: 290 });
  16  |   await page.clock.runFor(100);
  17  |   await surface.dispatchEvent('pointerdown', { ...down, pointerId: 2 });
  18  |   await surface.dispatchEvent('pointermove', { ...down, pointerId: 2, clientX: 700 });
  19  |   await surface.dispatchEvent('pointerup', down);
  20  |   await surface.dispatchEvent('lostpointercapture', down);
  21  |   const released = await page.evaluate(() => window.stage3.snapshot());
  22  |   await page.clock.runFor(100);
  23  |   expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(released.paddle);
  24  |   expect(released.phase).toBe('running');
  25  |   await surface.dispatchEvent('pointerdown', down);
  26  |   await surface.dispatchEvent('lostpointercapture', down);
> 27  |   await expect(page.getByRole('heading', { name: 'ひと休み' })).toBeVisible();
      |                                                             ^ Error: expect(locator).toBeVisible() failed
  28  |   const held = await page.evaluate(() => window.stage3.snapshot());
  29  |   await page.setViewportSize({ width: 844, height: 390 }); await page.clock.runFor(5000);
  30  |   expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(held.paddle);
  31  |   expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBe(held.simTime);
  32  |   await page.screenshot({ path: testInfo.outputPath('rotated-paused.png') });
  33  |   await page.getByRole('button', { name: 'つづける', exact: true }).click();
  34  |   await surface.dispatchEvent('pointermove', { ...down, clientX: 800 });
  35  |   await page.clock.runFor(50);
  36  |   expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(held.paddle);
  37  | });
  38  | 
  39  | test('非表示・画面ロック相当のpagehideでM10・球・時刻が止まり、手動で再開', async ({ page }) => {
  40  |   await page.evaluate(() => window.stage3.show(10)); await page.clock.runFor(32);
  41  |   await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  42  |   const before = await page.evaluate(() => window.stage3.snapshot());
  43  |   await page.clock.runFor(10_000);
  44  |   expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  45  |   await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow')); });
  46  |   await page.clock.runFor(500);
  47  |   expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  48  |   await page.getByRole('button', { name: 'つづける', exact: true }).click(); await page.clock.runFor(32);
  49  |   const resumedTime = await page.evaluate(() => window.stage3.snapshot().simTime);
  50  |   expect(resumedTime).toBeGreaterThan(before.simTime);
  51  |   expect(resumedTime - before.simTime).toBeLessThanOrEqual(0.04);
  52  |   await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  53  |   expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('paused');
  54  | });
  55  | 
  56  | test('WebGL復旧で描画を再作成し、停止中の390・スマッシュ予告を保持する', async ({ page }, testInfo) => {
  57  |   await page.evaluate(() => window.stage3.show(450)); await page.clock.runFor(32);
  58  |   await expect(page.getByText('スマッシュがくる！', { exact: true })).toBeVisible();
  59  |   await page.locator('canvas').dispatchEvent('webglcontextlost', { cancelable: true });
  60  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeDisabled();
  61  |   const before = await page.evaluate(() => window.stage3.snapshot());
  62  |   await page.clock.runFor(5000); expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  63  |   await page.evaluate(() => window.stage3.restore());
  64  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeEnabled();
  65  |   expect(await page.evaluate(() => window.stage3.metrics().viewCreates)).toBe(2);
  66  |   expect(await page.evaluate(() => window.stage3.metrics().viewDisposes)).toBe(1);
  67  |   expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  68  |   await expect(page.getByText('スマッシュがくる！', { exact: true })).toBeVisible();
  69  |   await page.screenshot({ path: testInfo.outputPath('context-restored-warning.png') });
  70  |   await page.getByRole('button', { name: 'つづける', exact: true }).click(); await page.clock.runFor(64);
  71  |   expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBeGreaterThan(before.simTime);
  72  | });
  73  | 
  74  | test('実際のWEBGL_lose_contextによる喪失と復旧でも手動再開を待つ', async ({ page }, info) => {
  75  |   await page.evaluate(() => window.stage3.show(450)); await page.clock.runFor(32);
  76  |   const supported = await page.evaluate(() => {
  77  |     const ext = document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context');
  78  |     Object.assign(window, { nativeContextLoss: ext }); ext?.loseContext(); return !!ext;
  79  |   });
  80  |   expect(supported, 'このブラウザの実コンテキスト喪失検証に必要な拡張').toBe(true);
  81  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeDisabled();
  82  |   const before = await page.evaluate(() => window.stage3.snapshot());
  83  |   await page.evaluate(() => (window as unknown as { nativeContextLoss: WEBGL_lose_context }).nativeContextLoss.restoreContext());
  84  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeEnabled();
  85  |   await page.clock.runFor(2000); expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  86  |   await expect(page.getByText('スマッシュがくる！', { exact: true })).toBeVisible();
  87  |   await page.screenshot({ path: info.outputPath('native-webgl-restored.png') });
  88  |   await page.getByRole('button', { name: 'つづける', exact: true }).click(); await page.clock.runFor(64);
  89  |   expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBeGreaterThan(before.simTime);
  90  | });
  91  | 
  92  | test('描画再作成の失敗時も状態を壊さずホームへ戻れる', async ({ page }) => {
  93  |   await page.evaluate(() => window.stage3.show(450)); await page.clock.runFor(32);
  94  |   await page.locator('canvas').dispatchEvent('webglcontextlost', { cancelable: true });
  95  |   const before = await page.evaluate(() => window.stage3.snapshot());
  96  |   await page.evaluate(() => { window.stage3.failNextView(); window.stage3.restore(); });
  97  |   await expect(page.getByRole('alert')).toContainText('描画を復旧できませんでした');
  98  |   expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  99  |   await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeDisabled();
  100 |   await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  101 |   await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
  102 | });
  103 | 
```