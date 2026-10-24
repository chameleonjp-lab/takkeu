import { expect, it, vi } from 'vitest';
import { Mesh } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createObjects } from '../../src/render/objects';
import { applyPresentation } from '../../src/render/presentation';
import { scenario } from '../helpers/scenarios';
import type { BallSnapshot } from '../../src/game/types';

const balls = (start: number, count: number): BallSnapshot[] => Array.from({ length: count }, (_, i) => ({ id: start + i, phase: 'incoming', smash: false, position: { x: 0.3, y: 0.5, z: 1 } }));
it('47球以上を表示し、共通の形状・虹色材質を再利用して落球後のIDを保持しない', () => {
  const objects = createObjects(DEFAULT_CONFIG);
  const snapshot = scenario(390).snapshot();
  applyPresentation(objects, { ...snapshot, balls: balls(1, 47) });
  expect(objects.balls.size).toBe(47);
  const cores = [...objects.balls.values()].map(v => v.core.geometry);
  expect(new Set(cores).size).toBe(1);
  expect(new Set([...objects.balls.values()].map(v => v.glow.geometry)).size).toBe(1);
  expect(new Set([...objects.balls.values()].map(v => v.core.material)).size).toBe(1);
  const count = () => { let n = 0; objects.root.traverse(o => { if (o instanceof Mesh) n++; }); return n; };
  const high = count();
  applyPresentation(objects, { ...snapshot, balls: [] });
  expect(objects.balls.size).toBe(0);
  for (let retry = 0; retry < 20; retry++) {
    applyPresentation(objects, { ...snapshot, runId: `retry-${retry}`, balls: balls(100 + retry * 47, 47) });
    expect(count()).toBe(high);
    expect(objects.balls.size).toBe(47);
  }
  const geometry = [...objects.balls.values()][0]!.core.geometry;
  const dispose = vi.spyOn(geometry, 'dispose');
  objects.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('420の相手球・未解放面の影・落球を漏らさず、次の通常球は黄色へ戻す', () => {
  const objects = createObjects(DEFAULT_CONFIG);
  const snapshot = scenario(30).snapshot();
  applyPresentation(objects, { ...snapshot, balls: [{ ...balls(1, 1)[0]!, position: { x: 0.5, y: 0.5, z: -0.7 } }] });
  expect(objects.balls.size).toBe(0);
  applyPresentation(objects, { ...scenario(190).snapshot(), balls: [{ ...balls(1, 1)[0]!, position: { x: 0.5, y: 0.5, z: -0.7 } }] });
  expect(objects.balls.get(1)!.shadow.visible).toBe(true);
  applyPresentation(objects, { ...scenario(420).snapshot(), balls: [{ ...balls(1, 1)[0]!, position: { x: 0.5, y: 0.5, z: -0.7 } }] });
  expect(objects.balls.size).toBe(0);
  applyPresentation(objects, { ...scenario(0).snapshot(), balls: balls(99, 1) });
  const visual = objects.balls.get(99)!;
  expect(visual.core.material.color.getHex()).toBe(0xffec64);
  expect(visual.glow.visible).toBe(false);
  objects.dispose();
});
