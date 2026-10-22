import { Color, DirectionalLight, HemisphereLight, Scene, Vector3, WebGLRenderer } from 'three';
import type { GameConfig, GameEvent, GameSnapshot } from '../game/types';
import type { InputMapping } from '../input/swipe';
import { createObjects } from './objects';
import { applyPresentation } from './presentation';
import { createCamera, fitCamera } from './camera';
import { updateOpponentView } from './opponentView';
import { computeDrawingSize } from './quality';
import type { Quality } from '../storage/preferences';

export interface GameView {
  render(snapshot: GameSnapshot, events: readonly GameEvent[]): void;
  resize(width: number, height: number): void;
  inputMapping(): InputMapping;
  setQuality(quality: Quality): void;
  resources(): { geometries: number; textures: number; programs: number; drawCalls: number };
  dispose(): void;
}

export function createView(canvas: HTMLCanvasElement, config: GameConfig): GameView {
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!context) throw new Error('WebGL 2を利用できません。対応ブラウザで再読み込みしてください。');
  const renderer = new WebGLRenderer({ canvas, context, antialias: true });
  const scene = new Scene();
  scene.background = new Color(0x0b1723);
  const camera = createCamera();
  scene.add(new HemisphereLight(0xd8f8ff, 0x17313b, 2.1));
  const light = new DirectionalLight(0xffffff, 2);
  light.position.set(-2, 4, 4); scene.add(light);
  const objects = createObjects(config);
  scene.add(objects.root);
  let flashUntil = 0;
  let previousRunId = '';
  let quality: Quality = 'standard';
  return {
    render(snapshot, events) {
      if (snapshot.runId !== previousRunId) { flashUntil = 0; previousRunId = snapshot.runId; }
      for (const event of events) if (event.kind === 'player-hit') flashUntil = event.time + 0.12;
      applyPresentation(objects, snapshot);
      updateOpponentView(objects, snapshot, events);
      if (!snapshot.progression.appliedMilestones.includes(100)) objects.rimMaterial.emissiveIntensity = snapshot.simTime < flashUntil ? 0.8 : 0.15;
      renderer.render(scene, camera);
    },
    resize(width, height) {
      const w = Math.max(1, width), h = Math.max(1, height);
      const size = computeDrawingSize(w, h, window.devicePixelRatio || 1, quality);
      renderer.setPixelRatio(1);
      renderer.setSize(size.width, size.height, false);
      fitCamera(camera, w, h, config);
    },
    inputMapping() {
      const rect = canvas.getBoundingClientRect();
      const topLeft = new Vector3(config.paddleMinX, config.paddleMaxY, config.paddleZ).project(camera);
      const bottomRight = new Vector3(config.paddleMaxX, config.paddleMinY, config.paddleZ).project(camera);
      return {
        screen: { left: rect.left + (topLeft.x + 1) * rect.width / 2, top: rect.top + (1 - topLeft.y) * rect.height / 2, width: (bottomRight.x - topLeft.x) * rect.width / 2, height: (topLeft.y - bottomRight.y) * rect.height / 2 },
        world: { minX: config.paddleMinX, maxX: config.paddleMaxX, minY: config.paddleMinY, maxY: config.paddleMaxY },
      };
    },
    setQuality(value) { quality = value; },
    resources() { return { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length ?? 0, drawCalls: renderer.info.render.calls }; },
    dispose() { objects.dispose(); renderer.dispose(); },
  };
}
