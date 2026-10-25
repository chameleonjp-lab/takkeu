import { expect,it,vi } from 'vitest';
import { BoxGeometry,Camera,Float32BufferAttribute,LineBasicMaterial,LineSegments,Mesh,MeshBasicMaterial,MeshStandardMaterial,Scene,Texture } from 'three';
import { prepareScene } from '../../src/render/prepare';

it('共通テクスチャと通常・虹色のプログラムを用意し、元の表示状態へ戻す',async()=>{
  const scene=new Scene(),texture=new Texture(),material=new MeshStandardMaterial({map:texture});
  const model=new Mesh(new BoxGeometry(),material);model.visible=false;scene.add(model);
  const lineMaterial=new LineBasicMaterial(),line=new LineSegments(new BoxGeometry(),lineMaterial);scene.add(line);
  const digit=new Mesh(new BoxGeometry(),new MeshBasicMaterial({vertexColors:true}));
  digit.geometry.setAttribute('color',new Float32BufferAttribute(new Float32Array(digit.geometry.attributes.position!.count*4),4));scene.add(digit);
  const oldColors=digit.geometry.attributes.color;
  const observations:boolean[][]=[];
  const gpu={initTexture:vi.fn(),compileAsync:vi.fn(async()=>{observations.push([material.vertexColors,lineMaterial.vertexColors]);return scene;}),render:vi.fn()};
  const progress:number[]=[];await prepareScene(gpu,scene,new Camera(),[model,line],fraction=>progress.push(fraction),()=>false);
  expect(observations).toEqual([[false,false],[true,true]]);
  expect(gpu.initTexture).toHaveBeenCalledTimes(1);expect(gpu.initTexture).toHaveBeenCalledWith(texture);
  expect(gpu.render).toHaveBeenCalledTimes(1);expect(progress.at(-1)).toBe(1);
  expect(model.visible).toBe(false);expect(material.vertexColors).toBe(false);expect(lineMaterial.vertexColors).toBe(false);
  expect(model.geometry.attributes.color!.itemSize).toBe(3);expect(digit.geometry.attributes.color).toBe(oldColors);
});

it('準備失敗と描画破棄でも表示状態を戻し、破棄後にGPU描画しない',async()=>{
  const scene=new Scene(),material=new MeshStandardMaterial(),mesh=new Mesh(new BoxGeometry(),material);scene.add(mesh);
  let calls=0;const renderer={initTexture:vi.fn(),compileAsync:async()=>{if(++calls===2)throw new Error('shader');return scene;},render:vi.fn()};
  await expect(prepareScene(renderer,scene,new Camera(),[mesh],()=>{},()=>false)).rejects.toThrow('shader');
  expect(material.vertexColors).toBe(false);expect(renderer.render).not.toHaveBeenCalled();
  const disposed={...renderer,compileAsync:async()=>scene};
  await expect(prepareScene(disposed,scene,new Camera(),[mesh],()=>{},()=>true)).rejects.toThrow('描画の準備が中断');
  expect(disposed.render).not.toHaveBeenCalled();
});

it('後半ラリーの描画復旧後も通常色と虹色の両方を準備して現在の表示へ戻す',async()=>{
  const scene=new Scene(),material=new MeshStandardMaterial({vertexColors:true}),mesh=new Mesh(new BoxGeometry(),material);scene.add(mesh);
  const flags:boolean[]=[];
  const gpu={initTexture(){},compileAsync:async()=>{flags.push(material.vertexColors);return scene;},render(){}};
  await prepareScene(gpu,scene,new Camera(),[mesh],()=>{},()=>false);
  expect(flags).toEqual([false,true]);expect(material.vertexColors).toBe(true);
});
