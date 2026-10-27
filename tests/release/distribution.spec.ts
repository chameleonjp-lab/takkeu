import { expect, test, waitForStart } from '../helpers/browserTest';
import { execFileSync } from 'node:child_process';
for (const [port, base] of [[4174, '/'], [4175, '/takkeu/']] as const) {
  test(`実配布物 ${base} の初期HTMLに静的なOG・XカードがありPNGを配信する`, async ({ page, request }) => {
    const origin = `http://127.0.0.1:${port}`;
    const response = await request.get(origin + base);
    expect(response.ok()).toBe(true);
    const metadata = await page.evaluate(source => {
      const html = new DOMParser().parseFromString(source, 'text/html');
      return {
        canonical: html.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        meta: Object.fromEntries([...html.querySelectorAll('meta[name], meta[property]')].map(node => [node.getAttribute('name') ?? node.getAttribute('property'), node.getAttribute('content')])),
      };
    }, await response.text());
    const canonical = 'https://chameleonjp-lab.github.io/takkeu/';
    expect(metadata.canonical).toBe(canonical);
    expect(metadata.meta['og:url']).toBe(canonical);
    expect(metadata.meta['og:type']).toBe('website');
    expect(metadata.meta['og:locale']).toBe('ja_JP');
    expect(metadata.meta['og:title']).toBe('タッケウ — つなげ、ラリー。');
    expect(metadata.meta['twitter:title']).toBe('タッケウ — つなげ、ラリー。');
    expect(metadata.meta['twitter:card']).toBe('summary_large_image');
    for (const key of ['description', 'og:description', 'twitter:description']) expect(metadata.meta[key]).toBe('タップ＆ドラッグで3500ラリーのゲームクリアと殿堂入りを目指す卓球ゲーム「タッケウ」。');
    for (const key of ['og:image:alt', 'twitter:image:alt']) expect(metadata.meta[key]).toBe('緑の卓球台と赤いラケットが映る卓球ゲーム「タッケウ」の画面。つなげ、ラリー。');
    for (const key of ['og:image', 'og:image:secure_url', 'twitter:image']) expect(metadata.meta[key]).toBe(canonical + 'og-takkeu-v1.png');
    expect(metadata.meta['og:image:type']).toBe('image/png');
    expect(metadata.meta['og:image:width']).toBe('1200');
    expect(metadata.meta['og:image:height']).toBe('630');
    const image = await request.get(origin + base + 'og-takkeu-v1.png');
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
    const bytes = await image.body();
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  test(`実配布物 ${base} の参照・開始・保存と開発機能の非混入`, async ({ page, request }) => {
    await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
    const origin = `http://127.0.0.1:${port}`, failures: string[] = [];
    page.on('pageerror', e => failures.push(e.message));
    page.on('requestfailed', r => failures.push(r.url()));
    page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
    await page.goto(origin + base + '?score=450&debug=1');
    await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
    expect(await page.locator('.home-art img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const revision = await (await request.get(origin + base + 'release.json')).json();
    expect(revision.commit).toBe(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
    expect(revision.base).toBe(base);
    const manifest = await (await request.get(origin + base + 'ranking-manifest.json')).json();
    expect(manifest.canonical_url).toBe('https://chameleonjp-lab.github.io/takkeu/');
    expect(manifest.player_name.required_before_start).toBe(false);
    await expect(page.locator('meta[name="chameleonjp-release"]')).toHaveAttribute('content', 'takkeu-20261023-01');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://chameleonjp-lab.github.io/takkeu/og-takkeu-v1.png');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const image = await request.get(origin + base + 'og-takkeu-v1.png');
    expect(image.ok()).toBe(true); expect(image.headers()['content-type']).toContain('image/png');
    const imageBytes = await image.body();
    expect([imageBytes.readUInt32BE(16), imageBytes.readUInt32BE(20)]).toEqual([1200, 630]);
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByLabel('描画品質', { exact: true }).selectOption('low');
    await page.getByRole('button', { name: '戻る', exact: true }).click();
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await waitForStart(page);
    await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
    await expect(page.getByLabel('残球数', { exact: true })).toHaveText('1');
    await page.keyboard.press('Escape');
    expect(failures).toEqual([]);
    for (const path of ['tests/fixtures/stage2.html', 'tests/fixtures/stage3.html', 'src/main.ts', '@vite/client']) expect((await request.get(origin + base + path)).status()).toBe(404);
    expect(await page.evaluate(() => 'stage2' in window || 'stage3' in window)).toBe(false);
  });
}
