import { expect, test, waitForStart } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';
import { installAudioProbe } from '../helpers/audioProbe';

// The same real app/session fixture is used before and after the effects change.
// No virtual clock, auto-resume, slow-frame override, or production score setter.
test.beforeEach(async ({ page }) => { await page.addInitScript(installAudioProbe); });

for (const quality of ['standard', 'low'] as const) for (const startingScore of [1500, 2000, 3000, 4000]) {
  for (const repeat of [1, 2]) test(`rally4000 ${quality} score${startingScore} repeat${repeat}`, async ({ context, page }, info) => {
    const errors: string[] = [], blockedRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:4176') await route.continue();
      else { blockedRequests.push(route.request().url()); await route.abort(); }
    });
    await page.goto('/tests/fixtures/stage3.html');
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByLabel('描画品質', { exact: true }).selectOption(quality);
    await page.getByRole('button', { name: '戻る', exact: true }).click();
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await waitForStart(page);
    await page.evaluate(score => { window.stage3.show(score); window.stage3.autoPlay(true); }, startingScore);
    const result = await page.evaluate(({ quality, repeat }) => new Promise<object>(resolve => {
      type Frame = { wallMs: number; intervalMs: number; simTime: number; phase: string; pauseReason: string | null;
        ballCount: number; activeBalls: number; score: number; resources: ReturnType<Window['stage3']['resources']>;
        audio: ReturnType<Window['audioResources']>; heapBytes: number | null };
      const heap = () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
      const first = window.stage3.snapshot(), initialResources = window.stage3.resources(), initialHeapBytes = heap();
      let previous = performance.now(), previousPhase = first.phase;
      const start = previous, samples: Frame[] = [], intervals: number[] = [], runningIntervals: number[] = [];
      const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1] ?? null;
      const fraction25 = (values: number[]) => values.length ? values.filter(n => n <= 25).length / values.length : null;
      function frame(now: number) {
        const snapshot = window.stage3.snapshot(), interval = now - previous;
        intervals.push(interval); previous = now;
        if (previousPhase === 'running' && snapshot.phase === 'running') runningIntervals.push(interval);
        previousPhase = snapshot.phase;
        samples.push({ wallMs: now - start, intervalMs: interval, simTime: snapshot.simTime, phase: snapshot.phase,
          pauseReason: snapshot.pauseReason, ballCount: snapshot.balls.length, activeBalls: snapshot.balls.filter(ball => ball.phase !== 'lost').length,
          score: snapshot.score, resources: window.stage3.resources(), audio: window.audioResources(), heapBytes: heap() });
        if (now - start < 60_000) { requestAnimationFrame(frame); return; }
        const final = window.stage3.snapshot(), continuousRun = first.phase === 'running' && samples.every(sample => sample.phase === 'running');
        const ratio = fraction25(runningIntervals), runningP95Ms = p95(runningIntervals);
        const targetMet = continuousRun && final.simTime - first.simTime >= 59 && ratio !== null && ratio >= .95 && runningP95Ms !== null && runningP95Ms <= 25;
        const maximumResources: Record<string, number> = {};
        for (const sample of samples) for (const [key, value] of Object.entries(sample.resources ?? {})) {
          if (typeof value === 'number') maximumResources[key] = Math.max(maximumResources[key] ?? 0, value);
        }
        resolve({ schema: 'rally-4000-real-loop-v1', environment: 'Linux Playwright browser; target hardware unverified',
          userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, deviceRatio: devicePixelRatio },
          drawingSize: { width: document.querySelector('canvas')!.width, height: document.querySelector('canvas')!.height },
          quality, repeat, initialScore: first.score, initialBalls: first.balls.length, durationMs: now - start,
          frames: samples.length, p95Ms: p95(intervals), fractionAtMost25ms: fraction25(intervals),
          runningP95Ms, runningFractionAtMost25ms: ratio, runningFrameCount: runningIntervals.length,
          runningSimulationSeconds: final.simTime - first.simTime, continuousRun, finalPhase: final.phase, pauseReason: final.pauseReason,
          finalScore: final.score, remainingBalls: final.balls.filter(ball => ball.phase !== 'lost').length,
          unexpectedPauses: samples.filter((sample, index) => sample.phase === 'paused' && samples[index - 1]?.phase !== 'paused')
            .map(sample => ({ wallMs: sample.wallMs, simTime: sample.simTime, pauseReason: sample.pauseReason })),
          initialResources, maximumResources, finalResources: window.stage3.resources(),
          initialHeapBytes, finalHeapBytes: heap(), peakHeapBytes: samples.reduce<number | null>((peak, sample) => sample.heapBytes === null ? peak : Math.max(peak ?? 0, sample.heapBytes), null),
          audioResources: window.audioResources(), opponentHits: window.stage3.metrics().events.filter(event => event.kind === 'opponent-hit').length,
          target: { p95MsAtMost: 25, fractionAtMost25msAtLeast: .95, continuousSimulationSecondsAtLeast: 59, initialBalls: 30 },
          executionStatus: 'measurement completed', linuxReferenceTarget: targetMet ? 'met' : 'NOT met', targetHardwareVerdict: 'unverified',
          intervals, runningIntervals, samples });
      }
      requestAnimationFrame(frame);
    }), { quality, repeat });
    await info.attach(`rally4000-${quality}-${startingScore}-repeat${repeat}.json`, {
      body: JSON.stringify({ ...result, errors, blockedRequests }, null, 2), contentType: 'application/json',
    });
    expect(errors).toEqual([]);
    expect(blockedRequests).toEqual([]);
    expect((result as { initialBalls: number }).initialBalls).toBe(30);
  });
}
