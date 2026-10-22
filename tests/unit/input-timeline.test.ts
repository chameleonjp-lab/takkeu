import { expect, it } from 'vitest';
import { createInputTimeline } from '../../src/input/timeline';

it('未来の入力を先取りせず、同時刻では最後の入力を使う', () => {
  const timeline = createInputTimeline({ x: 0, y: 0.5 });
  timeline.enqueue({ at: 0.2, target: { x: 0.2, y: 0.6 } });
  timeline.enqueue({ at: 0.1, target: { x: -0.2, y: 0.4 } });
  timeline.enqueue({ at: 0.2, target: { x: 0.7, y: 0.7 } });
  expect(timeline.sampleAt(0.09).target).toEqual({ x: 0, y: 0.5 });
  expect(timeline.sampleAt(0.1).target).toEqual({ x: -0.2, y: 0.4 });
  expect(timeline.sampleAt(0.19).target).toEqual({ x: -0.2, y: 0.4 });
  expect(timeline.sampleAt(0.2).target).toEqual({ x: 0.7, y: 0.7 });
});

it('clearは停止前の未適用目標を捨てて実位置を保持する', () => {
  const timeline = createInputTimeline({ x: 0, y: 0.5 });
  timeline.enqueue({ at: 1, target: { x: 1, y: 0.8 } });
  timeline.clear({ x: 0.1, y: 0.4 });
  expect(timeline.sampleAt(10).target).toEqual({ x: 0.1, y: 0.4 });
});
