import { writeFile } from 'node:fs/promises';
import type { TestInfo } from '@playwright/test';
import { expect, test } from '../helpers/browserTest';
import type {} from '../helpers/remainingHarness';
import type {} from '../helpers/appHarness';

test.use({ viewport: { width: 390, height: 844 } });

async function attachJson(info: TestInfo, name: string, value: unknown): Promise<void> {
  const path = info.outputPath(name);
  await writeFile(path, JSON.stringify(value, null, 2));
  await info.attach(name, { path, contentType: 'application/json' });
}

test('iPhone縦画面で100以降の相手球を待機中も表示し失球だけ隠す', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/fixtures/remaining-ball.html'); await page.waitForFunction(() => !!window.remaining);
  for (const score of [70, 99, 100, 190, 240, 420, 490]) {
    await page.evaluate(score => window.remaining.show(score, 'absent'), score);
    // Read the GPU buffer; a DOM screenshot also includes the overlaid ball HUD.
    const absent = await page.evaluate(() => window.remaining.imageHash());
    for (const phase of ['queued', 'waiting-return', 'lost'] as const) {
      await page.evaluate(({ score, phase }) => window.remaining.show(score, phase), { score, phase });
      const visible = score >= 100 && phase !== 'lost';
      expect((await page.evaluate(() => window.remaining.imageHash())) !== absent, `${score}/${phase}`).toBe(visible);
      expect(await page.evaluate(() => window.remaining.presentation().balls[1]!.visible)).toBe(visible);
      if (phase === 'waiting-return') await page.screenshot({ path: info.outputPath(`iphone-${score}-waiting.png`) });
    }
    for (const x of [-0.45, 0.45]) {
      await page.evaluate(({ score, x }) => window.remaining.show(score, 'incoming', x), { score, x });
      const visible = score >= 100;
      expect((await page.evaluate(() => window.remaining.imageHash())) === absent, `${score}/x=${x}`).toBe(!visible);
      expect(await page.evaluate(() => window.remaining.presentation().balls[1]!.visible)).toBe(visible);
      await page.screenshot({ path: info.outputPath(`iphone-${score}-${x > 0 ? 'right' : 'left'}-incoming.png`) });
    }
  }
  for (const score of [190, 240, 490]) {
    await page.evaluate(score => window.remaining.begin(score), score);
    await page.screenshot({ path: info.outputPath(`iphone-${score}-outgoing.png`) });
    await page.evaluate(() => window.remaining.until('waiting'));
    const waiting = await page.evaluate(() => ({ s: window.remaining.snapshot(), p: window.remaining.presentation() }));
    expect(waiting.s.balls[0]!.phase).toBe('waiting-return'); expect(waiting.p.balls[1]!.visible).toBe(true);
    expect(waiting.s.balls).toHaveLength(2);
    await page.screenshot({ path: info.outputPath(`iphone-${score}-arrived-visible.png`) });
    await page.evaluate(() => window.remaining.until('departed'));
    expect(await page.evaluate(() => window.remaining.snapshot().balls[0]!.phase)).toBe('incoming');
    await page.screenshot({ path: info.outputPath(`iphone-${score}-opponent-hit.png`) });
    await page.evaluate(() => window.remaining.until('own'));
    expect(await page.evaluate(() => window.remaining.presentation().balls[1]!.visible)).toBe(true);
    await page.screenshot({ path: info.outputPath(`iphone-${score}-own-incoming.png`) });
    await attachJson(info, `transitions-${score}.json`, await page.evaluate(() => ({ snapshot: window.remaining.snapshot(), events: window.remaining.events() })));
  }
  expect(errors).toEqual([]);
});

test('実アプリで加速球の一時停止・手動再開・リトライを保つ', async ({ page }, info) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.evaluate(() => window.stage3.remaining(540, 1)); await page.clock.runFor(64);
  const before = await page.evaluate(() => window.stage3.snapshot());
  expect(before.balls[0]!.phase).toBe('incoming');
  expect(before.scheduledReturns[0]!.remainingBallMultiplier).toBe(1.2);
  await page.keyboard.press('Escape');
  const paused = await page.evaluate(() => window.stage3.snapshot());
  expect(paused.phase).toBe('paused'); await page.clock.runFor(1000);
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused);
  await page.screenshot({ path: info.outputPath('iphone-540-paused.png') });
  await page.getByRole('button', { name: 'つづける', exact: true }).click(); await page.clock.runFor(16);
  expect((await page.evaluate(() => window.stage3.snapshot())).scheduledReturns[0]).toEqual(before.scheduledReturns[0]);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '最初からやり直す', exact: true }).click();
  const retried = await page.evaluate(() => window.stage3.snapshot());
  expect(retried.score).toBe(0); expect(retried.balls).toHaveLength(1); expect(retried.runId).not.toBe(before.runId);
  const initial = retried.scheduledReturns[0]!;
  expect(initial.arriveAt - initial.departAt).toBe(2); expect(initial.remainingBallMultiplier).toBe(1);
  await page.screenshot({ path: info.outputPath('iphone-retry-initial.png') });
  await attachJson(info, 'pause-resume-retry.json', { before, paused, retried });
});

test('ブラウザの実シミュレーション飛行時間が境界・残球数・後半スマッシュの指定比になる', async ({ page }, info) => {
  await page.goto('/tests/fixtures/remaining-ball.html'); await page.waitForFunction(() => !!window.remaining);
  const rows = await page.evaluate(() => window.remaining.measure());
  for (const row of rows) {
    const baseline = rows.find(r => r.score === row.score && r.count === 5)!;
    const ratio = row.score >= 100 && row.count === 1 ? 1.2 : 1;
    expect(baseline.duration / row.duration).toBeCloseTo(ratio, 8);
    expect(baseline.visible / row.visible).toBeCloseTo(ratio, 8);
  }
  await attachJson(info, 'measured-flights.json', rows);
});
