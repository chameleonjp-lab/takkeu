import { expect, it } from 'vitest';
import { Mesh, LineSegments, MeshStandardMaterial, LineBasicMaterial } from 'three';
import { DEFAULT_CONFIG as config } from '../../src/game/config';
import { createObjects } from '../../src/render/objects';
import { applyPresentation, resolvePresentation } from '../../src/render/presentation';
import { incoming, scenario } from '../helpers/scenarios';
import { GLOW_SCHEDULE } from '../helpers/glowSchedule';

it('実接触で0から555へ進め、全発光の直前・当日・翌ラリーと描画材質が指定表に一致する', () => {
  const game = scenario(0, 0), objects = createObjects(config);
  const observed = new Set<number>();
  try {
    for (let score = 0; score <= 555; score++) {
      expect(game.state.score).toBe(score);
      const snapshot = game.snapshot(), view = resolvePresentation(snapshot);
      for (const [threshold, part] of GLOW_SCHEDULE) {
        if (Math.abs(score - threshold) > 1) continue;
        observed.add(threshold);
        applyPresentation(objects, snapshot);
        const rainbowAt = part === 'playerRacketBody' ? 390 : threshold;
        expect(view.parts[part].rainbow, `${score}: ${part}`).toBe(score >= rainbowAt);
        expect(objects.parts[part].visible, `${score}: ${part} visibility`).toBe(!part.startsWith('opponent') || score >= threshold);
        objects.parts[part].traverse(child => {
          if (!(child instanceof Mesh || child instanceof LineSegments)) return;
          for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
            if (!(material instanceof MeshStandardMaterial || material instanceof LineBasicMaterial)) continue;
            expect(material.vertexColors, `${score}: ${part} material`).toBe(score >= rainbowAt);
            if (material instanceof MeshStandardMaterial && (score >= rainbowAt || (part === 'playerRacketBody' && score >= 270))) {
              expect(material.emissiveIntensity).toBeGreaterThan(0.5);
            }
          }
        });
      }
      expect(view.opponentField).toBe(score >= 490);
      expect(view.opponentRandom).toBe(score >= 500);
      expect(view.ownRandom).toBe(score >= 510);
      // Cross each threshold by a real collision, not by assigning a score or
      // fabricating appliedMilestones. Other balls are omitted in this audit.
      const now = game.state.simTime;
      game.state.balls = [incoming(1, now + 0.002, game.state.paddle, now, 1.2)];
      const result = game.step();
      expect(result.events.filter(e => e.kind === 'player-hit')).toHaveLength(1);
    }
    expect(observed.size).toBe(16);
    applyPresentation(objects, scenario(0).snapshot());
    expect(objects.opponentField.root.visible).toBe(false);
    expect(objects.parts.selfCourtRight.material.vertexColors).toBe(false);
    expect(objects.parts.selfFloor.material.vertexColors).toBe(false);
    expect(objects.opponentPaddle.visible).toBe(false);
  } finally { objects.dispose(); }
});
