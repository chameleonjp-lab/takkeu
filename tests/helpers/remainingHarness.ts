import { DEFAULT_CONFIG } from '../../src/game/config';
import { flightDuration } from '../../src/game/difficulty';
import { createView } from '../../src/render/createView';
import { resolvePresentation } from '../../src/render/presentation';
import { createScreens } from '../../src/ui/screens';
import type { BallPhase, GameEvent, GameSnapshot } from '../../src/game/types';
import { sampleReturn } from '../../src/game/trajectory';
import { incoming, scenario } from './scenarios';
import { measureFlight, missPaddle } from './remainingBall';
import '../../src/ui/styles.css';

const screens = createScreens(document.querySelector<HTMLElement>('#app')!, {
  start() {}, retry() {}, pause() {}, resume() {}, home() {}, toggleSound() {}, volume() {},
});
const view = createView(screens.canvas, DEFAULT_CONFIG);
let current: GameSnapshot;
let simulation: ReturnType<typeof scenario>;
const events: GameEvent[] = [];
let pixels = new Uint8Array();
function render() {
  screens.render(current);
  const rect = screens.canvasWrap.getBoundingClientRect();
  view.resize(rect.width, rect.height); view.render(current, []);
  const gl = screens.canvas.getContext('webgl2')!;
  pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
}
function show(score: number, phase: BallPhase | 'absent', x = 0.45) {
  current = { ...scenario(score, 20).snapshot(), runId: 'remaining-ball-evidence',
    balls: phase === 'absent' ? [] : [{ id: 1, phase, smash: score >= 450, position: { x, y: 0.5, z: -0.95 } }] };
  render();
}
function begin(score: number) {
  simulation = scenario(score); events.length = 0;
  const out = incoming(1, 20.02, { x: 0.5, y: 0.6 });
  out.from = { x: 0.5, y: 0.6, z: 1.95 }; out.plan = { ...out.plan, landingZ: -1.95 };
  simulation.state.balls = [{ ...out, phase: 'outgoing', position: sampleReturn(out.plan, out.from, 20) },
    incoming(2, 20.02 + flightDuration(DEFAULT_CONFIG, score, score >= 450), { x: 0.5, y: 0.6 })];
  current = simulation.snapshot(); render();
}
function until(stage: 'waiting' | 'departed' | 'own') {
  for (let i = 0; i < 600; i++) {
    const result = simulation.step(missPaddle); events.push(...result.events);
    const ball = simulation.state.balls.find(b => b.id === 1);
    if (!ball) throw new Error('Lost target before transition');
    if (stage === 'waiting' && ball.phase === 'waiting-return'
      || stage === 'departed' && result.events.some(e => e.kind === 'opponent-hit' && e.ballId === 1)
      || stage === 'own' && ball.phase === 'incoming' && ball.position.z >= 0) {
      current = result.snapshot; render(); return;
    }
  }
  throw new Error('Transition did not occur');
}
const harness = { show, begin, until, snapshot: () => current, presentation: () => resolvePresentation(current), events: () => events,
  async imageHash() {
    const hash = await crypto.subtle.digest('SHA-256', pixels);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  },
  measure: () => [99, 100, 101, 450, 539, 540, 555].flatMap(score => [1, 2, 3, 4, 5, 8].map(count => measureFlight(score, count))) };
declare global { interface Window { remaining: typeof harness } }
window.remaining = harness; show(490, 'waiting-return');
