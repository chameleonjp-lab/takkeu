import { expect, test } from '@playwright/test';
import type {} from '../helpers/appHarness';

test('Linuxの実フレーム60秒を記録し、実機の性能判定とは分ける', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.evaluate(() => { window.stage3.show(450); window.stage3.autoPlay(true); });
  const result = await page.evaluate(() => new Promise<object>(resolve => {
    let previous = performance.now(); const start = previous, intervals: number[] = [];
    const first = window.stage3.snapshot(), initialResources = window.stage3.resources();
    function frame(now: number) {
      intervals.push(now - previous); previous = now;
      if (now - start < 60_000) { requestAnimationFrame(frame); return; }
      const sorted = [...intervals].sort((a, b) => a - b), final = window.stage3.snapshot();
      resolve({ initialBalls: first.balls.length, initialScore: first.score, environment: 'Linux Playwright browser, not iPhone 17 Pro hardware', userAgent: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight, deviceRatio: devicePixelRatio },
        durationMs: now - start, frames: intervals.length, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
        fractionAtMost25ms: intervals.filter(n => n <= 25).length / intervals.length,
        runningSimulationSeconds: final.simTime - first.simTime, finalPhase: final.phase, pauseReason: final.pauseReason,
        remaining: final.balls.filter(b => b.phase !== 'lost').length, score: final.score,
        opponentHits: window.stage3.metrics().events.filter(e => e.kind === 'opponent-hit').length,
        smashHits: window.stage3.metrics().smashDepartures,
        initialResources, finalResources: window.stage3.resources(), intervals,
        targetHardwareVerdict: '未確認' });
    }
    requestAnimationFrame(frame);
  }));
  expect(errors).toEqual([]);
  await info.attach('browser-performance-60s.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
});
