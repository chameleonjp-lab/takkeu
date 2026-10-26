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
