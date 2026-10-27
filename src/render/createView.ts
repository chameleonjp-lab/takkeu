import { ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, Scene, WebGLRenderer } from 'three';
import type { GameConfig, GameEvent, GameSnapshot } from '../game/types';
import { createInputMapping } from '../input/mapping';
import type { InputMapping } from '../input/mapping';
import { createObjects } from './objects';
import { applyPresentation } from './presentation';
import { createCamera, fitCamera } from './camera';
import { updateOpponentView } from './opponentView';
import { computeDrawingSize } from './quality';
import type { Quality } from '../storage/preferences';
import { createFireworks, PARTICLE_LIMIT } from './particles';
import { createCelebrationView } from './celebrations';
import { createRallyEffectView, presentationPriority } from './rallyEffects';
import type { RallyEffectsState } from '../game/rallyEffects';
import { prepareScene } from './prepare';
import { MAX_BALLS } from '../game/milestones';

export interface GameView {
  interruptEffects?(): void;
  prepare?(progress:(completed:number,total:number)=>void):Promise<void>;
  render(snapshot: GameSnapshot, events: readonly GameEvent[], effects?: RallyEffectsState, presentationTime?: number): void;
  resize(width: number, height: number): void;
  inputMapping(): InputMapping;
  setQuality(quality: Quality): void;
  resources(): { geometries: number; textures: number; programs: number; drawCalls: number; particles:number;particleCapacity:number; rallyEffects?: ReturnType<ReturnType<typeof createRallyEffectView>['stats']> };
  dispose(): void;
}

export function createView(canvas: HTMLCanvasElement, config: GameConfig): GameView {
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!context) throw new Error('WebGL 2を利用できません。対応ブラウザで再読み込みしてください。');
  const renderer = new WebGLRenderer({ canvas, context, antialias: true });
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new Scene();
  scene.background = new Color(0x02040a);
  const camera = createCamera();
  scene.add(new HemisphereLight(0xfff9eb, 0x5b5446, 2.0));
  const light = new DirectionalLight(0xfff7e2, 2.8);
  light.position.set(-3, 5, 1.5); scene.add(light);
  const objects = createObjects(config);
  scene.add(objects.root);
  const fireworks=createFireworks();scene.add(fireworks.root);
  const celebrations=createCelebrationView(config,objects.tableRig);scene.add(celebrations.worldRoot);
  const rallyEffects=createRallyEffectView(config,objects.tableRig);scene.add(rallyEffects.worldRoot);
  const motionQuery=typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  let flashUntil = 0;
  let previousRunId = '';
  let quality: Quality = 'standard';
  let preparation:Promise<void>|null=null,disposed=false;
  return {
    interruptEffects() { fireworks.clear(); rallyEffects.clear(); },
    prepare(progress){
      if(!preparation)preparation=(async()=>{
        // Reserve every live-ball slot once; subsequent plays reuse the pool.
        const ids=Array.from({length:MAX_BALLS},(_,i)=>-i-1);
        objects.syncBalls(ids,true,0);
        for(const visual of objects.balls.values()){visual.root.visible=true;visual.glow.visible=true;visual.shadow.visible=true;}
        objects.commitBalls();
        rallyEffects.prepare();
        try{await prepareScene(renderer,scene,camera,Object.values(objects.parts),fraction=>progress(fraction,1),()=>disposed);}
        finally{if(!disposed){objects.syncBalls([],false,0);objects.commitBalls();rallyEffects.clear();}}
      })();
      return preparation;
    },
    render(snapshot, events, effects, presentationTime = snapshot.simTime) {
      if (snapshot.runId !== previousRunId) { flashUntil = 0; renderer.renderLists.dispose(); previousRunId = snapshot.runId; }
      for (const event of events) if (event.kind === 'player-hit') flashUntil = event.time + 0.12;
      const reducedMotion=motionQuery?.matches??false;
      const display = { ...snapshot, simTime: presentationTime };
      const lowPriorityOpacity=presentationPriority(display,effects);
      applyPresentation(objects, snapshot,reducedMotion);
      updateOpponentView(objects, snapshot, events);
      fireworks.update(snapshot,events,quality,reducedMotion,lowPriorityOpacity);
      celebrations.update(display,reducedMotion,lowPriorityOpacity);
      rallyEffects.update(display,effects,quality,reducedMotion);
      if (!snapshot.progression.appliedMilestones.includes(100)) objects.rimMaterial.emissiveIntensity = snapshot.simTime < flashUntil ? 0.8 : 0.15;
      renderer.render(scene, camera);
    },
    resize(width, height) {
      const w = Math.max(1, width), h = Math.max(1, height);
      const size = computeDrawingSize(w, h, window.devicePixelRatio || 1, quality);
      renderer.setPixelRatio(1);
      renderer.setSize(size.width, size.height, false);
      objects.opponentField.resize(size.width,size.height);
      fitCamera(camera, w, h, config);
    },
    inputMapping() { return createInputMapping(camera, () => canvas.getBoundingClientRect(), config); },
    setQuality(value) { quality = value; },
    resources() { return { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length ?? 0, drawCalls: renderer.info.render.calls,particles:fireworks.active()+rallyEffects.stats().particleCount,particleCapacity:PARTICLE_LIMIT+rallyEffects.stats().capacity,rallyEffects:rallyEffects.stats() }; },
    dispose() { if(disposed)return;disposed=true;rallyEffects.dispose();celebrations.dispose(); fireworks.dispose(); objects.dispose(); renderer.dispose(); },
  };
}
