// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { certificateDate, createCertificateControls, createCertificateImage, type CertificateData } from '../../src/ui/certificate';
import { setLanguage } from '../../src/i18n/i18n';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/languages';
import { TRANSLATIONS } from '../../src/i18n/translations';

const english = TRANSLATIONS.en;
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
const clear: CertificateData = { name: '太郎 ไทย Иван 🏓', hall: null, achievedAt: '2026-10-27T23:15:00-05:00', lostBalls: 12 };
type Draw = { text: string; x: number; y: number; font: string; width: number; ascent: number; descent: number; maxWidth: number | undefined };
type Capture = { draws: Draw[]; width: number; height: number; mime: string | undefined };
let captures: Capture[], pending: BlobCallback[], automatic: boolean, urls: Map<string, Blob>, disposers: (() => void)[];
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  setLanguage('ja');
  // Stable boundary translations isolate certificate behavior from catalog wording.
  TRANSLATIONS.en = { ...english, '賞 状': 'Certificate of Achievement', '{name} 殿': 'Awarded to {name}',
    'クリア賞状': 'Clear certificate', '画像を作って保存できます。': 'Create and save an image.',
    '賞状画像を作る': 'Create certificate image', '3500ラリー達成賞状': '3500-rally achievement certificate',
    '画像を保存': 'Save image', '賞状画像を共有': 'Share certificate image',
    '保存できない場合は、画像を長押しして保存できます。': 'Touch and hold the image to save it.',
    '{name}の3500ラリー達成賞状（殿堂番号なし）': '3500-rally certificate for {name} (no hall number)',
    '{name}の3500ラリー殿堂入り賞状・殿堂登録 第{number}号': '3500-rally hall certificate for {name}, hall No. {number}',
    '殿堂登録 第{number}号': 'Hall of Fame No. {number}', '賞状画像を作成しました。': 'Certificate image created.',
    '賞状画像を作成しています。': 'Creating certificate image.',
  };
  captures = []; pending = []; automatic = true; urls = new Map(); disposers = [];
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const draws: Draw[] = [];
    const capture: Capture = { draws, width: this.width, height: this.height, mime: undefined };
    captures.push(capture);
    const context = {
      font: '10px sans-serif', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: 'center', textBaseline: 'alphabetic',
      fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      measureText(value: string) {
        const size = Number(/([\d.]+)px/u.exec(context.font)?.[1] ?? 10);
        const length = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value)].length;
        return { width: length * size * 0.62, actualBoundingBoxAscent: size * 0.8, actualBoundingBoxDescent: size * 0.3 } as TextMetrics;
      },
      fillText(value: string, x: number, y: number, maxWidth?: number) {
        const metrics = context.measureText(value);
        draws.push({ text: value, x, y, font: context.font, width: metrics.width,
          ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent, maxWidth });
      },
    };
    return context as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (_callback, mime) {
    captures.at(-1)!.mime = mime;
    if (automatic) _callback(new Blob(['png'], { type: mime ?? 'image/png' }));
    else pending.push(_callback);
  });
  const NativeURL = URL;
  let serial = 0;
  vi.stubGlobal('URL', class extends NativeURL {
    static override createObjectURL(blob: Blob) { const url = `blob:certificate-${++serial}`; urls.set(url, blob); return url; }
    static override revokeObjectURL(url: string) { urls.delete(url); }
  });
});

