import { Color, Float32BufferAttribute, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial } from 'three';
import type { BufferGeometry } from 'three';
import type { BallSnapshot, GameSnapshot } from '../game/types';
import { colorBall } from './objects';
import type { createObjects } from './objects';
import { samplePulse, sampleRainbow } from './rainbow';

export type PartId = 'selfCourtRight' | 'selfCourtLeft' | 'opponentCourtRight' | 'opponentCourtLeft' | 'courtEdges' | 'net' | 'playerRacketBody' | 'playerRacketEdge' | 'opponentRacketBody' | 'opponentRacketEdge' | 'opponentBody';
export type PartState = Readonly<{ visible: boolean; rainbow: boolean }>;
export type PresentationState = Readonly<{
  parts: Readonly<Record<PartId, PartState>>; balls: Readonly<Record<number, PartState>>;
  pulseStrength: number; opponentEdgesVisible: boolean;
}>;
type VisualSnapshot = Pick<GameSnapshot, 'simTime' | 'progression'>;
function glowing(snapshot?: VisualSnapshot): boolean {
  return !!snapshot && (snapshot.progression.appliedMilestones.includes(30) || (snapshot.progression.ballGlowUntil !== null && snapshot.simTime < snapshot.progression.ballGlowUntil));
}
export function isBallVisible(ball: BallSnapshot, snapshot?: VisualSnapshot): boolean {
  if (ball.phase === 'lost' || ball.phase === 'queued') return false;
  if (ball.position.z >= 0) return true;
  if (snapshot?.progression.appliedMilestones.includes(420)) return false;
  return glowing(snapshot);
}
export function resolvePresentation(snapshot: GameSnapshot): PresentationState {
  const reached = (n: number) => snapshot.progression.appliedMilestones.includes(n);
  const part = (n: number, initiallyVisible = false): PartState => ({ visible: initiallyVisible || reached(n), rainbow: reached(n) });
  return {
    parts: {
      selfCourtRight: part(160, true), selfCourtLeft: part(210, true),
      opponentCourtRight: part(190), opponentCourtLeft: part(240), courtEdges: part(70, true),
      net: part(130, true), playerRacketBody: part(270, true), playerRacketEdge: part(100, true),
      opponentRacketBody: part(330), opponentRacketEdge: part(300), opponentBody: part(360),
    },
    balls: Object.fromEntries(snapshot.balls.map(ball => [ball.id, { visible: isBallVisible(ball, snapshot), rainbow: glowing(snapshot) }])),
    pulseStrength: reached(390) ? samplePulse(snapshot.simTime) : 1,
    opponentEdgesVisible: reached(70),
  };
}
function colorVertices(geometry: BufferGeometry, time: number): void {
  const points = geometry.attributes.position!;
  if (!geometry.attributes.color) geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(points.count * 3), 3));
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const width = Math.max(1e-8, bounds.max.x - bounds.min.x), height = Math.max(1e-8, bounds.max.y - bounds.min.y);
  const depth = Math.max(1e-8, bounds.max.z - bounds.min.z), colors = geometry.attributes.color!;
  for (let i = 0; i < points.count; i++) {
    const vertical = height > 1e-7 ? (points.getY(i) - bounds.min.y) / height : (points.getZ(i) - bounds.min.z) / depth;
    const rgb = sampleRainbow(time, 0.35 * (points.getX(i) - bounds.min.x) / width + 0.65 * vertical);
    colors.setXYZ(i, rgb.r, rgb.g, rgb.b);
  }
  colors.needsUpdate = true;
}
export function applyPresentation(objects: ReturnType<typeof createObjects>, snapshot: GameSnapshot): void {
  const state = resolvePresentation(snapshot);
  for (const [id, object] of Object.entries(objects.parts)) {
    const part = state.parts[id as PartId]; object.visible = part.visible;
    // Every part owns its material. Hidden surfaces cannot acquire another part's glow.
    object.traverse(child => {
      if (!(child instanceof Mesh || child instanceof LineSegments)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial || material instanceof LineBasicMaterial)) continue;
        if (material.vertexColors !== part.rainbow) { material.vertexColors = part.rainbow; material.needsUpdate = true; }
        if (part.rainbow) {
          colorVertices(child.geometry, snapshot.simTime);
          const rgb = sampleRainbow(snapshot.simTime, 0);
          material.color.setRGB(1, 1, 1).multiplyScalar(0.7 * state.pulseStrength);
          if (material instanceof MeshStandardMaterial) {
            material.emissive.setRGB(rgb.r, rgb.g, rgb.b); material.emissiveIntensity = 0.12 * state.pulseStrength;
          } else material.opacity = 0.9;
        } else {
          material.color.copy(material.userData.baseColor as Color);
          if (material instanceof MeshStandardMaterial) {
            material.emissive.copy(material.userData.baseEmissive as Color); material.emissiveIntensity = material.userData.baseIntensity as number;
          } else material.opacity = material.userData.baseOpacity as number;
        }
      }
    });
  }
  objects.opponentCourt.visible = state.parts.opponentCourtLeft.visible || state.parts.opponentCourtRight.visible;
  objects.opponentEdges.visible = state.opponentEdgesVisible;
  objects.opponentPaddle.visible = state.parts.opponentRacketBody.visible || state.parts.opponentRacketEdge.visible;
  objects.playerPaddle.position.x = snapshot.paddle.x; objects.playerPaddle.position.y = snapshot.paddle.y;
  for (const [id, visual] of objects.balls) {
    const ball = snapshot.balls.find(b => b.id === id), style = state.balls[id];
    // One visibility gate for the entire ball subtree, including all light/outline effects.
    visual.root.visible = !!ball && !!style?.visible;
    if (!ball || !style) continue;
    visual.root.position.set(ball.position.x, ball.position.y, ball.position.z);
    visual.glow.visible = style.rainbow;
    visual.core.scale.setScalar(style.rainbow ? 0.9 : 1);
    if (style.rainbow) colorBall(visual.glow, snapshot.simTime);
  }
}
