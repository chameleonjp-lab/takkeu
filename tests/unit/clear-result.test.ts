// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createScreens } from '../../src/ui/screens';
import { scenario } from '../helpers/scenarios';
import { scoreShareUrl } from '../../src/ranking/config';

const actions = { start() {}, pause() {}, resume() {}, retry() {}, home() {}, toggleSound() {}, volume() {} };
it('distinguishes a static clear and its certificate from an unfinished result', () => {
  const root = document.createElement('div'), screens = createScreens(root, actions);
  const clear = { ...scenario(3000).snapshot(), phase: 'gameover' as const, endReason: 'clear' as const };
  screens.render(clear);
  expect(root.querySelector('[data-result-comment]')!.textContent).toBe('3000ラリー達成！ゲームクリア！');
  expect(root.querySelector('[data-result]')!.getAttribute('data-cleared')).toBe('true');
  expect(root.querySelector('[data-certificate]')!.hasAttribute('hidden')).toBe(false);
  expect(root.querySelectorAll('[data-bolt]')).toHaveLength(0);
  screens.render({ ...clear, score: 2999, endReason: 'loss' });
  expect(root.querySelector('[data-result-comment]')!.textContent).not.toContain('クリア');
  expect(root.querySelector('[data-certificate]')!.hasAttribute('hidden')).toBe(true);
  screens.dispose();
});

it('shares a clear and an acknowledged hall number without inventing an ordinal', () => {
  const plain = new URL(scoreShareUrl(3000, true)!);
  expect(plain.searchParams.get('text')).toContain('ゲームクリア');
  expect(plain.searchParams.get('text')).not.toContain('第');
  expect(new URL(scoreShareUrl(3000, true, 7)!).searchParams.get('text')).toContain('殿堂登録 第7号');
  expect(scoreShareUrl(2999, true)).toBeNull();
});