afterEach(() => {
  disposers.forEach(dispose => dispose());
  TRANSLATIONS.en = english;
  setLanguage('ja');
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else Reflect.deleteProperty(document, 'fonts');
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function controls() {
  const host = document.createElement('section'); document.body.append(host);
  const control = createCertificateControls(host); disposers.push(control.dispose);
  control.set(clear);
  return { host, control, get: <T extends HTMLElement>(selector: string) => host.querySelector<T>(selector)! };
}

it('formats the certificate date in the requested language while retaining its UTC day', () => {
  expect(certificateDate('2026-10-27T23:15:00-05:00', 'en')).toBe('October 28, 2026');
  expect(certificateDate('2026-10-27T23:15:00-05:00', 'ja')).toBe('2026年10月28日');
});

it('uses Thai date conventions for the same UTC instant', () => {
  expect(certificateDate('2026-10-27T23:15:00-05:00', 'th')).toBe('28 ตุลาคม 2569');
});

it('keeps the image language captured before waiting for fonts', async () => {
  let release = () => {};
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(resolve => { release = resolve; }) } });
  setLanguage('en');
  const result = createCertificateImage(clear, document);
  setLanguage('ja'); release();
  const blob = await result;
  expect(captures[0]!.draws.map(draw => draw.text).join(' ')).toContain('Certificate of Achievement');
  expect(captures[0]!.draws.map(draw => draw.text).join(' ')).toContain(clear.name);
  expect(blob.type).toBe('image/png');
  expect(captures[0]).toMatchObject({ width: 900, height: 1200, mime: 'image/png' });
});

it.each(SUPPORTED_LANGUAGES.map(({ id }) => id))('fits translated image text and mixed-script names inside the border in %s', async language => {
  const name = '🏓日本ไทย한국Иван'.repeat(2);
  await createCertificateImage({ ...clear, name }, document, language);
  let previousBottom = 51;
  for (const draw of captures[0]!.draws) {
    expect(draw.width, draw.text).toBeLessThanOrEqual(730);
    expect(draw.x - draw.width / 2, draw.text).toBeGreaterThanOrEqual(85);
    expect(draw.x + draw.width / 2, draw.text).toBeLessThanOrEqual(815);
    expect(draw.y - draw.ascent, draw.text).toBeGreaterThan(51);
    expect(draw.y + draw.descent, draw.text).toBeLessThan(1149);
    expect(draw.y - draw.ascent, draw.text).toBeGreaterThan(previousBottom);
    previousBottom = draw.y + draw.descent;
    if (draw.maxWidth !== undefined) expect(draw.width, draw.text).toBeLessThanOrEqual(draw.maxWidth);
  }
});

it('preserves anonymous status and only uses a received hall number', async () => {
  await createCertificateImage(clear, document, 'ja');
  const anonymous = captures[0]!.draws.map(draw => draw.text).join(' ');
  expect(anonymous).toContain('達成記念・殿堂番号なし');
  expect(anonymous).not.toContain('殿堂登録 第');
  await createCertificateImage({ ...clear, hall: { number: 1234, displayName: '正式 ไทย', normalizedName: '正式 ไทย', registeredAt: '2026-10-26T12:00:00Z' } }, document, 'en');
  const registered = captures[1]!.draws.map(draw => draw.text).join(' ');
  expect(registered).toContain('Hall of Fame No. 1,234');
  expect(registered).toContain('正式 ไทย');
  expect(registered).not.toContain(clear.name);
});

it('uses the received hall name and raw hall number in the saved filename', async () => {
  setLanguage('en');
  const { control, host, get } = controls();
  control.set({ ...clear, hall: { number: 1234, displayName: '<b>ไทย</b>', normalizedName: '<b>ไทย</b>', registeredAt: '2026-10-26T12:00:00Z' } });
  get('[data-certificate-create]').click(); await flush();
  expect(get<HTMLImageElement>('[data-certificate-image]').alt).toBe('3500-rally hall certificate for <b>ไทย</b>, hall No. 1,234');
  expect(get<HTMLAnchorElement>('[data-certificate-download]').download).toBe('takkeu-3500-hall-1234.png');
  expect(host.querySelector('b')).toBeNull();
});

it('updates existing control nodes and accessible attributes when the language changes', () => {
  const { host, get } = controls();
  const create = get<HTMLButtonElement>('[data-certificate-create]'), image = get<HTMLImageElement>('[data-certificate-image]');
  create.focus(); setLanguage('en');
  expect(get('[data-certificate-create]')).toBe(create);
  expect(document.activeElement).toBe(create);
  expect(create.textContent).toBe('Create certificate image');
  expect(host.getAttribute('aria-label')).toBe('Clear certificate');
  expect(image.alt).toBe('3500-rally achievement certificate');
  expect(get('[data-certificate-download]').textContent).toBe('Save image');
});

