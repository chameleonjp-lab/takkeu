import { expect, test, waitForStart, type Page, type RpcCall } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

const playerName = '{score}<Rally>🏓';
const playId = '22222222-2222-4222-8222-222222222222';
const rpc = {
  start: 'start_takkeu_clear_play_v2', finish: 'finish_takkeu_clear_play_v2',
  score: 'submit_score_idempotent_v1', position: 'get_takkeu_player_position_v1',
  hall: 'register_takkeu_hall_v2',
} as const;

declare global {
  interface Window {
    i18nEventCounts: { added: number; removed: number };
    i18nStorageProbe: () => { deniedReads: number; deniedWrites: number; savedLanguage: string | null };
    i18nCertificateUrls: { created: string[]; revoked: string[] };
    releaseI18nFonts?: () => void;
  }
}

// The real app/controller/client run through the shared fixture. Only the
// external REST boundary is intercepted, including every write endpoint.
async function remoteRanking(page: Page, options: { hold?: readonly string[]; failOnce?: string } = {}) {
  const calls: RpcCall[] = [];
  const gates = new Map<string, { promise: Promise<void>; release: () => void }>();
  for (const name of options.hold ?? []) {
    let release = () => {};
    const promise = new Promise<void>(resolve => { release = resolve; });
    gates.set(name, { promise, release });
  }
  let failed = false;
  await page.route('https://*.supabase.co/rest/v1/rpc/**', async route => {
    const request = route.request(), name = request.url().split('/').at(-1)!;
    expect(request.method()).toBe('POST');
    const body = request.postDataJSON() as Record<string, unknown>;
    calls.push({ rpc: name, body });
    await gates.get(name)?.promise;
    if (name === options.failOnce && !failed) {
      failed = true;
      return route.fulfill({ status: 503, json: { code: 'unavailable' } });
    }
    if (name === rpc.start) return route.fulfill({ json: {
      accepted: true, start_id: body.p_start_id, play_id: playId, display_name: body.p_display_name,
      normalized_name: body.p_display_name, game_slug: 'takkeu', client_version: body.p_client_version,
      rules_version: 'goal-3500-v1',
    } });
    if (name === rpc.finish) return route.fulfill({ json: {
      accepted: true, play_id: body.p_play_id, game_slug: 'takkeu', result_type: body.p_result_type,
      reached_wave: 1, score: body.p_score, lost_balls: body.p_lost_balls, rules_version: 'goal-3500-v1',
    } });
    if (name === rpc.score) return route.fulfill({ json: [{
      accepted: true, result_play_id: body.p_play_id, result_submission_id: body.p_submission_id,
      result_display_name: body.p_display_name, result_normalized_name: body.p_display_name,
      result_first_score: body.p_score, result_best_score: 4001, result_play_count: 1,
    }] });
    if (name === rpc.hall) return route.fulfill({ json: {
      accepted: true, play_id: body.p_play_id, submission_id: body.p_submission_id,
      rules_version: 'goal-3500-v1', hall_number: 7, display_name: body.p_display_name,
      normalized_name: body.p_display_name, registered_at: '2026-10-27T12:00:00Z',
    } });
    if (name === rpc.position) return route.fulfill({ json: [{ rank_no: 123, total_entries: 250, best_score: 4001 }] });
    if (name === 'get_best_score_ranking') return route.fulfill({ json: [
      { rank_no: 1, display_name: playerName, best_score: 4001, play_count: 1 },
    ] });
    if (name === 'get_takkeu_hall_v2') return route.fulfill({ json: [] });
    if (name === 'report_takkeu_progress_v1') return route.fulfill({ json: { accepted: true } });
    throw new Error(`Unexpected RPC ${name}`);
  });
  return {
    calls,
    count: (name: string) => calls.filter(call => call.rpc === name).length,
    counts: () => Object.fromEntries([...new Set(calls.map(call => call.rpc))].sort().map(name => [name, calls.filter(call => call.rpc === name).length])),
    release: (name: string) => gates.get(name)?.release(),
  };
}

