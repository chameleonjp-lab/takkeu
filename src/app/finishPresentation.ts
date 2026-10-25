import { celebrationEnd } from '../game/celebrations';
import type { GameSnapshot } from '../game/types';

/** The score/physics are final immediately; only the drawing clock continues. */
export function createFinishPresentation() {
  let runId='',startedAt:number|null=null,endsAt=0,duration=0;
  return {
    frame(snapshot:GameSnapshot,now:number,effectEnd=0) {
      if(snapshot.runId!==runId||snapshot.phase!=='gameover'){
        runId=snapshot.runId;startedAt=null;duration=0;
      }
      if(snapshot.phase!=='gameover')return{snapshot,finishing:false};
      if(startedAt===null){
        startedAt=now;duration=Math.max(0,Math.min(5,Math.max(celebrationEnd(snapshot.celebrations),Number.isFinite(effectEnd)?effectEnd:0)-snapshot.simTime));
        endsAt=snapshot.simTime+duration;
      }
      const elapsed=Math.max(0,(now-startedAt)/1000);
      return{snapshot:{...snapshot,simTime:Math.min(endsAt,snapshot.simTime+elapsed)},finishing:elapsed<duration};
    },
  };
}