it('rejects a PNG completed after a language change and allows a new language image', async () => {
  automatic = false;
  const { get } = controls();
  const create = get<HTMLButtonElement>('[data-certificate-create]'); create.click(); await flush();
  expect(create.disabled).toBe(true);
  setLanguage('en');
  expect(create.disabled).toBe(false);
  expect(get('[data-certificate-message]').textContent).toBe('');
  pending.shift()!(new Blob(['old'], { type: 'image/png' })); await flush();
  expect(get('[data-certificate-image]').hasAttribute('src')).toBe(false);
  expect(urls.size).toBe(0);
  create.click(); await flush(); pending.shift()!(new Blob(['new'], { type: 'image/png' })); await flush();
  expect(get<HTMLImageElement>('[data-certificate-image]').alt).toBe(`3500-rally certificate for ${clear.name} (no hall number)`);
  expect(get<HTMLAnchorElement>('[data-certificate-download]').download).toBe('takkeu-3500-clear.png');
  expect(urls.size).toBe(1);
});

it.each(['leave', 'retry'] as const)('rejects a PNG completed after %s', async action => {
  automatic = false;
  const { control, get } = controls();
  get('[data-certificate-create]').click(); await flush();
  control.set(action === 'leave' ? null : { ...clear, achievedAt: '2026-10-28T12:00:00Z' });
  pending.shift()!(new Blob(['old'], { type: 'image/png' })); await flush();
  expect(get('[data-certificate-image]').hasAttribute('src')).toBe(false);
  expect(get('[data-certificate-message]').textContent).toBe('');
  expect(urls.size).toBe(0);
});

it.each(['language', 'leave', 'dispose'] as const)('revokes the displayed PNG on %s', async action => {
  const { control, get } = controls();
  get('[data-certificate-create]').click(); await flush();
  expect(urls.size).toBe(1);
  if (action === 'language') setLanguage('en');
  else if (action === 'leave') control.set(null);
  else control.dispose();
  expect(urls.size).toBe(0);
  expect(get('[data-certificate-preview]').hidden).toBe(true);
  expect(get('[data-certificate-image]').hasAttribute('src')).toBe(false);
});

it('does not display an old share failure after changing language and regenerating', async () => {
  let rejectShare = (_reason: Error) => {};
  vi.stubGlobal('navigator', { canShare: () => true, share: () => new Promise<void>((_resolve, reject) => { rejectShare = reject; }) });
  const { get } = controls();
  get('[data-certificate-create]').click(); await flush(); get('[data-certificate-share]').click();
  setLanguage('en'); get('[data-certificate-create]').click(); await flush();
  rejectShare(new Error('old share failed')); await flush();
  expect(get('[data-certificate-message]').textContent).toBe('Certificate image created.');
});

it('releases its language subscription on disposal', () => {
  const { host, control } = controls();
  control.dispose(); const content = host.innerHTML;
  setLanguage('en');
  expect(host.innerHTML).toBe(content);
});

it('localizes an unnamed player at generation time while preserving the literal same-text registered name', async () => {
  const { control, get } = controls();
  control.set({ ...clear, name: '' });
  setLanguage('en');
  get<HTMLButtonElement>('[data-certificate-create]').click(); await flush();
  expect(get<HTMLImageElement>('[data-certificate-image]').alt).toContain('Player');
  expect(captures.at(-1)!.draws.map(x=>x.text).join(' ')).toContain('Player');
  control.set({ ...clear, name: 'プレイヤー' });
  get<HTMLButtonElement>('[data-certificate-create]').click(); await flush();
  expect(get<HTMLImageElement>('[data-certificate-image]').alt).toContain('プレイヤー');
  control.set({ ...clear, name: '' });setLanguage('ja');
  get<HTMLButtonElement>('[data-certificate-create]').click(); await flush();
  expect(get<HTMLImageElement>('[data-certificate-image]').alt).toContain('プレイヤー');
});
