import { RankingError, validUuid } from './client';
import type { RankingApi } from './client';
import { RANKING_CONFIG as config } from './config';
import type { StorageLike } from '../storage/preferences';

type GuestStart = { startId: string; permanentFailure?: boolean };
type GuestStorage = StorageLike & Partial<Pick<Storage, 'key' | 'length' | 'removeItem'>>;

/** Counts only starts. Guest scores and player identities never enter this queue. */
export function createGuestPlayCounter(storage: GuestStorage, api: Pick<RankingApi, 'startGuest'>) {
  const prefix = `${config.guestPendingKey}.`;
  const individual = typeof storage.key === 'function' && typeof storage.removeItem === 'function';
  const decode = (key: string): unknown => { try { return JSON.parse(storage.getItem(key) ?? 'null'); } catch { return null; } };
  function read(): GuestStart[] {
    try {
      const saved: unknown = individual
        ? Array.from({ length: storage.length ?? 0 }, (_, index) => storage.key!(index))
          .filter((key): key is string => !!key?.startsWith(prefix)).map(decode)
        : decode(config.guestPendingKey);
      return Array.isArray(saved) ? saved.filter((row): row is GuestStart => !!row && typeof row === 'object'
        && validUuid(row.startId) && (row.permanentFailure === undefined || typeof row.permanentFailure === 'boolean')) : [];
    } catch { return []; }
  }
  let pending = read();
  function persist(row: GuestStart): void {
    try { storage.setItem(individual ? prefix + row.startId : config.guestPendingKey, JSON.stringify(individual ? row : pending)); }
    catch { /* Counting still works in memory when storage is unavailable. */ }
  }
  function forget(startId: string): void {
    try {
      if (individual) storage.removeItem!(prefix + startId);
      else storage.setItem(config.guestPendingKey, JSON.stringify(pending));
    } catch { /* An unremoved ACK is harmless: the server deduplicates its ID. */ }
  }
  let inFlight: Promise<void> | null = null;
  let followUpRequested = false;
  function retry(): Promise<void> {
    if (inFlight) return inFlight;
    for (const row of read()) if (!pending.some(p => p.startId === row.startId)) pending.push(row);
    if (!pending.some(row => !row.permanentFailure)) return Promise.resolve();
    inFlight = (async () => {
      for (;;) {
        const next = pending.find(row => !row.permanentFailure);
        if (!next) return;
        try {
          await api.startGuest(next.startId);
          pending = pending.filter(row => row.startId !== next.startId); forget(next.startId);
        } catch (error) {
          if (!(error instanceof RankingError) || error.retryable) return;
          next.permanentFailure = true; persist(next);
        }
      }
    })().finally(() => {
      inFlight = null;
      if (followUpRequested) { followUpRequested = false; return retry(); }
    });
    return inFlight;
  }
  return {
    record(): void {
      const row = { startId: crypto.randomUUID() }; pending.push(row); persist(row);
      if (inFlight) followUpRequested = true;
      void retry();
    },
    retry,
  };
}
