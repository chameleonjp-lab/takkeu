import { triangleAttribute } from './triangleAttribute';
import { DoubleSide, Group, Mesh, Vector3 } from 'three';
import type { Material } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createCelebrations, lossCelebration, rallyCelebration } from '../../src/game/celebrations';
import { createRallyEffects } from '../../src/game/rallyEffects';
import type { RallyEffectsController } from '../../src/game/rallyEffects';
import type { GameEvent, GameSnapshot, Point3 } from '../../src/game/types';
import { createFinishPresentation } from '../../src/app/finishPresentation';
import { createView } from '../../src/render/createView';
import { createRallyEffectView } from '../../src/render/rallyEffects';
import { createCamera, fitCamera } from '../../src/render/camera';
import { createScreens } from '../../src/ui/screens';
import { createRallyNotice } from '../../src/ui/rallyNotice';
import type { Quality } from '../../src/storage/preferences';
import { scenario } from './scenarios';
import '../../src/ui/styles.css';

// This entire fixture is excluded from Vite's production entrypoints. Its score
// construction verifies rendering, and is not the physical 0→4000 replay.
const root=document.querySelector<HTMLElement>('#app')!;
let current:GameSnapshot=scenario(0,20).snapshot();
let controller:RallyEffectsController=createRallyEffects(current.runId,0);
let eventNumber=0,quality:Quality='standard';
let finish=createFinishPresentation();
let finishing=false;
let drawingWallTime=20_000;
let canvasCapture=false;
let lastEvents:readonly GameEvent[]=[];
let confirmedHit:GameEvent|null=null;
// Test-only A/B of the four actual rendered flat batches. Three calls this
// hook before choosing its transparent DoubleSide one/two-pass path. Keeping
// the override here avoids a production debug API or a second fake renderer.
let singlePassOverride:boolean|null=null;
const originalSinglePass=new WeakMap<Material,boolean>();
const touchedSinglePass=new Set<string>();
const meshBeforeRender=Mesh.prototype.onBeforeRender;
Mesh.prototype.onBeforeRender=function(this:Mesh,...args:Parameters<Mesh['onBeforeRender']>){
  const material=args[4];
  if(/^rally-(table|world)-(lines|glow)$/.test(this.name)&&material.transparent&&material.side===DoubleSide){
    if(!originalSinglePass.has(material))originalSinglePass.set(material,material.forceSinglePass);
    material.forceSinglePass=singlePassOverride??originalSinglePass.get(material)!;
    touchedSinglePass.add(this.name);
  }
  meshBeforeRender.apply(this,args);
};
const screens=createScreens(root,{
  start(){},retry(){reset(0);},home(){reset(0);current={...current,phase:'ready'};render();},
  pause(){current={...current,phase:'paused',pauseReason:'user'};render();},
  resume(){current={...current,phase:'running',pauseReason:null};render();},toggleSound(){},volume(){},
});
const notice=createRallyNotice(root);
let view=createView(screens.canvas,DEFAULT_CONFIG);
// A separate, unrendered copy exposes deterministic geometry in tests, alongside
// the real application's view. It cannot affect the visible scene/physics.
const diagnosticRig=new Group();
let diagnostic=createRallyEffectView(DEFAULT_CONFIG,diagnosticRig);
const camera=createCamera();
let viewport={width:390,height:844};
let fitted='';
const captureCanvas=document.createElement('canvas');captureCanvas.width=1024;captureCanvas.height=768;
const captureContext=captureCanvas.getContext('2d',{colorSpace:'srgb'})!;
const staticBalls:GameSnapshot['balls']=[
  {id:1,phase:'incoming',position:{x:-.4,y:.43,z:1.25},smash:false},
  {id:2,phase:'outgoing',position:{x:.45,y:.62,z:-.35},smash:false},
];
function event(kind:GameEvent['kind'],score:number,time:number,position?:Point3):GameEvent {
  return {id:`${current.runId}:fixture-${++eventNumber}`,runId:current.runId,kind,time,
    ...(kind==='player-hit'?{rallyScore:score}:{lossCount:score,ballId:score}),...(position?{position}:{})};
}
function render() {
  const presentation=finish.frame(current,drawingWallTime,controller.endTime());
  finishing=presentation.finishing;
  screens.render(current,finishing);
  const rectangle=screens.canvasWrap.getBoundingClientRect();
  viewport={width:rectangle.width,height:rectangle.height};
  view.setQuality(quality);
  const fitKey=`${rectangle.width}:${rectangle.height}:${quality}`;
  if(fitKey!==fitted){view.resize(rectangle.width,rectangle.height);fitCamera(camera,rectangle.width,rectangle.height,DEFAULT_CONFIG);fitted=fitKey;}
  const state=controller.state();
  view.render(presentation.snapshot,lastEvents,state);
  if(!canvasCapture)diagnostic.update(presentation.snapshot,state,quality,matchMedia('(prefers-reduced-motion: reduce)').matches);
  const cues=state.cues.filter(cue=>(cue.kind==='notice'||cue.kind==='major')&&presentation.snapshot.simTime>=cue.at&&presentation.snapshot.simTime<cue.at+cue.duration);
  const cue=cues.sort((a,b)=>b.priority-a.priority||b.at-a.at)[0];
  notice.update(presentation.snapshot,{notice:cue?{score:cue.value,at:cue.at,major:cue.kind==='major'}:null,bestAt:state.best?.at??null,goldAt:state.arrivals.find(a=>a.threshold===300)?.at??null},finishing);
  lastEvents=[];
}
function reset(score:number,bestAtStart=0) {
  current={...scenario(score,20).snapshot(),balls:staticBalls,paddle:{x:.1,y:.5}};
  drawingWallTime=20_000;
  controller=createRallyEffects(current.runId,bestAtStart);eventNumber=0;confirmedHit=null;finish=createFinishPresentation();
  if(score>0)controller.consume([event('player-hit',score,0)]);
  render();
}
function arrive(score:number,at=20) {
  const contact={x:.1,y:.5,z:DEFAULT_CONFIG.paddleZ};
  const hit=event('player-hit',score,at,contact);
  controller.consume([hit]);
  current={...current,score,simTime:at,celebrations:rallyCelebration(current.celebrations,score,at),
    progression:scenario(score,at).snapshot().progression};
  confirmedHit=hit;drawingWallTime=at*1000;lastEvents=[hit];render();return hit;
}
const harness={
  reset,arrive,
  show(score:number,time=20){reset(Math.max(0,score-1));arrive(score,20);harness.time(time);},
  time(simTime:number){if(current.phase!=='gameover')current={...current,simTime};drawingWallTime=simTime*1000;render();},
  advance(seconds:number){if(current.phase==='running')current={...current,simTime:current.simTime+seconds};if(current.phase!=='paused')drawingWallTime+=seconds*1000;render();},
  pause(){current={...current,phase:'paused',pauseReason:'user'};render();},
  resume(){current={...current,phase:'running',pauseReason:null};render();},
  redraw(){render();},
  singlePass(value:boolean|null,nextQuality:Quality=quality){
    singlePassOverride=value;quality=nextQuality;touchedSinglePass.clear();render();
    return {override:value,quality,materials:[...touchedSinglePass].sort(),resources:view.resources()};
  },
  replayHit(){if(confirmedHit)controller.consume([confirmedHit]);render();},
  restore(){view.dispose();diagnostic.dispose();view=createView(screens.canvas,DEFAULT_CONFIG);diagnostic=createRallyEffectView(DEFAULT_CONFIG,diagnosticRig);fitted='';render();},
  setQuality(next:Quality){quality=next;render();},
  warning(){current={...current,scheduledReturns:[{ballId:1,departAt:current.simTime+.2,netCrossAt:current.simTime+.4,arriveAt:current.simTime+.6,target:{x:0,y:.5},smash:true,warningAt:current.simTime-.1,speedMultiplier:2.5}]};render();},
  loss(count:number,streak=1,sameFrame=false) {
    reset(2000);let celebrations=createCelebrations();
    for(let n=Math.max(1,count-streak+1);n<=count;n++){
      const at=20+(sameFrame?0:(n-(count-streak+1))*.04);
      const lost=event('ball-lost',n,at,{x:n%2?-.72:.72,y:.16,z:2.3+(n%3)*.04});
      controller.consume([lost]);lastEvents=[...lastEvents,lost];
      celebrations=lossCelebration(celebrations,n,at);
      current={...current,simTime:at,lostBallCount:n,celebrations};
      drawingWallTime=at*1000;
    }
    render();
  },
  overlap(score:number,loss=99,streak=4){
    reset(score-1);arrive(score);
    // Conservative visual stress: stack legacy century/repdigit and four losses
    // at the same presentation time. This is not a claim of physical reachability.
    let celebrations=rallyCelebration(current.celebrations,1111,20);
    for(let n=Math.max(1,loss-streak+1);n<=loss;n++){
      const lost=event('ball-lost',n,20,{x:n%2?-.72:.72,y:.16,z:2.3});
      controller.consume([lost]);celebrations=lossCelebration(celebrations,n,20);
    }
    current={...current,lostBallCount:loss,celebrations};render();
  },
  ablate(kind:'no-legacy'|'no-random'|'no-repdigit'){
    // Diagnostic fixtures only: never an acceptance scene or production option.
    current=kind==='no-legacy'?{...current,celebrations:createCelebrations()}:kind==='no-repdigit'?{...current,celebrations:{...current.celebrations,repdigitAt:null}}:
      {...current,progression:{...current.progression,appliedMilestones:current.progression.appliedMilestones.filter(score=>score!==500&&score!==510)}};
    render();
  },
  legacyFireworks(){
    // Deliberately conservative pool-cap stress, not a physically reachable
    // timing claim:64effect facts with only30distinct ball IDs, all atsimTime20.
    // The positions use actual racket-contact/table-bounce planes.
    const fireworks:GameEvent[]=Array.from({length:64},(_,index)=>{
      const racket=index%2===0;
      return {id:`${current.runId}:pool-${index}`,runId:current.runId,time:20,kind:racket?'player-hit':'table-bounce',ballId:index%30+1,
        rallyScore:current.score,effect:racket?'racket-firework':'bounce-firework',
        position:racket?{x:.1,y:.5,z:DEFAULT_CONFIG.paddleZ}:{x:(index%5-2)*.32,y:DEFAULT_CONFIG.tableY,z:.3+(index%6)*.2}};
    });
    current={...current,balls:Array.from({length:30},(_,index)=>({id:index+1,phase:'incoming',smash:false,
      position:{x:(index%5-2)*.32,y:.35+Math.floor(index/5)*.05,z:.3+Math.floor(index/5)*.2}})),
      scheduledReturns:[{ballId:1,departAt:20.2,netCrossAt:20.4,arriveAt:20.6,target:{x:0,y:.5},smash:true,warningAt:19.9,speedMultiplier:2.5}]};
    lastEvents=fireworks;render();return {events:fireworks.length,distinctBallIds:30,resources:view.resources()};
  },
  finish(){current={...current,phase:'gameover',balls:current.balls.map(b=>({...b,phase:'lost'}))};render();},
  snapshot:()=>current,state:()=>controller.state(),stats:()=>view.resources().rallyEffects??diagnostic.stats(),resources:()=>view.resources(),finishing:()=>finishing,
  project(position:Point3){const point=new Vector3(position.x,position.y,position.z).project(camera);return {x:(point.x+1)*viewport.width/2,y:(1-point.y)*viewport.height/2,inView:Math.abs(point.x)<=1&&Math.abs(point.y)<=1};},
  geometry(){
    const rows:{name:string;vertices:number;sample:number[];colorSample:number[];bounds:{min:number[];max:number[]}}[]=[];
    for(const group of [diagnosticRig,diagnostic.worldRoot])group.traverse(node=>{
      if(!('geometry' in node))return;
      const geometry=(node as Mesh).geometry;
      const values=triangleAttribute(geometry,'position').array,count=geometry.drawRange.count;
      if(!count)return;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<count*3;i++){const k=i%3;min[k]=Math.min(min[k]!,values[i]!);max[k]=Math.max(max[k]!,values[i]!);}
      rows.push({name:node.name,vertices:count,sample:Array.from(values).slice(0,Math.min(count*3,240)),colorSample:Array.from(triangleAttribute(geometry,'color').array).slice(0,Math.min(count*4,320)),bounds:{min,max}});
    });
    return rows;
  },
  capture(simTime:number){
    canvasCapture=true;
    try{harness.time(simTime);}finally{canvasCapture=false;}
    captureContext.drawImage(screens.canvas,0,0,1024,768);
    return captureCanvas.toDataURL('image/png');
  },
};
declare global{interface Window{rally:typeof harness}}
window.rally=harness;reset(0);
