import { Float32BufferAttribute,LineBasicMaterial,LineSegments,Mesh,MeshStandardMaterial,Texture } from 'three';
import type { Camera,Object3D,Scene,WebGLRenderer } from 'three';

/** Compile real scene variants and upload shared data behind the loading screen. */
export async function prepareScene(renderer:Pick<WebGLRenderer,'compileAsync'|'initTexture'|'render'>,scene:Scene,camera:Camera,parts:readonly Object3D[],progress:(fraction:number)=>void,isDisposed:()=>boolean):Promise<void>{
  const materials=new Map<MeshStandardMaterial|LineBasicMaterial,boolean>();
  const textures=new Set<Texture>();
  scene.traverse(object=>{
    if(!(object instanceof Mesh||object instanceof LineSegments))return;
    for(const material of Array.isArray(object.material)?object.material:[object.material])
      for(const value of Object.values(material))if(value instanceof Texture)textures.add(value);
  });
  const check=()=>{if(isDisposed())throw new Error('描画の準備が中断しました。もう一度お試しください。');};
  check();for(const texture of textures)renderer.initTexture(texture);progress(.2);
  for(const part of parts)part.traverse(object=>{
    if(!(object instanceof Mesh||object instanceof LineSegments))return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(!(material instanceof MeshStandardMaterial||material instanceof LineBasicMaterial))continue;
      materials.set(material,material.vertexColors);
      if(!object.geometry.attributes.color){
        const count=object.geometry.attributes.position!.count;
        object.geometry.setAttribute('color',new Float32BufferAttribute(new Float32Array(count*3).fill(1),3));
      }
    }
  });
  const visibility=new Map<Object3D,{visible:boolean;frustumCulled:boolean}>();
  try{
    // A restored view may already show a late rally. Warm the normal variant
    // explicitly too, so the next replay has nothing left to compile.
    for(const material of materials.keys()){material.vertexColors=false;material.needsUpdate=true;}
    await renderer.compileAsync(scene,camera);check();progress(.5);
    for(const material of materials.keys()){material.vertexColors=true;material.needsUpdate=true;}
    await renderer.compileAsync(scene,camera);check();progress(.8);
    // Upload geometry/instance buffers for currently hidden late-game parts too.
    scene.traverse(object=>{visibility.set(object,{visible:object.visible,frustumCulled:object.frustumCulled});object.visible=true;object.frustumCulled=false;});
    renderer.render(scene,camera);check();progress(1);
  }finally{
    for(const [material,colors]of materials){material.vertexColors=colors;material.needsUpdate=true;}
    for(const [object,state]of visibility){object.visible=state.visible;object.frustumCulled=state.frustumCulled;}
  }
}
