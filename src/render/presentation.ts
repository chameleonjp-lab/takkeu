import { Color, Float32BufferAttribute, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial } from 'three';
import type { BufferGeometry } from 'three';
import type { BallSnapshot, GameSnapshot } from '../game/types';
import type { createObjects } from './objects';
import { samplePulse, sampleRainbow, sampleRandomMotion } from './rainbow';

export type PartId = 'selfCourtRight' | 'selfCourtLeft' | 'opponentCourtRight' | 'opponentCourtLeft' | 'courtEdges' | 'net' | 'playerRacketBody' | 'playerRacketEdge' | 'opponentRacketBody' | 'opponentRacketEdge' | 'opponentBody' | 'selfFloor' | 'opponentFloor' | 'opponentWall' | 'structure';
export type PartState = Readonly<{ visible: boolean; rainbow: boolean; solid?: boolean }>;
export type PresentationState = Readonly<{
  parts: Readonly<Record<PartId, PartState>>; balls: Readonly<Record<number, PartState>>;
  pulseStrength: number; opponentEdgesVisible: boolean;
  opponentField:boolean;opponentRandom:boolean;ownRandom:boolean;
}>;
const SOLID_RACKET_GLOW = new Color(0xef252e);
type VisualSnapshot = Pick<GameSnapshot, 'simTime' | 'progression'>;
function glowing(snapshot?: VisualSnapshot): boolean {
  return !!snapshot && (snapshot.progression.appliedMilestones.includes(480) || snapshot.progression.appliedMilestones.includes(30) || (snapshot.progression.ballGlowUntil !== null && snapshot.simTime < snapshot.progression.ballGlowUntil));
}
export function isBallVisible(ball: BallSnapshot, snapshot?: VisualSnapshot): boolean {
  if (ball.phase !== 'incoming' && ball.phase !== 'outgoing') return false;
  if (ball.position.z >= 0) return true;
  if (snapshot?.progression.appliedMilestones.includes(420) && !snapshot.progression.appliedMilestones.includes(480)) return false;
  const reached = (n: number) => !!snapshot?.progression.appliedMilestones.includes(n);
  // Glowing edges or a glowing ball cannot reveal an unreleased court half.
  const courtVisible = reached(490) || reached(ball.position.x >= 0 ? 190 : 240);
  return courtVisible && glowing(snapshot);
}
export function resolvePresentation(snapshot: GameSnapshot): PresentationState {
  const reached = (n: number) => snapshot.progression.appliedMilestones.includes(n);
  const part = (n: number, initiallyVisible = false, opponent=false): PartState => ({ visible: (!opponent || !reached(490)) && (initiallyVisible || reached(n)), rainbow: reached(n) });
  return {
    parts: {
      selfCourtRight: part(160, true), selfCourtLeft: part(210, true),
      opponentCourtRight: part(190,false,true), opponentCourtLeft: part(240,false,true), courtEdges: part(70, true),
      net: part(130, true), playerRacketBody: reached(390) ? part(390, true) : { visible: true, rainbow: false, ...(reached(270) ? { solid: true } : {}) }, playerRacketEdge: part(100, true),
      opponentRacketBody: part(330,false,true), opponentRacketEdge: part(300,false,true), opponentBody: part(360,false,true),
      // Later stages keep a quiet backdrop; floor decoration has no role in physics or input mapping.
      selfFloor: {visible:snapshot.score<1500,rainbow:reached(410)}, opponentFloor: part(380,false,true), opponentWall: part(420,false,true),structure:part(460,true),
    },
    balls: Object.fromEntries(snapshot.balls.map(ball => [ball.id, { visible: isBallVisible(ball, snapshot), rainbow: glowing(snapshot) }])),
    pulseStrength: reached(390) ? samplePulse(snapshot.simTime) : 1,
    opponentEdgesVisible: reached(70)&&!reached(490),opponentField:reached(490)&&snapshot.score<1500,opponentRandom:reached(500),ownRandom:reached(510),
  };
}
function colorVertices(geometry: BufferGeometry, time: number, randomSeed?:number): void {
  const points = geometry.attributes.position!;
  if (!geometry.attributes.color) geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(points.count * 3), 3));
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const width = Math.max(1e-8, bounds.max.x - bounds.min.x), height = Math.max(1e-8, bounds.max.y - bounds.min.y);
  const depth = Math.max(1e-8, bounds.max.z - bounds.min.z), colors = geometry.attributes.color!;
  const motion=randomSeed===undefined?{x:0,y:0}:sampleRandomMotion(time,randomSeed);
  for (let i = 0; i < points.count; i++) {
    const vertical = height > 1e-7 ? (points.getY(i) - bounds.min.y) / height : (points.getZ(i) - bounds.min.z) / depth;
    const rgb = sampleRainbow(time, (0.35+motion.y*.25) * (points.getX(i) - bounds.min.x) / width + (0.65+motion.x*.25) * vertical+motion.x);
    colors.setXYZ(i, rgb.r, rgb.g, rgb.b);
  }
  colors.needsUpdate = true;
}
export function applyPresentation(objects: ReturnType<typeof createObjects>, snapshot: GameSnapshot, reducedMotion=false): void {
  const state = resolvePresentation(snapshot);
  const motionTime=reducedMotion?0:snapshot.simTime;
  // Preserve the legacy logical pulse/period, while narrowing only displayed
  // wide-field material contrast to prevent composite full-surface flashes.
  const presentationPulse=reducedMotion?1:.88+(state.pulseStrength-.65)*(.12/.35);
  let runSeed=0;
  for(const character of snapshot.runId)runSeed=(runSeed*31+character.charCodeAt(0))%65521;
  objects.opponentField.root.visible=state.opponentField;
  if(state.opponentField)objects.opponentField.update(motionTime,state.opponentRandom,presentationPulse,runSeed+490);
  let partIndex=0;
  for (const [id, object] of Object.entries(objects.parts)) {
    partIndex++;
    const part = state.parts[id as PartId]; object.visible = part.visible;
    if(!part.visible)continue;
    // Every part owns its material. Hidden surfaces cannot acquire another part's glow.
    object.traverse(child => {
      if (!(child instanceof Mesh || child instanceof LineSegments)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial || material instanceof LineBasicMaterial)) continue;
        if (material.vertexColors !== part.rainbow) { material.vertexColors = part.rainbow; material.needsUpdate = true; }
        if (part.rainbow) {
          colorVertices(child.geometry, motionTime,state.ownRandom&&!id.startsWith('opponent')?runSeed+partIndex*31:undefined);
          material.color.setRGB(1, 1, 1).multiplyScalar((material instanceof MeshStandardMaterial ? 0.16 : 1) * presentationPulse);
          if (material instanceof MeshStandardMaterial) {
            material.emissive.setRGB(1, 1, 1); material.emissiveIntensity = 0.85 * presentationPulse;
          } else material.opacity = 0.9;
        } else {
          material.color.copy(material.userData.baseColor as Color);
          if (material instanceof MeshStandardMaterial) {
            material.emissive.copy(part.solid ? SOLID_RACKET_GLOW : material.userData.baseEmissive as Color);
            if (part.solid) material.color.multiplyScalar(0.16);
            material.emissiveIntensity = part.solid ? 0.85 : material.userData.baseIntensity as number;
          } else material.opacity = material.userData.baseOpacity as number;
        }
      }
    });
  }
  objects.opponentCourt.visible = state.parts.opponentCourtLeft.visible || state.parts.opponentCourtRight.visible;
  objects.opponentEdges.visible = state.opponentEdgesVisible;
  objects.opponentPaddle.visible = state.parts.opponentRacketBody.visible || state.parts.opponentRacketEdge.visible;
  objects.playerPaddle.position.x = snapshot.paddle.x; objects.playerPaddle.position.y = snapshot.paddle.y;
  const motion=state.ownRandom?sampleRandomMotion(motionTime,runSeed+480):{x:0,y:0};
  objects.syncBalls(snapshot.balls.filter(ball => state.balls[ball.id]?.visible).map(ball => ball.id), glowing(snapshot), motionTime+motion.x*7);
  for (const ball of snapshot.balls) {
    const id = ball.id, visual = objects.balls.get(id), style = state.balls[id];
    if (!visual) continue;
    // One visibility gate for the entire ball subtree, including all light/outline effects.
    visual.root.visible = !!style?.visible;
    if (!style) continue;
    visual.root.position.set(ball.position.x, ball.position.y, ball.position.z);
    visual.shadow.position.y = objects.tableY + 0.007 - ball.position.y;
    const surfaceVisible = ball.position.z >= 0 || state.parts[ball.position.x >= 0 ? 'opponentCourtRight' : 'opponentCourtLeft'].visible;
    visual.shadow.visible = surfaceVisible && Math.abs(ball.position.z) <= objects.tableHalfLength && Math.abs(ball.position.x) <= objects.tableHalfWidth;
    visual.shadowOpacity = 0.3 / (1 + Math.max(0, ball.position.y - objects.tableY));
    visual.glow.visible = style.rainbow;
    visual.core.scale.setScalar(style.rainbow ? 0.9 : 1);
  }
  objects.commitBalls();
}
