import { expect, test } from '../helpers/browserTest';
import type { Page } from '@playwright/test';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/languages';
import type {} from '../helpers/i18nHarness';

const mixedName = '<img src=x onerror=alert(1)> ไทย Иван العربية';
const registeredAt = '2026-10-27T23:30:00Z';
const kana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const screenshots = new Set(['de', 'th', 'zh-Hant', 'ko', 'ru']);
const loadingState = { percent: 35, stage: 'ランキングを確認しています', remainingSeconds: null, elapsedSeconds: 12, error: null };
const loadingError = 'ランキング通信に失敗しました（503）。';

test.use({ timezoneId: 'Pacific/Kiritimati', reducedMotion: 'reduce' });

async function language(page: Page, id: string): Promise<void> {
  await page.evaluate(async next => {
    const path = '/src/i18n/i18n.ts';
    (await import(/* @vite-ignore */ path)).setLanguage(next);
  }, id);
}

async function message(page: Page, selector: string, source: string, parameters: Record<string, string | number> = {}): Promise<void> {
  const expected = await page.evaluate(async ({ source, parameters }) => {
    const path = '/src/i18n/i18n.ts';
    return (await import(/* @vite-ignore */ path)).t(source, parameters) as string;
  }, { source, parameters });
  await expect(page.locator(selector)).toHaveText(expected);
  if (await page.locator('html').getAttribute('lang') !== 'ja') expect(expected, source).not.toMatch(kana);
}

async function layout(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    loading: [...document.querySelectorAll<HTMLElement>('[data-loading-screen]:not([hidden]) [data-loading-content]')]
      .map(node => ({ client: node.clientWidth, scroll: node.scrollWidth })) }));
  expect(overflow.document, 'the document must not overflow horizontally').toBeLessThanOrEqual(overflow.width + 1);
  expect(overflow.body, 'the body must not overflow horizontally').toBeLessThanOrEqual(overflow.width + 1);
  for (const region of overflow.loading) expect(region.scroll, 'loading text must wrap within its content region').toBeLessThanOrEqual(region.client + 1);
  const controls = page.locator('button:visible, a.button:visible, select:visible');
  for (let index = 0; index < await controls.count(); index++) {
    const control = controls.nth(index), box = await control.boundingBox();
    expect(box, await control.getAttribute('data-action') ?? 'visible control').not.toBeNull();
    expect(box!.height, 'visible button/select touch targets are at least 44 CSS pixels').toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(overflow.width + 1);
  }
}