async function language(page: Page, next: string) {
  await page.evaluate(async selected => {
    const path = '/src/i18n/i18n.ts';
    (await import(/* @vite-ignore */ path)).setLanguage(selected);
  }, next);
}

async function openRemote(page: Page) {
  await page.clock.install({ time: new Date('2026-10-27T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-27T12:00:01Z'));
  await page.goto('/tests/fixtures/stage3.html?ranking=remote');
  await page.locator('[data-player-name]').fill(playerName);
  await page.locator('[data-action="start"]').click();
}

async function clear(page: Page) {
  await page.evaluate(() => window.stage3.goal());
  await page.clock.runFor(3200);
  await expect(page.locator('[data-result]')).toBeVisible();
  await expect(page.locator('[data-result]')).toHaveAttribute('data-cleared', 'true');
}

async function readableBlob(page: Page, url: string) {
  return page.evaluate(async value => {
    try { return (await fetch(value)).ok; } catch { return false; }
  }, url);
}

test('language changes preserve held start, finish, Hall and rank requests and their identities', async ({ page }) => {
  const remote = await remoteRanking(page, { hold: [rpc.start, rpc.finish, rpc.hall, rpc.position] });
  await openRemote(page);
  await expect.poll(async () => {
    await page.clock.runFor(5);
    return remote.count(rpc.start);
  }, { timeout: 30000, intervals: [1, 5, 10] }).toBe(1);
  await expect(page.locator('[data-loading-screen]')).toBeVisible();
  const startCounts = remote.counts();
  await language(page, 'en');
  await expect(page.locator('[data-loading-screen] h2')).toHaveText('Getting ready to play');
  await expect(page.locator('[data-player-name]')).toHaveValue(playerName);
  expect(remote.counts()).toEqual(startCounts);
  remote.release(rpc.start);
  await waitForStart(page);
  await clear(page);
  await expect.poll(() => remote.count(rpc.finish)).toBe(1);
  await expect(page.locator('[data-ranking-body] bdi')).toHaveText(playerName);
  const finishCounts = remote.counts();
  await language(page, 'es');
  await expect(page.locator('[data-result-comment]')).toHaveText('¡3500 devoluciones! ¡Juego completado!');
  await expect(page.locator('[data-position-message]')).toHaveText('Calculando puesto…');
  expect(remote.counts()).toEqual(finishCounts);
  expect(remote.count(rpc.score)).toBe(0);
  remote.release(rpc.finish);
  await expect.poll(() => remote.count(rpc.hall)).toBe(1);
  await expect.poll(() => remote.count(rpc.position)).toBe(1);
  await expect(page.locator('[data-hall-message]')).toHaveText('Comprobando el registro en el Salón de la Fama.');
  const hallCounts = remote.counts();
  await language(page, 'de');
  await expect(page.locator('[data-hall-message]')).toHaveText('Eintragung in die Ruhmeshalle wird geprüft.');
  await expect(page.locator('[data-position-message]')).toHaveText('Platz wird berechnet …');
  expect(remote.counts()).toEqual(hallCounts);
  remote.release(rpc.position);
  remote.release(rpc.hall);
  await expect(page.locator('[data-position-message]')).toHaveText('Platz 123 von 250 Einträgen');
  await expect(page.locator('[data-hall-message]')).toHaveText('Ruhmeshalle Nr. 7');
  await expect(page.locator('[data-hall-note] bdi')).toHaveText(playerName);
  await expect(page.locator('[data-ranking-body] bdi')).toHaveText(playerName);
  const completedCounts = remote.counts();
  await language(page, 'en');
  await expect(page.locator('[data-hall-message]')).toHaveText('Hall of Fame No. 7');
  await expect(page.locator('[data-position-message]')).toHaveText('Rank 123 of 250 names');
  const text = new URL((await page.locator('[data-share-x]').getAttribute('href'))!).searchParams.get('text');
  expect(text).toContain('Hall of Fame No. 7');
  expect(remote.counts()).toEqual(completedCounts);
  for (const name of [rpc.start, rpc.finish, rpc.score, rpc.hall]) expect(remote.count(name), name).toBe(1);
  // A clear refreshes rank after both the score and Hall acknowledgements.
  expect(remote.count(rpc.position)).toBe(2);
  for (const call of remote.calls.filter(call => [rpc.start, rpc.finish, rpc.score, rpc.hall].includes(call.rpc as typeof rpc.start))) {
    expect(call.body.p_display_name).toBe(playerName);
  }
  expect(remote.calls.find(call => call.rpc === rpc.position)?.body.p_normalized_name).toBe(playerName);
  expect(await page.evaluate(() => window.stage3.snapshot())).toMatchObject({ score: 3500, phase: 'gameover', endReason: 'clear' });
});

for (const failure of ['score', 'position'] as const) test(`a failed ${failure} request retries once only after an explicit action in the new language`, async ({ page }) => {
  const remote = await remoteRanking(page, { failOnce: rpc[failure] });
  await openRemote(page);
  await waitForStart(page);
  await page.evaluate(() => { window.stage3.show(12); window.stage3.finish(); });
  await page.clock.runFor(16);
  await expect(page.locator('[data-result-position]')).toHaveAttribute('data-state', 'error');
  expect(remote.count(rpc[failure])).toBe(1);
  const failedCounts = remote.counts();
  await language(page, 'en');
  await language(page, 'es');
  await expect(page.locator('[data-position-message]')).toHaveText('No se pudo cargar el puesto');
  await page.clock.runFor(1000);
  expect(remote.counts()).toEqual(failedCounts);
  const action = failure === 'score' ? 'ranking-retry' : 'position-retry';
  await page.locator(`[data-action="${action}"]`).click();
  await expect(page.locator('[data-position-message]')).toHaveText('Puesto 123 de 250 nombres');
  expect(remote.count(rpc[failure])).toBe(2);
  expect(remote.count(rpc.start)).toBe(1);
  const attempts = remote.calls.filter(call => call.rpc === rpc[failure]);
  expect(attempts[1]!.body).toEqual(attempts[0]!.body);
  const retriedCounts = remote.counts();
  await language(page, 'de');
  await expect(page.locator('[data-position-message]')).toHaveText('Platz 123 von 250 Einträgen');
  expect(remote.counts()).toEqual(retriedCounts);
  expect(remote.count(rpc.score)).toBe(failure === 'score' ? 2 : 1);
  expect(remote.count(rpc.position)).toBe(failure === 'position' ? 2 : 1);
});

for (const denied of ['accessor', 'methods'] as const) test(`denied localStorage ${denied} keeps browser detection, home selection and same-page gameplay usable`, async ({ page, rankingTraffic }) => {
  await page.addInitScript(mode => {
    Object.defineProperties(navigator, { languages: { get: () => ['fr-CA', 'en-US'] }, language: { get: () => 'en-US' } });
    const storage = window.localStorage, nativeGet = Storage.prototype.getItem;
    let deniedReads = 0, deniedWrites = 0;
    window.i18nStorageProbe = () => ({ deniedReads, deniedWrites, savedLanguage: nativeGet.call(storage, 'takkeu.language.v1') });
    if (mode === 'accessor') {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { deniedReads++; throw new DOMException('Storage denied', 'SecurityError'); },
        set() { deniedWrites++; throw new DOMException('Storage denied', 'SecurityError'); },
      });
    } else {
      Storage.prototype.getItem = () => { deniedReads++; throw new DOMException('Read denied', 'SecurityError'); };
      Storage.prototype.setItem = () => { deniedWrites++; throw new DOMException('Write denied', 'QuotaExceededError'); };
    }
  }, denied);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  const before = await page.evaluate(() => window.i18nStorageProbe());
  await page.locator('[data-home] [data-language]').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-action="start"]')).toContainText('Start');
  const after = await page.evaluate(() => window.i18nStorageProbe());
  expect(after.savedLanguage).toBeNull();
  expect(denied === 'accessor' ? after.deniedReads : after.deniedWrites).toBeGreaterThan(denied === 'accessor' ? before.deniedReads : before.deniedWrites);
  await page.locator('[data-action="start"]').click();
  await waitForStart(page);
  await page.clock.runFor(32);
  await expect(page.getByTestId('game-screen')).toBeVisible();
  await expect(page.locator('[data-score]')).toHaveText('0');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause-overlay')).toBeVisible();
  await page.locator('[data-action="resume"]').click();
  await expect(page.locator('.pause-overlay')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.locator('.pause-overlay [data-action="home"]').click();
  await expect(page.locator('[data-home]')).toBeVisible();
  await expect(page.locator('[data-home] [data-language]')).toHaveValue('en');
  expect(await page.evaluate(() => window.i18nStorageProbe().savedLanguage)).toBeNull();
  await expect.poll(() => rankingTraffic.filter(call => call.rpc === 'start_takkeu_guest_play_v1').length).toBe(1);
  expect(rankingTraffic.some(call => [rpc.start, rpc.finish, rpc.score, rpc.hall].includes(call.rpc as typeof rpc.start))).toBe(false);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('[data-home] [data-language]')).toHaveValue('fr');
});

