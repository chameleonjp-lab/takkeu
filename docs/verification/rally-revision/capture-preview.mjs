// Rebuild the home illustration with the production Three.js renderer.
// Posed test state: this is not gameplay, timing, or hardware evidence.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
const dir = 'docs/verification/rally-revision';
const fd = openSync(`${dir}/preview-server.log`, 'w');
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { detached: true, stdio: ['ignore', fd, fd] });
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://127.0.0.1:4178')).ok) break; } catch { /* startup */ }
    if (i === 99) throw new Error('Preview server did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 600, height: 415 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4178/');
  await page.evaluate(async () => {
    const { createView } = await import('/src/render/createView.ts');
    const { DEFAULT_CONFIG } = await import('/src/game/config.ts');
    const { scenario } = await import('/tests/helpers/scenarios.ts');
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { width: '600px', height: '415px', display: 'block' });
    document.body.replaceChildren(canvas); document.body.style.margin = '0';
    const snapshot = scenario(0, 0).snapshot();
    snapshot.paddle = { x: 0.58, y: 0.42 };
    snapshot.balls = [{ id: 1, phase: 'incoming', smash: false, position: { x: -0.45, y: 0.45, z: 0.95 } }];
    const view = createView(canvas, DEFAULT_CONFIG); view.resize(600, 415); view.render(snapshot, []);
    window.disposePreview = () => view.dispose();
  });
  await page.locator('canvas').screenshot({ path: 'src/ui/court-preview.png' });
  await page.evaluate(() => window.disposePreview());
  const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
  const paths = ['src/render/balls.ts', 'src/render/environment.ts', 'src/render/rainbow.ts', 'src/render/materials.ts', 'src/render/paddle.ts', 'src/render/objects.ts', 'src/render/presentation.ts', 'src/render/createView.ts', 'src/render/camera.ts', 'src/ui/court-preview.png'];
  writeFileSync(`${dir}/preview-generation.json`, JSON.stringify({ capturedAt: new Date().toISOString(), illustrationOnly: true,
    size: { width: 600, height: 415 }, paddle: { x: 0.58, y: 0.42 }, sourceSha256: Object.fromEntries(paths.map(path => [path, hash(path)])) }, null, 2) + '\n');
} finally {
  await browser?.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already closed */ }
  closeSync(fd);
}
