import { expect, it } from 'vitest';
import { computeDrawingSize } from '../../src/render/quality';
it('描画倍率1.5／低品質1.0と200万画素を守り、CSSサイズを変えない', () => {
  expect(computeDrawingSize(400, 600, 3, 'standard')).toEqual({ width: 600, height: 900 });
  expect(computeDrawingSize(400, 600, 3, 'low')).toEqual({ width: 400, height: 600 });
  for (const quality of ['standard', 'low'] as const) {
    const size = computeDrawingSize(3000, 2000, 3, quality);
    expect(size.width * size.height).toBeLessThanOrEqual(2_000_000);
    expect(size.width / size.height).toBeCloseTo(1.5, 2);
  }
  expect(computeDrawingSize(0, NaN, Infinity, 'low')).toEqual({ width: 1, height: 1 });
});
