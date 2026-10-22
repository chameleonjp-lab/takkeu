import { chromium, webkit, request, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const expected = process.argv[2];
assert.match(expected, /^[0-9a-f]{40}$/);
const url = 'https://chameleonjp-lab.github.io/takkeu/';
const proxyServer = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const proxy = proxyServer ? { server: proxyServer } : undefined;
const browserTLSBypass = process.env.TAKKEU_BROWSER_PROXY_TLS_BYPASS === '1';
const out = 'docs/verification/reference-threejs/published';
mkdirSync(out, { recursive: true });
const result = { at: new Date().toISOString(), url, expected, status: 'running', browsers: [] };
result.transport = { apiTLS: 'default certificate verification enabled for metadata and development-path requests', browserTLS: browserTLSBypass ? 'session proxy CA is not in Chromium browser trust store; browser context bypasses that certificate check, separately verified by API and curl' : 'default certificate verification enabled' };
const api = await request.newContext({ proxy });
try {
  const response = await api.get(`${url}release.json?sha=${expected}`);
  assert.equal(response.status(), 200);
  result.release = await response.json();
  assert.equal(result.release.commit, expected);
  assert.equal(result.release.base, '/takkeu/');
  result.developmentPaths = {};
  for (const path of ['tests/fixtures/stage2.html', 'tests/fixtures/stage3.html', 'src/main.ts', '@vite/client']) {
    const status = (await api.get(url + path)).status();
    result.developmentPaths[path] = status;
    assert.equal(status, 404);
  }
  for (const [engine, name, viewport, mobile] of [
    [chromium, 'chromium-desktop', { width: 1280, height: 800 }, false],
    [webkit, 'webkit-portrait', { width: 390, height: 844 }, true],
    [webkit, 'webkit-landscape', { width: 844, height: 390 }, true],
  ]) {
    const browser = await engine.launch({ proxy, ...(engine === chromium ? { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } : {}) });
    try {
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: browserTLSBypass });
      const page = await context.newPage(), errors = [], resources = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('requestfailed', r => errors.push(`${r.url()}: ${r.failure()?.errorText}`));
      page.on('response', r => { resources.push({ url: r.url(), status: r.status() }); if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
      await page.goto(url + '?score=450&debug=1', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
      await page.screenshot({ path: `${out}/${name}-home.png`, fullPage: true });
      await page.getByRole('button', { name: '設定', exact: true }).click();
      await page.getByLabel('描画品質', { exact: true }).selectOption('low');
      await page.getByRole('button', { name: '音：オン', exact: true }).click();
      await page.getByRole('button', { name: '戻る', exact: true }).click();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: '設定', exact: true }).click();
      await expect(page.getByLabel('描画品質', { exact: true })).toHaveValue('low');
      await expect(page.getByRole('button', { name: '音：オフ', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '戻る', exact: true }).click();
      await page.getByRole('button', { name: 'はじめる', exact: true }).click();
      await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
      await expect(page.getByLabel('残球数', { exact: true })).toHaveText('1');
      // Only normal production pointer input; no fixture or score override.
      const surface = page.getByTestId('input-surface'), box = await surface.boundingBox();
      const court = await page.locator('canvas').boundingBox();
      const origin = { x: box.x + box.width / 2, y: box.y + box.height * 0.8 };
      const target = { x: origin.x + court.width * 0.05, y: origin.y - court.height * 0.06 };
      await surface.dispatchEvent('pointerdown', { pointerId: 11, pointerType: 'touch', clientX: origin.x, clientY: origin.y, button: 0 });
      await surface.dispatchEvent('pointermove', { pointerId: 11, pointerType: 'touch', clientX: target.x, clientY: target.y });
      await page.clock.runFor(300);
      await surface.dispatchEvent('pointerup', { pointerId: 11, pointerType: 'touch', clientX: target.x, clientY: target.y });
      await page.clock.runFor(1450);
      await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
      await page.clock.runFor(200);
      await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
      await page.screenshot({ path: `${out}/${name}-returned.png`, fullPage: true });
      await page.getByRole('button', { name: '一時停止', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.screenshot({ path: `${out}/${name}-paused.png`, fullPage: true });
      await page.getByRole('button', { name: 'つづける' }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      await page.getByRole('button', { name: '一時停止', exact: true }).click();
      await page.getByRole('button', { name: '最初からやり直す', exact: true }).click();
      await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
      await page.getByRole('button', { name: '一時停止', exact: true }).click();
      await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
      assert.equal(await page.evaluate(() => 'stage2' in window || 'stage3' in window), false);
      assert.deepEqual(errors, []);
      result.browsers.push({ name, version: browser.version(), viewport, errors, resources, firstPostBounceReturn: 1, result: 'passed', scope: 'Linux emulation, clock paused; not iPhone hardware, listening or performance' });
      await context.close();
    } finally { await browser.close(); }
  }
  result.status = 'passed';
} catch (e) {
  result.status = 'failed'; result.error = String(e); process.exitCode = 1;
} finally {
  await api.dispose();
  writeFileSync(`${out}/live-check.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
