import type { HallEntry } from '../ranking/client';

export type CertificateData = Readonly<{ name: string; hall: HallEntry | null; achievedAt: string; lostBalls: number }>;
export function certificateDate(timestamp: string): string {
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(timestamp));
}

/** Generated only on the result screen, never in a gameplay/render loop. */
export async function createCertificateImage(data: CertificateData, doc = document): Promise<Blob> {
  await doc.fonts?.ready;
  const canvas = doc.createElement('canvas'); canvas.width = 900; canvas.height = 1200;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('賞状画像を作成できませんでした。');
    ctx.fillStyle = '#fbf5e6'; ctx.fillRect(0, 0, 900, 1200);
    ctx.strokeStyle = '#b68c43'; ctx.lineWidth = 5; ctx.strokeRect(34, 34, 832, 1132);
    ctx.lineWidth = 1.5; ctx.strokeRect(51, 51, 798, 1098);
    const text = (value: string, y: number, size: number, color = '#203a45', weight = '500') => {
      let fitted = size;
      ctx.font = `${weight} ${fitted}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
      while (ctx.measureText(value).width > 730 && fitted > 20) {
        fitted--; ctx.font = `${weight} ${fitted}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
      }
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(value, 450, y, 730);
    };
    text('T A K K E U', 142, 27, '#88713f', '700');
    text('賞 状', 278, 96, '#203a45', '700');
    ctx.beginPath(); ctx.moveTo(285, 321); ctx.lineTo(615, 321); ctx.stroke();
    text(`${data.hall?.displayName ?? data.name} 殿`, 426, 58, '#203a45', '700');
    text(data.hall ? `殿堂登録 第${data.hall.number}号` : '3000ラリー達成', 510, 35, '#997134', '700');
    text('あなたはタッケウにおいて', 617, 29);
    text('3000ラリーを達成しました。', 670, 32, '#203a45', '700');
    text('その集中力と正確な返球を', 733, 27);
    text('ここに称えます。', 777, 27);
    text('3000 RALLY CLEAR', 893, 39, '#997134', '700');
    const date = certificateDate(data.hall?.registeredAt ?? data.achievedAt);
    text(data.hall ? `殿堂登録日 ${date}（UTC）` : `達成日 ${date}（端末時刻・UTC）`, 982, 23);
    text(`今回の落球数 ${data.lostBalls}球`, 1026, 23);
    text(data.hall ? '登録名ごとの初回クリアを記念して' : '達成記念・殿堂番号なし', 1087, 20, '#6a756c');
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('賞状画像を保存できませんでした。')), 'image/png'));
  } finally { canvas.width = 0; canvas.height = 0; }
}

/** An in-flight PNG belongs to its result. Leaving/retrying revokes its URL. */
export function createCertificateControls(host: HTMLElement) {
  host.innerHTML = `<h3>クリア賞状</h3><p>画像を作って保存できます。</p>
    <button type="button" class="button subtle" data-certificate-create>賞状画像を作る</button>
    <p data-certificate-message role="status" aria-live="polite"></p>
    <div data-certificate-preview hidden><img data-certificate-image alt="3000ラリー達成賞状" width="900" height="1200">
      <a class="button subtle" data-certificate-download target="_blank" rel="noopener noreferrer">画像を保存</a>
      <button type="button" class="button subtle" data-certificate-share hidden>賞状画像を共有</button>
      <p>保存できない場合は、画像を長押しして保存できます。</p></div>`;
  const get = <T extends HTMLElement>(s: string) => host.querySelector<T>(s)!;
  const create = get<HTMLButtonElement>('[data-certificate-create]'), share = get<HTMLButtonElement>('[data-certificate-share]');
  const preview = get('[data-certificate-preview]'), image = get<HTMLImageElement>('[data-certificate-image]');
  const link = get<HTMLAnchorElement>('[data-certificate-download]'), message = get('[data-certificate-message]');
  let data: CertificateData | null = null, key = '', epoch = 0, url: string | null = null, file: File | null = null;
  const release = () => {
    if (url) URL.revokeObjectURL(url);
    url = null; file = null; preview.hidden = true; share.hidden = true;
    image.removeAttribute('src'); link.removeAttribute('href'); message.textContent = '';
    create.disabled = false; create.removeAttribute('aria-busy');
  };
  const generate = async () => {
    if (!data) return;
    const request = ++epoch, current = data;
    create.disabled = true; create.setAttribute('aria-busy', 'true'); message.textContent = '賞状画像を作成しています。';
    try {
      const blob = await createCertificateImage(current, host.ownerDocument);
      if (request !== epoch) return;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      const filename = current.hall ? `takkeu-hall-${current.hall.number}.png` : 'takkeu-3000-clear.png';
      file = new File([blob], filename, { type: 'image/png' });
      image.src = url; image.alt = current.hall ? `${current.hall.displayName}の殿堂入り賞状・殿堂登録 第${current.hall.number}号` : `${current.name}の3000ラリー達成賞状（殿堂番号なし）`;
      link.href = url; link.download = filename; preview.hidden = false;
      share.hidden = true;
      try { share.hidden = !(typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })); }
      catch { /* File sharing can be unavailable while PNG saving still works. */ }
      message.textContent = '賞状画像を作成しました。';
    } catch { if (request === epoch) message.textContent = '賞状画像を作成できませんでした。もう一度お試しください。'; }
    finally { if (request === epoch) { create.disabled = false; create.removeAttribute('aria-busy'); } }
  };
  const shareImage = async () => {
    if (!file || typeof navigator.share !== 'function') return;
    try { await navigator.share({ files: [file], title: 'タッケウ 3000ラリー達成賞状' }); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) message.textContent = '共有できませんでした。「画像を保存」か画像の長押しをご利用ください。'; }
  };
  create.addEventListener('click', generate); share.addEventListener('click', shareImage);
  return {
    set(next: CertificateData | null) {
      const nextKey = JSON.stringify(next);
      if (key === nextKey) return;
      key = nextKey; epoch++; data = next; release(); host.hidden = !next;
    },
    dispose() { epoch++; data = null; release(); create.removeEventListener('click', generate); share.removeEventListener('click', shareImage); },
  };
}
