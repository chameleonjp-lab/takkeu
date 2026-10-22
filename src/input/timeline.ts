import type { InputFrame, InputSample, PaddlePoint } from '../game/types';
export interface InputTimeline { enqueue(sample: InputSample): void; sampleAt(simTime: number): InputFrame; clear(target: PaddlePoint): void }
export function createInputTimeline(initial: PaddlePoint): InputTimeline {
  let target = { ...initial };
  let queue: InputSample[] = [];
  return {
    enqueue(sample) {
      if (!Number.isFinite(sample.at) || !Number.isFinite(sample.target.x) || !Number.isFinite(sample.target.y)) return;
      queue.push({ at: sample.at, target: { ...sample.target } });
      queue.sort((a, b) => a.at - b.at);
    },
    sampleAt(simTime) {
      while (queue[0] && queue[0].at <= simTime + 1e-10) target = { ...queue.shift()!.target };
      return { target: { ...target } };
    },
    clear(position) { queue = []; target = { ...position }; },
  };
}
