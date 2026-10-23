import { expect, test, type Page } from '@playwright/test';
import type {} from '../helpers/appHarness';

test.use({ video: 'on' });
async function begin(page: Page, size = { width: 390, height: 844 }) {
  await page.setViewportSize(size);
  await page.clock.install({ time: new Date('2026-10-23T14:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-23T14:00:01Z'));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
}
async function projection(page: Page, point: { x: number; y: number }, clamp = true) {
  return page.evaluate(async ({ point, clamp }) => {
    const cameraUrl = '/src/render/camera.ts', configUrl = '/src/game/config.ts';
    const { createCamera, fitCamera } = await import(cameraUrl);
    const { DEFAULT_CONFIG: config, clampPaddle } = await import(configUrl);
    const rect = document.querySelector('canvas')!.getBoundingClientRect();
    const camera = createCamera(); fitCamera(camera, rect.width, rect.height, config);
    const target = clamp ? clampPaddle(point, config) : point;
    const p = camera.position.clone().set(target.x, target.y, config.paddleZ).project(camera);
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2, target };
  }, { point, clamp });
}
async function aligned(page: Page, expected: { x: number; y: number }) {
  const paddle = await page.evaluate(() => window.stage3.snapshot().paddle);
  const screen = await projection(page, paddle, false);
  expect(Math.hypot(screen.x - expected.x, screen.y - expected.y)).toBeLessThan(1);
}

for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 280, height: 360 }]) {
  test(`実canvasのtap/drag/releaseが投影位置に一致し保持する ${size.width}×${size.height}`, async ({ page }, info) => {
    await begin(page, size);
    expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual({ x: 0, y: .5 });
    const canvas = page.locator('canvas'), box = (await canvas.boundingBox())!;
    expect(box).toEqual({ x: 0, y: 0, width: size.width, height: size.height });
    await expect(canvas).toBeFocused();
    await expect(page.locator('[data-game] button:visible, [data-game] a:visible')).toHaveCount(0);
    for (const y of [.15, .5, .85]) for (const x of [-2, 0, 2]) {
      const p = await projection(page, { x, y });
      const before = await page.evaluate(() => window.stage3.snapshot().paddle);
      await page.mouse.move(p.x, p.y); await page.clock.runFor(12);
      expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(before);
      await page.mouse.down(); await page.clock.runFor(12); await aligned(page, p);
      const next = await projection(page, { x: x === 0 ? .35 : 0, y: .5 });
      await page.mouse.move(next.x, next.y); await page.clock.runFor(12); await aligned(page, next);
      await page.mouse.up(); const held = await page.evaluate(() => window.stage3.snapshot().paddle);
      await page.clock.runFor(12); expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(held);
    }
    // Outside drag follows capture, clamps, and releases without cancelling.
    const p = await projection(page, { x: 0, y: .5 });
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(-80, -80); await page.clock.runFor(12); await page.mouse.up();
    const held = await page.evaluate(() => window.stage3.snapshot());
    expect(held.phase).toBe('running');
    const edge = await projection(page, { x: -100, y: 100 }); await aligned(page, edge);
    await page.clock.runFor(32); expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(held.paddle);
    await page.screenshot({ path: info.outputPath('direct-held.png') });
    await info.attach('direct-input-state.json', { body: JSON.stringify({ viewport: size, box, held }), contentType: 'application/json' });
  });
}

test('二本指は両releaseで停止し、追加指やドラッグでは停止しない', async ({ page }, info) => {
  await begin(page);
  const canvas = page.locator('canvas');
  const a = { pointerId: 21, pointerType: 'touch', button: 0, clientX: 150, clientY: 450 };
  const b = { ...a, pointerId: 22, clientX: 250 };
  await canvas.dispatchEvent('pointerdown', a); await page.clock.runFor(20);
  await canvas.dispatchEvent('pointerdown', b); await page.clock.runFor(20);
  expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('running');
  await canvas.dispatchEvent('pointerup', a);
  expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('running');
  await canvas.dispatchEvent('pointerup', b);
  await expect(page.getByRole('dialog')).toBeVisible();
  const paused = await page.evaluate(() => window.stage3.snapshot());
  await page.clock.runFor(1000); expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused);
  await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath('two-finger-paused.png') });
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await canvas.dispatchEvent('pointerdown', a);
  await canvas.dispatchEvent('pointermove', { ...a, clientX: 180 });
  await canvas.dispatchEvent('pointerdown', b);
  await canvas.dispatchEvent('pointerup', a); await canvas.dispatchEvent('pointerup', b);
  await page.clock.runFor(20);
  expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('running');
  // Cancel is interruption, never the gesture and never an implicit resume.
  await canvas.dispatchEvent('pointerdown', { ...a, pointerType: 'pen' });
  await canvas.dispatchEvent('pointercancel', { ...a, pointerType: 'pen' });
  expect(await page.evaluate(() => window.stage3.snapshot().pauseReason)).toBe('input-lost');
});

test('情報上の入力・safe area・resize連発・メニューに古い入力が残らない', async ({ page }, info) => {
  await begin(page);
  await page.addStyleTag({ content: ':root { --safe-top: 44px; --safe-bottom: 34px; --safe-left: 8px; --safe-right: 8px; }' });
  const hud = await page.locator('.hud').boundingBox();
  expect(await page.locator('.hud').evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');
  await page.mouse.click(hud!.x + 8, hud!.y + 8); await page.clock.runFor(12);
  const inputState = await page.evaluate(() => window.stage3.snapshot());
  expect(inputState.paddle).not.toEqual({ x: 0, y: .5 });
  await page.keyboard.press('Escape');
  const paused = await page.evaluate(() => ({ state: window.stage3.snapshot(), renders: window.stage3.metrics().viewRenders }));
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.dispatchEvent(new Event('resize')); });
  await page.clock.runFor(300);
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused.state);
  expect(await page.evaluate(() => window.stage3.metrics().viewRenders)).toBe(paused.renders);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible();
  // Neither volume interaction nor menu pointer input reaches the paddle.
  await page.getByRole('dialog').getByLabel('効果音の音量', { exact: true }).fill('0.3');
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused.state);
  await page.setViewportSize({ width: 844, height: 390 }); await page.clock.runFor(200);
  expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBe(paused.state.simTime);
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await page.locator('canvas').dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
  await page.clock.runFor(12); expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(paused.state.paddle);
  await page.screenshot({ path: info.outputPath('resized-resumed.png') });
});
