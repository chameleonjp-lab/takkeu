import { chromium, webkit } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

// Run from the source checkout served by Vite. This records evidence and does not
// change the fixture, camera, game state, input mapping, or production source.
const options = Object.fromEntries(process.argv.slice(2).map(value => {
  const at = value.indexOf('=');
  return [value.slice(2, at), value.slice(at + 1)];
}));
const origin = options.url ?? 'http://127.0.0.1:4180';
const output = resolve(options.output ?? 'docs/verification/viewport-direct/baseline');
const source = resolve(options.source ?? process.cwd());
const engines = (options.engines ?? 'chromium,webkit').split(',');
const viewports = [[390, 844], [844, 390], [1280, 720], [320, 568], [280, 360]];
const states = [{ score: 0, time: 1.25 }, { score: 555, time: 1.25 }];
await mkdir(output, { recursive: true });
const manifest = {
  recordedAt: new Date().toISOString(), source, origin,
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(),
  sourceStatus: execFileSync('git', ['status', '--short'], { cwd: source, encoding: 'utf8' }).trim(),
  browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null,
  libraryPath: process.env.LD_LIBRARY_PATH ?? null,
  skipHostValidation: process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS ?? null,
  node: process.version, playwright: JSON.parse(await readFile(new URL('../../node_modules/@playwright/test/package.json', import.meta.url))).version,
  viewports, states, deviceScaleFactor: 1, records: [], failures: [],
  limitations: [
    'Desktop Linux browser engines at specified CSS viewports; no real iPhone or VoiceOver validation.',
    'Geometry projection is independent of input mapping. It uses the actual camera configuration and every unique rendered mesh vertex.',
    'Trajectory evidence samples 64 seeded incoming/outgoing plan pairs at 401 normalized times; it is not proof over every random plan.',
    'Canvas screenshot includes the complete CSS canvas. Viewport screenshot preserves the initial scroll position; full-page screenshot shows overflow.',
    'Static score/time screenshots and area estimates do not establish flashing safety.',
  ],
};
if (options.append === 'true') {
  const previous = JSON.parse(await readFile(resolve(output, 'manifest.json')));
  manifest.records = previous.records;
  manifest.failures = previous.failures;
}
for (const engine of engines) {
  let browser;
  try {
    browser = await ({ chromium, webkit }[engine]).launch(engine === 'chromium' ? { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } : {});
    for (const [width, height] of viewports) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'ja-JP', reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push({ kind: 'pageerror', message: error.message }));
      page.on('console', message => { if (message.type() === 'error') errors.push({ kind: 'console', message: message.text() }); });
      try {
        await page.goto(`${origin}/tests/fixtures/stage2.html`);
        await page.waitForFunction(() => !!window.stage2);
        for (const state of states) {
          const id = `${engine}-${width}x${height}-score${state.score}-t${state.time}`;
          console.log(`Capturing ${id}`);
          await page.evaluate(({ score, time }) => {
            window.stage2.show(score, time);
            window.scrollTo(0, 0);
          }, state);
          await page.evaluate(() => document.fonts.ready);
          const metrics = await page.evaluate(async () => {
            const [{ Vector3 }, { createCamera, fitCamera }, { DEFAULT_CONFIG, clampPaddle }, { VIEWPOINT, REFERENCE_ASPECT }, { createObjects }, { applyPresentation, isBallVisible }, { sampleReturn, deflectBounce }, { chooseOpponentTarget, choosePlayerTarget, randomUnit }] = await Promise.all([
              import('/node_modules/three/build/three.module.js'), import('/src/render/camera.ts'), import('/src/game/config.ts'), import('/src/game/viewpoint.ts'),
              import('/src/render/objects.ts'), import('/src/render/presentation.ts'), import('/src/game/trajectory.ts'), import('/src/game/targets.ts'),
            ]);
            const snapshot = window.stage2.snapshot();
            const canvas = document.querySelector('canvas');
            const rect = canvas.getBoundingClientRect();
            const wrap = document.querySelector('.canvas-wrap').getBoundingClientRect();
            const config = DEFAULT_CONFIG;
            const camera = createCamera(); fitCamera(camera, wrap.width, wrap.height, config); camera.updateMatrixWorld(true);
            const objects = createObjects(config); applyPresentation(objects, snapshot); objects.root.updateMatrixWorld(true);
            const project = point => {
              const ndc = new Vector3(point.x, point.y, point.z).project(camera);
              const x = (ndc.x + 1) * rect.width / 2, y = (1 - ndc.y) * rect.height / 2;
              return { x, y, viewportX: rect.left + x, viewportY: rect.top + y, ndcZ: ndc.z };
            };
            const bounds = points => {
              const xs = points.map(p => p.x), ys = points.map(p => p.y);
              const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
              const clipped = points.filter(p => p.x < -1e-6 || p.x > rect.width + 1e-6 || p.y < -1e-6 || p.y > rect.height + 1e-6 || p.ndcZ < -1 || p.ndcZ > 1);
              return { left, right, top, bottom, width: right - left, height: bottom - top,
                minimumCanvasMargin: Math.min(left, rect.width - right, top, rect.height - bottom), clippedVertexCount: clipped.length, vertexCount: points.length,
                minimumViewportMargin: Math.min(rect.left + left, innerWidth - rect.left - right, rect.top + top, innerHeight - rect.top - bottom),
                outsideViewport: rect.left + left < 0 || rect.left + right > innerWidth || rect.top + top < 0 || rect.top + bottom > innerHeight,
                clippedWitnesses: clipped.slice(0, 12) };
            };
            const uniqueVertices = mesh => {
              const position = mesh.geometry.attributes.position, seen = new Set(), result = [];
              for (let i = 0; i < position.count; i++) {
                const p = new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
                const key = `${p.x},${p.y},${p.z}`;
                if (!seen.has(key)) { seen.add(key); result.push({ x: p.x, y: p.y, z: p.z }); }
              }
              return result;
            };
            const names = ['wood', 'frontRubber', 'backRubber', 'handle', 'grip', 'rim'];
            const meshVertices = [];
            objects.playerPaddle.traverse(child => {
              if (!child.isMesh) return;
              const localVertices = uniqueVertices(child).map(p => ({ x: p.x - snapshot.paddle.x, y: p.y - snapshot.paddle.y, z: p.z - config.paddleZ }));
              meshVertices.push({ name: names[meshVertices.length], localVertices });
            });
            const paddleAt = (point, includeProjected = false) => {
              const meshes = meshVertices.map(mesh => {
                const projected = mesh.localVertices.map(p => project({ x: p.x + point.x, y: p.y + point.y, z: p.z + config.paddleZ }));
                return { name: mesh.name, bounds: bounds(projected), ...(includeProjected ? { projected } : {}) };
              });
              const vertices = meshVertices.flatMap(mesh => mesh.localVertices.map(p => project({ x: p.x + point.x, y: p.y + point.y, z: p.z + config.paddleZ })));
              return { point, center: project({ ...point, z: config.paddleZ }), bounds: bounds(vertices), meshes };
            };
            const boundary = [];
            for (let i = 0; i <= 100; i++) {
              const y = config.paddleMinY + (config.paddleMaxY - config.paddleMinY) * i / 100;
              boundary.push({ edge: 'left', ...paddleAt(clampPaddle({ x: -999, y }, config)) });
              boundary.push({ edge: 'right', ...paddleAt(clampPaddle({ x: 999, y }, config)) });
            }
            for (const y of [config.paddleMinY, config.paddleMaxY]) {
              const left = clampPaddle({ x: -999, y }, config), right = clampPaddle({ x: 999, y }, config);
              for (let i = 1; i < 100; i++) boundary.push({ edge: y === config.paddleMinY ? 'bottom' : 'top', ...paddleAt({ x: left.x + (right.x - left.x) * i / 100, y }) });
            }
            const corners = [-config.tableHalfWidth, config.tableHalfWidth].flatMap(x => [-config.tableHalfLength, config.tableHalfLength].map(z => ({ world: { x, y: config.tableY, z }, ...project({ x, y: config.tableY, z }) })));
            const front = corners.filter(p => p.world.z > 0), back = corners.filter(p => p.world.z < 0);
            const frontCenter = project({ x: 0, y: config.tableY, z: config.tableHalfLength });
            const backCenter = project({ x: 0, y: config.tableY, z: -config.tableHalfLength });
            const polygon = [corners[0], corners[2], corners[3], corners[1]];
            const tableArea = Math.abs(polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - p.y * q.x; }, 0)) / 2;
            const balls = snapshot.balls.map(ball => {
              const visual = objects.balls.get(ball.id);
              if (!visual?.root.visible) return { id: ball.id, phase: ball.phase, position: ball.position, visible: false };
              visual.root.updateMatrixWorld(true);
              const core = bounds(uniqueVertices(visual.core).map(project));
              const glow = visual.glow.visible ? bounds(uniqueVertices(visual.glow).map(project)) : null;
              return { id: ball.id, phase: ball.phase, position: ball.position, visible: true, center: project(ball.position), core, glow, displayed: glow ?? core };
            });
            const source = { randomState: 7, lastTargetBand: 1 };
            const firstVisual = objects.balls.values().next().value;
            const sphereOffsets = (firstVisual?.glow.visible ? firstVisual.glow : firstVisual?.core)?.geometry.attributes.position;
            const silhouette = [];
            if (sphereOffsets) for (let i = 0; i < sphereOffsets.count; i++) silhouette.push({ x: sphereOffsets.getX(i), y: sphereOffsets.getY(i), z: sphereOffsets.getZ(i) });
            const trajectories = [];
            for (let i = 0; i < 64; i++) {
              const opponent = chooseOpponentTarget(source, config), player = choosePlayerTarget(source, config, opponent);
              for (const direction of ['incoming', 'outgoing']) {
                const from = { ...(direction === 'incoming' ? opponent : player), z: direction === 'incoming' ? -config.paddleZ : config.paddleZ };
                let plan = { ballId: i + 1, departAt: 0, arriveAt: 1, netCrossAt: 0.5, target: direction === 'incoming' ? player : opponent,
                  smash: snapshot.score >= 450, warningAt: null, speedMultiplier: 1, landingZ: -from.z, bounceY: config.tableY + config.ballRadius };
                if (snapshot.score >= 555) plan = deflectBounce(plan, from, randomUnit(source), config);
                const visibleSamples = [];
                let centerClipped = 0, sphereClipped = 0, worstMargin = Infinity, worst = null;
                for (let n = 0; n <= 400; n++) {
                  const u = n / 400, position = sampleReturn(plan, from, u);
                  if (!isBallVisible({ id: plan.ballId, phase: direction, position, smash: plan.smash }, snapshot)) continue;
                  const center = project(position), centerOutside = center.x < 0 || center.x > rect.width || center.y < 0 || center.y > rect.height;
                  if (centerOutside) centerClipped++;
                  // Test the entire rendered sphere, not only its centre or an assumed radius in CSS pixels.
                  const sphere = bounds(silhouette.map(p => project({ x: position.x + p.x, y: position.y + p.y, z: position.z + p.z })));
                  if (sphere.minimumCanvasMargin < 0) sphereClipped++;
                  if (sphere.minimumCanvasMargin < worstMargin) { worstMargin = sphere.minimumCanvasMargin; worst = { u, position, center, sphere }; }
                  visibleSamples.push({ u, position, center, minimumSphereMargin: sphere.minimumCanvasMargin });
                }
                trajectories.push({ direction, from, plan, visibleSamples, centerClipped, sphereClipped, worstMargin, worst });
              }
            }
            const styles = ['.shell', '.game-screen', '.hud', '.game-header', '.play-frame', '.input-surface', '.canvas-wrap', '.input-pad'].map(selector => {
              const element = document.querySelector(selector);
              return { selector, rect: element?.getBoundingClientRect().toJSON() ?? null };
            });
            const result = {
              snapshot, config, viewpoint: VIEWPOINT, referenceAspect: REFERENCE_ASPECT,
              viewport: { width: innerWidth, height: innerHeight, devicePixelRatio, scrollX, scrollY, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
                visualViewport: visualViewport ? { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale, offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop } : null },
              canvas: { rect: rect.toJSON(), wrapperRect: wrap.toJSON(), drawingWidth: canvas.width, drawingHeight: canvas.height, cssArea: rect.width * rect.height,
                viewportOccupancy: rect.width * rect.height / (innerWidth * innerHeight), horizontalOccupancy: rect.width / innerWidth, verticalOccupancy: rect.height / innerHeight,
                visibleArea: Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) * Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) },
              camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), aspect: camera.aspect, fov: camera.fov, near: camera.near, far: camera.far,
                projectionMatrix: camera.projectionMatrix.toArray(), matrixWorld: camera.matrixWorld.toArray(), matrixWorldInverse: camera.matrixWorldInverse.toArray() },
              table: { corners, bounds: bounds(corners), frontWidth: Math.abs(front[1].x - front[0].x), backWidth: Math.abs(back[1].x - back[0].x),
                screenDepth: frontCenter.y - backCenter.y, centerlineLength: Math.hypot(frontCenter.x - backCenter.x, frontCenter.y - backCenter.y), area: tableArea },
              paddle: { meshGeometry: meshVertices, initial: paddleAt(snapshot.paddle, true),
                boundarySampling: '101 y-levels at each clamped horizontal edge and 99 interior points on each top/bottom edge; all unique face, wood, handle, grip and rim vertices at every point',
                boundary, minimumBoundaryMargin: Math.min(...boundary.map(p => p.bounds.minimumCanvasMargin)), clippedBoundaryPlacements: boundary.filter(p => p.bounds.clippedVertexCount > 0).length },
              balls, trajectorySphereMesh: firstVisual?.glow.visible ? 'glow SphereGeometry(24,16)' : 'core SphereGeometry(20,12)', trajectories, trajectorySummary: { paths: trajectories.length, visibleSamples: trajectories.reduce((sum, path) => sum + path.visibleSamples.length, 0),
                centerClippedSamples: trajectories.reduce((sum, path) => sum + path.centerClipped, 0), sphereClippedSamples: trajectories.reduce((sum, path) => sum + path.sphereClipped, 0),
                minimumSphereMargin: Math.min(...trajectories.map(path => path.worstMargin)) },
              layout: styles, resources: window.stage2.resources(),
            };
            objects.dispose();
            return result;
          });
          await page.screenshot({ path: resolve(output, `${id}-viewport.png`) });
          await page.screenshot({ path: resolve(output, `${id}-fullpage.png`), fullPage: true });
          await page.locator('canvas').screenshot({ path: resolve(output, `${id}-canvas.png`) });
          const record = { id, engine, browserVersion: browser.version(), errors: [...errors], ...metrics };
          await writeFile(resolve(output, `${id}.json.gz`), gzipSync(JSON.stringify(record)));
          manifest.records.push({ id, engine, viewport: { width, height }, state, json: `${id}.json.gz`, errors: [...errors],
            canvasOccupancy: metrics.canvas.viewportOccupancy, tableFrontWidth: metrics.table.frontWidth, tableDepth: metrics.table.screenDepth,
            paddleFace: metrics.paddle.initial.meshes.find(mesh => mesh.name === 'frontRubber').bounds,
            ball: metrics.balls.find(ball => ball.visible)?.displayed,
            tableCornerMinimumMargin: metrics.table.bounds.minimumCanvasMargin, paddleBoundaryMinimumMargin: metrics.paddle.minimumBoundaryMargin,
            trajectorySummary: metrics.trajectorySummary });
          await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
        }
      } catch (error) {
        manifest.failures.push({ engine, viewport: { width, height }, message: error.stack ?? String(error), pageErrors: errors });
        console.error(error);
      } finally { await context.close(); }
    }
  } catch (error) {
    manifest.failures.push({ engine, message: error.stack ?? String(error) }); console.error(error);
  } finally { await browser?.close(); }
}
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ output, captured: manifest.records.length, failures: manifest.failures.length }));
if (manifest.failures.length) process.exitCode = 1;
