// Evidence-only native canvas input. Never a production build entrypoint.
import { chromium, webkit } from '@playwright/test';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const output = fileURLToPath(new URL('.', import.meta.url));
await mkdir(output, { recursive: true });
const results = [], caps = [];
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch(engine === 'chromium' ? { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } : {});
  // The recording frame is fixed before navigation, avoiding resize letterboxing.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    recordVideo: { dir: output, size: { width: 390, height: 844 } }, locale: 'ja-JP' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('http://127.0.0.1:4177/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.clock.runFor(25);
  await page.evaluate(() => {
    const ring = document.createElement('div');
    ring.style.cssText = 'position:fixed;width:24px;height:24px;border:2px solid #ffcf66;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:30';
    const label = document.createElement('div');
    label.style.cssText = 'position:fixed;right:10px;top:70px;color:#fff;font:12px sans-serif;pointer-events:none;z-index:30';
    label.textContent = '自動canvas入力 / 時計制御';
    document.body.append(ring, label);
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, e => {
      ring.style.left = `${e.clientX}px`; ring.style.top = `${e.clientY}px`;
      ring.style.borderColor = e.buttons ? '#ffcf66' : '#aaa';
      label.textContent = `${type} / ${e.buttons ? '押下中' : '離した状態'}`;
    });
  });
  const points = await page.evaluate(async () => {
    const { createCamera, fitCamera } = await import('/src/render/camera.ts');
    const { DEFAULT_CONFIG: config } = await import('/src/game/config.ts');
    const rect = document.querySelector('canvas').getBoundingClientRect();
    const camera = createCamera(); fitCamera(camera, rect.width, rect.height, config);
    return [{ x: -.3, y: .45 }, { x: .3, y: .65 }, { x: -.35, y: .7 }].map(p => {
      const q = camera.position.clone().set(p.x, p.y, config.paddleZ).project(camera);
      return { x: Math.round(rect.left + (q.x + 1) * rect.width / 2), y: Math.round(rect.top + (1 - q.y) * rect.height / 2) };
    });
  });
  const samples = [];
  async function record(label) {
    await page.clock.runFor(25);
    samples.push({ label, state: await page.evaluate(() => window.stage3.snapshot()) });
    await page.waitForTimeout(120);
  }
  await page.mouse.move(points[0].x, points[0].y); await page.mouse.down(); await record('down/place');
  for (let segment = 0; segment < 2; segment++) for (let i = 1; i <= 10; i++) {
    const a = points[segment], b = points[segment + 1];
    await page.mouse.move(a.x + (b.x - a.x) * i / 10, a.y + (b.y - a.y) * i / 10);
    await record('drag');
  }
  await page.mouse.up(); await record('release');
  const held = samples.at(-1).state.paddle;
  await page.mouse.move(340, 760); await record('hover after release');
  assert.deepEqual(samples.at(-1).state.paddle, held);
  await page.waitForTimeout(700); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.stage3.snapshot().phase), 'paused');
  assert.deepEqual(errors, []);
  const video = page.video(); await context.close();
  await rename(await video.path(), output + engine + '-native-demo.webm');
  results.push({ engine, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, points, samples, errors });
  for (const quality of ['standard', 'low']) for (const viewport of [{ width: 390, height: 844 }, { width: 3000, height: 2000 }]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3 });
    const p = await ctx.newPage(); await p.goto('http://127.0.0.1:4177/');
    await p.getByRole('button', { name: '設定', exact: true }).click();
    await p.getByLabel('描画品質', { exact: true }).selectOption(quality);
    await p.getByRole('button', { name: '戻る', exact: true }).click();
    await p.getByRole('button', { name: 'はじめる', exact: true }).click();
    await p.keyboard.press('Escape');
    const m = await p.locator('canvas').evaluate(c => ({ width: c.width, height: c.height,
      css: { x: c.getBoundingClientRect().x, y: c.getBoundingClientRect().y, width: c.getBoundingClientRect().width, height: c.getBoundingClientRect().height }, dpr: devicePixelRatio }));
    assert.deepEqual(m.css, { x: 0, y: 0, ...viewport }); assert.equal(m.dpr, 3);
    assert.ok(m.width * m.height <= 2_000_000);
    if (viewport.width === 3000) assert.ok(m.width * m.height >= 1_990_000);
    else assert.deepEqual([m.width, m.height], quality === 'standard' ? [585, 1266] : [390, 844]);
    caps.push({ engine, quality, viewport, ...m }); await ctx.close();
  }
  await browser.close();
}
await writeFile(output + 'native-demo-input.json', JSON.stringify(results, null, 2));
await writeFile(output + 'actual-pixel-caps.json', JSON.stringify(caps, null, 2));
console.log(JSON.stringify({ demos: results.length, pixelCapCases: caps.length, status: 'passed' }));
