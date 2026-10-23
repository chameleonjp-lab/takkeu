// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { createInputMapping } from '../../src/input/mapping';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { paddleHorizontalRange } from '../../src/game/viewpoint';
import { createCamera, fitCamera } from '../../src/render/camera';
import { createView } from '../../src/render/createView';
import type { GameView } from '../../src/render/createView';

// Only the GPU boundary is replaced. Mapping uses the view's real Three camera.
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: class {
    setPixelRatio(): void {} setSize(): void {} dispose(): void {}
  } };
});
const views: GameView[] = [];
function setup(width: number, height: number, left = 17, top = 31) {
  const canvas = document.createElement('canvas');
  const rect = { left, top, width, height };
  canvas.getBoundingClientRect = () => ({ ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height, toJSON: () => ({ ...rect }) });
  canvas.getContext = (() => ({})) as unknown as HTMLCanvasElement['getContext'];
  const view = createView(canvas, DEFAULT_CONFIG); views.push(view); view.resize(width, height);
  const camera = createCamera(); fitCamera(camera, width, height, DEFAULT_CONFIG);
  const project = (x: number, y: number) => {
    const point = new Vector3(x, y, DEFAULT_CONFIG.paddleZ).project(camera);
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  };
  return { view, rect, project };
}
afterEach(() => { for (const view of views.splice(0)) view.dispose(); vi.unstubAllGlobals(); });

describe('actual camera ray pointer mapping', () => {
  it.each([[390, 844], [844, 390], [1280, 720], [320, 568], [280, 360]])('roundtrips the reachable center, corners, and height-dependent edges at %ix%i', (width, height) => {
    const { view, project, rect } = setup(width, height);
    const mapping = view.inputMapping();
    expect(mapping.screen).toEqual(rect);
    for (const y of [0.15, 0.325, 0.5, 0.675, 0.85]) {
      const range = paddleHorizontalRange(y, DEFAULT_CONFIG);
      for (const x of [range.min, range.min / 2, 0, range.max / 2, range.max]) {
        const client = project(x, y);
        const target = mapping.toWorld?.(client.x, client.y);
        expect(target?.x).toBeCloseTo(x, 10); expect(target?.y).toBeCloseTo(y, 10);
        const rendered = project(target!.x, target!.y);
        expect(Math.hypot(rendered.x - client.x, rendered.y - client.y)).toBeLessThan(1);
      }
    }
  });

  it('uses the supplied camera pose and off-axis projection, and invalidates changed world matrices', () => {
    const camera = new PerspectiveCamera(63, 1.7, 0.1, 30);
    camera.position.set(-0.4, 1.8, 4.2); camera.lookAt(0.2, 0.4, DEFAULT_CONFIG.paddleZ);
    camera.setViewOffset(1700, 1000, 130, 70, 1400, 850); camera.updateMatrixWorld();
    const rect = { left: 23, top: 41, width: 1400, height: 850 };
    const point = new Vector3(0.24, 0.63, DEFAULT_CONFIG.paddleZ).project(camera);
    const mapping = createInputMapping(camera, () => rect, DEFAULT_CONFIG);
    const target = mapping.toWorld(rect.left + (point.x + 1) * rect.width / 2, rect.top + (1 - point.y) * rect.height / 2);
    expect(target?.x).toBeCloseTo(0.24, 10); expect(target?.y).toBeCloseTo(0.63, 10);
    camera.position.x += 0.1;
    expect(mapping.isCurrent?.()).toBe(false);
    expect(mapping.toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)).toBeNull();
  });

  it('clamps rays using the height-dependent paddle reach rather than a rectangular world range', () => {
    const { view, project } = setup(390, 844);
    const mapping = view.inputMapping();
    const targets = [
      { source: { x: -9, y: 0.15 }, expected: { x: paddleHorizontalRange(0.15, DEFAULT_CONFIG).min, y: 0.15 } },
      { source: { x: 9, y: 0.85 }, expected: { x: paddleHorizontalRange(0.85, DEFAULT_CONFIG).max, y: 0.85 } },
      { source: { x: 0, y: -1 }, expected: { x: 0, y: 0.15 } },
      { source: { x: 0, y: 1.2 }, expected: { x: 0, y: 0.85 } },
    ];
    for (const { source, expected } of targets) {
      const client = project(source.x, source.y), target = mapping.toWorld?.(client.x, client.y);
      expect(target?.x).toBeCloseTo(expected.x, 10); expect(target?.y).toBeCloseTo(expected.y, 10);
    }
  });

  it.each([1, 1.5, 2, 3])('uses CSS pixels at DPR %s independent of drawing-buffer scaling', dpr => {
    vi.stubGlobal('devicePixelRatio', dpr);
    const { view, project } = setup(390, 844);
    const client = project(0.32, 0.73), target = view.inputMapping().toWorld?.(client.x, client.y);
    expect(target?.x).toBeCloseTo(0.32, 10); expect(target?.y).toBeCloseTo(0.73, 10);
  });

  it('invalidates mappings when either the canvas rectangle or camera projection changes', () => {
    const { view, rect, project } = setup(390, 844);
    const point = project(0, 0.5), mapping = view.inputMapping();
    expect(mapping.isCurrent?.()).toBe(true);
    rect.left += 1;
    expect(mapping.isCurrent?.()).toBe(false); expect(mapping.toWorld?.(point.x, point.y)).toBeNull();
    const shifted = view.inputMapping(); expect(shifted.isCurrent?.()).toBe(true);
    view.resize(844, 390);
    expect(shifted.isCurrent?.()).toBe(false); expect(shifted.toWorld?.(point.x, point.y)).toBeNull();
    expect(view.inputMapping().isCurrent?.()).toBe(true);
  });

  it('ignores nonfinite coordinates and invalid canvas geometry', () => {
    const { view, rect } = setup(390, 844);
    const mapping = view.inputMapping();
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(mapping.toWorld?.(bad, 60)).toBeNull(); expect(mapping.toWorld?.(70, bad)).toBeNull();
    }
    rect.width = 0;
    expect(view.inputMapping().toWorld?.(70, 60)).toBeNull();
    rect.width = NaN;
    expect(view.inputMapping().toWorld?.(70, 60)).toBeNull();
  });
});