for (const { id, locale } of SUPPORTED_LANGUAGES) test(`i18n states ${id}: tables, receipts, retries and enlarged short layouts`, async ({ page, rankingTraffic }, info) => {
  const dialogs: string[] = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.setViewportSize({ width: 402, height: 700 });
  await page.goto('/tests/fixtures/i18n.html');
  await page.waitForFunction(() => !!window.i18nHarness);
  await language(page, id);
  await page.evaluate(() => window.i18nHarness.result());
  await expect(page.locator('html')).toHaveAttribute('lang', id);
  await expect(page.locator('[data-result]')).toBeVisible();
  const before = await page.evaluate(() => window.i18nHarness.state());
  // Node and browser CLDR versions can group four-digit Italian numbers differently.
  // Calculate expected standard Intl values in the browser under test, keeping UTC explicit.
  const expectedIntl = await page.evaluate(({locale,registeredAt}) => ({
    date: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(registeredAt)),
    numbers: Object.fromEntries([35,1250,3500].map(value => [value, value.toLocaleString(locale)])),
  }), {locale,registeredAt});
  const date=expectedIntl.date, formatted=(value:number)=>expectedIntl.numbers[value]!;
  await message(page, '[data-result-comment]', '3500ラリー達成！ゲームクリア！');
  await message(page, '[data-position-message]', '{rank}位 / {total}登録中', { rank: formatted(35), total: formatted(1250) });
  await message(page, '[data-position-note]', '登録名ごとの自己ベスト順位（{score}ラリー）', { score: formatted(3500) });
  await message(page, '[data-hall-message]', '殿堂登録 第{number}号', { number: 35 });
  await message(page, '[data-hall-note]', '{name}・初回登録日 {date}（UTC）。再クリアも同じ番号です。', { name: mixedName, date });
  await message(page, '[data-ranking-message]', 'プレイ回数はゲーム開始時に数えます。');
  await message(page, '[data-hall-list-message]', '番号は登録名ごとの初回クリア順です。');
  await expect(page.locator('[data-top100]')).toBeVisible();
  await expect(page.locator('[data-ranking-body] tr')).toHaveCount(3);
  await expect(page.locator('[data-ranking-body] tr').nth(0).locator('td').first()).toHaveText('1');
  await expect(page.locator('[data-ranking-body] tr').nth(1).locator('td').first()).toHaveText('1');
  for (const selector of ['[data-ranking-body] tr:first-child', '[data-hall-list] li:first-child', '[data-hall-note]']) {
    expect(await page.locator(`${selector} bdi`).textContent()).toBe(mixedName);
    await expect(page.locator(`${selector} bdi`)).toHaveAttribute('dir', 'auto');
    await expect(page.locator(`${selector} img, ${selector} script`)).toHaveCount(0);
  }
  await expect(page.locator('[data-player-name]')).toHaveAttribute('dir', 'auto');
  const receipt = await page.locator('[data-share-x]').getAttribute('href');
  const share = new URL(receipt!);
  expect(share.searchParams.get('text')).toContain('3500');
  expect(share.searchParams.get('text')).toContain('35');
  expect(share.searchParams.get('text')).toContain('https://chameleonjp-lab.github.io/takkeu/');
  await page.evaluate(async chosen => {
    const path = '/src/i18n/i18n.ts', i18n = await import(/* @vite-ignore */ path);
    for (let i = 0; i < 10; i++) { i18n.setLanguage(chosen === 'ja' ? 'en' : 'ja'); i18n.setLanguage(chosen); }
  }, id);
  expect(await page.evaluate(() => window.i18nHarness.state())).toEqual(before);

  await page.evaluate(() => {
    const harness = window.i18nHarness;
    harness.submission('submitting'); harness.position('loading'); harness.hall('pending');
    harness.leaderboard('loading'); harness.hallList('loading');
  });
  await message(page, '[data-ranking-status]', 'ランキングに記録しています。');
  await message(page, '[data-position-message]', '順位を集計中…');
  await message(page, '[data-hall-message]', '殿堂登録を確認しています。');
  await message(page, '[data-ranking-message]', 'ランキングを読み込んでいます。');
  await message(page, '[data-hall-list-message]', '殿堂一覧を読み込んでいます。');
  await expect(page.locator('[data-ranking-table]')).toBeHidden();
  await expect(page.locator('[data-action="ranking-refresh"]')).toBeDisabled();
  await expect(page.locator('[data-action="hall-retry"]')).toBeHidden();
  expect(await page.locator('[data-share-x]').getAttribute('href')).not.toBe(receipt);

  await page.evaluate(error => {
    const harness = window.i18nHarness;
    harness.submission('retryable_failed'); harness.position('error'); harness.hall('retryable_failed');
    harness.leaderboard('error'); harness.hallList('error'); harness.error(error);
  }, loadingError);
  await message(page, '[data-ranking-status]', '記録を送信できませんでした。通信を確認して再送できます。');
  await message(page, '[data-position-message]', '順位を取得できませんでした');
  await message(page, '[data-hall-message]', '殿堂登録は再送できます。');
  await message(page, '[data-ranking-message]', 'ランキングを取得できませんでした。時間をおいて更新してください。');
  await message(page, '[data-hall-list-message]', '殿堂一覧を取得できませんでした。「ランキングを更新」で再取得できます。');
  await message(page, '[data-error]', 'ランキング通信に失敗しました（{status}）。', { status: 503 });
  await page.locator('[data-action="position-retry"]').focus();
  await language(page, id === 'ja' ? 'en' : 'ja'); await language(page, id);
  await expect(page.locator('[data-action="position-retry"]')).toBeFocused();
  expect(await page.evaluate(() => window.i18nHarness.state().actions)).toEqual(before.actions);
  await page.locator('[data-action="position-retry"]').click();
  await page.locator('[data-action="hall-retry"]').click();
  await page.locator('[data-action="ranking-retry"]').click();
  await page.locator('[data-action="ranking-refresh"]').click();
  expect(await page.evaluate(() => window.i18nHarness.state().actions)).toMatchObject({ positionRetry: 1, rankingRetry: 2, rankingRefresh: 1 });
  await page.evaluate(() => {
    const harness = window.i18nHarness;
    harness.submission('permanent_failed'); harness.position('excluded'); harness.hall('failed');
    harness.leaderboard('loaded', true); harness.hallList('loaded', true);
  });
  await message(page, '[data-position-message]', 'この登録名は現在ランキング対象外です。');
  await message(page, '[data-hall-message]', '殿堂登録を確認できませんでした。');
  await message(page, '[data-ranking-message]', 'まだ記録がありません。最初のラリーをつなごう。');
  await message(page, '[data-hall-list-message]', '最初の殿堂入りを目指そう。');
  await expect(page.locator('[data-action="ranking-retry"]')).toBeHidden();
  await expect(page.locator('[data-action="hall-retry"]')).toBeHidden();
  await expect(page.locator('[data-action="position-retry"]')).toBeHidden();
  await page.evaluate(() => window.i18nHarness.hall('anonymous'));
  await message(page, '[data-hall-note]', '名前なしのクリアです。達成賞状を作れます。殿堂番号は付きません。');

  await page.evaluate(state => window.i18nHarness.loading(state), loadingState);
  await expect(page.locator('[data-loading-screen]')).toBeVisible();
  await message(page, '[data-loading-stage]', loadingState.stage);
  await expect(page.locator('[data-loading-progress]')).toHaveAttribute('aria-valuenow', '35');
  await message(page, '[data-loading-eta]', '{seconds}秒経過 · 通常より時間がかかっています。準備ができるまでお待ちください。', { seconds: 12 });
  const loadingFocus = await page.evaluate(() => document.activeElement?.id);
  await language(page, id === 'ja' ? 'en' : 'ja'); await language(page, id);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe(loadingFocus);
  await page.evaluate(state => window.i18nHarness.loading(state), { ...loadingState, error: loadingError });
  await message(page, '[data-loading-screen] h2', '準備を完了できませんでした');
  await message(page, '[data-loading-screen] [role="alert"]', 'ランキング通信に失敗しました（{status}）。', { status: 503 });
  await expect(page.locator('[data-loading-action="retry"]')).toBeFocused();
  await page.locator('[data-loading-action="retry"]').click();
  expect(await page.evaluate(() => window.i18nHarness.state().actions.loadingRetry)).toBe(1);
  await expect(page.locator('[data-loading-action="retry"]')).toBeHidden();

  for (const viewport of [{ width: 402, height: 700 }, { width: 844, height: 390 }]) {
    for (const scale of [100, 200] as const) {
      await page.setViewportSize(viewport);
      await page.evaluate(scale => { window.i18nHarness.fontScale(scale); window.i18nHarness.result(); }, scale);
      const captionFont = await page.locator('.ranking-caption').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize));
      expect(captionFont, 'the 200% run must actually double rem-based text').toBe(scale === 100 ? 12 : 24);
      await layout(page);
      const orientation = viewport.width < viewport.height ? 'portrait' : 'landscape';
      const evidence = screenshots.has(id) && (orientation === 'portrait' && scale === 100 || orientation === 'landscape' && scale === 200);
      if (evidence) await page.screenshot({ path: `docs/i18n/screenshots/${info.project.name}-${id}-state-result-${orientation}-${scale}.png`, fullPage: true });
      await page.evaluate(state => window.i18nHarness.loading(state), { ...loadingState, error: loadingError });
      await layout(page);
      await page.locator('[data-loading-action="retry"]').scrollIntoViewIfNeeded();
      await expect(page.locator('[data-loading-action="retry"]')).toBeInViewport();
      await expect(page.locator('[data-loading-action="cancel"]')).toBeVisible();
      if (evidence && scale === 200) await page.screenshot({ path: `docs/i18n/screenshots/${info.project.name}-${id}-state-loading-failure-${orientation}-${scale}.png` });
    }
  }
  expect(await page.evaluate(() => window.i18nHarness.state().sameNodes)).toBe(true);
  expect(await page.evaluate(() => window.i18nHarness.state().snapshot)).toEqual(before.snapshot);
  expect(rankingTraffic).toEqual([]); expect(dialogs).toEqual([]);
});
