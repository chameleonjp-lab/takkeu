const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
function evaluate(source, globals = {}) {
  return vm.runInNewContext(stripTypeScriptTypes(source), globals, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
}
const boundary = read('tests/helpers/staticNetworkBoundary.ts').replace(/^import .*;\n/gm, '').replace(/export /g, '');
function route(url, method = 'GET', status = 200) {
  const calls = []; const response = { status: () => status };
  return { calls, request: () => ({ url: () => url, method: () => method }),
    fetch: async options => { calls.push(['fetch', options]); if (url.startsWith('blob:')) throw Error('blob passed to HTTP fetch'); return response; },
    fulfill: async () => calls.push(['fulfill']), abort: async () => calls.push(['abort']), continue: async () => calls.push(['continue']) };
}
async function runRoute(url, method, status) {
  const r = route(url, method, status), unexpected = [];
  const fn = evaluate(boundary + '\nisolatedStaticRoute;', { URL });
  await fn(r, unexpected); return { r, unexpected };
}
test('loopback blob stays browser-local, never HTTP fetched', async () => {
  const { r, unexpected } = await runRoute('blob:http://127.0.0.1:4173/id', 'GET');
  assert.deepEqual(r.calls, [['continue']]); assert.deepEqual(unexpected, []);
});
test('HTTP static read still uses zero redirects', async () => {
  const { r, unexpected } = await runRoute('http://127.0.0.1:4173/index.html', 'GET');
  assert.equal(r.calls[0][0], 'fetch'); assert.equal(r.calls[0][1].maxRedirects, 0);
  assert.equal(r.calls[1][0], 'fulfill'); assert.deepEqual(unexpected, []);
});
test('external, opaque blob and all writes remain blocked', async () => {
  for (const [url, method] of [['https://external.invalid/', 'GET'], ['blob:https://external.invalid/id', 'GET'], ['blob:null/id', 'GET'], ['blob:http://127.0.0.1:4173/id','POST'], ['http://127.0.0.1:4173/','POST'], ['http://127.0.0.1:9999/','GET']]) {
    const { r, unexpected } = await runRoute(url, method); assert.deepEqual(r.calls, [['abort']]); assert.equal(unexpected.length, 1);
  }
});
test('HTTP redirect remains rejected', async () => {
  const { r, unexpected } = await runRoute('http://127.0.0.1:4173/', 'GET', 302);
  assert.deepEqual(r.calls.map(x => x[0]), ['fetch', 'abort']); assert.equal(unexpected.length, 1);
});
test('mocked LAN blob gets a narrow page-level browser continuation', async () => {
  const source = read('tests/browser/iphone-performance.spec.ts');
  const marker = "await page.route('blob:http://device-lan.invalid/**'";
  const start = source.indexOf(marker); assert.ok(start >= 0, 'missing fixture-local blob handler');
  const end = source.indexOf('\n  });', start); assert.ok(end > start);
  const handlers = []; const page = { route: async (pattern, handler) => handlers.push({ pattern, handler }) };
  await evaluate('(async()=>{' + source.slice(start, end + 6) + '})()', { page, URL });
  for (const method of ['GET', 'POST']) {
    const r = route('blob:http://device-lan.invalid/id', method); await handlers[0].handler(r);
    assert.deepEqual(r.calls, [[method === 'GET' ? 'continue' : 'abort']]);
  }
});
test('only exact Vite sockets stay mocked open without upstream', async () => {
  let handler;
  const unexpected = [];
  const context = { route: async () => {}, routeWebSocket: async (_pattern, fn) => { handler = fn; } };
  const install = evaluate(boundary + '\ninstallStaticNetworkBoundary;', { URL });
  await install(context, unexpected);
  for (const [url, protocols, allowed] of [
    ['ws://127.0.0.1:4173/?token=test', ['vite-hmr'], true],
    ['ws://127.0.0.1:4173/other', ['vite-hmr'], false],
    ['ws://127.0.0.1:9999/', ['vite-hmr'], false],
    ['wss://external.invalid/', ['vite-hmr'], false],
    ['ws://127.0.0.1:4173/', ['chat'], false],
    ['ws://user@127.0.0.1:4173/', ['vite-hmr'], false],
  ]) {
    let closed = 0;
    handler({ url: () => url, protocols: () => protocols, close: () => closed++, connectToServer: () => { throw Error('no upstream allowed'); } });
    assert.equal(closed, allowed ? 0 : 1, url);
  }
  assert.equal(unexpected.length, 5);
});
test('LAN fixture only mocks its own Vite socket, never arbitrary upstream', async () => {
  const source = read('tests/browser/iphone-performance.spec.ts');
  const start = source.indexOf("  await page.routeWebSocket('**/*'");
  const end = source.indexOf('\n', start);
  let handler;
  const page = { routeWebSocket: async (_pattern, fn) => { handler = fn; } }, errors = [];
  const helper = evaluate(boundary + '\nisolatedHmrSocket;', { URL });
  await evaluate('(async()=>{' + source.slice(start, end) + '})()', { page, errors, isolatedHmrSocket: helper });
  for (const [url, allowed] of [['ws://device-lan.invalid/?token=test', true], ['ws://external.invalid/', false]]) {
    let closed = 0;
    handler({ url: () => url, protocols: () => ['vite-hmr'], close: () => closed++, connectToServer: () => { throw Error('no upstream'); } });
    assert.equal(closed, allowed ? 0 : 1);
  }
  assert.equal(errors.length, 1);
});
test('share selector matches anchor specificity and retains white/black values', () => {
  const css = read('src/ui/styles.css');
  assert.match(css, /a\[data-share-home-x\], a\[data-share-x\] \{[^}]*background: #000; color: #fff;/);
  assert.ok(css.lastIndexOf('a[data-share-home-x]') > css.indexOf('.home-footer a'));
});
test('i18n checks translated prose while requiring the exact two fixed tags', () => {
  const source = read('tests/browser/i18n.spec.ts');
  const start = source.indexOf("  expect(text).toContain('3500')");
  const end = source.indexOf("  await page.locator('[data-certificate-create]')", start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end), kana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
  const expect = value => ({ toContain: part => assert.ok(value.includes(part)), toBe: other => assert.equal(value, other), not: { toMatch: re => assert.ok(!re.test(value)) } });
  const text = 'TAKKEU 3500 rallies!\nhttps://chameleonjp-lab.github.io/takkeu/\n#タッケウ #ゲーム制作';
  evaluate(block, { text, id: 'en', kana, expect });
  assert.throws(() => evaluate(block, { text: text.replace('rallies', 'ラリー'), id: 'en', kana, expect }));
  assert.throws(() => evaluate(block, { text: text.replace('#ゲーム制作', '#wrong'), id: 'en', kana, expect }));
});
