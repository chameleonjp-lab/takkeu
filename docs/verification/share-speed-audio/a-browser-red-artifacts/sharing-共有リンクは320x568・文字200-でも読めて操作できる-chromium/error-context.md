# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sharing.spec.ts >> 共有リンクは320x568・文字200%でも読めて操作できる
- Location: tests/browser/sharing.spec.ts:117:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [aria-hidden] [ref=e5]: t.
    - paragraph [ref=e6]: RALLY COMPLETE
    - heading "ナイスラリー！" [level=2] [ref=e7]
    - paragraph [ref=e8]: 今回のラリー数
    - status "今回のラリー数" [ref=e9]: "1234567890"
    - button "もう一度" [active] [ref=e10] [cursor=pointer]:
      - text: もう一度
      - generic [aria-hidden] [ref=e11]: ↗
    - paragraph [ref=e12]:
      - text: 自己ベスト
      - status "自己ベスト" [ref=e13]: "1234567890"
      - text: ラリー
    - paragraph [ref=e14]: もう1ラリー、つないでみよう。
    - link "Xでスコアをシェア" [ref=e15] [cursor=pointer]:
      - /url: https://twitter.com/intent/tweet?text=%E3%82%BF%E3%83%83%E3%82%B1%E3%82%A6%E3%81%A71234567890%E3%83%A9%E3%83%AA%E3%83%BC%E9%81%94%E6%88%90%EF%BC%81%0A%E4%BD%95%E3%83%A9%E3%83%AA%E3%83%BC%E3%81%A4%E3%81%AA%E3%81%92%E3%82%89%E3%82%8C%E3%82%8B%EF%BC%9F+%23%E3%82%BF%E3%83%83%E3%82%B1%E3%82%A6&url=https%3A%2F%2Fchameleonjp-lab.github.io%2Ftakkeu%2F
      - text: Xでスコアをシェア
      - generic [aria-hidden] [ref=e16]: ↗
    - button "ホームへ" [ref=e17] [cursor=pointer]
    - status [ref=e18]: 終了。1234567890ラリー。残球数0。
    - region [ref=e19]:
      - paragraph [ref=e20]: LEADERBOARD
      - heading "ランキング TOP 30" [level=3] [ref=e21]
      - paragraph [ref=e22]: 最高ラリー数で競う、みんなの記録
      - status [ref=e23]: ランキングを読み込んでいます。
      - button "ランキングを更新" [ref=e24] [cursor=pointer]
      - link "実験場で詳しいランキングを見る ↗" [ref=e25] [cursor=pointer]:
        - /url: https://chameleonjp-lab.github.io/chameleonjp_lab/ranking.html?game=takkeu
