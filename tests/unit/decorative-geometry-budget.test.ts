import {expect,it} from 'vitest';
import {Mesh} from 'three';
import {DEFAULT_CONFIG} from '../../src/game/config';
import {createObjects} from '../../src/render/objects';
import {applyPresentation} from '../../src/render/presentation';
import {scenario} from '../helpers/scenarios';

it('bounds flat court/stripe vertices without changing court size, UV coverage or winding',()=>{
  const objects=createObjects(DEFAULT_CONFIG);
  try{
    const court=objects.parts.selfCourtRight.geometry;
    expect(court.getAttribute('position').count).toBeLessThanOrEqual(4);
    court.computeBoundingBox();
    expect(court.boundingBox!.max.x-court.boundingBox!.min.x).toBeCloseTo(DEFAULT_CONFIG.tableHalfWidth);
    expect(court.boundingBox!.max.y-court.boundingBox!.min.y).toBeCloseTo(DEFAULT_CONFIG.tableHalfLength);
    const uv=court.getAttribute('uv');
    expect(Math.min(...Array.from({length:uv.count},(_,i)=>uv.getX(i)))).toBe(.5);
    expect(Math.max(...Array.from({length:uv.count},(_,i)=>uv.getX(i)))).toBe(1);
    expect(court.getAttribute('normal').getZ(0)).toBe(1);
    const before=objects.playerCourt.matrix.clone();
    for(const score of [1500,2600,3000,4000]){
      applyPresentation(objects,scenario(score).snapshot());
      expect(objects.playerCourt.matrix.equals(before)).toBe(true);
      expect(court.index!.count).toBeLessThanOrEqual(6);
    }
    let edgeVertices=0;
    objects.parts.courtEdges.traverse(n=>{if(n instanceof Mesh)edgeVertices+=n.geometry.getAttribute('position').count;});
    expect(edgeVertices).toBeLessThanOrEqual(32);
  }finally{objects.dispose();}
});

it('represents straight net strands by endpoints, preserving their bounds and opacity',()=>{
  const objects=createObjects(DEFAULT_CONFIG);
  try{
    const geometry=objects.net.geometry;
    expect(geometry.getAttribute('position').count).toBeLessThanOrEqual(128);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.x).toBeCloseTo(-1.08);
    expect(geometry.boundingBox!.max.x).toBeCloseTo(1.08);
    expect(geometry.boundingBox!.min.y).toBeCloseTo(0);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(.18);
    const material=Array.isArray(objects.net.material)?objects.net.material[0]!:objects.net.material;
    expect(material.opacity).toBe(.7);
    applyPresentation(objects,scenario(1500,20).snapshot());
    const colors=geometry.getAttribute('color'),storage=colors.array;
    applyPresentation(objects,scenario(2600,21).snapshot());
    expect(geometry.getAttribute('color').array).toBe(storage);
    expect([...storage].every(Number.isFinite)).toBe(true);
  }finally{objects.dispose();}
});
