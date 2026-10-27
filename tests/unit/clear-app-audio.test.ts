// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/createApp';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createSimulationState, snapshotSimulation, startSimulation, stepSimulation } from '../../src/game/simulation';
import type { GameSession } from '../../src/game/types';
import { incoming } from '../helpers/scenarios';

it('the app delivers the final hit and clear sound event without suspending the fanfare', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  let state = createSimulationState(7);
  const session: GameSession = { snapshot: () => snapshotSimulation(state), start: () => startSimulation(state, DEFAULT_CONFIG),
    step: (dt, input) => stepSimulation(state, DEFAULT_CONFIG, dt, input),
    pause() {}, resume() {}, reset(seed) { state = createSimulationState(seed); } };
  const audio = { prepare: async () => true, unlock: async () => true, consume: vi.fn(), setVolume() {}, setMuted() {}, suspend: vi.fn(), reset() {}, dispose: async () => {} };
  const root = document.createElement('div'); document.body.append(root);
  const mapping = { screen: { left: 0, top: 0, width: 390, height: 844 }, isCurrent: () => true, toWorld: () => ({ x: 0, y: .5 }) };
  const render = vi.fn();
  const app = createApp(root, { createSession: () => session, createAudio: () => audio,
    createView: () => ({ prepare: async () => {}, render, resize() {}, setQuality() {}, inputMapping: () => mapping, dispose() {}, resources: () => ({ geometries: 0, textures: 0, programs: 0, drawCalls: 0, particles: 0, particleCapacity: 0 }) }),
    storage: { getItem: () => null, setItem() {} }, rankingApi: { start: async () => { throw Error('no named start'); }, startGuest: async () => {}, finish: async () => {}, submit: async () => {}, top: async () => [], position: async () => null } });
  try {
    root.querySelector('.canvas-wrap')!.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844, toJSON() {} });
    root.querySelector<HTMLButtonElement>('[data-action="start"]')!.click(); await vi.advanceTimersByTimeAsync(200);
    expect(state.phase).toBe('running');
    state.score = 3499; state.balls = [incoming(1, state.simTime + .05, undefined, state.simTime)];
    const stopped = audio.suspend.mock.calls.length;
    await vi.advanceTimersByTimeAsync(100);
    expect(state.endReason).toBe('clear');
    expect(audio.consume.mock.calls.flatMap(c => c[0]).some(e => e.kind === 'game-clear')).toBe(true);
    expect(audio.suspend).toHaveBeenCalledTimes(stopped);
    await vi.advanceTimersByTimeAsync(3000); const draws = render.mock.calls.length; await vi.advanceTimersByTimeAsync(3000);
    expect(render).toHaveBeenCalledTimes(draws); expect(audio.suspend).toHaveBeenCalledTimes(stopped);
  } finally { app.dispose(); root.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); }
});
