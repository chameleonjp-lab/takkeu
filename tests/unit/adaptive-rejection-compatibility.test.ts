import { expect, it, vi } from 'vitest';
import { loadPreferences, savePreferences, type Preferences } from '../../src/storage/preferences';

it('recovers an unshipped auto preference to standard without losing the existing v1 settings', () => {
  const storage = {
    getItem: () => JSON.stringify({ version: 1, bestScore: 4000, volume: .42, muted: true, sensitivity: 1.25, quality: 'auto' }),
    setItem: vi.fn(),
  };
  const value = loadPreferences(storage);
  expect(value).toEqual({ version: 1, bestScore: 4000, volume: .42, muted: true, sensitivity: 1.25, quality: 'standard' });
  expect(savePreferences(storage, { ...value, quality: 'auto' } as unknown as Preferences)).toBe(false);
  expect(storage.setItem).not.toHaveBeenCalled();
});
