import { expect, test } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';
import type { GameSnapshot } from '../../src/game/types';

// Functional load/UI checks retain traces, screenshots and state attachments.
// Native input videos are recorded in contact/direct-input/basic-play instead.
// An earlier full-canvas run completed its assertions but exhausted the original
// 180s limit during artifact teardown. Traces also show long screenshot/evaluate
// API waits; no internal GPU profile establishes their sole cause.
// Keep API/DOM/source traces and explicit milestone screenshots; omit only the
// continuous trace screencast. Resolution, simulated duration and assertions stay.
test.use({ video: 'off', trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true } });

test('開始から実際に返球して5・10・20の増球を通過し、21ラリーへ進む', async ({ page }, info) => {
  // Full viewport has ~3.7x the old PC pixel count. Repeated CI API/teardown waits
  // exceeded 180s. This 360s functional budget applies locally and in CI;
  // the separate 25ms/95% real-time performance criterion is unchanged.
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

test('450の30球と以後の同時返球・失球・増球・スマッシュを30ゲーム秒維持する', async ({ page }, info) => {
  // Same 30 simulated seconds, rendering resolution and assertions. See the
  // viewport verification ledger for retained 180s CI failures and rationale.
  test.setTimeout(360_000);
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.evaluate(() => { window.stage3.show(450); window.stage3.autoPlay(false); });
  expect(await page.evaluate(() => window.stage3.snapshot().balls.length)).toBe(30);
  for (let frame = 0; frame < 5; frame++) await page.clock.fastForward(100);
  const opening = await page.evaluate(() => ({ state: window.stage3.snapshot(), events: window.stage3.metrics().events }));
  const firstServes = opening.events.filter(e => e.kind === 'opponent-hit');
  expect(firstServes.map(e => e.ballId).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  expect(new Set(firstServes.map(e => e.time)).size).toBe(1);
  expect(firstServes.every(e => e.time <= 0.5)).toBe(true);
  expect(opening.state.balls.filter(b => b.phase === 'incoming' || b.phase === 'outgoing')).toHaveLength(30);
  const samples = [];
  const addedIds = new Set<number>();
  for (let i = 0; i < 30; i++) {
    // Functional load at 10Hz: all 120Hz physics steps run through createLoop.
    // This does not substitute for the separate native FPS/performance suite.
    for (let frame = 0; frame < (i === 0 ? 5 : 10); frame++) await page.clock.fastForward(100);
    const row = await page.evaluate(() => ({ state: window.stage3.snapshot(), events: window.stage3.metrics().events, resources: window.stage3.resources() }));
    for (const ball of row.state.balls) if (ball.id > 30) addedIds.add(ball.id);
    for (const event of row.events) if (event.ballId !== undefined && event.ballId > 30) addedIds.add(event.ballId);
    const losses = row.events.filter(e => e.kind === 'ball-lost').length;
    expect(row.state.phase).toBe('running');
    expect(row.state.balls.length).toBeLessThanOrEqual(30);
    expect(row.state.balls).toHaveLength(30 + addedIds.size - losses);
    expect(row.resources!.drawCalls).toBeLessThan(160); samples.push(row);
    // Keep the center paddle through the first wave to exercise real stock losses.
    if (i === 1) await page.evaluate(() => window.stage3.autoPlay(true));
  }
  expect(samples.at(-1)!.state.simTime).toBeGreaterThanOrEqual(29.9);
  expect(samples.at(-1)!.state.simTime).toBeLessThanOrEqual(30.1);
  expect(samples.at(-1)!.state.score).toBeGreaterThan(500);
  const events = await page.evaluate(() => window.stage3.metrics().events);
  expect(events.filter(e => e.kind === 'player-hit')).toHaveLength(samples.at(-1)!.state.score - 450);
  expect(events.filter(e => e.kind === 'ball-lost').length).toBeGreaterThan(0);
  expect(events.some(e => e.kind === 'smash-warning')).toBe(true);
  expect(addedIds.size).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.stage3.metrics().smashDepartures)).toBe(events.filter(e => e.kind === 'opponent-hit').length);
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
