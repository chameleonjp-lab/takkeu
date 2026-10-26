import { BufferAttribute } from 'three';
import type { BufferGeometry } from 'three';

/** Read the submitted triangle stream, so shape assertions support both layouts. */
export function triangleAttribute(geometry:BufferGeometry,name:string):BufferAttribute {
  const attribute=geometry.getAttribute(name) as BufferAttribute,index=geometry.getIndex();
  if(!index)return attribute;
  const values=new Float32Array(geometry.drawRange.count*attribute.itemSize);
  for(let i=0;i<geometry.drawRange.count;i++)for(let c=0;c<attribute.itemSize;c++)values[i*attribute.itemSize+c]=attribute.getComponent(index.getX(i),c);
  return new BufferAttribute(values,attribute.itemSize);
}