test('thirty synchronous language switches retain listeners, canvas, simulation and GPU resources', async ({ page }) => {
  await page.addInitScript(() => {
    const counts = { added: 0, removed: 0 };
    window.i18nEventCounts = counts;
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      counts.added++;
      add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      counts.removed++;
      remove.call(this, type, listener, options);
    };
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.locator('[data-action="start"]').click();
  await waitForStart(page);
  await page.evaluate(() => window.stage3.show(555));
  await page.clock.runFor(16);
  const check = await page.evaluate(async () => {
    const path = '/src/i18n/i18n.ts', i18n = await import(/* @vite-ignore */ path);
    const canvas = document.querySelector('canvas'), surface = document.querySelector('[data-testid="input-surface"]');
    const state = () => structuredClone({ events: window.i18nEventCounts, snapshot: window.stage3.snapshot(), metrics: window.stage3.metrics(), resources: window.stage3.resources() });
    const before = state();
    for (let index = 0; index < 30; index++) i18n.setLanguage(index % 2 === 0 ? 'de' : 'en');
    return { before, after: state(), sameCanvas: canvas === document.querySelector('canvas'), sameSurface: surface === document.querySelector('[data-testid="input-surface"]') };
  });
  expect(check.before.events.added).toBeGreaterThan(0);
  expect(check.after).toEqual(check.before);
  expect(check.sameCanvas).toBe(true);
  expect(check.sameSurface).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-score]')).toHaveText('555');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause-overlay')).toBeVisible();
  const paused=await page.evaluate(()=>({snapshot:window.stage3.snapshot(),resources:window.stage3.resources(),metrics:window.stage3.metrics()}));
  await page.locator('.pause-overlay [data-language]').selectOption('de');
  expect(await page.evaluate(()=>({snapshot:window.stage3.snapshot(),resources:window.stage3.resources(),metrics:window.stage3.metrics()}))).toEqual(paused);
  await expect(page.locator('.pause-overlay')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang','de');
  await page.locator('[data-action="resume"]').click();
  await page.clock.runFor(16);
  expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBeGreaterThan(check.after.snapshot.simTime);
});

