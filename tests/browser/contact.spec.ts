import { expect, test, type Page } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

test.use({ video: 'on' });

async function begin(page: Page) {
  const now = new Date('2026-10-22T16:00:00Z');
  await page.clock.install({ time: now }); await page.clock.pauseAt(new Date(+now + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  // Evidence-only cursor: records the native pointer position, never injects a target.
  await page.evaluate(() => {
    const dot = document.createElement('div'); dot.id = 'recorded-pointer';
    dot.style.cssText = 'position:fixed;width:20px;height:20px;border:2px solid #ff6c7b;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:30;display:none';
    document.body.append(dot);
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, event => {
      const p = event as PointerEvent; dot.style.left = `${p.clientX}px`; dot.style.top = `${p.clientY}px`;
      dot.style.display = type === 'pointerup' ? 'none' : 'block';
    });
  });
}
async function visible(page: Page) {
  return page.evaluate(async () => {
    const cameraUrl = '/src/render/camera.ts', configUrl = '/src/game/config.ts';
    const { createCamera, fitCamera } = await import(cameraUrl);
    const { DEFAULT_CONFIG: config } = await import(configUrl);
    const state = window.stage3.snapshot(), rect = document.querySelector('canvas')!.getBoundingClientRect();
    const camera = createCamera(); fitCamera(camera, rect.width, rect.height, config);
    const ball = state.balls.find(b => b.phase === 'incoming' && b.position.z >= 0);
    const p = ball ? camera.position.clone().copy(ball.position).project(camera) : null;
    return { score: state.score, phase: state.phase, ball: p ? { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 } : null };
  });
}

test('ワンバウンド後の見える球にラケットを合わせれば返球できる', async ({ page }, testInfo) => {
  await begin(page);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.width / 2, box.height * .9); await page.mouse.down();
  await page.clock.runFor(1400);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
  await page.screenshot({ path: testInfo.outputPath('before-bounce.png') });
  for (let tick = 0; tick < 10 && (await visible(page)).score === 0; tick++) {
    const state = await visible(page);
    if (state.ball) await page.mouse.move(Math.round(state.ball.x), Math.round(state.ball.y));
    await page.clock.runFor(50);
  }
  await page.mouse.up();
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  await page.screenshot({ path: testInfo.outputPath('returned.png') });
  await page.clock.runFor(1000);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
});

// Follow only currently visible ball positions through native canvas input.
// No reservations, future ball positions, score changes or fixture autoplay.
test('見えている球にドラッグで合わせ、3ラリーをつなげる', async ({ page }, testInfo) => {
  await begin(page);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.width / 2, box.height * .8); await page.mouse.down();
  let score = 0;
  for (let tick = 0; tick < 65 && score < 3; tick++) {
    const state = await visible(page);
    expect(state.phase).toBe('running'); score = state.score;
    if (state.ball) await page.mouse.move(Math.round(state.ball.x), Math.round(state.ball.y));
    await page.clock.runFor(200);
  }
  await page.mouse.up();
  expect(score).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: testInfo.outputPath('three-visible-returns.png') });
});
