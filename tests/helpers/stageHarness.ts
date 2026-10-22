import { createAudio } from '../../src/audio/audio';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { GameEvent, GameSnapshot } from '../../src/game/types';
import { createView } from '../../src/render/createView';
import { resolvePresentation } from '../../src/render/presentation';
import { createScreens } from '../../src/ui/screens';
import '../../src/ui/styles.css';
import { incoming, scenario } from './scenarios';
import { resolveOpponentPose } from '../../src/render/opponentView';

let current: GameSnapshot = scenario(0, 0).snapshot();
const audio = createAudio(DEFAULT_CONFIG);
let muted = false;
let simulation: ReturnType<typeof scenario> | null = null;
const emitted: GameEvent[] = [];
const screens = createScreens(document.querySelector<HTMLElement>('#app')!, {
  start() {}, retry() {}, home() {}, volume(value) { audio.setVolume(value); },
  pause() { if (simulation) { simulation.state.phase = 'paused'; simulation.state.pauseReason = 'user'; } current = { ...current, phase: 'paused', pauseReason: 'user' }; render(); },
  resume() { if (simulation) { simulation.state.phase = 'running'; simulation.state.pauseReason = null; } current = { ...current, phase: 'running', pauseReason: null }; render(); },
  toggleSound() { muted = !muted; audio.setMuted(muted); screens.setSound(muted); },
});
const view = createView(screens.canvas, DEFAULT_CONFIG);
function render(events: readonly GameEvent[] = []) {
  screens.render(current); audio.consume(events);
  const rect = screens.canvasWrap.getBoundingClientRect();
  view.resize(rect.width, rect.height); view.render(current, events);
}
function show(score: number, time = 0, glowUntil: number | null = null) {
  simulation = null; emitted.length = 0;
  const count = score >= 150 ? 4 : score >= 50 ? 3 : score >= 30 ? 2 : 1;
  const base = scenario(score, time).snapshot();
  current = { ...base, phase: 'running', progression: { ...base.progression, ballGlowUntil: glowUntil },
    balls: Array.from({ length: count }, (_, i) => ({ id: i + 1, phase: 'incoming', smash: false,
      position: { x: i % 2 ? 0.4 : -0.4, y: 0.45, z: (score === 10 || i % 2) ? -0.75 : 0.95 } })),
  };
  audio.reset(current.runId); render();
}
function beginSmash(score = 450) {
  simulation = scenario(score, 0); simulation.state.randomState = 2; emitted.length = 0;
  const ball = incoming(1, 0.001, { x: 0, y: 0.5 }, 0, 2.5);
  const existing2 = incoming(2, 2.2, { x: 0.8, y: 0.5 }, 0, 2.4);
  const existing3 = incoming(3, 2.8, { x: -0.7, y: 0.7 }, 0, 3.2);
  const queued = incoming(4, 3.8, { x: 0, y: 0.5 }, 0, 1.2);
  simulation.state.balls = [
    { ...ball, phase: 'outgoing', from: { x: 0, y: 0.5, z: DEFAULT_CONFIG.paddleZ }, plan: { ...ball.plan, landingZ: -DEFAULT_CONFIG.paddleZ } },
    existing2, existing3, { ...queued, phase: 'queued' },
  ];
  audio.reset(simulation.state.runId);
  const result = simulation.step(); current = result.snapshot; emitted.push(...result.events); render(result.events);
}
function advance(seconds: number) {
  if (!simulation) return;
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DEFAULT_CONFIG.fixedDt); i++) events.push(...simulation.step().events);
  current = simulation.snapshot(); emitted.push(...events); render(events);
}
function animate(seconds: number): Promise<void> {
  const initialTime = current.simTime, started = performance.now();
  let completedTicks = 0;
  return new Promise(resolve => {
    const frame = (now: number) => {
      const elapsed = Math.min(seconds, (now - started) / 1000);
      const events: GameEvent[] = [];
      if (simulation) {
        const requiredTicks = Math.floor(elapsed / DEFAULT_CONFIG.fixedDt + 1e-9);
        while (completedTicks < requiredTicks) { events.push(...simulation.step().events); completedTicks++; }
        current = simulation.snapshot(); emitted.push(...events);
      } else if (current.phase === 'running') current = { ...current, simTime: initialTime + elapsed };
      render(events);
      if (elapsed < seconds) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
}
const harness = {
  show, beginSmash, advance, animate, events: () => emitted, pose: () => resolveOpponentPose(current),
  time(value: number) { if (current.phase === 'running') current = { ...current, simTime: value }; render(); },
  snapshot: () => current,
  presentation: () => resolvePresentation(current),
  muted: () => muted,
};
declare global { interface Window { stage2: typeof harness } }
window.stage2 = harness;
show(0);
