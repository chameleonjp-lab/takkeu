import type { Quality } from '../storage/preferences';
export function computeDrawingSize(cssWidth: number, cssHeight: number, deviceRatio: number, quality: Quality): { width: number; height: number } {
  const width = Number.isFinite(cssWidth) ? Math.max(1, cssWidth) : 1;
  const height = Number.isFinite(cssHeight) ? Math.max(1, cssHeight) : 1;
  // Low-load mode bounds large surfaces at 540p-equivalent fill cost.
  // Phone-sized CSS canvases stay at their existing 1x resolution.
  const pixelLimit = quality === 'low' ? 960 * 540 : 2_000_000;
  const ratio = Math.min(Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1, quality === 'low' ? 1 : 1.5, Math.sqrt(pixelLimit / (width * height)));
  return { width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)) };
}

/** Same endpoint sizes as manual modes; intermediate rounding stays inside them. */
export function computeAdaptiveDrawingSize(cssWidth: number, cssHeight: number, deviceRatio: number, level: number): { width: number; height: number } {
  const high = computeDrawingSize(cssWidth, cssHeight, deviceRatio, 'standard');
  const low = computeDrawingSize(cssWidth, cssHeight, deviceRatio, 'low');
  const step = Number.isFinite(level) ? Math.max(0, Math.min(2, Math.floor(level))) : 0;
  if (step === 0) return high;
  if (step === 2) return low;
  return { width: Math.floor((high.width + low.width) / 2), height: Math.floor((high.height + low.height) / 2) };
}
