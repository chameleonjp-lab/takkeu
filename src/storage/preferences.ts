export type Quality = 'standard' | 'low';
export type Preferences = Readonly<{ version: 1; bestScore: number; volume: number; muted: boolean; sensitivity: number; quality: Quality }>;
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export const PREFERENCES_KEY = 'takkeu.preferences.v1';
export const DEFAULT_PREFERENCES: Preferences = Object.freeze({ version: 1, bestScore: 0, volume: 0.65, muted: false, sensitivity: 1, quality: 'standard' });
function validScore(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function inRange(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
export function loadPreferences(storage: StorageLike): Preferences {
  try {
    const value: unknown = JSON.parse(storage.getItem(PREFERENCES_KEY) ?? 'null');
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('bestScore' in value) || !validScore(value.bestScore)) return { ...DEFAULT_PREFERENCES };
    const record = value as Record<string, unknown>;
    return { version: 1, bestScore: value.bestScore,
      volume: inRange(record.volume, 0, 1) ? record.volume : DEFAULT_PREFERENCES.volume,
      muted: typeof record.muted === 'boolean' ? record.muted : DEFAULT_PREFERENCES.muted,
      sensitivity: inRange(record.sensitivity, 0.5, 2) ? record.sensitivity : DEFAULT_PREFERENCES.sensitivity,
      quality: record.quality === 'low' || record.quality === 'standard' ? record.quality : DEFAULT_PREFERENCES.quality,
    };
  } catch { return { ...DEFAULT_PREFERENCES }; }
}
export function savePreferences(storage: StorageLike, value: Preferences): boolean {
  if (value.version !== 1 || !validScore(value.bestScore) || !inRange(value.volume, 0, 1) || typeof value.muted !== 'boolean' || !inRange(value.sensitivity, 0.5, 2) || !['low', 'standard'].includes(value.quality)) return false;
  try { storage.setItem(PREFERENCES_KEY, JSON.stringify(value)); return true; } catch { return false; }
}
