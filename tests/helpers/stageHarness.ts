import { createAudio } from '../../src/audio/audio';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { GameEvent, GameSnapshot } from '../../src/game/types';
import { createView } from '../../src/render/createView';
import { resolvePresentation } from '../../src/render/presentation';
import { createScreens } from '../../src/ui/screens';
import '../../src/ui/styles.css';
import { scenario } from './scenarios';

let current: GameSnapshot = scenario(0, 0).snapshot();
const audio = createAudio(DEFAULT_CONFIG);
let muted = false;
const screens = createScreens(document.querySelector<HTMLElement>('#app')!, {
  start() {}, retry() {}, home() {}, volume(value) { audio.setVolume(value); },
  pause() { current = { ...current, phase: 'paused', pauseReason: 'user' }; render(); },
  resume() { current = { ...current, phase: 'running', pauseReason: null }; render(); },
  toggleSound() { muted = !muted; audio.setMuted(muted); screens.setSound(muted); },
});
const view = createView(screens.canvas, DEFAULT_CONFIG);
function render(events: readonly GameEvent[] = []) {
  screens.render(current);
  const rect = screens.canvasWrap.getBoundingClientRect();
  view.resize(rect.width, rect.height); view.render(current, events);
}
function show(score: number, time = 0, glowUntil: number | null = null) {
  const count = score >= 150 ? 4 : score >= 50 ? 3 : score >= 30 ? 2 : 1;
  const base = scenario(score, time).snapshot();
  current = { ...base, phase: 'running', progression: { ...base.progression, ballGlowUntil: glowUntil },
    balls: Array.from({ length: count }, (_, i) => ({ id: i + 1, phase: 'incoming', smash: false,
      position: { x: i % 2 ? 0.4 : -0.4, y: 0.45, z: (score === 10 || i % 2) ? -0.75 : 0.95 } })),
  };
  audio.reset(current.runId); render();
}
const harness = {
  show,
  time(value: number) { if (current.phase === 'running') current = { ...current, simTime: value }; render(); },
  snapshot: () => current,
  presentation: () => resolvePresentation(current),
  muted: () => muted,
};
declare global { interface Window { stage2: typeof harness } }
window.stage2 = harness;
show(0);
