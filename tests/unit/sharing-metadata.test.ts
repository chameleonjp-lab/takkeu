// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('provides one description and image alt in the initial HTML for both social card formats', () => {
  const html = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
  const meta = (key: string) => html.querySelector(`meta[name="${key}"], meta[property="${key}"]`)?.getAttribute('content');
  for (const key of ['description', 'og:description', 'twitter:description']) {
    expect(meta(key)).toBe('タップ＆ドラッグで遊べる卓球ゲーム「タッケウ」。何ラリーつなげられる？');
  }
  for (const key of ['og:image:alt', 'twitter:image:alt']) {
    expect(meta(key)).toBe('緑の卓球台と赤いラケットが映る卓球ゲーム「タッケウ」の画面。つなげ、ラリー。');
  }
});
