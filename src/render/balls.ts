import { BackSide, CircleGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { GameConfig } from '../game/types';
import { standard } from './materials';
import { sampleRainbow } from './rainbow';

/** Three GPU draws regardless of ball count; detached handles retain per-ball transforms. */
export function createBallPool(config: GameConfig) {
  const root = new Group();
  const coreGeometry = new SphereGeometry(config.ballRadius, 12, 8);
  const coreMaterial = standard(0xffec64, 0.42, 0xffeaa0, 0.15);
  const glowGeometry = new SphereGeometry(config.ballRadius, 12, 8);
  glowGeometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(glowGeometry.attributes.position!.count * 3), 3));
  // The opaque white core occludes the shell's centre. Normal depth testing
  // also keeps the entire ball behind a paddle when it is farther away.
  const glowMaterial = new MeshBasicMaterial({ vertexColors: true, side: BackSide, transparent: true, opacity: 0.85, depthWrite: true, toneMapped: false });
  const shadowGeometry = new CircleGeometry(config.ballRadius * 1.2, 12);
  const shadowMaterial=new MeshBasicMaterial({color:0x153827,transparent:true,opacity:1,depthWrite:false});
  shadowMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vInstanceOpacity;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvInstanceOpacity=instanceColor.r;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vInstanceOpacity;')
      .replace('#include <color_fragment>','diffuseColor.a*=vInstanceOpacity;');
  };
  let capacity=16;
  const batch=(geometry:typeof coreGeometry|typeof shadowGeometry,material:typeof coreMaterial|MeshBasicMaterial)=>{
    const model=new InstancedMesh(geometry,material,capacity);model.count=0;model.frustumCulled=false;model.visible=false;
    // Draw the solid outer shell before translucent net lines. Its depth
    // distinguishes near/far balls even when one batch straddles the net.
    if(material===glowMaterial)model.renderOrder=-1;
    model.instanceMatrix.setUsage(DynamicDrawUsage);root.add(model);return model;
  };
  let coreBatch=batch(coreGeometry,coreMaterial),glowBatch=batch(glowGeometry,glowMaterial),shadowBatch=batch(shadowGeometry,shadowMaterial);
  const alphaColor=new Color();
  function ensureCapacity(count:number){
    if(count<=capacity)return;
    while(capacity<count)capacity*=2;
    for(const previous of [coreBatch,glowBatch,shadowBatch]){root.remove(previous);previous.dispose();}
    coreBatch=batch(coreGeometry,coreMaterial);glowBatch=batch(glowGeometry,glowMaterial);shadowBatch=batch(shadowGeometry,shadowMaterial);
  }
  function createVisual() {
    const group = new Group();
    const core = new Mesh(coreGeometry, coreMaterial), glow = new Mesh(glowGeometry, glowMaterial);
    const shadow = new Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    group.add(core, glow, shadow); group.visible = false;
    return { root: group, core, glow, shadow, shadowOpacity:.25 };
  }
  type Visual = ReturnType<typeof createVisual>;
  const balls = new Map<number, Visual>();
  const free: Visual[] = [createVisual()];
  const matrix=new Matrix4();
  let disposed=false;
  return {
    root, balls,
    sync(ids: readonly number[], rainbow: boolean, time: number) {
      const visible = new Set(ids);
      for (const [id, visual] of balls) if (!visible.has(id)) {
        visual.root.visible = false; balls.delete(id); free.push(visual);
      }
      for (const id of visible) if (!balls.has(id)) balls.set(id, free.pop() ?? createVisual());
      ensureCapacity(visible.size);
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
    commit(){
      let cores=0,glows=0,shadows=0;
      for(const visual of balls.values()){
        if(!visual.root.visible)continue;
        visual.root.updateMatrix();visual.core.updateMatrix();
        matrix.multiplyMatrices(visual.root.matrix,visual.core.matrix);coreBatch.setMatrixAt(cores++,matrix);
        if(visual.glow.visible){visual.glow.updateMatrix();matrix.multiplyMatrices(visual.root.matrix,visual.glow.matrix);glowBatch.setMatrixAt(glows++,matrix);}
        if(visual.shadow.visible){visual.shadow.updateMatrix();matrix.multiplyMatrices(visual.root.matrix,visual.shadow.matrix);shadowBatch.setMatrixAt(shadows,matrix);
          const opacity=visual.shadowOpacity;shadowBatch.setColorAt(shadows++,alphaColor.setRGB(opacity,opacity,opacity));}
      }
      for(const [model,count] of [[coreBatch,cores],[glowBatch,glows],[shadowBatch,shadows]] as const){model.count=count;model.visible=count>0;model.instanceMatrix.needsUpdate=true;model.boundingSphere=null;}
      if(shadowBatch.instanceColor){shadowBatch.instanceColor.setUsage(DynamicDrawUsage);shadowBatch.instanceColor.needsUpdate=true;}
    },
    clear() { if(disposed)return;disposed=true;balls.clear(); free.length = 0;for(const model of [coreBatch,glowBatch,shadowBatch])model.dispose(); },
  };
}
const white = new Color(0xffffff);
