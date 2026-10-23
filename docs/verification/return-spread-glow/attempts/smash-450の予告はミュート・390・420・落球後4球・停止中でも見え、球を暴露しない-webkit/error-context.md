# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smash.spec.ts >> 450の予告はミュート・390・420・落球後4球・停止中でも見え、球を暴露しない
- Location: tests/browser/smash.spec.ts:5:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('[data-smash-warning]')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" locator('[data-smash-warning]') with timeout 5000ms
  - waiting for locator('[data-smash-warning]')
    14 × locator resolved to <p hidden="" role="status" class="smash-warning" data-smash-warning="">スマッシュがくる！</p>
       - unexpected value "hidden"

```

```yaml
- main:
  - link "タッケウ":
    - /url: "#"
  - button "音：オフ"
  - button "一時停止"
  - text: RALLY
  - status "ラリー数": "450"
  - text: 残球数
  - status "残球数": "4"
  - paragraph: ひとつずつ、 つないでいこう。
  - paragraph: ここからも操作できます 指を置いたまま、左右・上下へ
  - paragraph: ワンバウンドした球にラケットを合わせよう。
  - status: 残球数4。
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
  13 |   await page.getByRole('button', { name: '音：オン', exact: true }).click();
  14 |   expect(await page.evaluate(() => window.stage2.muted())).toBe(true);
  15 |   const warning = page.locator('[data-smash-warning]');
> 16 |   await expect(warning).toBeVisible();
     |                         ^ Error: expect(locator).toBeVisible() failed
  17 |   await expect(page.getByLabel('残球数')).toContainText('4');
  18 |   expect(await page.evaluate(() => window.stage2.pose().preparing)).toBe(true);
  19 |   expect(await page.evaluate(() => Object.values(window.stage2.presentation().balls).every(b => !b.visible))).toBe(true);
  20 |   await page.screenshot({ path: info.outputPath('smash-warning-muted.png') });
  21 |   const beforePulse = await warning.screenshot();
  22 |   await page.evaluate(() => window.stage2.advance(0.15));
  23 |   expect(beforePulse.equals(await warning.screenshot())).toBe(true);
  24 |   await page.getByRole('button', { name: '一時停止', exact: true }).click();
  25 |   const paused = await page.evaluate(() => window.stage2.snapshot());
  26 |   await page.evaluate(() => window.stage2.advance(2));
  27 |   expect(await page.evaluate(() => window.stage2.snapshot())).toEqual(paused);
  28 |   await page.screenshot({ path: info.outputPath('smash-warning-paused.png') });
  29 |   await page.getByRole('button', { name: 'つづける', exact: true }).click();
  30 |   await page.evaluate(() => window.stage2.animate(0.3));
  31 |   await page.screenshot({ path: info.outputPath('smash-departure-hidden.png') });
  32 |   await page.evaluate(() => window.stage2.animate(0.65));
  33 |   await page.screenshot({ path: info.outputPath('smash-own-side.png') });
  34 |   await page.evaluate(() => window.stage2.animate(1.3));
  35 |   await expect(warning).toBeHidden();
  36 |   const events = await page.evaluate(() => window.stage2.events());
  37 |   expect(events.filter(e => e.kind === 'smash-warning' && e.ballId === 1)).toHaveLength(1);
  38 |   expect(events.filter(e => e.kind === 'opponent-hit' && e.ballId === 1)).toHaveLength(1);
  39 |   expect(await page.evaluate(() => window.stage2.snapshot().phase)).toBe('running');
  40 |   await info.attach('smash-state.json', { body: JSON.stringify({ plan, events }, null, 2), contentType: 'application/json' });
  41 | });
  42 | 
  43 | test('予告音を実際のWeb Audioで合成して保存する', async ({ page }, info) => {
  44 |   await page.goto('/');
  45 |   const signal = await page.evaluate(async () => {
  46 |     const url = '/src/audio/tones.ts';
  47 |     const { playSmashWarning } = await import(/* @vite-ignore */ url);
  48 |     const context = new OfflineAudioContext(1, 8820, 44100);
  49 |     playSmashWarning(context, context.destination);
  50 |     return Array.from((await context.startRendering()).getChannelData(0));
  51 |   });
  52 |   expect(Math.sqrt(signal.reduce((sum, value) => sum + value * value, 0) / signal.length)).toBeGreaterThan(0.01);
  53 |   const wav = Buffer.alloc(44 + signal.length * 2);
  54 |   wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  55 |   wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  56 |   wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  57 |   wav.write('data', 36); wav.writeUInt32LE(signal.length * 2, 40);
  58 |   signal.forEach((value, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  59 |   await info.attach('smash-warning.wav', { body: wav, contentType: 'audio/wav' });
  60 | });
  61 | 
```