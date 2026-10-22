// Supplemental diagnostic of the cold-scene stall, using unchanged source 1e13fd4.
// Run against `npm run dev -- --host 127.0.0.1 --port 4178 --strictPort`.
import { chromium, webkit, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
for (const [name, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch({ headless: true, args: name === 'chromium' ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] : [] });
  try {
    const context = await browser.newContext(name === 'webkit' ? devices['iPhone 13'] : { viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4178/tests/fixtures/stage3.html');
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await page.evaluate(() => { window.stage3.show(450); window.stage3.autoPlay(true); });
    await page.waitForTimeout(1000);
    const cold = await page.evaluate(() => ({ snapshot: window.stage3.snapshot(), resources: window.stage3.resources() }));
    if (cold.snapshot.phase === 'running') await page.getByRole('button', { name: '一時停止', exact: true }).click();
    await page.getByRole('button', { name: 'つづける', exact: true }).click();
    const result = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now(), before = window.stage3.snapshot(), initialSmashes = window.stage3.metrics().smashDepartures;
      let previous = start; const intervals = [];
      function frame(now) {
        intervals.push(now - previous); previous = now;
        if (now - start < 60_000) { requestAnimationFrame(frame); return; }
        const final = window.stage3.snapshot(), sorted = [...intervals].sort((a, b) => a - b);
        resolve({ durationMs: now - start, frames: intervals.length, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], fractionAtMost25ms: intervals.filter(n => n <= 25).length / intervals.length,
          simulationSeconds: final.simTime - before.simTime, finalPhase: final.phase, pauseReason: final.pauseReason,
          remaining: final.balls.filter(ball => ball.phase !== 'lost').length, score: final.score, smashHits: window.stage3.metrics().smashDepartures - initialSmashes,
          resources: window.stage3.resources(), intervals });
      }
      requestAnimationFrame(frame);
    }));
    const record = { sourceCommit: '1e13fd4281721a2b843967a3b69b5801088da26e', browser: name, method: 'max-state injection, 1s scene/shader warmup, explicit manual resume, then 60s real frames; no automatic resume during measurement', cold, result, errors, targetHardwareVerdict: '未確認' };
    writeFileSync(`docs/verification/stage3/media/${name}/warm-performance-60s.json`, JSON.stringify(record, null, 2) + '\n');
    console.log(name, JSON.stringify({ coldPhase: cold.snapshot.phase, coldReason: cold.snapshot.pauseReason, ...result, intervals: undefined, errors }));
  } finally { await browser.close(); }
}
