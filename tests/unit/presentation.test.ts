import { expect, it } from 'vitest';
import { Mesh, MeshStandardMaterial } from 'three';
import { createSession } from '../../src/game/session';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { isBallVisible, applyPresentation, resolvePresentation } from '../../src/render/presentation';
import { samplePulse, sampleRainbow } from '../../src/render/rainbow';
import { createObjects } from '../../src/render/objects';
import { advance } from '../helpers/fixtures';
import { scenario } from '../helpers/scenarios';
import type { BallSnapshot } from '../../src/game/types';

it('相手側は暗闇に隠し、自側と不可視の相手の返球計算を保つ', () => {
  const session = createSession(DEFAULT_CONFIG, 7); session.start();
  const objects = createObjects(DEFAULT_CONFIG);
  applyPresentation(objects, session.snapshot());
  expect(objects.opponentCourt.visible).toBe(false);
  expect(objects.opponentEdges.visible).toBe(false);
  expect(objects.opponentPaddle.visible).toBe(false);
  expect(objects.opponentBody.visible).toBe(false);
  expect(objects.playerCourt.visible).toBe(true);
  expect(isBallVisible(session.snapshot().balls[0]!)).toBe(false);
  const events = advance(session, 5.3);
  expect(events.filter(e => e.kind === 'opponent-hit')).toHaveLength(2);
  expect(session.snapshot().score).toBe(1);
  expect(isBallVisible({ id: 1, phase: 'incoming', position: { x: 0, y: 0.5, z: 0 }, smash: false })).toBe(true);
  objects.dispose();
});

it('最新21行の進行表の部位を順に解放し、未解放の本体を漏らさない', () => {
  const changes = [
    [70, 'courtEdges'], [100, 'playerRacketEdge'], [130, 'net'],
    [160, 'selfCourtRight'], [190, 'opponentCourtRight'], [210, 'selfCourtLeft'],
    [240, 'opponentCourtLeft'], [300, 'opponentRacketEdge'],
    [330, 'opponentRacketBody'], [360, 'opponentBody'],
    [380, 'opponentFloor'], [410, 'selfFloor'], [420, 'opponentWall'],
  ] as const;
  for (const [score, part] of changes) {
    expect(resolvePresentation(scenario(score - 1).snapshot()).parts[part].rainbow).toBe(false);
    expect(resolvePresentation(scenario(score).snapshot()).parts[part]).toEqual({ visible: true, rainbow: true });
  }
  const at70 = resolvePresentation(scenario(70).snapshot());
  expect(at70.opponentEdgesVisible).toBe(true);
  for (const part of ['opponentCourtRight', 'opponentCourtLeft', 'opponentRacketBody', 'opponentRacketEdge'] as const) expect(at70.parts[part]).toEqual({ visible: false, rainbow: false });
  expect(at70.parts.opponentBody.visible).toBe(false);
  expect(resolvePresentation(scenario(190).snapshot()).parts.opponentCourtLeft.rainbow).toBe(false);
  expect(resolvePresentation(scenario(300).snapshot()).parts.opponentRacketBody.rainbow).toBe(false);
  expect(resolvePresentation(scenario(330).snapshot()).parts.opponentBody.visible).toBe(false);
});

it('10の発光は5秒ちょうどで終わり、30の常時虹色が優先する', () => {
  const s = scenario(10, 24.999);
  s.state.progression = { ...s.state.progression, appliedMilestones: [10], ballGlowUntil: 25 };
  const ball: BallSnapshot = { id: 1, phase: 'incoming', position: { x: 0, y: 0.5, z: -0.01 }, smash: false };
  const state = () => ({ ...s.snapshot(), balls: [ball] });
  expect(resolvePresentation(state()).balls[1]).toEqual({ visible: true, rainbow: true });
  s.state.simTime = 25;
  expect(resolvePresentation(state()).balls[1]).toEqual({ visible: false, rainbow: false });
  s.state.progression = { ...s.state.progression, appliedMilestones: [10, 30], ballGlowUntil: 25 };
  expect(resolvePresentation(state()).balls[1]).toEqual({ visible: true, rainbow: true });
});

it('419→420では相手側の球由来の部品だけを隠し、境界と返球待ちも扱う', () => {
  const s = scenario(419);
  const base = { id: 1, phase: 'incoming', position: { x: 0, y: 0.5, z: -0.1 }, smash: true } satisfies BallSnapshot;
  const state = (balls: BallSnapshot[]) => ({ ...s.snapshot(), balls });
  expect(resolvePresentation(state([base])).balls[1]!.visible).toBe(true);
  s.state.progression = { ...s.state.progression, appliedMilestones: [...s.state.progression.appliedMilestones, 420], ballGlowUntil: null };
  const before = structuredClone(state([base]));
  const parts = resolvePresentation(before).parts;
  for (const phase of ['incoming', 'outgoing', 'waiting-return'] as const) expect(resolvePresentation(state([{ ...base, phase }])).balls[1]!.visible).toBe(false);
  expect(resolvePresentation(state([{ ...base, position: { ...base.position, z: 0 } }])).balls[1]!.visible).toBe(true);
  for (const phase of ['queued', 'lost'] as const) expect(resolvePresentation(state([{ ...base, phase, position: { ...base.position, z: 1 } }])).balls[1]!.visible).toBe(false);
  expect(resolvePresentation(state([base])).parts).toEqual(parts);
  expect(state([base])).toEqual(before);
  const objects = createObjects(DEFAULT_CONFIG);
  applyPresentation(objects, state([base]));
  for (const visual of objects.balls.values()) expect(visual.root.visible).toBe(false);
  expect(objects.opponentBody.visible).toBe(true);
  objects.dispose();
});

