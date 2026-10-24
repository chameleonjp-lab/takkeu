# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smash.spec.ts >> 予告音を実際のWeb Audioで合成して保存する
- Location: tests/browser/smash.spec.ts:60:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0.01
Received:   0.009881948881516424
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [aria-hidden] [ref=e6]: t.
      - generic [ref=e7]: TAKKEU
      - generic [ref=e8]: 卓球の、その先へ。
    - generic [ref=e10]:
      - paragraph [ref=e11]: ONE BALL. ENDLESS RALLY.
      - heading "タッケウ" [level=1] [ref=e13]: タッケウ.
      - paragraph [ref=e14]: ワンバウンドをとらえて、ラリーをつなぐ。
      - paragraph [ref=e15]: タップした位置にラケットを置き、ドラッグで球に合わせる。自分の台で一度弾んだ球に触れれば、打ち返せます。
      - generic [ref=e16]:
        - generic [ref=e17]: ランキングの名前 任意
        - textbox "ランキングの名前 任意" [ref=e18]:
          - /placeholder: 名前なしでも遊べます
        - paragraph [ref=e19]: 20文字以内。入力すると名前と記録が公開され、カメレオンの実験場のランキングに参加します。同じ名前の記録は合算されます。名前なしのプレイも回数だけ記録します。
      - button "はじめる" [active] [ref=e20] [cursor=pointer]:
        - text: はじめる
        - generic [aria-hidden] [ref=e21]: ↗
      - paragraph [ref=e22]: 2本指で短くタップ、またはEscキーで一時停止
    - generic "遊び方" [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e26]: "01"
        - paragraph [ref=e27]:
          - strong [ref=e28]: タップで置く
          - generic [ref=e29]: 指やポインターの位置へ直接移動。
      - generic [ref=e30]:
        - generic [ref=e31]: "02"
        - paragraph [ref=e32]:
          - strong [ref=e33]: ドラッグで動かす
          - generic [ref=e34]: 押している間は、その位置について動きます。
      - generic [ref=e35]:
        - generic [ref=e36]: "03"
        - paragraph [ref=e37]:
          - strong [ref=e38]: 離すと止まる
          - generic [ref=e39]: 最後の位置を保ち、自分の返球で +1。
    - generic [ref=e40]:
      - paragraph [ref=e41]:
        - text: 自己ベスト
        - status "自己ベスト" [ref=e42]: "0"
        - text: ラリー
      - link "Xでシェア" [ref=e43] [cursor=pointer]:
        - /url: https://twitter.com/intent/tweet?text=%E3%82%BF%E3%83%83%E3%83%97%EF%BC%86%E3%83%89%E3%83%A9%E3%83%83%E3%82%B0%E3%81%A7%E9%81%8A%E3%81%B9%E3%82%8B%E5%8D%93%E7%90%83%E3%82%B2%E3%83%BC%E3%83%A0%E3%80%8C%E3%82%BF%E3%83%83%E3%82%B1%E3%82%A6%E3%80%8D%EF%BC%81%0A%E4%BD%95%E3%83%A9%E3%83%AA%E3%83%BC%E3%81%A4%E3%81%AA%E3%81%92%E3%82%89%E3%82%8C%E3%82%8B%EF%BC%9F+%23%E3%82%BF%E3%83%83%E3%82%B1%E3%82%A6&url=https%3A%2F%2Fchameleonjp-lab.github.io%2Ftakkeu%2F
      - link "カメレオンの実験場" [ref=e44] [cursor=pointer]:
        - /url: https://chameleonjp-lab.github.io/chameleonjp_lab/
      - button "設定" [ref=e45] [cursor=pointer]
    - status [ref=e46]: ホーム
