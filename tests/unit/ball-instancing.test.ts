import { expect, it, vi } from 'vitest';
import { InstancedMesh, Matrix4, MeshStandardMaterial } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createObjects } from '../../src/render/objects';
import { applyPresentation } from '../../src/render/presentation';
import { scenario } from '../helpers/scenarios';

it('124球を3バッチで描き、実位置・深度・発光を保って20回再利用し一度だけ破棄する',()=>{
  const objects=createObjects(DEFAULT_CONFIG),base=scenario(555).snapshot();
  const balls=Array.from({length:124},(_,i)=>({id:i+1,phase:'incoming' as const,smash:true,position:{x:(i%9-4)*.1,y:.4,z:i%2?-.8:.8}}));
  applyPresentation(objects,{...base,balls});
  const batches:InstancedMesh[]=[];objects.root.traverse(o=>{if(o instanceof InstancedMesh)batches.push(o);});
  expect(batches).toHaveLength(3);
  const core=batches.find(b=>b.material instanceof MeshStandardMaterial)!;
  expect(core.count).toBe(124);expect(core.frustumCulled).toBe(false);
  const matrix=new Matrix4();core.getMatrixAt(7,matrix);
  expect(matrix.elements[12]).toBeCloseTo(balls[7]!.position.x,6);
  expect(matrix.elements[13]).toBeCloseTo(balls[7]!.position.y,6);
  expect(matrix.elements[14]).toBeCloseTo(balls[7]!.position.z,6);
  const geometries=batches.map(b=>b.geometry),dispose=geometries.map(g=>vi.spyOn(g,'dispose'));
  for(let retry=0;retry<20;retry++){
    applyPresentation(objects,{...base,runId:`retry-${retry}`,balls:[]});expect(batches.every(b=>b.count===0)).toBe(true);
    applyPresentation(objects,{...base,runId:`retry-${retry}`,balls:balls.map(b=>({...b,id:b.id+1000*retry}))});
    expect(core.count).toBe(124);expect(objects.balls.size).toBe(124);
  }
  objects.dispose();for(const spy of dispose)expect(spy).toHaveBeenCalledTimes(1);
});

it('移動・再挑戦後の透明物の並び順に古い球位置の境界球を使わない',()=>{
  const objects=createObjects(DEFAULT_CONFIG),base=scenario(555).snapshot();
  const show=(z:number)=>applyPresentation(objects,{...base,balls:[{id:1,phase:'incoming',smash:true,position:{x:0,y:.5,z}}]});
  show(-1);const batches:InstancedMesh[]=[];objects.root.traverse(o=>{if(o instanceof InstancedMesh)batches.push(o);});
  for(const b of batches)if(b.count)b.computeBoundingSphere();
  show(1);
  for(const b of batches)if(b.count){if(!b.boundingSphere)b.computeBoundingSphere();expect(b.boundingSphere!.center.z).toBeCloseTo(1,6);}
  objects.dispose();
});
