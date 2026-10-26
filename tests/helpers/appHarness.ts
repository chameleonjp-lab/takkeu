import { createApp } from '../../src/app/createApp';
import { ballCountAtScore } from '../../src/game/milestones';
import { speedMultiplier } from '../../src/game/difficulty';
import { scheduleReturn } from '../../src/game/scheduler';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createSession } from '../../src/game/session';
import { createView } from '../../src/render/createView';
import { createAudio } from '../../src/audio/audio';
import { createRankingClient } from '../../src/ranking/client';
import type { GameSession, GameSnapshot, GameEvent } from '../../src/game/types';
import { createSimulationState, snapshotSimulation, startSimulation, stepSimulation } from '../../src/game/simulation';
import { scenario } from './scenarios';
import { deflectBounce } from '../../src/game/trajectory';
import { remainingScenario } from './remainingBall';
import { lossLimitScenario } from './losses';
import { Vector3 } from 'three';
import { createCamera, fitCamera } from '../../src/render/camera';
import '../../src/ui/styles.css';

let state = createSimulationState(7);
let currentView: ReturnType<typeof createView> | null = null;
let currentAudio: ReturnType<typeof createAudio> | null = null;
let autoPlay = false;
let renderEnabled=true;
const qualitySwitches: {level:number;at:number;before:{width:number;height:number};after:{width:number;height:number}}[]=[];
let resolutionLevel=0;
let failNextView = false;
let releasePreparation:(()=>void)|null=null;
const metrics = { viewCreates: 0, viewDisposes: 0, viewRenders: 0, viewPrepares:0, smashDepartures: 0, events: [] as GameEvent[] };
const session: GameSession = {
  snapshot: () => snapshotSimulation(state), start() { startSimulation(state, DEFAULT_CONFIG); },
  step(dt, input) {
    const target = autoPlay ? session.snapshot().scheduledReturns[0]?.target ?? state.paddle : input.target;
    const result = stepSimulation(state, DEFAULT_CONFIG, dt, autoPlay ? { target } : input); metrics.events.push(...result.events);
    metrics.smashDepartures += result.events.filter(event => event.kind === 'opponent-hit' && result.snapshot.balls.find(ball => ball.id === event.ballId)?.smash).length;
    return result;
  },
  pause(reason) { if (state.phase === 'running') { state.phase = 'paused'; state.pauseReason = reason; } },
  resume() { if (state.phase === 'paused') { state.phase = 'running'; state.pauseReason = null; } },
  reset(seed) { state = createSimulationState(seed); },
};
// Only this test entrypoint can replace the session. It is never a Vite build input.
const app = createApp(document.querySelector<HTMLElement>('#app')!, {
  createSession: () => session,
  storage: new URLSearchParams(location.search).has('ranking') ? window.localStorage : { getItem: () => null, setItem() {} },
  // Ordinary gameplay tests use a deterministic empty leaderboard. Ranking tests
  // explicitly opt into the real REST client and intercept its network boundary.
  rankingApi: new URLSearchParams(location.search).has('ranking') ? createRankingClient() : {
    position: async () => null, startGuest: async () => {},
    start: async () => { throw new Error('Named ranking requires the ranking fixture option'); },
    finish: async () => {}, submit: async () => {}, top: async () => [],
  },
  createAudio(...args) { currentAudio = createAudio(...args); return currentAudio; },
  createView(canvas, config) {
    if (failNextView) { failNextView = false; throw new Error('verification: renderer creation failed'); }
    const view = createView(canvas, config); currentView = view; metrics.viewCreates++;
    let drawingQuality: import('../../src/storage/preferences').Quality='standard';
    return { ...view,
      setQuality(quality){drawingQuality=quality;view.setQuality(quality);},
      setResolutionLevel(level){
        const before={width:canvas.width,height:canvas.height};view.setResolutionLevel?.(level);
        if(drawingQuality==='auto'&&level!==resolutionLevel){qualitySwitches.push({level,at:performance.now(),before,after:{width:canvas.width,height:canvas.height}});resolutionLevel=level;}
      },
      async prepare(progress:(completed:number,total:number)=>void){
        metrics.viewPrepares++;
        if(new URLSearchParams(location.search).get('loading')==='hold'&&metrics.viewPrepares===1)await new Promise<void>(resolve=>{releasePreparation=resolve;});
        await view.prepare!(progress);
      },
      render(...args) { metrics.viewRenders++; if(renderEnabled)view.render(...args); }, dispose() { metrics.viewDisposes++; view.dispose(); } };
  },
});
function show(score: number) {
  state = scenario(score, 0).state;
  currentAudio?.reset(state.runId); metrics.events.length = 0; metrics.smashDepartures = 0;
  state.balls = [];
  for (let id = 1; id <= ballCountAtScore(score); id++) {
    const smash = score >= 450;
    let plan = scheduleReturn({ ballId: id, earliestDepartAt: 0,
      preferredTarget: { x: [-0.7, 0.7, 0, 0.4][(id - 1) % 4]!, y: 0.5 },
      speedMultiplier: speedMultiplier(score), score, smash }, session.snapshot().scheduledReturns, DEFAULT_CONFIG);
    const from = { x: 0, y: 0.5, z: -DEFAULT_CONFIG.paddleZ };
    if(score>=555)plan=deflectBounce(plan,from,(id*17%29)/29,DEFAULT_CONFIG);
    state.balls.push({ id, phase: 'queued', position: from, from, plan, warningSent: false });
  }
  state.nextBallId = state.balls.length + 1;
  if (score === 10) state.progression = { ...state.progression, ballGlowUntil: 5 };
}
function restore() { const canvas = document.querySelector('canvas')!; canvas.dispatchEvent(new Event('webglcontextrestored')); }
const harness = {
  renderingEnabled:()=>renderEnabled,
  renderEnabled(value:boolean){renderEnabled=value;},
  qualityChanges:()=>qualitySwitches.map(c=>({...c})),
  setResolutionLevel(level:number){currentView?.setResolutionLevel?.(level);},
  parkForInput(){
    show(0); // Keep a real running session, with an opponent stroke beyond the input-only test.
    for(const ball of state.balls)ball.plan={...ball.plan,departAt:100000,netCrossAt:100001,arriveAt:100002,warningAt:null};
  },
  inputError(x:number,y:number){
    const canvas=document.querySelector('canvas')!,rect=canvas.getBoundingClientRect();
    const expected=currentView!.inputMapping().toWorld(x,y)!;
    const camera=createCamera();fitCamera(camera,rect.width,rect.height,DEFAULT_CONFIG);
    const project=(p:{x:number;y:number})=>{const v=new Vector3(p.x,p.y,DEFAULT_CONFIG.paddleZ).project(camera);return{x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};};
    const actual=project(state.paddle),target=project(expected);
    return{phase:state.phase,paddle:{...state.paddle},expected,actual,target,errorCssPx:Math.hypot(actual.x-target.x,actual.y-target.y)};
  },
  snapshot: (): GameSnapshot => session.snapshot(), show, restore, metrics: () => metrics,
  releasePreparation(){releasePreparation?.();releasePreparation=null;},
  lossLimit(count = 98) {
    state = lossLimitScenario(count, 340, 0).state;
    currentAudio?.reset(state.runId); metrics.events.length = 0;
  },
  remaining(score: number, count: number) {
    state = remainingScenario(score, count, 20.05).state;
    state.simTime = 0;
    for (const ball of state.balls) ball.plan = { ...ball.plan, departAt: ball.plan.departAt - 20,
      netCrossAt: ball.plan.netCrossAt - 20, arriveAt: ball.plan.arriveAt - 20,
      warningAt: ball.plan.warningAt === null ? null : ball.plan.warningAt - 20 };
    for (const ball of state.balls) if (ball.warningEmittedAt !== undefined) ball.warningEmittedAt -= 20;
    currentAudio?.reset(state.runId); metrics.events.length = 0;
  },
  resources: () => currentView?.resources(),
  failNextView() { failNextView = true; },
  finish() { state.phase = 'gameover'; state.balls.forEach(ball => { ball.phase = 'lost'; }); },
  autoPlay(value: boolean) { autoPlay = value; },
  dispose: () => app.dispose(), freshSession: () => createSession(DEFAULT_CONFIG, 7).snapshot() };
declare global { interface Window { stage3: typeof harness } }
window.stage3 = harness;
