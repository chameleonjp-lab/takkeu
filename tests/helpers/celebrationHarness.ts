import { DEFAULT_CONFIG } from '../../src/game/config';
import { celebrationFrame, createCelebrations, lossCelebration, rallyCelebration } from '../../src/game/celebrations';
import type { GameSnapshot } from '../../src/game/types';
import { createView } from '../../src/render/createView';
import { createScreens } from '../../src/ui/screens';
import { scenario } from './scenarios';
import '../../src/ui/styles.css';

let current:GameSnapshot=scenario(0,0).snapshot();
const screens=createScreens(document.querySelector<HTMLElement>('#app')!,{
  start(){},retry(){},home(){},pause(){current={...current,phase:'paused',pauseReason:'user'};render();},
  resume(){current={...current,phase:'running',pauseReason:null};render();},toggleSound(){},volume(){},
});
let view=createView(screens.canvas,DEFAULT_CONFIG);
function render(){screens.render(current);const r=screens.canvasWrap.getBoundingClientRect();view.resize(r.width,r.height);view.render(current,[]);}
const harness={
  show({loss=0,streak=1,rally=0,time=.05}:{loss?:number;streak?:number;rally?:number;time?:number}){
    let celebrations=createCelebrations();
    for(let n=Math.max(1,loss-streak+1);n<=loss;n++)celebrations=lossCelebration(celebrations,n,0);
    if(rally)celebrations=rallyCelebration(celebrations,rally,0);
    current={...scenario(rally,time).snapshot(),lostBallCount:loss,celebrations};render();
  },
  advance(seconds:number){if(current.phase==='running')current={...current,simTime:current.simTime+seconds};render();},
  time(simTime:number){current={...current,simTime};render();},
  restore(){view.dispose();view=createView(screens.canvas,DEFAULT_CONFIG);render();},
  frame:()=>celebrationFrame(current.celebrations,current.simTime),snapshot:()=>current,resources:()=>view.resources(),
};
declare global{interface Window{celebrations:typeof harness}}
window.celebrations=harness;harness.show({});
