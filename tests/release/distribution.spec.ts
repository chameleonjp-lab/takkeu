import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
for (const [port, base] of [[4174, '/'], [4175, '/takkeu/']] as const) {
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
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByLabel('描画品質', { exact: true }).selectOption('low');
    await page.getByRole('button', { name: '戻る', exact: true }).click();
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
    await expect(page.getByLabel('残球数', { exact: true })).toHaveText('1');
    await page.keyboard.press('Escape');
    expect(failures).toEqual([]);
    for (const path of ['tests/fixtures/stage2.html', 'tests/fixtures/stage3.html', 'src/main.ts', '@vite/client']) expect((await request.get(origin + base + path)).status()).toBe(404);
    expect(await page.evaluate(() => 'stage2' in window || 'stage3' in window)).toBe(false);
  });
}
