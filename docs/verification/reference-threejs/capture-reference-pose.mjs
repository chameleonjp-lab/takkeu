// A still rendering comparison, separate from the real-input gameplay tests.
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const formal = JSON.parse(readFileSync(join(dir, 'final-verification.json'), 'utf8'));
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (formal.result !== 'passed' || formal.commit !== sha) throw new Error('Finish the unchanged formal source first');
const fd = openSync(join(dir, 'pose-server.log'), 'w');
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { detached: true, stdio: ['ignore', fd, fd] });
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://127.0.0.1:4178')).ok) break; } catch { /* startup */ }
    if (i === 99) throw new Error('Preview server did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 650 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4178/tests/fixtures/stage2.html');
  const result = await page.evaluate(async () => {
    const { createView } = await import('/src/render/createView.ts');
    const { DEFAULT_CONFIG } = await import('/src/game/config.ts');
    const canvas = document.createElement('canvas'); canvas.id = 'comparison-court';
    Object.assign(canvas.style, { position: 'fixed', left: '0', top: '0', width: '675px', height: '471px', zIndex: '100' });
    document.body.append(canvas);
    const snapshot = structuredClone(window.stage2.snapshot());
    snapshot.paddle = { x: 0.58, y: 0.42 };
    const view = createView(canvas, DEFAULT_CONFIG); view.resize(675, 471); view.render(snapshot, []);
    window.disposeComparison = () => view.dispose();
    return { paddle: snapshot.paddle, resources: view.resources(), viewport: { width: 675, height: 471 }, userAgent: navigator.userAgent };
  });
  await page.locator('#comparison-court').screenshot({ path: join(dir, 'screenshots', 'reference-pose.png') });
  await page.evaluate(() => window.disposeComparison());
  writeFileSync(join(dir, 'reference-pose.json'), JSON.stringify({ commit: sha, capturedAt: new Date().toISOString(), illustrationOnly: true,
    note: 'Production Three.js renderer; player paddle positioned for comparison. Not a gameplay or hardware test.', ...result }, null, 2) + '\n');
} finally {
  await browser?.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already closed */ }
  closeSync(fd);
}
