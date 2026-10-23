import { expect, test } from '@playwright/test';

test.use({ video: 'on' });

test('450の予告はミュート・390・420・落球後4球・停止中でも見え、球を暴露しない', async ({ page }, info) => {
  await page.goto('/tests/fixtures/stage2.html');
  await page.waitForFunction(() => !!window.stage2);
  await page.evaluate(() => window.stage2.beginSmash(449));
  expect(await page.evaluate(() => window.stage2.snapshot().scheduledReturns.find(p => p.ballId === 1)!.smash)).toBe(false);
  await page.evaluate(() => window.stage2.beginSmash(450));
  const plan = await page.evaluate(() => window.stage2.snapshot().scheduledReturns.find(p => p.ballId === 1)!);
  expect(plan.smash).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '音：オン', exact: true }).click();
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  expect(await page.evaluate(() => window.stage2.muted())).toBe(true);
  const warning = page.locator('[data-smash-warning]');
  await expect(warning).toBeVisible();
  await expect(page.getByLabel('残球数')).toContainText('4');
  expect(await page.evaluate(() => window.stage2.pose().preparing)).toBe(true);
  expect(await page.evaluate(() => Object.values(window.stage2.presentation().balls).every(b => !b.visible))).toBe(true);
  await page.screenshot({ path: info.outputPath('smash-warning-muted.png') });
  // The rounded overlay's transparent corners now expose the animated court.
  // Compare its opaque content, while preserving the static-warning requirement.
  const box = (await warning.boundingBox())!;
  const appearance = () => warning.evaluate(e => {
    const s = getComputedStyle(e);
    return { background: s.backgroundColor, color: s.color, opacity: s.opacity, border: s.borderColor, animation: s.animationName, radius: s.borderRadius };
  });
  const styles = await appearance(), inset = Math.ceil(Number.parseFloat(styles.radius));
  const clip = { x: Math.ceil(box.x + inset), y: Math.ceil(box.y + inset),
    width: Math.floor(box.x + box.width - inset) - Math.ceil(box.x + inset),
    height: Math.floor(box.y + box.height - inset) - Math.ceil(box.y + inset) };
  await info.attach('warning-full-before.png', { body: await warning.screenshot(), contentType: 'image/png' });
  const beforePulse = await page.screenshot({ clip });
  await page.evaluate(() => window.stage2.advance(0.15));
  await info.attach('warning-full-after.png', { body: await warning.screenshot(), contentType: 'image/png' });
  expect(await appearance()).toEqual(styles);
  expect(await warning.boundingBox()).toEqual(box);
  expect(beforePulse.equals(await page.screenshot({ clip }))).toBe(true);
  await page.keyboard.press('Escape');
  const paused = await page.evaluate(() => window.stage2.snapshot());
  await page.evaluate(() => window.stage2.advance(2));
  expect(await page.evaluate(() => window.stage2.snapshot())).toEqual(paused);
  await page.screenshot({ path: info.outputPath('smash-warning-paused.png') });
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await page.evaluate(() => window.stage2.animate(0.3));
  await page.screenshot({ path: info.outputPath('smash-departure-hidden.png') });
  await page.evaluate(() => window.stage2.animate(0.65));
  await page.screenshot({ path: info.outputPath('smash-own-side.png') });
  await page.evaluate(() => window.stage2.animate(1.3));
  await expect(warning).toBeHidden();
  const events = await page.evaluate(() => window.stage2.events());
  expect(events.filter(e => e.kind === 'smash-warning' && e.ballId === 1)).toHaveLength(1);
  expect(events.filter(e => e.kind === 'opponent-hit' && e.ballId === 1)).toHaveLength(1);
  expect(await page.evaluate(() => window.stage2.snapshot().phase)).toBe('running');
  await info.attach('smash-state.json', { body: JSON.stringify({ plan, events }, null, 2), contentType: 'application/json' });
});

test('予告音を実際のWeb Audioで合成して保存する', async ({ page }, info) => {
  await page.goto('/');
  const signal = await page.evaluate(async () => {
    const url = '/src/audio/tones.ts';
    const { playSmashWarning } = await import(/* @vite-ignore */ url);
    const context = new OfflineAudioContext(1, 8820, 44100);
    playSmashWarning(context, context.destination);
    return Array.from((await context.startRendering()).getChannelData(0));
  });
  expect(Math.sqrt(signal.reduce((sum, value) => sum + value * value, 0) / signal.length)).toBeGreaterThan(0.01);
  const wav = Buffer.alloc(44 + signal.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(signal.length * 2, 40);
  signal.forEach((value, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  await info.attach('smash-warning.wav', { body: wav, contentType: 'audio/wav' });
});
