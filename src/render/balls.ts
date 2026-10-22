import { BackSide, CircleGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { GameConfig } from '../game/types';
import { standard } from './materials';
import { sampleRainbow } from './rainbow';

/** Models are assigned only to visible balls. Queues and lost IDs own no model. */
export function createBallPool(config: GameConfig) {
  const root = new Group();
  const coreGeometry = new SphereGeometry(config.ballRadius, 20, 12);
  const coreMaterial = standard(0xffec64, 0.42, 0xffeaa0, 0.15);
  const glowGeometry = new SphereGeometry(config.ballRadius, 24, 16);
  glowGeometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(glowGeometry.attributes.position!.count * 3), 3));
  // The opaque white core occludes the shell's centre. Normal depth testing
  // also keeps the entire ball behind a paddle when it is farther away.
  const glowMaterial = new MeshBasicMaterial({ vertexColors: true, side: BackSide, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
  const shadowGeometry = new CircleGeometry(config.ballRadius * 1.2, 20);
  function createVisual() {
    const group = new Group();
    const core = new Mesh(coreGeometry, coreMaterial), glow = new Mesh(glowGeometry, glowMaterial);
    const shadow = new Mesh(shadowGeometry, new MeshBasicMaterial({ color: 0x153827, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    group.add(core, glow, shadow); group.visible = false; root.add(group);
    return { root: group, core, glow, shadow };
  }
  type Visual = ReturnType<typeof createVisual>;
  const balls = new Map<number, Visual>();
  // Keep shared resources attached even if the first play ends before a ball
  // becomes visible, so the owner's normal disposal visits them exactly once.
  const free: Visual[] = [createVisual()];
  return {
    root, balls,
    sync(ids: readonly number[], rainbow: boolean, time: number) {
      const visible = new Set(ids);
      for (const [id, visual] of balls) if (!visible.has(id)) {
        visual.root.visible = false; balls.delete(id); free.push(visual);
      }
      for (const id of visible) if (!balls.has(id)) balls.set(id, free.pop() ?? createVisual());
      coreMaterial.color.copy(rainbow ? white : coreMaterial.userData.baseColor);
      coreMaterial.emissive.copy(rainbow ? white : coreMaterial.userData.baseEmissive);
      if (rainbow && visible.size) {
        const colors = glowGeometry.attributes.color!, positions = glowGeometry.attributes.position!;
        for (let i = 0; i < colors.count; i++) {
          const rgb = sampleRainbow(time, (positions.getY(i) / config.ballRadius + 1) / 2);
          colors.setXYZ(i, rgb.r, rgb.g, rgb.b);
        }
        colors.needsUpdate = true;
      }
    },
    clear() { balls.clear(); free.length = 0; },
  };
}
const white = new Color(0xffffff);
