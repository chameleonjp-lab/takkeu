import { Color, DirectionalLight, HemisphereLight, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three';
import type { GameConfig, GameEvent, GameSnapshot } from '../game/types';
import type { InputMapping } from '../input/swipe';
import { createObjects } from './objects';
import { applyPresentation } from './presentation';

export interface GameView {
  render(snapshot: GameSnapshot, events: readonly GameEvent[]): void;
  resize(width: number, height: number): void;
  inputMapping(): InputMapping;
  dispose(): void;
}

export function createView(canvas: HTMLCanvasElement, config: GameConfig): GameView {
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!context) throw new Error('WebGL 2を利用できません。対応ブラウザで再読み込みしてください。');
  const renderer = new WebGLRenderer({ canvas, context, antialias: true });
  const scene = new Scene();
  scene.background = new Color(0x0b1723);
  const camera = new OrthographicCamera(-1.5, 1.5, 1, -1, 0.1, 30);
  camera.position.set(0, 3.6, 6.8);
  camera.lookAt(0, 0.1, 0.7);
  camera.updateMatrixWorld();
  scene.add(new HemisphereLight(0xd8f8ff, 0x17313b, 2.1));
  const light = new DirectionalLight(0xffffff, 2);
  light.position.set(-2, 4, 4); scene.add(light);
  const objects = createObjects(config);
  scene.add(objects.root);
  let flashUntil = 0;
  let previousRunId = '';
  return {
    render(snapshot, events) {
      if (snapshot.runId !== previousRunId) { flashUntil = 0; previousRunId = snapshot.runId; }
      for (const event of events) if (event.kind === 'player-hit') flashUntil = event.time + 0.12;
      applyPresentation(objects, snapshot);
      objects.rimMaterial.emissiveIntensity = snapshot.simTime < flashUntil ? 0.8 : 0.15;
      renderer.render(scene, camera);
    },
    resize(width, height) {
      const w = Math.max(1, width), h = Math.max(1, height);
      const ratio = Math.min(window.devicePixelRatio || 1, config.maxPixelRatio, Math.sqrt(config.maxDrawingPixels / (w * h)));
      renderer.setPixelRatio(1);
      renderer.setSize(Math.max(1, Math.floor(w * ratio)), Math.max(1, Math.floor(h * ratio)), false);
      const aspect = w / h;
      const worldWidth = Math.max(2.8, aspect * 1.8);
      camera.left = -worldWidth / 2; camera.right = worldWidth / 2;
      camera.top = worldWidth / aspect / 2; camera.bottom = -camera.top;
      camera.updateProjectionMatrix();
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
    dispose() { objects.dispose(); renderer.dispose(); },
  };
}
