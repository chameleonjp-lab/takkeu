# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smash.spec.ts >> 450の予告はミュート・390・420・落球後4球・停止中でも見え、球を暴露しない
- Location: tests/browser/smash.spec.ts:5:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- main [ref=e1]:
  - generic [ref=e2]:
    - generic "卓球ゲームの描画領域" [active] [ref=e5]
    - generic:
      - generic:
        - generic: RALLY
        - status "ラリー数": "450"
      - generic:
        - generic: 残球数
        - status "残球数": "4"
      - status: スマッシュがくる！
    - generic:
      - generic:
        - status: プレイ中。残球数4。
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test.use({ video: 'on' });
  4  | 
  5  | test('450の予告はミュート・390・420・落球後4球・停止中でも見え、球を暴露しない', async ({ page }, info) => {
  6  |   await page.goto('/tests/fixtures/stage2.html');
  7  |   await page.waitForFunction(() => !!window.stage2);
  8  |   await page.evaluate(() => window.stage2.beginSmash(449));
  9  |   expect(await page.evaluate(() => window.stage2.snapshot().scheduledReturns.find(p => p.ballId === 1)!.smash)).toBe(false);
  10 |   await page.evaluate(() => window.stage2.beginSmash(450));
  11 |   const plan = await page.evaluate(() => window.stage2.snapshot().scheduledReturns.find(p => p.ballId === 1)!);
  12 |   expect(plan.smash).toBe(true);
  13 |   await page.keyboard.press('Escape');
  14 |   await page.getByRole('button', { name: '音：オン', exact: true }).click();
  15 |   await page.getByRole('button', { name: 'つづける', exact: true }).click();
  16 |   expect(await page.evaluate(() => window.stage2.muted())).toBe(true);
  17 |   const warning = page.locator('[data-smash-warning]');
  18 |   await expect(warning).toBeVisible();
  19 |   await expect(page.getByLabel('残球数')).toContainText('4');
  20 |   expect(await page.evaluate(() => window.stage2.pose().preparing)).toBe(true);
  21 |   expect(await page.evaluate(() => Object.values(window.stage2.presentation().balls).every(b => !b.visible))).toBe(true);
  22 |   await page.screenshot({ path: info.outputPath('smash-warning-muted.png') });
  23 |   const beforePulse = await warning.screenshot();
  24 |   await page.evaluate(() => window.stage2.advance(0.15));
> 25 |   expect(beforePulse.equals(await warning.screenshot())).toBe(true);
     |                                                          ^ Error: expect(received).toBe(expected) // Object.is equality
  26 |   await page.keyboard.press('Escape');
  27 |   const paused = await page.evaluate(() => window.stage2.snapshot());
  28 |   await page.evaluate(() => window.stage2.advance(2));
  29 |   expect(await page.evaluate(() => window.stage2.snapshot())).toEqual(paused);
  30 |   await page.screenshot({ path: info.outputPath('smash-warning-paused.png') });
  31 |   await page.getByRole('button', { name: 'つづける', exact: true }).click();
  32 |   await page.evaluate(() => window.stage2.animate(0.3));
  33 |   await page.screenshot({ path: info.outputPath('smash-departure-hidden.png') });
  34 |   await page.evaluate(() => window.stage2.animate(0.65));
  35 |   await page.screenshot({ path: info.outputPath('smash-own-side.png') });
  36 |   await page.evaluate(() => window.stage2.animate(1.3));
  37 |   await expect(warning).toBeHidden();
  38 |   const events = await page.evaluate(() => window.stage2.events());
  39 |   expect(events.filter(e => e.kind === 'smash-warning' && e.ballId === 1)).toHaveLength(1);
  40 |   expect(events.filter(e => e.kind === 'opponent-hit' && e.ballId === 1)).toHaveLength(1);
  41 |   expect(await page.evaluate(() => window.stage2.snapshot().phase)).toBe('running');
  42 |   await info.attach('smash-state.json', { body: JSON.stringify({ plan, events }, null, 2), contentType: 'application/json' });
  43 | });
  44 | 
  45 | test('予告音を実際のWeb Audioで合成して保存する', async ({ page }, info) => {
  46 |   await page.goto('/');
  47 |   const signal = await page.evaluate(async () => {
  48 |     const url = '/src/audio/tones.ts';
  49 |     const { playSmashWarning } = await import(/* @vite-ignore */ url);
  50 |     const context = new OfflineAudioContext(1, 8820, 44100);
  51 |     playSmashWarning(context, context.destination);
  52 |     return Array.from((await context.startRendering()).getChannelData(0));
  53 |   });
  54 |   expect(Math.sqrt(signal.reduce((sum, value) => sum + value * value, 0) / signal.length)).toBeGreaterThan(0.01);
  55 |   const wav = Buffer.alloc(44 + signal.length * 2);
  56 |   wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  57 |   wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  58 |   wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  59 |   wav.write('data', 36); wav.writeUInt32LE(signal.length * 2, 40);
  60 |   signal.forEach((value, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  61 |   await info.attach('smash-warning.wav', { body: wav, contentType: 'audio/wav' });
  62 | });
  63 | 
```