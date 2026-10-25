// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { createScreens } from '../../src/ui/screens';
import { scenario } from '../helpers/scenarios';

import { resultBands as bands } from '../helpers/resultCases';

let dispose: () => void = () => {};
afterEach(() => dispose());
it.each(bands)('shows the exact comment at both ends of %i–%i', (min, max, comment) => {
  const root = document.createElement('div'); document.body.append(root);
  const noop = () => {};
  const screens = createScreens(root, { start: noop, pause: noop, resume: noop, retry: noop, home: noop, toggleSound: noop, volume: noop });
  dispose = () => { screens.dispose(); root.remove(); };
  const snapshot = scenario(0).snapshot();
  for (const score of [min, max]) {
    screens.render({ ...snapshot, score, phase: 'gameover' });
    const heading = root.querySelector('[data-result] h2')!;
    expect(heading.textContent).toBe(comment);
    expect(heading.closest('[hidden], [aria-hidden="true"]')).toBeNull();
    expect(root.querySelector('[data-result-score]')!.textContent).toBe(String(score));
  }
});
