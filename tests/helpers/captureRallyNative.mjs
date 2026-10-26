import { createServer } from 'vite';
import { chromium, webkit } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

// Visual replay only: explicit Playwright clock, never performance evidence.
// Real stepSimulation/autoplay, normal collisions/guards, no fabricated warning.
const [before, after, output] = process.argv.slice(2);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const files = root => ({
  ...Object.fromEntries(execFileSync('git', ['-C', root, 'ls-files', 'src', 'tests/helpers/appHarness.ts', 'tests/helpers/scenarios.ts', 'tests/helpers/remainingBall.ts', 'tests/helpers/losses.ts', 'tests/fixtures/stage3.html', 'package.json', 'package-lock.json'], { encoding: 'utf8' }).trim().split('\n').map(file => [file, sha(readFileSync(path.join(root, file)))])),
  executingRunnerSHA256: sha(readFileSync(import.meta.filename)),
});
const summaries = [];
mkdirSync(output, { recursive: true });
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch({ headless: true, ...(engine === 'chromium' ? { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } : {}) });
  try {
    for (const [side, root] of [['before', before], ['after', after]]) {
      const initialHashes = files(root), errors = [], blocked = [];
      const server = await createServer({ root, configFile: false, plugins: [{ name: 'native-visual-only', enforce: 'pre', transform(code, id) {
        if (!id.endsWith('/src/app/createApp.ts')) return;
        const anchor = '  frameId = requestAnimationFrame(frame);\n  return {';
        if (!code.includes(anchor)) throw Error('Visual initialization anchor missing');
        return { code: code.replace(anchor, `  frameId = requestAnimationFrame(frame);
  window.__nativeVisual={started:false,requestStart(){requestAnimationFrame(now=>{window.stage3.show(3999);window.stage3.autoPlay(true);preferences={...preferences,bestScore:3999};loop.resetClock(now);window.__nativeVisual.initialRAF=now;window.__nativeVisual.started=true;});},state:()=>effectState};
  return {`).replace('const result = loop.frame(now);','window.__nativeVisual.lastRAF=now; const result = loop.frame(now);'), map: null };
      } }], server: { host: '127.0.0.1', port: 4176, strictPort: true, watch: { ignored: ['**/docs/**', '**/artifacts/**'] } } });
      await server.listen();
      try {
        for (const quality of ['low', 'standard']) {
          const directory = path.join(output, `${engine}-${side}-${quality}`);
          mkdirSync(directory, { recursive: true });
          const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
          await context.route('**/*', async route => {
            if (new URL(route.request().url()).origin === 'http://127.0.0.1:4176') await route.continue();
            else { blocked.push(route.request().url()); await route.abort(); }
          });
          await context.routeWebSocket('**/*', socket => socket.close());
          const page = await context.newPage();
          page.on('pageerror', error => errors.push(error.message));
          try {
            const epoch = new Date('2026-10-26T00:00:00Z');
            await page.clock.install({ time: epoch });
            await page.clock.pauseAt(new Date(+epoch + 1000));
            await page.goto('http://127.0.0.1:4176/tests/fixtures/stage3.html');
            await page.getByRole('button', { name: '設定', exact: true }).click();
            await page.getByLabel('描画品質', { exact: true }).selectOption(quality);
            await page.getByRole('button', { name: '戻る', exact: true }).click();
            await page.getByRole('button', { name: 'はじめる', exact: true }).click();
            const deadline = Date.now() + 60000;
            while (await page.evaluate(() => window.stage3.snapshot().phase !== 'running')) {
              if (Date.now() > deadline) throw Error('Native replay startup timeout');
              await page.clock.runFor(5);
              await new Promise(resolve => setTimeout(resolve, 5));
            }
            // Align only the fixture's initial scenario/clock after resource preparation.
            await page.clock.pauseAt(new Date(+epoch + 120000));
            await page.evaluate(() => window.__nativeVisual.requestStart());
            await page.clock.runFor(16);
            if (!await page.evaluate(() => window.__nativeVisual.started)) throw Error('Initial RAF alignment did not run');
            const frames = [];
            for (let frame = 0; frame < 375; frame++) {
              await page.clock.runFor(16);
              const record = await page.evaluate(async () => {
                const cameraURL = '/src/render/camera.ts', configURL = '/src/game/config.ts';
                const { createCamera, fitCamera } = await import(cameraURL), { DEFAULT_CONFIG } = await import(configURL);
                const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect(), camera = createCamera();
                fitCamera(camera, rect.width, rect.height, DEFAULT_CONFIG);
                const snapshot = window.stage3.snapshot(), events = window.stage3.metrics().events;
                const project = position => { const p = camera.position.clone().set(position.x, position.y, position.z).project(camera); return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2, inView: Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 }; };
                // A conservative camera-space cube contains the ball's sphere
                // and shell. Use its projected extent to exclude overlaps,
                // rather than mistaking a 12px centre gap for no occlusion.
                const bounds = position => {
                  const center = project(position), radius = DEFAULT_CONFIG.ballRadius;
                  const viewPosition = camera.position.clone().set(position.x, position.y, position.z).applyMatrix4(camera.matrixWorldInverse);
                  if(viewPosition.z+radius>=-camera.near)return {...center,exclusionRadius:null,nearPlaneIntersection:true};
                  let extent = 0;
                  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
                    const p = viewPosition.clone().add(camera.position.clone().set(x*radius,y*radius,z*radius)).applyMatrix4(camera.projectionMatrix);
                    extent=Math.max(extent,Math.hypot(rect.left+(p.x+1)*rect.width/2-center.x,rect.top+(1-p.y)*rect.height/2-center.y));
                  }
                  return {...center,exclusionRadius:extent,nearPlaneIntersection:false};
                };
                const warning = document.querySelector('[data-smash-warning]'), warningRect = warning.getBoundingClientRect();
                const previous = window.__nativeEventCount ?? 0; window.__nativeEventCount = events.length;
                return { snapshot, effects: window.__nativeVisual.state(), newEvents: events.slice(previous), resources: window.stage3.resources(),
                  clock:{now:performance.now(),initialRAF:window.__nativeVisual.initialRAF,lastRAF:window.__nativeVisual.lastRAF,elapsedRAF:window.__nativeVisual.lastRAF-window.__nativeVisual.initialRAF,fixedTick:Math.round(snapshot.simTime/DEFAULT_CONFIG.fixedDt)},
                  centers: snapshot.balls.map(ball => ({ id: ball.id, phase: ball.phase, ...bounds(ball.position) })),
                  css: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, drawingSize: { width: canvas.width, height: canvas.height },
                  warning: { hidden: warning.hidden, text: warning.textContent, x: warningRect.x, y: warningRect.y, width: warningRect.width, height: warningRect.height },
                  notice: document.querySelector('[data-rally-notice]')?.textContent };
              });
              if (record.snapshot.phase !== 'running' || record.snapshot.balls.filter(ball => ball.phase !== 'lost').length !== 30) throw Error('Native visual replay lost continuous 30-ball running state');
              frames.push(record);
              // Keep every 16ms content-clock frame for LOW; one matched STANDARD control.
              if (quality === 'low' || frame === 150) await page.screenshot({ path: path.join(directory, `${String(frame).padStart(4, '0')}.png`) });
            }
            const events = frames.flatMap(frame => frame.newEvents);
            if (!events.some(event => event.kind === 'player-hit' && event.rallyScore === 4000) || !events.some(event => event.kind === 'smash-warning') || !events.some(event => event.kind === 'table-bounce')) throw Error('Replay omitted required real arrival/warning/bounce events');
            const metadata = { engine, side, quality, browser: browser.version(), width: 1280, height: 720, fps: 62.5, seconds: 6, frames: 375,
              physicalDevice: false, performanceMeasurement: false, explicitTestClockMs: 16, source: 'Actual production physics/autoplay and emitted events; native CSS screenshot, no resampling or fabricated warning.',
              initialHashes, finalHashes: files(root), errors, blocked, records: frames };
            metadata.sourceStable = JSON.stringify(metadata.initialHashes) === JSON.stringify(metadata.finalHashes);
            writeFileSync(path.join(directory, 'capture.json.gz'), gzipSync(JSON.stringify(metadata)));
            summaries.push({ engine, side, quality, frames: frames.length, finalScore: frames.at(-1).snapshot.score, sourceStable: metadata.sourceStable, errors, blocked });
            writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summaries, null, 2));
            if (!metadata.sourceStable || errors.length || blocked.length) throw Error('Native capture provenance/error check failed');
            console.log(engine, side, quality, '375 real-physics frames recorded');
          } finally { await context.close(); }
        }
      } finally { await server.close(); }
    }
  } finally { await browser.close(); }
}
