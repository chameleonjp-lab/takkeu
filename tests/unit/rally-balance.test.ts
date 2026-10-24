import { expect, it } from 'vitest';
import { ballCountAtScore, ballRewardScore } from '../../src/game/milestones';
import { advanceProgression } from '../../src/game/progression';
import { createObjects } from '../../src/render/objects';
import { applyPresentation, isBallVisible } from '../../src/render/presentation';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { measureFlight } from '../helpers/remainingBall';
import { incoming, scenario } from '../helpers/scenarios';

it.each([
  [49, 6], [50, 7], [51, 7], [53, 7], [54, 8], [99, 19], [100, 19],
  [137, 28], [138, 29], [139, 29], [140, 30], [141, 30], [142, 30], [143, 31],
  [218, 56], [219, 56], [220, 57], [221, 57], [222, 58], [278, 86], [279, 86],
  [280, 87], [281, 88], [309, 116], [310, 118], [311, 120], [389, 276],
  [390, 279], [391, 282], [450, 459], [470, 519], [471, 522], [555, 774],
])('%iラリーまでに獲得する球は%i球（落球の補充なし）', (score, count) => {
  expect(ballCountAtScore(score)).toBe(count);
});

it.each([[49, 50, 1], [53, 54, 1], [139, 143, 2], [219, 222, 2], [279, 281, 2], [309, 311, 4], [389, 391, 6], [469, 471, 6]])(
  '%i→%iの報酬を%i球だけ付与し、再評価では重複しない', (before, after, count) => {
    const first = advanceProgression(scenario(before).state.progression, before, after, 20);
    expect(first.addedBalls).toBe(count);
    expect(advanceProgression(first.state, before, after, 21).addedBalls).toBe(0);
  },
);

it('1ラリーで複数球を得ても報酬スコアと視覚節目は一度だけ通知する', () => {
  expect([116, 117, 118, 276, 277, 278].map(ballRewardScore)).toEqual([310, 310, 311, 390, 390, 390]);
  const s = scenario(389); s.state.balls = [incoming(1, 20.002)];
  const result = s.step();
  expect(result.snapshot.score).toBe(390);
  expect(result.snapshot.balls).toHaveLength(4);
  expect(new Set(result.snapshot.balls.map(b => b.id)).size).toBe(4);
  expect(result.events.filter(e => e.kind === 'milestone').map(e => e.milestone)).toEqual([390]);
});

it.each([
  [99, false], [100, false], [101, false], [419, true], [420, false],
  [479, false], [480, true], [490, true], [555, true],
])('%iの相手コートの待機球を隠し虹色の上の飛行球だけ表示', (score, flyingVisible) => {
  const base = scenario(score).snapshot(), objects = createObjects(DEFAULT_CONFIG);
  for (const phase of ['queued', 'waiting-return', 'incoming', 'outgoing', 'lost'] as const) {
    for (const x of [-0.5, 0.5]) {
      const ball = { id: 1, phase, position: { x, y: 0.5, z: -1 }, smash: false };
      const snapshot = { ...base, balls: [ball] }, visible = flyingVisible && (phase === 'incoming' || phase === 'outgoing');
      expect(isBallVisible(ball, snapshot)).toBe(visible);
      applyPresentation(objects, snapshot);
      expect(objects.balls.size).toBe(visible ? 1 : 0);
    }
  }
  objects.dispose();
});

it.each([
  [299, 0.7866942097611996], [300, 0.7864771901625253], [301, 0.7862626862718127],
  [400, 0.7736636156854885], [450, 0.6168287475897574], [540, 0.48050883024859936],
])('%iの実飛行時間は300目からの増速分1.1倍を反映する', (score, duration) => {
  expect(measureFlight(score, 2).duration).toBeCloseTo(duration, 10);
});

it.each([99, 100, 101, 450, 500, 540, 555])('%iの実際の飛行は残球1球だけ1.2倍になる', score => {
  const baseline = measureFlight(score, 5);
  for (const count of [1, 2, 3, 5]) {
    const actual = measureFlight(score, count);
    expect(baseline.duration / actual.duration).toBeCloseTo(score >= 100 && count === 1 ? 1.2 : 1, 8);
  }
});
