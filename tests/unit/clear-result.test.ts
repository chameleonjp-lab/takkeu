// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createScreens } from '../../src/ui/screens';
import { scenario } from '../helpers/scenarios';
import { scoreShareUrl } from '../../src/ranking/config';

const actions = { start() {}, pause() {}, resume() {}, retry() {}, home() {}, toggleSound() {}, volume() {} };
it('distinguishes a static clear and its certificate from an unfinished result', () => {
  const root = document.createElement('div'), screens = createScreens(root, actions);
  const clear = { ...scenario(3500).snapshot(), phase: 'gameover' as const, endReason: 'clear' as const };
  screens.render(clear);
  expect(root.querySelector('[data-result-comment]')!.textContent).toBe('3500ラリー達成！ゲームクリア！');
  expect(root.querySelector('[data-result]')!.getAttribute('data-cleared')).toBe('true');
  expect(root.querySelector('[data-certificate]')!.hasAttribute('hidden')).toBe(false);
  expect(root.querySelectorAll('[data-bolt]')).toHaveLength(0);
  screens.render({ ...clear, score: 2999, endReason: 'loss' });
  expect(root.querySelector('[data-result-comment]')!.textContent).not.toContain('クリア');
  expect(root.querySelector('[data-certificate]')!.hasAttribute('hidden')).toBe(true);
  screens.dispose();
});

it('shares a clear and an acknowledged hall number without inventing an ordinal', () => {
  const plain = new URL(scoreShareUrl(3500, true)!);
  expect(plain.searchParams.get('text')).toContain('ゲームクリア');
  expect(plain.searchParams.get('text')).not.toContain('第');
  expect(new URL(scoreShareUrl(3500, true, 7)!).searchParams.get('text')).toContain('殿堂登録 第7号');
  expect(scoreShareUrl(2999, true)).toBeNull();
});
it('keeps the90-99 loss warning readable between events and resets it on retry',()=>{
 const root=document.createElement('div'),screens=createScreens(root,actions);
 for(const lostBallCount of [89,90,98,99,100,0]){screens.render({...scenario(3200).snapshot(),lostBallCount});expect((root.querySelector('[data-losses]')as HTMLElement).dataset.danger).toBe(String(lostBallCount>=90&&lostBallCount<100));if(lostBallCount>=90&&lostBallCount<100)expect(root.querySelector('[data-losses-label]')?.textContent).toContain(`あと${100-lostBallCount}球`);}
 screens.dispose();
});
