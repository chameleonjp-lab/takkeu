import { createHash } from 'node:crypto';
import { Group, Mesh } from 'three';
import { createRallyEffectView } from '../../src/render/rallyEffects';
import { createRallyEffects, RALLY_EFFECTS } from '../../src/game/rallyEffects';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { scenario } from './scenarios';
import type { GameEvent } from '../../src/game/types';

/** Hash the actual triangle stream, independent of indexed/non-indexed storage. */
export function rallyGeometryCorpus() {
  const rows: object[]=[];
  for(const quality of ['standard','low'] as const)for(const reduced of [false,true]) {
    for(const kind of ['arrival','loss'] as const)for(const value of kind==='arrival'?RALLY_EFFECTS.map(c=>c.threshold):[1,10,20,30,40,50,55,60,70,77,80,88,90,99,100]) {
      const score=kind==='arrival'?value:4000,runId='geometry-corpus';
      const controller=createRallyEffects(runId,score-1),rig=new Group(),view=createRallyEffectView(DEFAULT_CONFIG,rig);
      const event=(n:number):GameEvent=>({id:`${kind}-${n}`,runId,time:20,kind:kind==='arrival'?'player-hit':'ball-lost',...(kind==='arrival'?{rallyScore:n}:{lossCount:n,ballId:n}),position:{x:.25,y:.5,z:1.95}});
      if(kind==='arrival')controller.consume([event(value)]);else controller.consume(Array.from({length:value},(_,i)=>event(i+1)));
      for(const age of [.1,.4,1.1,2.1,3.1,3.9,4.1]) {
        const snapshot={...scenario(score,20+age).snapshot(),runId};
        view.update(snapshot,controller.state(),quality,reduced);
        const batches:object[]=[];
        for(const root of [rig,view.worldRoot])root.traverse(node=>{
          if(!(node instanceof Mesh))return;const g=node.geometry,index=g.getIndex(),count=g.drawRange.count;
          const hashes:Record<string,string>={};
          for(const name of ['position','color']){const attr=g.getAttribute(name),data=new Float32Array(count*attr.itemSize);
            for(let i=0;i<count;i++)for(let j=0;j<attr.itemSize;j++)data[i*attr.itemSize+j]=attr.getComponent(index?index.getX(i):i,j);
            hashes[name]=createHash('sha256').update(new Uint8Array(data.buffer)).digest('hex');}
          batches.push({name:node.name,count,hashes});
        });
        rows.push({quality,reduced,kind,value,age,batches,stats:view.stats()});
      }
      view.dispose();
    }
  }
  return rows;
}