test('language switches discard a pending PNG and revoke each of three real certificate previews', async ({ page }) => {
  await page.addInitScript(() => {
    const urls = { created: [] as string[], revoked: [] as string[] };
    window.i18nCertificateUrls = urls;
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = object => {
      const value = create(object);
      if (object instanceof Blob && object.type === 'image/png') urls.created.push(value);
      return value;
    };
    URL.revokeObjectURL = value => { if (urls.created.includes(value)) urls.revoked.push(value); revoke(value); };
  });
  const remote = await remoteRanking(page);
  await openRemote(page);
  await waitForStart(page);
  await clear(page);
  await expect(page.locator('[data-hall-message]')).toHaveText('殿堂登録 第7号');
  const before = await page.evaluate(() => ({ snapshot: window.stage3.snapshot(), resources: window.stage3.resources(), metrics: window.stage3.metrics() }));
  const image = page.locator('[data-certificate-image]'), create = page.locator('[data-certificate-create]');
  await language(page, 'en');
  await page.evaluate(() => Object.defineProperty(document, 'fonts', { configurable: true, value: {
    ready: new Promise<void>(resolve => { window.releaseI18nFonts = resolve; }),
  } }));
  await create.click();
  await expect(create).toBeDisabled();
  await expect(page.locator('[data-certificate-message]')).toHaveText('Creating certificate image.');
  await language(page, 'de');
  await page.evaluate(() => window.releaseI18nFonts?.());
  await page.clock.runFor(32);
  await expect(image).not.toHaveAttribute('src');
  await expect(create).toBeEnabled();
  await expect(page.locator('[data-certificate-message]')).toHaveText('');
  expect(await page.evaluate(() => window.i18nCertificateUrls.created)).toEqual([]);
  const urls: string[] = [];
  for (const variation of [
    { language: 'de', hall: 'Ruhmeshalle Nr. 7', alt: `Urkunde für ${playerName}: 3500 Ballwechsel und Ruhmeshalle Nr. 7`, message: 'Urkundenbild wurde erstellt.' },
    { language: 'en', hall: 'Hall of Fame No. 7', alt: `${playerName}’s 3500-rally Hall of Fame certificate · No. 7`, message: 'Certificate image created.' },
    { language: 'es', hall: 'Salón de la Fama n.º 7', alt: `Diploma de ${playerName} por 3500 devoluciones en el Salón de la Fama · N.º 7`, message: 'Imagen del diploma creada.' },
  ]) {
    await language(page, variation.language);
    await expect(page.locator('[data-certificate-preview]')).toBeHidden();
    await expect(image).not.toHaveAttribute('src');
    await expect(page.locator('[data-certificate-download]')).not.toHaveAttribute('href');
    await expect(page.locator('[data-certificate-share]')).toBeHidden();
    await expect(page.locator('[data-hall-message]')).toHaveText(variation.hall);
    if (urls.length) expect(await readableBlob(page, urls.at(-1)!)).toBe(false);
    await create.click();
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('alt', variation.alt);
    await expect(page.locator('[data-certificate-message]')).toHaveText(variation.message);
    const url = (await image.getAttribute('src'))!;
    urls.push(url);
    const png = Buffer.from(await image.evaluate(async (element: HTMLImageElement) => Array.from(new Uint8Array(await (await fetch(element.src)).arrayBuffer()))));
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([900, 1200]);
    expect(await image.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight])).toEqual([900, 1200]);
    await expect(page.locator('[data-certificate-download]')).toHaveAttribute('download', 'takkeu-3500-hall-7.png');
    expect(await readableBlob(page, url)).toBe(true);
  }
  expect(new Set(urls).size).toBe(3);
  expect(await page.evaluate(() => ({ snapshot: window.stage3.snapshot(), resources: window.stage3.resources(), metrics: window.stage3.metrics() }))).toEqual(before);
  await page.locator('[data-result] [data-action="home"]').click();
  await expect(page.locator('[data-home]')).toBeVisible();
  expect(await readableBlob(page, urls.at(-1)!)).toBe(false);
  const ledger = await page.evaluate(() => window.i18nCertificateUrls);
  expect(ledger.created).toEqual(urls);
  expect(ledger.revoked).toEqual(urls);
  for (const name of [rpc.start, rpc.finish, rpc.score, rpc.hall]) expect(remote.count(name), name).toBe(1);
  expect(remote.count(rpc.position)).toBe(2);
});
