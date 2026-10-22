// Supplementary diagnosis only: one warm-up phase, then no resuming while timed.
import assert from 'node:assert/strict';
import { chromium, webkit, devices } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
const dir = 'docs/verification/rally-revision';
const formal = JSON.parse(readFileSync(`${dir}/final-verification.json`, 'utf8'));
assert.equal(formal.result, 'passed');
const assertSources = () => { for (const [path, expected] of Object.entries(formal.sourceSha256)) assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), expected, path); };
assertSources();
const checkedOutCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const fd = openSync(`${dir}/warm-server.log`, 'w');
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4181', '--strictPort'], { detached: true, stdio: ['ignore', fd, fd] });
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://127.0.0.1:4181')).ok) break; } catch { /* startup */ }
    if (i === 99) throw new Error('Diagnostic server did not start');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  for (const [engine, launcher, device] of [['chromium', chromium, 'Desktop Chrome'], ['webkit', webkit, 'iPhone 13']]) {
    const startedAt = new Date().toISOString(), browser = await launcher.launch(engine === 'chromium' ? { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } : {});
    try {
      const { defaultBrowserType: _, ...profile } = devices[device];
      const page = await browser.newPage(profile), errors = [], warmPauses = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:4181/tests/fixtures/stage3.html');
      await page.getByRole('button', { name: 'はじめる', exact: true }).click();
      await page.evaluate(() => { window.stage3.show(390); window.stage3.autoPlay(true); });
      const deadline = Date.now() + 15_000;
      let warmed = false;
      while (Date.now() < deadline && warmPauses.length < 12) {
        await page.waitForTimeout(150);
        const s = await page.evaluate(() => window.stage3.snapshot());
        if (s.simTime >= 3) { warmed = true; break; }
        if (s.phase === 'paused') {
          warmPauses.push({ time: s.simTime, reason: s.pauseReason });
          await page.getByRole('button', { name: 'つづける', exact: true }).click();
        }
      }
      let result;
      if (warmed) {
        await page.evaluate(() => window.stage3.show(450));
        await page.waitForTimeout(200);
        const phase = await page.evaluate(() => window.stage3.snapshot().phase);
        if (phase === 'running') await page.getByRole('button', { name: '一時停止', exact: true }).click();
        await page.getByRole('button', { name: 'つづける', exact: true }).click();
        // From here on, an interruption ends the measurement. Never auto-resume it.
        result = await page.evaluate(() => new Promise(resolve => {
          const first = window.stage3.snapshot(), initialResources = window.stage3.resources();
          const initialEvents = window.stage3.metrics().events.length, initialSmashes = window.stage3.metrics().smashDepartures;
          const start = performance.now(), intervals = [], samples = [];
          let previous = start, sampled = -1;
          const frame = now => {
            intervals.push(now - previous); previous = now;
            const state = window.stage3.snapshot(), elapsed = now - start;
            if (Math.floor(elapsed / 1000) > sampled) { sampled = Math.floor(elapsed / 1000); samples.push({ elapsed, state, resources: window.stage3.resources() }); }
            if (state.phase === 'running' && elapsed < 60_000) { requestAnimationFrame(frame); return; }
            const sorted = [...intervals].sort((a, b) => a - b);
            resolve({ durationMs: elapsed, frames: intervals.length, intervals, samples,
              p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], fractionAtMost25ms: intervals.filter(n => n <= 25).length / intervals.length,
              runningSimulationSeconds: state.simTime - first.simTime, first, final: state, initialResources, finalResources: window.stage3.resources(),
              opponentHits: window.stage3.metrics().events.slice(initialEvents).filter(e => e.kind === 'opponent-hit').length,
              smashHits: window.stage3.metrics().smashDepartures - initialSmashes });
          };
          requestAnimationFrame(frame);
        }));
      }
      const verdict = warmed && result?.final.phase === 'running' && result.runningSimulationSeconds >= 59 && result.smashHits > 0 && result.opponentHits > 0 && result.fractionAtMost25ms >= .95 ? '成功（この準備済みLinux条件のみ）' : '失敗（この準備済みLinux条件）';
      const record = { productCommit: formal.commit, checkedOutCommit, sourceHashesMatchFormal: true, engine, browserVersion: browser.version(), profile: device,
        environment: 'Debian 13 Playwright / software WebGL, not iPhone hardware', startedAt, endedAt: new Date().toISOString(),
        conditions: '390で3ゲーム秒の描画準備後450へ変更。準備中だけ手動再開。450の計測中は一度も再開せず、中断で終了。速度・解像度・停止閾値は変更しない。',
        warmed, warmPauses, errors, verdict, hardwareVerdict: '未確認', result };
      writeFileSync(`${dir}/data/warm-${engine}.json`, JSON.stringify(record, null, 2) + '\n');
      await page.screenshot({ path: `${dir}/screenshots/warm-${engine}.png` });
      console.log(JSON.stringify({ engine, warmed, warmPauses, verdict, durationMs: result?.durationMs, simSeconds: result?.runningSimulationSeconds, score: result?.final.score, phase: result?.final.phase, reason: result?.final.pauseReason, errors }));
    } finally { await browser.close(); }
  }
  assertSources();
} finally {
  try { process.kill(-server.pid, 'SIGTERM'); } catch { /* ended */ }
  closeSync(fd);
}
