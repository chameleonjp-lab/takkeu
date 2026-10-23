import { expect, test } from '@playwright/test';
import { ballCountAtScore } from '../../src/game/milestones';
import type {} from '../helpers/appHarness';
import type { GameSnapshot } from '../../src/game/types';

// Functional load/UI checks retain traces, screenshots and state attachments.
// Native input videos are recorded in contact/direct-input/basic-play instead.
// Avoid encoding every software-GPU frame here: a full-canvas 30s run completed
// all assertions but exhausted the unchanged 180s limit during artifact teardown.
// CI traces showed full-viewport software-GPU readbacks exhausting the budget.
// Keep API/DOM/source traces and explicit milestone screenshots; omit only the
// continuous trace screencast. Resolution, simulated duration and limits stay put.
test.use({ video: 'off', trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true } });

test('開始から実際に返球して5・10・20の増球を通過し、21ラリーへ進む', async ({ page }, info) => {
  // Full-viewport SwiftShader has ~3.7x the old PC pixel workload. CI traces
  // exceeded 180s in GPU readback; this is a functional completion budget,
  // not the unchanged 25ms/95% real-time performance acceptance criterion.
  test.setTimeout(360_000);
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  // Only input is automated: start the real session without replacing its score or balls.
  await page.evaluate(() => window.stage3.autoPlay(true));
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  const checkpoints = [{ score: 5, balls: 2 }, { score: 10, balls: 3 }, { score: 20, balls: 4 }];
  const reached: { threshold: number; state: GameSnapshot }[] = [];
  for (let i = 0; i < 480; i++) {
    await page.clock.runFor(250);
    const state = await page.evaluate(() => window.stage3.snapshot());
    expect(state.phase).toBe('running');
    const checkpoint = checkpoints[reached.length];
    if (checkpoint && state.score >= checkpoint.score) {
      expect(state.balls).toHaveLength(checkpoint.balls);
      expect(state.progression.awardedBallCount).toBe(checkpoint.balls - 1);
      await expect(page.getByLabel('残球数', { exact: true })).toContainText(String(checkpoint.balls));
      reached.push({ threshold: checkpoint.score, state });
      await page.screenshot({ path: info.outputPath(`cadence-${checkpoint.score}.png`) });
    }
    if (state.score >= 21) {
      await page.screenshot({ path: info.outputPath('cadence-after-020.png') });
      break;
    }
  }
  expect(reached.map(row => row.threshold)).toEqual([5, 10, 20]);
  const state = await page.evaluate(() => window.stage3.snapshot());
  expect(state.score).toBeGreaterThanOrEqual(21); expect(state.score).toBeLessThan(30);
  expect(state.balls).toHaveLength(4);
  const events = await page.evaluate(() => window.stage3.metrics().events);
  expect(events.filter(e => e.kind === 'milestone').map(e => e.milestone)).toEqual([5, 10, 20]);
  expect(events.filter(e => e.kind === 'ball-lost')).toEqual([]);
  await info.attach('cadence-play.json', { body: JSON.stringify({ reached, final: state, events }, null, 2), contentType: 'application/json' });
});

test('縦横・44pxボタン・200%文字・ラベル・安全余白を確認', async ({ page }, info) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  await expect(page.getByLabel('操作感度', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-settings]').getByLabel('効果音の音量', { exact: true })).toBeVisible();
  await expect(page.getByLabel('描画品質', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('home-text-200.png'), fullPage: true });
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: info.outputPath('paused-text-200.png'), fullPage: true });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(dialog.getByLabel('効果音の音量', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  await page.addStyleTag({ content: 'html { font-size: 100%; }' });
  for (const size of [{ width: 402, height: 874 }, { width: 874, height: 402 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size); await page.clock.runFor(32);
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await page.clock.runFor(32);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`game-${size.width}x${size.height}.png`) });
    await page.keyboard.press('Escape');
    for (const button of await page.getByRole('button').all()) {
      if (!await button.isVisible()) continue;
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(size.width - 12);
      await expect(button).toBeInViewport();
    }
    await dialog.getByLabel('効果音の音量', { exact: true }).scrollIntoViewIfNeeded();
    await expect(dialog.getByLabel('効果音の音量', { exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  }
  await info.attach('menu-accessibility.yml', { body: await page.locator('main').ariaSnapshot(), contentType: 'text/yaml' });
});

test('450の47球と以後の増球・スマッシュ・高速接触を30ゲーム秒維持する', async ({ page }, info) => {
  // Same 30 simulated seconds, rendering resolution and assertions. See the
  // viewport verification ledger for retained 180s CI failures and rationale.
  test.setTimeout(360_000);
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.evaluate(() => { window.stage3.show(450); window.stage3.autoPlay(true); });
  expect(await page.evaluate(() => window.stage3.snapshot().balls.length)).toBe(47);
  const samples = [];
  for (let i = 0; i < 30; i++) {
    await page.clock.runFor(1000);
    const row = await page.evaluate(() => ({ state: window.stage3.snapshot(), resources: window.stage3.resources() }));
    expect(row.state.phase).toBe('running'); expect(row.state.balls.filter(b => b.phase !== 'lost')).toHaveLength(ballCountAtScore(row.state.score));
    expect(row.resources!.drawCalls).toBeLessThan(160); samples.push(row);
  }
  expect(samples.at(-1)!.state.score).toBeGreaterThan(500);
  const servedIds = await page.evaluate(() => [...new Set(window.stage3.metrics().events.filter(e => e.kind === 'opponent-hit').map(e => e.ballId))]);
  for (let id = 1; id <= 47; id++) expect(servedIds).toContain(id);
  expect(await page.evaluate(() => window.stage3.metrics().smashDepartures)).toBeGreaterThan(0);
  await info.attach('growing-ball-load.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
});

test('WebGL初期化不可と復旧失敗でもホームと自己ベストを保つ', async ({ page }) => {
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: Parameters<typeof native>) {
      if (String(args[0]) === 'webgl2') return null;
      return native.apply(this, args);
    } as typeof native;
  });
  await page.goto('/'); await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('WebGL 2を利用できません');
  await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
  await expect(page.locator('[data-home]').getByLabel('自己ベスト', { exact: true })).toHaveText('0');
});
