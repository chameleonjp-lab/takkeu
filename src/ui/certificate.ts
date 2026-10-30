import type { HallEntry } from '../ranking/client';
import { formatNumber, getLanguage, onLanguageChange, t } from '../i18n/i18n';
import { getLanguageLocale, type Language } from '../i18n/languages';

export type CertificateData = Readonly<{ name: string; hall: HallEntry | null; achievedAt: string; lostBalls: number }>;
export function certificateDate(timestamp: string, language = getLanguage()): string {
  return new Intl.DateTimeFormat(getLanguageLocale(language), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(timestamp));
}

// Installed fonts are used under their OS licenses; no remote font request is made.
function certificateFont(language: Language): string {
  const regional = language === 'ja' ? '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", '
    : language === 'ko' ? '"Noto Sans CJK KR", "Apple SD Gothic Neo", "Malgun Gothic", '
      : language === 'zh-Hans' ? '"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", '
        : language === 'zh-Hant' ? '"Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", '
          : language === 'th' ? '"Noto Sans Thai", "Thonburi", "Leelawadee UI", "Tahoma", ' : '';
  return `${regional}"Noto Sans", "Noto Sans Thai", "Noto Sans CJK JP", "Noto Sans CJK KR", "Hiragino Sans", "Yu Gothic", "Meiryo", "Arial Unicode MS", "Arial", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
}

/** Generated only on the result screen, never in a gameplay/render loop. */
export async function createCertificateImage(data: CertificateData, doc = document, language = getLanguage()): Promise<Blob> {
  // The default argument captures the language before the first asynchronous wait.
  await doc.fonts?.ready;
  const canvas = doc.createElement('canvas'); canvas.width = 900; canvas.height = 1200;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(t('賞状画像を作成できませんでした。', {}, language));
    ctx.fillStyle = '#fbf5e6'; ctx.fillRect(0, 0, 900, 1200);
    ctx.strokeStyle = '#b68c43'; ctx.lineWidth = 5; ctx.strokeRect(34, 34, 832, 1132);
    ctx.lineWidth = 1.5; ctx.strokeRect(51, 51, 798, 1098);
    const locale = getLanguageLocale(language), family = certificateFont(language);
    const words = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(locale, { granularity: 'word' }) : null;
    const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(locale, { granularity: 'grapheme' }) : null;
    const characters = (value: string): string[] => {
      if (graphemes) return [...graphemes.segment(value)].map(segment => segment.segment);
      const result: string[] = [];
      for (const character of value) {
        const previous = result.at(-1);
        if (previous && (/^[\p{Mark}\u200d\ufe0e\ufe0f\u{1f3fb}-\u{1f3ff}]$/u.test(character) || previous.endsWith('\u200d')
          || (/^\p{Regional_Indicator}$/u.test(character) && /^\p{Regional_Indicator}$/u.test(previous)))) result[result.length - 1] += character;
        else result.push(character);
      }
      return result;
    };
    const wrap = (value: string): string[] => {
      const segments = words ? [...words.segment(value)].map(segment => segment.segment) : value.split(/(\s+)/u);
      const lines: string[] = []; let line = '';
      for (const segment of segments) {
        if (ctx.measureText(line + segment).width <= 730) { line += segment; continue; }
        if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
        const trimmed = segment.trimStart();
        if (ctx.measureText(trimmed).width <= 730) { line = trimmed; continue; }
        // Long words and names wrap at a grapheme boundary, preserving combining marks.
        for (const character of characters(trimmed)) {
          if (line && ctx.measureText(line + character).width > 730) { lines.push(line); line = ''; }
          line += character;
        }
      }
      if (line.trim()) lines.push(line.trimEnd());
      return lines;
    };
    const text = (value: string, top: number, height: number, size: number, color = '#203a45', weight = '500') => {
      for (let fitted = size; fitted >= 14; fitted--) {
        ctx.font = `${weight} ${fitted}px ${family}`;
        const lines = wrap(value), metrics = lines.map(line => ctx.measureText(line));
        const ascent = Math.max(fitted * 0.8, ...metrics.map(metric => metric.actualBoundingBoxAscent ?? fitted * 0.8));
        const descent = Math.max(fitted * 0.3, ...metrics.map(metric => metric.actualBoundingBoxDescent ?? fitted * 0.3));
        const lineHeight = Math.max(fitted * 1.45, ascent + descent + 4);
        if (lines.length * lineHeight > height || metrics.some(metric => metric.width > 730)) continue;
        ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        const baseline = top + (height - lines.length * lineHeight) / 2 + (lineHeight - ascent - descent) / 2 + ascent;
        lines.forEach((line, index) => ctx.fillText(line, 450, baseline + index * lineHeight));
        return;
      }
      throw new Error(t('賞状画像を作成できませんでした。', {}, language));
    };
    text('T A K K E U', 112, 48, 27, '#88713f', '700');
    text(t('賞 状', {}, language), 184, 126, 88, '#203a45', '700');
    ctx.beginPath(); ctx.moveTo(285, 321); ctx.lineTo(615, 321); ctx.stroke();
    text(t('{name} 殿', { name: data.hall?.displayName ?? (data.name || t('プレイヤー', {}, language)) }, language), 359, 100, 58, '#203a45', '700');
    text(data.hall ? t('殿堂登録 第{number}号', { number: formatNumber(data.hall.number, language) }, language) : t('3500ラリー達成', {}, language), 477, 70, 35, '#997134', '700');
    text(t('あなたはタッケウにおいて', {}, language), 578, 58, 29);
    text(t('3500ラリーを達成しました。', {}, language), 642, 70, 32, '#203a45', '700');
    text(t('その集中力と正確な返球を', {}, language), 718, 53, 27);
    text(t('ここに称えます。', {}, language), 775, 53, 27);
    text(t('3500ラリークリア', {}, language), 854, 65, 39, '#997134', '700');
    const date = certificateDate(data.hall?.registeredAt ?? data.achievedAt, language);
    text(data.hall ? t('殿堂登録日 {date}（UTC）', { date }, language) : t('達成日 {date}（端末時刻・UTC）', { date }, language), 944, 68, 23);
    text(t('今回の落球数 {count}球', { count: formatNumber(data.lostBalls, language) }, language), 1018, 43, 23);
    text(data.hall ? t('登録名ごとの初回クリアを記念して', {}, language) : t('達成記念・殿堂番号なし', {}, language), 1070, 58, 20, '#6a756c');
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(t('賞状画像を保存できませんでした。', {}, language))), 'image/png'));
  } finally { canvas.width = 0; canvas.height = 0; }
}

/** An in-flight PNG belongs to its result and language. */
export function createCertificateControls(host: HTMLElement) {
  host.innerHTML = `<h3 data-certificate-heading></h3><p data-certificate-description></p>
    <button type="button" class="button subtle" data-certificate-create></button>
    <p data-certificate-message role="status" aria-live="polite"></p>
    <div data-certificate-preview hidden><img data-certificate-image alt="" width="900" height="1200">
      <a class="button subtle" data-certificate-download target="_blank" rel="noopener noreferrer"></a>
      <button type="button" class="button subtle" data-certificate-share hidden></button>
      <p data-certificate-save-help></p></div>`;
  const get = <T extends HTMLElement>(s: string) => host.querySelector<T>(s)!;
  const create = get<HTMLButtonElement>('[data-certificate-create]'), share = get<HTMLButtonElement>('[data-certificate-share]');
  const preview = get('[data-certificate-preview]'), image = get<HTMLImageElement>('[data-certificate-image]');
  const link = get<HTMLAnchorElement>('[data-certificate-download]'), message = get('[data-certificate-message]');
  let data: CertificateData | null = null, key = '', epoch = 0, url: string | null = null, file: File | null = null, disposed = false;
  const translateControls = () => {
    host.setAttribute('aria-label', t('クリア賞状'));
    get('[data-certificate-heading]').textContent = t('クリア賞状');
    get('[data-certificate-description]').textContent = t('画像を作って保存できます。');
    create.textContent = t('賞状画像を作る'); link.textContent = t('画像を保存'); share.textContent = t('賞状画像を共有');
    get('[data-certificate-save-help]').textContent = t('保存できない場合は、画像を長押しして保存できます。');
    if (!url) image.alt = t('3500ラリー達成賞状');
  };
  const release = () => {
    if (url) URL.revokeObjectURL(url);
    url = null; file = null; preview.hidden = true; share.hidden = true;
    image.removeAttribute('src'); image.alt = t('3500ラリー達成賞状');
    link.removeAttribute('href'); link.removeAttribute('download'); message.textContent = '';
    create.disabled = false; create.removeAttribute('aria-busy');
  };
  const generate = async () => {
    if (!data) return;
    const request = ++epoch, current = data, language = getLanguage();
    release();
    create.disabled = true; create.setAttribute('aria-busy', 'true'); message.textContent = t('賞状画像を作成しています。', {}, language);
    try {
      const blob = await createCertificateImage(current, host.ownerDocument, language);
      if (request !== epoch || language !== getLanguage()) return;
      url = URL.createObjectURL(blob);
      const filename = current.hall ? `takkeu-3500-hall-${current.hall.number}.png` : 'takkeu-3500-clear.png';
      file = new File([blob], filename, { type: 'image/png' });
      image.src = url; image.alt = current.hall ? t('{name}の3500ラリー殿堂入り賞状・殿堂登録 第{number}号', { name: current.hall.displayName, number: formatNumber(current.hall.number, language) }, language) : t('{name}の3500ラリー達成賞状（殿堂番号なし）', { name: current.name || t('プレイヤー', {}, language) }, language);
      link.href = url; link.download = filename; preview.hidden = false;
      share.hidden = true;
      try { share.hidden = !(typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })); }
      catch { /* File sharing can be unavailable while PNG saving still works. */ }
      message.textContent = t('賞状画像を作成しました。', {}, language);
    } catch { if (request === epoch && language === getLanguage()) message.textContent = t('賞状画像を作成できませんでした。もう一度お試しください。', {}, language); }
    finally { if (request === epoch) { create.disabled = false; create.removeAttribute('aria-busy'); } }
  };
  const shareImage = async () => {
    if (!file || typeof navigator.share !== 'function') return;
    const request = epoch, sharedFile = file, language = getLanguage();
    try { await navigator.share({ files: [sharedFile], title: t('タッケウ 3500ラリー達成賞状', {}, language) }); }
    catch (error) {
      if (request === epoch && file === sharedFile && language === getLanguage() && !(error instanceof DOMException && error.name === 'AbortError')) {
        message.textContent = t('共有できませんでした。「画像を保存」か画像の長押しをご利用ください。', {}, language);
      }
    }
  };
  const languageKey = (next: CertificateData | null) => JSON.stringify([getLanguage(), next]);
  const unsubscribe = onLanguageChange(() => { epoch++; key = languageKey(data); release(); translateControls(); });
  translateControls();
  create.addEventListener('click', generate); share.addEventListener('click', shareImage);
  return {
    set(next: CertificateData | null) {
      if (disposed) return;
      const nextKey = languageKey(next);
      if (key === nextKey) return;
      key = nextKey; epoch++; data = next; release(); host.hidden = !next;
    },
    dispose() { disposed = true; epoch++; data = null; unsubscribe(); release(); create.removeEventListener('click', generate); share.removeEventListener('click', shareImage); },
  };
}