it('30〜419の既存返球待ちは見え、初回待ちだけが隠れる', () => {
  const s = scenario(30).snapshot();
  const ball = { id: 1, phase: 'waiting-return', position: { x: 0, y: 0.5, z: -1.95 }, smash: false } satisfies BallSnapshot;
  expect(resolvePresentation({ ...s, balls: [ball] }).balls[1]!.visible).toBe(true);
  expect(resolvePresentation({ ...s, balls: [{ ...ball, phase: 'queued' }] }).balls[1]!.visible).toBe(false);
});

it('虹色の球は白い中心を保ち、M10終了とリトライで通常の黄色へ戻る', () => {
  const objects = createObjects(DEFAULT_CONFIG);
  const ball = { id: 1, phase: 'incoming', position: { x: 0, y: 0.5, z: 0.9 }, smash: false } satisfies BallSnapshot;
  for (const [score, time, until, white] of [[10, 24.99, 25, true], [10, 25, 25, false], [30, 26, 25, true], [390, 0.3, null, true], [0, 0, null, false]] as const) {
    const snapshot = scenario(score, time).snapshot();
    applyPresentation(objects, { ...snapshot, progression: { ...snapshot.progression, ballGlowUntil: until }, balls: [ball] });
    const core = objects.balls.get(1)!.core;
    expect(core.material.color.getHex(), `score=${score} time=${time}`).toBe(white ? 0xffffff : 0xffec64);
  }
  objects.dispose();
});

it('390の強→弱は0.3秒、周期は0.6秒で形と球の明るさを保つ', () => {
  expect(samplePulse(0)).toBeCloseTo(1);
  expect(samplePulse(0.3)).toBeCloseTo(0.65);
  expect(samplePulse(0.6)).toBeCloseTo(1);
  expect(samplePulse(0.15)).toBeCloseTo(0.825);
  expect(samplePulse(1.234)).toBeCloseTo(samplePulse(1.834), 10);
  for (let i = 0; i < 100; i++) {
    const a = samplePulse(i / 1000), b = samplePulse((i + 1) / 1000);
    expect(Math.abs(a - b)).toBeLessThan(0.002);
  }
  expect(resolvePresentation(scenario(389, 0.3).snapshot()).pulseStrength).toBe(1);
  expect(resolvePresentation(scenario(390, 0.3).snapshot()).pulseStrength).toBeCloseTo(0.65);
  const colors = Array.from({ length: 7 }, (_, i) => sampleRainbow(0, i / 7));
  expect(new Set(colors.map(c => JSON.stringify(c))).size).toBe(7);
});

it('部位の材質を共有して未解放面へ色を漏らさず、描画が計算を変えない', () => {
  const s = scenario(190);
  const objects = createObjects(DEFAULT_CONFIG);
  const snapshot = s.snapshot(), before = structuredClone(snapshot);
  applyPresentation(objects, snapshot);
  expect(objects.parts.selfCourtLeft.material).not.toBe(objects.parts.selfCourtRight.material);
  expect(objects.parts.opponentCourtRight.visible).toBe(true);
  expect(objects.parts.opponentCourtLeft.visible).toBe(false);
  expect(objects.parts.opponentCourtLeft.material.vertexColors).toBe(false);
  expect(objects.parts.playerRacketBody.visible).toBe(true);
  expect(objects.parts.opponentRacketBody.visible).toBe(false);
  expect(snapshot).toEqual(before);
  objects.dispose();
});


it('390で未解放の自側床と壁を先取りせず、解放済みの相手床だけが脈動する', () => {
  const objects = createObjects(DEFAULT_CONFIG);
  const before = resolvePresentation(scenario(379).snapshot());
  expect(before.parts.opponentFloor.visible).toBe(false);
  const at390 = resolvePresentation(scenario(390).snapshot());
  expect(at390.parts.opponentFloor).toEqual({ visible: true, rainbow: true });
  expect(at390.parts.selfFloor).toEqual({ visible: true, rainbow: false });
  expect(at390.parts.opponentWall).toEqual({ visible: false, rainbow: false });
  applyPresentation(objects, scenario(390).snapshot());
  expect(objects.parts.opponentFloor.visible).toBe(true);
  expect(objects.parts.opponentWall.visible).toBe(false);
  objects.dispose();
});

it('270の本体は単色で発光し、390から非球部品として虹色の強弱へ移る', () => {
  const objects = createObjects(DEFAULT_CONFIG);
  applyPresentation(objects, scenario(270).snapshot());
  const rubber = objects.parts.playerRacketBody.children[1] as import('three').Mesh<import('three').BufferGeometry, import('three').MeshStandardMaterial>;
  expect(rubber.material.emissiveIntensity).toBeGreaterThan(0.5);
  expect(rubber.material.emissive.getHex()).toBe(rubber.material.userData.baseColor.getHex());
  expect(rubber.material.vertexColors).toBe(false);
  const emissions = new Set<number>();
  objects.parts.playerRacketBody.traverse(child => {
    if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) emissions.add(child.material.emissive.getHex());
  });
  expect([...emissions]).toEqual([0xef252e]);
  applyPresentation(objects, scenario(390).snapshot());
  expect(rubber.material.vertexColors).toBe(true);
  objects.dispose();
});
