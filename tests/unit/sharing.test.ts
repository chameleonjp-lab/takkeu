import { expect, it } from 'vitest';
import { homeShareUrl, scoreShareUrl } from '../../src/ranking/config';

const canonicalUrl = 'https://chameleonjp-lab.github.io/takkeu/';

function share(url: string | null, separateUrl = true) {
  expect(url).not.toBeNull();
  const intent = new URL(url!);
  expect(intent.origin + intent.pathname).toBe('https://twitter.com/intent/tweet');
  expect(intent.searchParams.get('url')).toBe(separateUrl ? canonicalUrl : null);
  return intent.searchParams.get('text');
}

it.each([0, 1, 42, 1234567890, Number.MAX_SAFE_INTEGER])('shares the finalized result %s, including zero and scores above the ranking limit', score => {
  expect(share(scoreShareUrl(score), false)).toBe(`タッケウで${score}ラリー達成！\nあなたは何ラリーできるかな？\n#タッケウ\nhttps://chameleonjp-lab.github.io/takkeu/`);
});

it.each([1, 42, 1234567890, Number.MAX_SAFE_INTEGER])('shares a valid home best of %s', best => {
  expect(share(homeShareUrl(best))).toBe(`卓球ゲーム「タッケウ」で自己ベスト${best}ラリー！\n何ラリーつなげられる？ #タッケウ`);
});

it.each([0, -1, -0.5, 0.5, NaN, Infinity, -Infinity, undefined, null, '42'])('uses generic home copy for missing, zero or invalid best %s', best => {
  expect(share(homeShareUrl(best as number))).toBe('タップ＆ドラッグで遊べる卓球ゲーム「タッケウ」！\n何ラリーつなげられる？ #タッケウ');
});

it.each([-1, -0.5, 0.5, NaN, Infinity, -Infinity, undefined, null, '42'])('does not build a result share for invalid score %s', score => {
  expect(scoreShareUrl(score as number)).toBeNull();
});