```

# Test source

```ts
  1  | import { expect, test } from '../helpers/browserTest';
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
  23 |   // The rounded overlay's transparent corners now expose the animated court.
  24 |   // Compare its opaque content, while preserving the static-warning requirement.
  25 |   const box = (await warning.boundingBox())!;
  26 |   const appearance = () => warning.evaluate(e => {
  27 |     const s = getComputedStyle(e);
  28 |     return { background: s.backgroundColor, color: s.color, opacity: s.opacity, border: s.borderColor, animation: s.animationName, radius: s.borderRadius };
  29 |   });
  30 |   const styles = await appearance(), inset = Math.ceil(Number.parseFloat(styles.radius));
  31 |   const clip = { x: Math.ceil(box.x + inset), y: Math.ceil(box.y + inset),
  32 |     width: Math.floor(box.x + box.width - inset) - Math.ceil(box.x + inset),
  33 |     height: Math.floor(box.y + box.height - inset) - Math.ceil(box.y + inset) };
  34 |   await info.attach('warning-full-before.png', { body: await warning.screenshot(), contentType: 'image/png' });
  35 |   const beforePulse = await page.screenshot({ clip });
  36 |   await page.evaluate(() => window.stage2.advance(0.15));
  37 |   await info.attach('warning-full-after.png', { body: await warning.screenshot(), contentType: 'image/png' });
  38 |   expect(await appearance()).toEqual(styles);
  39 |   expect(await warning.boundingBox()).toEqual(box);
  40 |   expect(beforePulse.equals(await page.screenshot({ clip }))).toBe(true);
  41 |   await page.keyboard.press('Escape');
  42 |   const paused = await page.evaluate(() => window.stage2.snapshot());
  43 |   await page.evaluate(() => window.stage2.advance(2));
  44 |   expect(await page.evaluate(() => window.stage2.snapshot())).toEqual(paused);
  45 |   await page.screenshot({ path: info.outputPath('smash-warning-paused.png') });
  46 |   await page.getByRole('button', { name: 'つづける', exact: true }).click();
  47 |   await page.evaluate(() => window.stage2.animate(0.3));
  48 |   await page.screenshot({ path: info.outputPath('smash-departure-hidden.png') });
  49 |   await page.evaluate(() => window.stage2.animate(0.65));
  50 |   await page.screenshot({ path: info.outputPath('smash-own-side.png') });
  51 |   await page.evaluate(() => window.stage2.animate(1.3));
  52 |   await expect(warning).toBeHidden();
  53 |   const events = await page.evaluate(() => window.stage2.events());
  54 |   expect(events.filter(e => e.kind === 'smash-warning' && e.ballId === 1)).toHaveLength(1);
  55 |   expect(events.filter(e => e.kind === 'opponent-hit' && e.ballId === 1)).toHaveLength(1);
  56 |   expect(await page.evaluate(() => window.stage2.snapshot().phase)).toBe('running');
  57 |   await info.attach('smash-state.json', { body: JSON.stringify({ plan, events }, null, 2), contentType: 'application/json' });
  58 | });
  59 | 
  60 | test('予告音を実際のWeb Audioで合成して保存する', async ({ page }, info) => {
  61 |   await page.goto('/');
  62 |   const signal = await page.evaluate(async () => {
  63 |     const url = '/src/audio/tones.ts';
  64 |     const { playSmashWarning } = await import(/* @vite-ignore */ url);
  65 |     const context = new OfflineAudioContext(1, 8820, 44100);
  66 |     playSmashWarning(context, context.destination);
  67 |     return Array.from((await context.startRendering()).getChannelData(0));
  68 |   });
> 69 |   expect(Math.sqrt(signal.reduce((sum, value) => sum + value * value, 0) / signal.length)).toBeGreaterThan(0.01);
     |                                                                                            ^ Error: expect(received).toBeGreaterThan(expected)
  70 |   const wav = Buffer.alloc(44 + signal.length * 2);
  71 |   wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  72 |   wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  73 |   wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  74 |   wav.write('data', 36); wav.writeUInt32LE(signal.length * 2, 40);
  75 |   signal.forEach((value, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  76 |   await info.attach('smash-warning.wav', { body: wav, contentType: 'audio/wav' });
  77 | });
  78 | 
```