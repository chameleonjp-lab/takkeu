import { expect, test } from '@playwright/test';
import type {} from '../helpers/appHarness';

for (const quality of ['standard', 'low'] as const) for(const startingScore of [450,555])test(`${quality}・${startingScore}からLinuxの実フレーム60秒を記録し、実機の性能判定とは分ける`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByLabel('描画品質', { exact: true }).selectOption(quality);
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.evaluate(score => { window.stage3.show(score); window.stage3.autoPlay(true); },startingScore);
  const result = await page.evaluate(quality => new Promise<object>(resolve => {
    let previous = performance.now(); const start = previous, intervals: number[] = [];
    const first = window.stage3.snapshot(), initialResources = window.stage3.resources();
    const frames: { wallMs: number; intervalMs: number; simTime: number; phase: string; pauseReason: string | null }[] = [];
    const runningIntervals: number[] = []; let previousPhase = first.phase;
    function frame(now: number) {
      const current = window.stage3.snapshot(), interval = now - previous;
      intervals.push(interval); previous = now;
      frames.push({ wallMs: now - start, intervalMs: interval, simTime: current.simTime, phase: current.phase, pauseReason: current.pauseReason });
      if (previousPhase === 'running' && current.phase === 'running') runningIntervals.push(interval);
      previousPhase = current.phase;
      if (now - start < 60_000) { requestAnimationFrame(frame); return; }
      const sorted = [...intervals].sort((a, b) => a - b), final = window.stage3.snapshot();
      resolve({ initialBalls: first.balls.length, initialScore: first.score, environment: 'Linux Playwright browser, not iPhone 17 Pro hardware', userAgent: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight, deviceRatio: devicePixelRatio },
        drawingSize:{width:document.querySelector('canvas')!.width,height:document.querySelector('canvas')!.height},quality,
        durationMs: now - start, frames: intervals.length, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
        fractionAtMost25ms: intervals.filter(n => n <= 25).length / intervals.length,
        runningSimulationSeconds: final.simTime - first.simTime, finalPhase: final.phase, pauseReason: final.pauseReason,
        remaining: final.balls.filter(b => b.phase !== 'lost').length, score: final.score,
        opponentHits: window.stage3.metrics().events.filter(e => e.kind === 'opponent-hit').length,
        smashHits: window.stage3.metrics().smashDepartures,
        initialResources, finalResources: window.stage3.resources(), intervals, samples: frames,
        runningIntervals, runningP95Ms: [...runningIntervals].sort((a,b)=>a-b)[Math.ceil(runningIntervals.length * .95) - 1] ?? null,
        runningFractionAtMost25ms: runningIntervals.length ? runningIntervals.filter(n=>n<=25).length/runningIntervals.length : null,
        continuousRun: frames.every(f=>f.phase==='running'),
        measurementVerdict: frames.every(f=>f.phase==='running') && runningIntervals.filter(n=>n<=25).length / runningIntervals.length >= .95 ? 'Linux reference target met; not device acceptance' : 'Linux reference target NOT met or continuous run interrupted',
        targetHardwareVerdict: '未確認' });
    }
    requestAnimationFrame(frame);
  }), quality);
  expect(errors).toEqual([]);
  await info.attach(`browser-performance-60s-${quality}-${startingScore}.json`, { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
});