```

# Test source

```ts
  37  |   await popup.close();
  38  | }
  39  | 
  40  | async function openHarness(page: Page, bestScore = 0) {
  41  |   await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  42  |   if (bestScore) await page.addInitScript(best => {
  43  |     if (location.hostname === '127.0.0.1') localStorage.setItem('takkeu.preferences.v1', JSON.stringify({ version: 1, bestScore: best, volume: 0.65, muted: false, sensitivity: 1, quality: 'low' }));
  44  |   }, bestScore);
  45  |   await page.goto('/tests/fixtures/stage3.html?ranking=remote');
  46  | }
  47  | 
  48  | async function finish(page: Page, score: number) {
  49  |   await page.evaluate(value => { window.stage3.show(value); window.stage3.finish(); }, score);
  50  |   await page.clock.runFor(16);
  51  |   await expect(page.locator('[data-result-score]')).toHaveText(String(score));
  52  | }
  53  | 
  54  | // The gameplay fixture creates a ball for every earned reward. Exercise huge
  55  | // share values through the production screens without allocating those balls.
  56  | async function renderLargeResult(page: Page, score: number) {
  57  |   await page.evaluate(async value => {
  58  |     const snapshot = window.stage3.snapshot();
  59  |     window.stage3.dispose();
  60  |     const screensUrl = '/src/ui/screens.ts', preferencesUrl = '/src/storage/preferences.ts';
  61  |     const [{ createScreens }, { DEFAULT_PREFERENCES }] = await Promise.all([import(screensUrl), import(preferencesUrl)]);
  62  |     const screens = createScreens(document.querySelector('#app')!, {
  63  |       start() {}, pause() {}, resume() {}, retry() {}, toggleSound() {}, volume() {},
  64  |       home() { screens.render({ ...snapshot, phase: 'ready', score: 0 }); },
  65  |     });
  66  |     screens.setPreferences({ ...DEFAULT_PREFERENCES, bestScore: value });
  67  |     screens.render({ ...snapshot, phase: 'gameover', score: value });
  68  |   }, score);
  69  | }
  70  | 
  71  | test('自己ベストなしのホームから通常リンクで正式URLと汎用文を開ける', async ({ page, context }) => {
  72  |   const intents = await blockX(context);
  73  |   await page.goto('/');
  74  |   const home = page.getByRole('link', { name: 'Xでシェア', exact: true });
  75  |   await expect(page.locator('.home-footer')).toContainText('Xでシェア');
  76  |   await page.getByRole('button', { name: 'はじめる', exact: true }).focus();
  77  |   await page.keyboard.press('Tab');
  78  |   await expect(home).toBeFocused();
  79  |   await activateIntent(page, home, genericText, true);
  80  |   await activateIntent(page, home, genericText);
  81  |   expect(intents).toHaveLength(2);
  82  | });
  83  | 
  84  | test('自己ベストと今回の結果を区別し、通信失敗・再挑戦・0点・大きな値・ホームでも共有値を保つ', async ({ page, context }) => {
  85  |   const intents = await blockX(context);
  86  |   await page.route('https://*.supabase.co/rest/v1/rpc/get_best_score_ranking', route => route.fulfill({ status: 503, json: { code: 'unavailable' } }));
  87  |   await openHarness(page, 200);
  88  |   const home = page.locator('[data-share-home-x]'), result = page.locator('[data-share-x]');
  89  |   const bestText = '卓球ゲーム「タッケウ」で自己ベスト200ラリー！\n何ラリーつなげられる？ #タッケウ';
  90  |   await activateIntent(page, home, bestText);
  91  |   await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  92  |   await expect(result).not.toHaveAttribute('href');
  93  |   await finish(page, 37);
  94  |   await expect(page.locator('[data-result] [data-best]')).toHaveText('200');
  95  |   await expect(page.locator('[data-ranking-message]')).toContainText('取得できません');
  96  |   await page.getByRole('button', { name: 'もう一度', exact: true }).focus();
  97  |   await page.keyboard.press('Tab');
  98  |   await expect(result).toBeFocused();
  99  |   await activateIntent(page, result, 'タッケウで37ラリー達成！\n何ラリーつなげられる？ #タッケウ', true);
  100 |   await page.getByRole('button', { name: 'もう一度', exact: true }).click();
  101 |   await page.clock.runFor(16);
  102 |   await expect(result).not.toHaveAttribute('href');
  103 |   await finish(page, 0);
  104 |   await activateIntent(page, result, 'タッケウで0ラリー達成！\n何ラリーつなげられる？ #タッケウ');
  105 |   await page.locator('[data-result] [data-action="home"]').click();
  106 |   await expect(result).not.toHaveAttribute('href');
  107 |   await expectIntent(home, bestText);
  108 |   await renderLargeResult(page, 1234567890);
  109 |   await activateIntent(page, result, 'タッケウで1234567890ラリー達成！\n何ラリーつなげられる？ #タッケウ');
  110 |   await page.locator('[data-result] [data-action="home"]').click();
  111 |   await expectIntent(home, '卓球ゲーム「タッケウ」で自己ベスト1234567890ラリー！\n何ラリーつなげられる？ #タッケウ');
  112 |   expect(intents).toHaveLength(4);
  113 | });
  114 | 
  115 | for (const [width, height] of [[320, 568], [568, 320], [1280, 720]] as const) {
  116 |   for (const textScale of [1, 2]) {
  117 |     test(`共有リンクは${width}x${height}・文字${textScale * 100}%でも読めて操作できる`, async ({ page, context }, info) => {
  118 |       await page.setViewportSize({ width, height });
  119 |       const intents = await blockX(context);
  120 |       await openHarness(page, 1234567890);
  121 |       await page.addStyleTag({ content: `:root { font-size: ${16 * textScale}px; }` });
  122 |       const home = page.locator('[data-share-home-x]');
  123 |       await home.scrollIntoViewIfNeeded();
  124 |       await expect(home).toBeInViewport();
  125 |       expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  126 |       const overlaps = await page.locator('.home-footer').evaluate(footer => {
  127 |         const boxes = [...footer.children].map(node => node.getBoundingClientRect());
  128 |         return boxes.some((a, i) => boxes.slice(i + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
  129 |       });
  130 |       expect(overlaps).toBe(false);
  131 |       await page.screenshot({ path: info.outputPath(`home-${width}x${height}-${textScale}.png`) });
  132 |       await activateIntent(page, home, '卓球ゲーム「タッケウ」で自己ベスト1234567890ラリー！\n何ラリーつなげられる？ #タッケウ');
  133 |       await renderLargeResult(page, 1234567890);
  134 |       const result = page.locator('[data-share-x]');
  135 |       await result.scrollIntoViewIfNeeded();
  136 |       await expect(result).toBeInViewport();
> 137 |       expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      |                                                                                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  138 |       const bounds = await result.boundingBox();
  139 |       expect(bounds!.x).toBeGreaterThanOrEqual(0);
  140 |       expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  141 |       await page.screenshot({ path: info.outputPath(`result-${width}x${height}-${textScale}.png`) });
  142 |       await activateIntent(page, result, 'タッケウで1234567890ラリー達成！\n何ラリーつなげられる？ #タッケウ');
  143 |       expect(intents).toHaveLength(2);
  144 |     });
  145 |   }
  146 | }
  147 | 
```