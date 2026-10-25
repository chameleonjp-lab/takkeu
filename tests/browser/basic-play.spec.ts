import { expect, test, waitForStart } from '../helpers/browserTest';

test.use({ video: 'on' });

test.beforeEach(async ({ page }) => {
  const now = new Date('2026-10-22T12:00:00Z');
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await page.goto('/');
});

test('開始→直接配置・ドラッグ→返球→失球→結果→再挑戦', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await waitForStart(page);
  const surface = page.getByTestId('input-surface');
  await expect(surface).toBeVisible();
  const box = (await surface.boundingBox())!;
  // Project the intended visible centre independently, then click the actual canvas.
  const centre = await page.evaluate(async () => {
    const cameraUrl = '/src/render/camera.ts', configUrl = '/src/game/config.ts';
    const { createCamera, fitCamera } = await import(cameraUrl);
    const { DEFAULT_CONFIG } = await import(configUrl);
    const rect = document.querySelector('canvas')!.getBoundingClientRect();
    const camera = createCamera(); fitCamera(camera, rect.width, rect.height, DEFAULT_CONFIG);
    const p = camera.position.clone().set(0, .5, DEFAULT_CONFIG.paddleZ).project(camera);
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  });
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.clock.runFor(2700);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  await page.mouse.up();
  await page.screenshot({ path: testInfo.outputPath('playing.png') });
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.3);
  await page.clock.runFor(300);
  await page.mouse.up();
  await page.clock.runFor(5000);
  await expect(page.getByRole('heading', { name: 'ナイスラリー！' })).toBeVisible();
  await expect(page.getByLabel('今回のラリー数')).toHaveText('1');
  await page.getByRole('button', { name: 'もう一度', exact: true }).click();
  await waitForStart(page);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
  await expect(page.getByLabel('残球数')).toContainText('1');
  await page.clock.runFor(2700);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
});

test('停止中は描画を保持し、再開操作でだけ進む', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await waitForStart(page);
  await page.clock.runFor(1800);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'ひと休み' })).toBeVisible();
  const before = await page.locator('canvas').screenshot();
  await page.clock.runFor(5000);
  const after = await page.locator('canvas').screenshot();
  await testInfo.attach('paused-before', { body: before, contentType: 'image/png' });
  await testInfo.attach('paused-after', { body: after, contentType: 'image/png' });
  expect(before.equals(after), '停止中の画面が一致する').toBe(true);
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
});

test('タッチの絶対位置ドラッグでラケットを動かせる', async ({ page }) => {
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await waitForStart(page);
  const surface = page.getByTestId('input-surface');
  const box = (await surface.boundingBox())!;
  const position = { x: box.x + box.width * 0.15, y: box.y + box.height * 0.8 };
  await surface.dispatchEvent('pointerdown', { pointerId: 10, pointerType: 'touch', isPrimary: true, clientX: position.x, clientY: position.y, button: 0 });
  await surface.dispatchEvent('pointermove', { pointerId: 10, pointerType: 'touch', isPrimary: true, clientX: position.x + box.width * 0.8, clientY: position.y - 100 });
  await page.clock.runFor(300);
  await surface.dispatchEvent('pointerup', { pointerId: 10, pointerType: 'touch', isPrimary: true, clientX: position.x + box.width * 0.8, clientY: position.y - 100 });
  await page.clock.runFor(2700);
  await expect(page.locator('[data-finishing]')).toBeVisible();
  await expect(page.getByLabel('残球数', { exact: true })).toHaveText('0');
  // Gameplay has stopped; advance the drawing clock through the .9s net burst.
  await page.clock.runFor(1000);
  await expect(page.getByRole('heading', { name: 'ナイスラリー！' })).toBeVisible();
  await expect(page.getByLabel('今回のラリー数')).toHaveText('0');
});
