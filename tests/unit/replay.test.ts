import { expect, it } from 'vitest';
import { replay } from '../helpers/replay';

it('30/60/120回描画でも同じ時刻付き入力なら得点・残球・進行が一致する', () => {
  const inputs = [{ at: 0, target: { x: 0, y: 0.5 } }, { at: 4.7, target: { x: -0.5, y: 0.55 } }, { at: 6, target: { x: 1.05, y: 0.15 } }];
  const baseline = replay(120, inputs);
  expect(baseline.score).toBe(2);
  expect(baseline.phase).toBe('gameover');
  expect(replay(30, inputs)).toEqual(baseline);
  expect(replay(60, inputs)).toEqual(baseline);
});
