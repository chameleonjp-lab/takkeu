import { expect, test } from '@playwright/test';

test.use({ video: 'on' });

test('ワンバウンド後の見える球にラケットを合わせれば返球できる', async ({ page }, testInfo) => {
  const now = new Date('2026-10-22T16:00:00Z');
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(+now + 1000));
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  const surface = page.getByTestId('input-surface');
  const box = (await surface.boundingBox())!;
  const canvas = (await page.locator('canvas').boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height * 0.8;
  const target = { x: x + canvas.width * 0.05, y: y - canvas.height * 0.06 };
  await surface.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, button: 0 });
  await surface.dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: target.x, clientY: target.y });
  await page.clock.runFor(300);
  await surface.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: target.x, clientY: target.y });
  await page.clock.runFor(1100);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
  await page.screenshot({ path: testInfo.outputPath('before-bounce.png') });
  await page.clock.runFor(200);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  await page.screenshot({ path: testInfo.outputPath('returned.png') });
  await page.clock.runFor(1000);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
});

// This follows only visible ball positions through real drag input. It never
// reads a return reservation, changes the score, or enables fixture auto-play.
test('見えている球にドラッグで合わせ、3ラリーをつなげる', async ({ page }, testInfo) => {
  const now = new Date('2026-10-22T16:00:00Z');
  await page.clock.install({ time: now }); await page.clock.pauseAt(new Date(+now + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  const surface = page.getByTestId('input-surface');
  const box = (await surface.boundingBox())!;
  const origin = { x: box.x + box.width / 2, y: box.y + box.height * 0.75 };
  let score = 0;
  for (let tick = 0; tick < 65 && score < 3; tick++) {
    const visible = await page.evaluate(async () => {
      const cameraUrl = '/src/render/camera.ts';
      const { createCamera, fitCamera } = await import(cameraUrl);
      const configUrl = '/src/game/config.ts'; const { DEFAULT_CONFIG: config } = await import(configUrl);
      const state = window.stage3.snapshot(), canvas = document.querySelector('canvas')!.getBoundingClientRect();
      const camera = createCamera(); fitCamera(camera, canvas.width, canvas.height, config);
      const point = (p: { x: number; y: number; z: number }) => {
        const v = camera.position.clone().set(p.x, p.y, p.z).project(camera);
        return { x: (v.x + 1) * canvas.width / 2, y: (1 - v.y) * canvas.height / 2 };
      };
      const ball = state.balls.find(b => b.phase === 'incoming' && b.position.z >= 0);
      return { score: state.score, phase: state.phase, paddle: point({ ...state.paddle, z: config.paddleZ }), ball: ball ? point(ball.position) : null };
    });
    expect(visible.phase).toBe('running'); score = visible.score;
    if (visible.ball) {
      const dx = Math.max(-60, Math.min(60, visible.ball.x - visible.paddle.x));
      const dy = Math.max(-60, Math.min(60, visible.ball.y - visible.paddle.y));
      await surface.dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'touch', clientX: origin.x, clientY: origin.y, button: 0 });
      await surface.dispatchEvent('pointermove', { pointerId: 9, pointerType: 'touch', clientX: origin.x + dx, clientY: origin.y + dy });
      await page.clock.runFor(200);
      await surface.dispatchEvent('pointerup', { pointerId: 9, pointerType: 'touch', clientX: origin.x + dx, clientY: origin.y + dy });
    } else await page.clock.runFor(200);
  }
  expect(score).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: testInfo.outputPath('three-visible-returns.png') });
});
