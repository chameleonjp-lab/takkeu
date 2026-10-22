import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, loadPreferences, savePreferences } from '../../src/storage/preferences';

describe('版付き端末内保存', () => {
  const stored = (value: string | null) => ({ getItem: () => value, setItem() {} });
  it('自己ベストと全設定を保存して読み戻す', () => {
    let json: string | null = null;
    const storage = { getItem: (key: string) => key === PREFERENCES_KEY ? json : null, setItem(key: string, value: string) { expect(key).toBe(PREFERENCES_KEY); json = value; } };
    const value = { ...DEFAULT_PREFERENCES, bestScore: 450, volume: 0.3, muted: true, sensitivity: 1.6, quality: 'low' as const };
    expect(savePreferences(storage, value)).toBe(true);
    expect(loadPreferences(storage)).toEqual(value);
  });
  it.each([null, '{', 'null', '[]', '{"version":2,"bestScore":450}', '{"version":1,"bestScore":-1}', '{"version":1,"bestScore":1.5}', '{"version":1,"bestScore":1e999}'])('破損・版違い・不正点数を既定値へ戻す: %s', json => {
    expect(loadPreferences(stored(json))).toEqual(DEFAULT_PREFERENCES);
  });
  it('不正な設定だけを既定値にし、有効な自己ベストは残す', () => {
    expect(loadPreferences(stored(JSON.stringify({ version: 1, bestScore: 80, volume: -1, muted: 'false', sensitivity: 100, quality: 'ultra' })))).toEqual({ ...DEFAULT_PREFERENCES, bestScore: 80 });
  });
  it('読取拒否・容量不足・NaNでも例外を投げずメモリ内継続できる', () => {
    const blocked = { getItem(): never { throw new Error('denied'); }, setItem(): never { throw new Error('quota'); } };
    expect(loadPreferences(blocked)).toEqual(DEFAULT_PREFERENCES);
    expect(savePreferences(blocked, DEFAULT_PREFERENCES)).toBe(false);
    expect(savePreferences(stored(null), { ...DEFAULT_PREFERENCES, bestScore: NaN })).toBe(false);
  });
});
