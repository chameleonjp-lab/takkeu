import { DEFAULT_CONFIG } from '../../src/game/config';
import { speedMultiplier } from '../../src/game/difficulty';
import { ballCountAtScore } from '../../src/game/milestones';
import { createRallyEffects } from '../../src/game/rallyEffects';
import type { RallyEffectsState } from '../../src/game/rallyEffects';
import { scheduleReturn } from '../../src/game/scheduler';
import { snapshotSimulation, stepSimulation } from '../../src/game/simulation';
import { deflectBounce } from '../../src/game/trajectory';
import type { GameEvent, GameSnapshot } from '../../src/game/types';
import { scenario } from './scenarios';

/** Diagnostic replay: same initial plans and fixed-step autoplayer as appHarness.
 * This is test-owned input and is excluded from production builds. */
export function rallyPerformanceReplay(score=4000,seconds=30,everySteps=2) {
  const state=scenario(score,0).state;
  state.balls=[];
  for(let id=1;id<=ballCountAtScore(score);id++){
    let plan=scheduleReturn({ballId:id,earliestDepartAt:0,preferredTarget:{x:[-.7,.7,0,.4][(id-1)%4]!,y:.5},
      speedMultiplier:speedMultiplier(score),score,smash:score>=450},snapshotSimulation(state).scheduledReturns,DEFAULT_CONFIG);
    const from={x:0,y:.5,z:-DEFAULT_CONFIG.paddleZ};
    if(score>=555)plan=deflectBounce(plan,from,(id*17%29)/29,DEFAULT_CONFIG);
    state.balls.push({id,phase:'queued',position:from,from,plan,warningSent:false});
  }
  state.nextBallId=state.balls.length+1;
  const controller=createRallyEffects(state.runId,0),frames:{snapshot:GameSnapshot;state:RallyEffectsState;events:readonly GameEvent[]}[]=[];
  let pending:GameEvent[]=[];
  for(let step=0;step<Math.round(seconds/DEFAULT_CONFIG.fixedDt);step++){
    const target=snapshotSimulation(state).scheduledReturns[0]?.target??state.paddle;
    const result=stepSimulation(state,DEFAULT_CONFIG,DEFAULT_CONFIG.fixedDt,{target});
    controller.consume(result.events);pending.push(...result.events);
    if((step+1)%everySteps===0){frames.push({snapshot:result.snapshot,state:controller.state(),events:pending});pending=[];}
  }
  return frames;
}
