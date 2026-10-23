import { expect, it } from 'vitest';
import { createInputTimeline } from '../../src/input/timeline';

it('未来の入力を先取りせず、同時刻の種類と受理順を全て保持する', () => {
  const initial = { x: 0, y: .5 }, timeline = createInputTimeline(initial);
  const a = { kind: 'place' as const, at: .003, target: { x: -.2, y: .4 } };
  const b = { kind: 'move' as const, at: .004, target: { x: .7, y: .7 } };
  const c = { kind: 'release' as const, at: .004, target: b.target };
  timeline.enqueue({ kind: 'place', at: .020, target: initial });
  timeline.enqueue(a); timeline.enqueue(b); timeline.enqueue(c);
  expect(timeline.take(0, .002)).toEqual({ target: initial, samples: [] });
  expect(timeline.take(.002, .008)).toEqual({ target: initial, samples: [a, b, c] });
  expect(timeline.take(.008, .016)).toEqual({ target: b.target, samples: [] });
  expect(timeline.take(.016, .024).samples).toHaveLength(1);
});
it('clearは停止前の入力を捨て、再開の初期位置だけを保持する', () => {
  const timeline = createInputTimeline({ x: 0, y: .5 });
  timeline.enqueue({ at: 1, kind: 'move', target: { x: 1, y: .8 } });
  timeline.clear({ x: .1, y: .4 });
  expect(timeline.take(0, 2)).toEqual({ target: { x: .1, y: .4 }, samples: [] });
});
it('NaNと既に確定した区間への入力を拒否する', () => {
  const timeline = createInputTimeline({ x: 0, y: .5 });
  timeline.take(0, .1);
  timeline.enqueue({ at: .05, target: { x: 1, y: .8 } });
  timeline.enqueue({ at: NaN, target: { x: 1, y: .8 } });
  timeline.enqueue({ at: .11, target: { x: NaN, y: .8 } });
  expect(timeline.take(.1, .2).samples).toEqual([]);
});
