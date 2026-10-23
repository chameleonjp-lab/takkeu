import type { InputFrame, InputSample, PaddlePoint } from '../game/types';
export interface InputTimeline { enqueue(sample: InputSample): void; take(start: number, end: number): InputFrame; clear(target: PaddlePoint): void }
export function createInputTimeline(initial: PaddlePoint): InputTimeline {
  let target = { ...initial };
  let queue: InputSample[] = [];
  let committed = -Infinity;
  return {
    enqueue(sample) {
      if (!Number.isFinite(sample.at) || sample.at < committed - 1e-10 || !Number.isFinite(sample.target.x) || !Number.isFinite(sample.target.y)) return;
      queue.push({ ...sample, target: { ...sample.target } });
      queue.sort((a, b) => a.at - b.at);
    },
    take(start, end) {
      const previous = { ...target }, samples: InputSample[] = [];
      while (queue[0] && queue[0].at <= end + 1e-10) {
        const sample = queue.shift()!;
        if (sample.at < start - 1e-10) continue;
        samples.push(sample); target = { ...sample.target };
      }
      committed = end;
      return { target: previous, samples };
    },
    clear(position) { queue = []; target = { ...position }; committed = -Infinity; },
  };
}
