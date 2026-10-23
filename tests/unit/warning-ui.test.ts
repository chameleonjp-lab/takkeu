// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { planOpponentReturn } from '../../src/game/opponent';
import { createScreens } from '../../src/ui/screens';
import { scenario } from '../helpers/scenarios';

it('音が消えていても状態から予告を復元し、390の強弱から独立して表示する', () => {
  const root = document.createElement('div'); document.body.append(root);
  const noop = () => {};
  const screens = createScreens(root, { start: noop, pause: noop, resume: noop, retry: noop, home: noop, toggleSound: noop, volume: noop });
  const base = scenario(450, 20).snapshot();
  const plan = planOpponentReturn({ ballId: 1, earliestDepartAt: 20, preferredTarget: { x: 0, y: 0.5 }, speedMultiplier: 2.2, score: 450, randomValue: 0 }, [], [], DEFAULT_CONFIG);
  screens.setSound(true); screens.render({ ...base, scheduledReturns: [plan] });
  const warning = root.querySelector<HTMLElement>('[data-smash-warning]');
  expect(warning).not.toBeNull();
  expect(warning!.hidden).toBe(false);
  expect(warning!.textContent).toContain('スマッシュ');
  const before = warning!.outerHTML;
  screens.render({ ...base, phase: 'paused', pauseReason: 'user', scheduledReturns: [plan] });
  expect(warning!.hidden).toBe(false);
  expect(root.querySelector<HTMLElement>('.hud')!.inert).toBe(true);
  screens.render({ ...base, simTime: 20.3, scheduledReturns: [plan] });
  expect(warning!.outerHTML).toBe(before);
  screens.render({ ...base, simTime: plan.departAt, scheduledReturns: [plan] });
  expect(warning!.hidden).toBe(true);
  screens.dispose(); root.remove();
});
