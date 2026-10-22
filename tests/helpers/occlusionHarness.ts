import { Vector3 } from 'three';
import { DEFAULT_CONFIG as config } from '../../src/game/config';
import { VIEWPOINT } from '../../src/game/viewpoint';
import { createCamera, fitCamera } from '../../src/render/camera';
import { createView } from '../../src/render/createView';
import { scenario } from './scenarios';

const canvas = document.querySelector('canvas')!;
const view = createView(canvas, config);
view.resize(600, 419);
const camera = createCamera(); fitCamera(camera, 600, 419, config);
const paddle = { x: 0.34, y: 0.68 };
const projected = new Vector3(paddle.x, paddle.y, config.paddleZ).project(camera);
const screen = { x: (projected.x + 1) * canvas.width / 2, y: (1 - projected.y) * canvas.height / 2 };

function show(depth: 'absent' | 'behind' | 'front', score = 0) {
  const snapshot = scenario(score, 0).snapshot();
  const z = depth === 'behind' ? 1.25 : 2.3;
  const scale = (VIEWPOINT.eye.z - z) / (VIEWPOINT.eye.z - config.paddleZ);
  view.render({ ...snapshot, progression: { ...snapshot.progression, ballGlowUntil: score === 10 ? 5 : null }, paddle,
    balls: depth === 'absent' ? [] : [{ id: 1, phase: 'incoming', smash: false,
    position: { x: VIEWPOINT.eye.x + (paddle.x - VIEWPOINT.eye.x) * scale,
      y: VIEWPOINT.eye.y + (paddle.y - VIEWPOINT.eye.y) * scale, z } }] }, []);
  // Read the actual GPU result in the same task as rendering (no cleared buffer).
  const gl = canvas.getContext('webgl2')!, rgba = new Uint8Array(4);
  gl.readPixels(Math.round(screen.x), canvas.height - Math.round(screen.y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  return [...rgba];
}
const occlusion = { show, screen };
declare global { interface Window { occlusion: typeof occlusion } }
window.occlusion = occlusion;
show('absent');
