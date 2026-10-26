import { expect, it } from 'vitest';
import { BufferAttribute, Group, Mesh } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createRallyEffectView } from '../../src/render/rallyEffects';
import { scenario } from '../helpers/scenarios';

it('uses four shared corners and six immutable indices per quad, with bounded active uploads',()=>{
  const rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
  view.update(scenario(4000,20).snapshot());
  const meshes:Mesh[]=[];for(const root of [rig,view.worldRoot])root.traverse(n=>{if(n instanceof Mesh)meshes.push(n);});
  expect(meshes).toHaveLength(4);
  const identities=meshes.map(mesh=>({index:mesh.geometry.index,positions:mesh.geometry.attributes.position!.array,colors:mesh.geometry.attributes.color!.array}));
  for(const mesh of meshes){
    const g=mesh.geometry,index=g.index!;expect(index).not.toBeNull();
    expect(Array.from(index.array.slice(0,12))).toEqual([0,1,2,1,3,2,4,5,6,5,7,6]);
    expect(g.attributes.position!.count/4).toBe(index.count/6);expect(index.array).toBeInstanceOf(Uint16Array);
    const quads=g.drawRange.count/6;
    expect((g.attributes.position as BufferAttribute).updateRanges).toEqual([{start:0,count:quads*12}]);
    expect((g.attributes.color as BufferAttribute).updateRanges).toEqual([{start:0,count:quads*16}]);
    expect(index.version).toBe(0);
  }
  view.update(scenario(4000,21).snapshot(),undefined,'low');
  meshes.forEach((mesh,i)=>{expect(mesh.geometry.index).toBe(identities[i]!.index);expect(mesh.geometry.attributes.position!.array).toBe(identities[i]!.positions);expect(mesh.geometry.attributes.color!.array).toBe(identities[i]!.colors);expect(mesh.geometry.index!.version).toBe(0);});
  view.clear();meshes.forEach(mesh=>{expect(mesh.geometry.drawRange.count).toBe(0);expect(mesh.visible).toBe(false);});
  let disposed=0;meshes.forEach(mesh=>mesh.geometry.addEventListener('dispose',()=>disposed++));view.dispose();view.dispose();expect(disposed).toBe(4);
});
