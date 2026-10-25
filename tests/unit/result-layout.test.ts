// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createScreens } from '../../src/ui/screens';
import { scenario } from '../helpers/scenarios';
let dispose = () => {};
afterEach(() => dispose());
function setup() {
  const root = document.createElement('div'); document.body.append(root); const noop = () => {}, retryPosition = vi.fn();
  const screens = createScreens(root, { start: noop, pause: noop, resume: noop, retry: noop, home: noop, toggleSound: noop, volume: noop, retryPosition });
  screens.render({ ...scenario(0).snapshot(), score: 1500, phase: 'gameover' });
  dispose = () => { screens.dispose(); root.remove(); };
  return { root, screens, retryPosition, get: (selector: string) => root.querySelector<HTMLElement>(selector)! };
}
it('presents score, comment, position, best, actions, TOP30 in that DOM/reading order', () => {
  const { get } = setup();
  const nodes = ['[data-result-score]', '[data-result] h2', '[data-result-position]', '[data-result] [data-best]', '[data-result] [data-action="retry"]', '[data-share-x]', '[data-result] [data-action="home"]', '.ranking-panel'].map(get);
  for (let i = 1; i < nodes.length; i++) expect(nodes[i-1]!.compareDocumentPosition(nodes[i]!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});
it('announces collection, all ranks, top100, failure/retry, and excludes guests', () => {
  const { screens, get, retryPosition } = setup();
  screens.setResultPosition({ status: 'loading' }); expect(get('[data-position-message]').textContent).toBe('順位を集計中…');
  expect(get('[data-position-message]').getAttribute('role')).toBe('status');
  screens.setResultPosition({ status: 'loaded', rank: 100, total: 250, bestScore: 2000 });
  expect(get('[data-position-message]').textContent).toBe('100位 / 250登録中'); expect(get('[data-top100]').hidden).toBe(false);
  screens.setResultPosition({ status: 'loaded', rank: 101, total: 250, bestScore: 2000 }); expect(get('[data-top100]').hidden).toBe(true);
  screens.setResultPosition({ status: 'error' }); get('[data-action="position-retry"]').click(); expect(retryPosition).toHaveBeenCalledOnce();
  screens.setResultPosition({ status: 'hidden' }); expect(get('[data-result-position]').hidden).toBe(true); expect(get('[data-position-message]').textContent).toBe('');
});
