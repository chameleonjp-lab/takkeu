import { expect, test, waitForStart } from '../helpers/browserTest';

test.use({ video: 'on' });

test.describe('画面の証拠', () => {
  test('縦・横・PCのレイアウトと開始・停止・結果を画像・動画に残す', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const now = new Date('2026-10-22T12:00:00Z');
    await page.clock.install({ time: now });
    await page.clock.pauseAt(new Date(now.getTime() + 1000));
    await page.goto('/');
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await waitForStart(page);
    // Observe before the faster first bounce (1.44s), then deliberately miss it.
    await page.clock.runFor(1250);
    await page.screenshot({ path: testInfo.outputPath('playing.png') });
    await page.keyboard.press('Escape');
    await page.screenshot({ path: testInfo.outputPath('paused.png') });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.clock.runFor(32);
    await page.getByRole('button', { name: 'つづける', exact: true }).click();
    await page.clock.runFor(32);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('canvas')).toBeInViewport();
    await expect(page.locator('canvas')).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('landscape.png') });
    const surface = page.getByTestId('input-surface');
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + 100); await page.mouse.down();
    await page.mouse.move(box.x + box.width - 10, box.y + 20);
    await page.clock.runFor(300); await page.mouse.up();
    await page.clock.runFor(1500);
    await expect(page.locator('[data-finishing]')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('final-electricity.png') });
    await page.clock.runFor(1000);
    await expect(page.locator('[data-result] h2')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: true });
    await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test('実際のWeb Audioで自分用・相手用の異なる短音を合成できる', async ({ page }, testInfo) => {
  await page.goto('/');
  const signals = await page.evaluate(async () => {
    const moduleUrl = '/src/audio/tones.ts';
    const { playPlayerHit, playOpponentHit } = await import(/* @vite-ignore */ moduleUrl);
    const result: number[][] = [];
    for (const play of [playPlayerHit, playOpponentHit]) {
      const context = new OfflineAudioContext(1, 4410, 44100);
      play(context, context.destination);
      const buffer = await context.startRendering();
      result.push(Array.from(buffer.getChannelData(0)));
    }
    return result;
  });
  for (const signal of signals) expect(Math.sqrt(signal.reduce((sum, value) => sum + value * value, 0) / signal.length)).toBeGreaterThan(0.01);
  expect(signals[0]!.some((value, index) => Math.abs(value - signals[1]![index]!) > 0.1)).toBe(true);
  for (const [index, signal] of signals.entries()) {
    const wav = Buffer.alloc(44 + signal.length * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(signal.length * 2, 40);
    signal.forEach((value, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
    await testInfo.attach(index === 0 ? 'player-hit.wav' : 'opponent-hit.wav', { body: wav, contentType: 'audio/wav' });
  }
});
