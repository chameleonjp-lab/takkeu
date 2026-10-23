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
const occlusion = { show, screen, emissionProbe, netGlowProbe };
declare global { interface Window { occlusion: typeof occlusion } }
window.occlusion = occlusion;
show('absent');

/** Isolate real production parts with zero lights to verify emitted colour. */
async function emissionProbe() {
  const { Color, Scene, WebGLRenderer } = await import('three');
  const { createObjects } = await import('../../src/render/objects');
  const { applyPresentation } = await import('../../src/render/presentation');
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(600, 419);
  const scene = new Scene(); scene.background = new Color(0);
  const objects = createObjects(config), results = [];
  const points = [
    ['selfCourtRight', 160, [0.5, 0, 0.9]], ['opponentCourtRight', 190, [0.5, 0, -0.9]],
    ['opponentFloor', 380, [0, -0.8, -3]], ['selfFloor', 410, [0, -0.8, 0.5]],
    ['opponentWall', 420, [0, 0, -6.15]],
  ] as const;
  try {
    for (const [id, threshold, point] of points) {
      const pixels = [], captures = [];
      const screen = new Vector3(...point).project(camera);
      const x = Math.round((screen.x + 1) * 300), y = Math.round((screen.y + 1) * 419 / 2);
      for (const score of [threshold - 1, threshold]) {
        applyPresentation(objects, scenario(score, 0).snapshot());
        const part = objects.parts[id], parent = part.parent!;
        scene.add(part); renderer.render(scene, camera);
        const gl = renderer.getContext(), rgba = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        pixels.push([...rgba]); captures.push(renderer.domElement.toDataURL('image/png'));
        parent.add(part);
      }
      results.push({ id, threshold, x, y, pixels, captures });
    }
    return results;
  } finally { objects.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
}

/** Probe the real instanced halo against the real translucent net grid. */
async function netGlowProbe(){
  const {Color,LineSegments,MeshStandardMaterial,Scene,WebGLRenderer}=await import('three');
  const {createObjects}=await import('../../src/render/objects');
  const {applyPresentation}=await import('../../src/render/presentation');
  const probeConfig={...config,ballRadius:.18};
  const objects=createObjects(probeConfig),renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(600,419);const scene=new Scene();scene.background=new Color(0);scene.add(objects.root);
  const point=new Vector3(0,.1,0).project(camera),x=Math.round((point.x+1)*300),y=Math.round((point.y+1)*419/2);
  const captures:number[][]=[];
  try{
    for(const z of [-.45,.45]){
      const scale=(VIEWPOINT.eye.z-z)/VIEWPOINT.eye.z;
      const ball={id:1,phase:'incoming' as const,smash:true,position:{x:VIEWPOINT.eye.x+(0-VIEWPOINT.eye.x)*scale+.95*probeConfig.ballRadius,y:VIEWPOINT.eye.y+(.1-VIEWPOINT.eye.y)*scale,z}};
      applyPresentation(objects,{...scenario(555).snapshot(),balls:[ball,{...ball,id:2,position:{x:1.6,y:.5,z:-1.8}}]});
      for(const part of Object.values(objects.parts))part.visible=false;
      objects.opponentField.root.visible=false;objects.net.visible=true;
      objects.net.traverse(child=>{if(child instanceof LineSegments){const m=child.material as import('three').LineBasicMaterial;m.vertexColors=false;m.color.set(0x0000ff);m.opacity=.7;m.transparent=true;m.needsUpdate=true;}});
      const visual=objects.balls.get(1)!;
      const colors=visual.glow.geometry.attributes.color!;for(let i=0;i<colors.count;i++)colors.setXYZ(i,1,0,0);colors.needsUpdate=true;
      if(visual.core.material instanceof MeshStandardMaterial){visual.core.material.color.set(0);visual.core.material.emissive.set(0);}
      renderer.render(scene,camera);const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);captures.push([...pixel]);
    }
    return {x,y,behind:captures[0]!,front:captures[1]!};
  }finally{objects.dispose();renderer.dispose();renderer.forceContextLoss();}
}
