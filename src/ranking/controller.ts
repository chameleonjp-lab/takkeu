import { RANKING_CONFIG as config } from './config';
import { createRankingClient, RankingError, validLostBalls, validScore, validUuid } from './client';
import type { PendingResult, Play, RankingApi } from './client';
import type { StorageLike } from '../storage/preferences';
import { createGuestPlayCounter } from './guestPlays';

export type SubmissionStatus = 'idle' | 'submitting' | 'submitted' | 'retryable_failed' | 'permanent_failed';
export type RankingState = Readonly<{ status: SubmissionStatus; pendingCount: number }>;
export type SubmissionEvent = Readonly<{ playId: string; submissionId: string; status: Exclude<SubmissionStatus, 'idle'> }>;
export function validateName(value: string): string {
  const name = value.trim();
  if ([...name].length > config.maxNameLength) throw new RankingError(false, '名前は20文字以内で入力してください。');
  return name;
}
function isPending(value: unknown): value is PendingResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<PendingResult>, play = row.play;
  return !!play && validUuid(play.startId) && validUuid(play.playId) && typeof play.displayName === 'string' && play.displayName.length > 0 && [...play.displayName].length <= config.maxNameLength && typeof play.normalizedName === 'string' && validUuid(row.submissionId) && validScore(row.score) && (row.lostBalls === undefined || validLostBalls(row.lostBalls)) && ['game_over', 'retire'].includes(row.resultType ?? '') && row.clientVersion === config.clientVersion;
}
export function createRankingController(storage: StorageLike, api: RankingApi = createRankingClient(), onChange: (state: RankingState) => void = () => {}, onSubmission: (event: SubmissionEvent) => void = () => {}) {
  const guests = createGuestPlayCounter(storage, api);
  const read = (key: string): unknown => { try { return JSON.parse(storage.getItem(key) ?? 'null'); } catch { return null; } };
  const save = (key: string, value: unknown): void => { try { storage.setItem(key, JSON.stringify(value)); } catch { /* Keep the in-memory record and send immediately. */ } };
  const stored = read(config.pendingKey);
  let pending: PendingResult[] = Array.isArray(stored) ? stored.filter(isPending) : [];
  let status: SubmissionStatus = pending.length ? pending.some(row => !row.permanentFailure) ? 'retryable_failed' : 'permanent_failed' : 'idle';
  let inFlight: Promise<void> | null = null;
  let pendingStart: { startId: string; displayName: string } | null = null;
  const savedStart = read(config.startKey);
  if (savedStart && typeof savedStart === 'object' && 'startId' in savedStart && validUuid(savedStart.startId) && 'displayName' in savedStart && typeof savedStart.displayName === 'string') pendingStart = { startId: savedStart.startId, displayName: savedStart.displayName };
  const finished = new Set(pending.map(row => row.play.playId));
  const state = (): RankingState => ({ status, pendingCount: pending.length });
  const notify = () => onChange(state());
  const persist = () => save(config.pendingKey, pending);
  const submission = (row: PendingResult, status: SubmissionEvent['status']) => onSubmission({ playId: row.play.playId, submissionId: row.submissionId, status });
  function retry(): Promise<void> {
    if (inFlight) return inFlight;
    if (!pending.some(row => !row.permanentFailure)) return Promise.resolve();
    status = 'submitting'; notify();
    inFlight = (async () => {
      for (;;) {
        const next = pending.find(row => !row.permanentFailure);
        if (!next) { status = pending.length ? 'permanent_failed' : 'submitted'; notify(); return; }
        submission(next, 'submitting');
        try {
          await api.finish(next); await api.submit(next);
          pending = pending.filter(row => row.submissionId !== next.submissionId); persist();
          submission(next, 'submitted');
        } catch (error) {
          const retryable = !(error instanceof RankingError) || error.retryable;
          if (retryable) {
            // This failure blocks every later result too. Report each affected
            // identifier without implying that any of them was acknowledged.
            for (const waiting of pending) if (!waiting.permanentFailure) submission(waiting, 'retryable_failed');
            status = 'retryable_failed'; notify(); return;
          }
          pending = pending.map(row => row === next ? { ...row, permanentFailure: true } : row); persist();
          submission(next, 'permanent_failed');
          // Keep the rejected record for diagnosis and continue with later plays.
        }
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  }
  return {
    state,
    clearResult(): void { if (pending.length === 0) { status = 'idle'; notify(); } },
    name(): string { const name = read(config.nameKey); try { return typeof name === 'string' ? validateName(name) : ''; } catch { return ''; } },
    // A canceled preparation no longer owns the next same-name start. A late
    // response can then be retired without closing the replacement's play.
    abandonStart():void { pendingStart=null;save(config.startKey,null); },
    async start(value: string): Promise<Play | null> {
      const displayName = validateName(value); save(config.nameKey, displayName);
      if (!displayName) { guests.record(); return null; }
      if (!pendingStart || pendingStart.displayName !== displayName) pendingStart = { startId: crypto.randomUUID(), displayName };
      save(config.startKey, pendingStart);
      const request = pendingStart;
      const play = await api.start(request.startId, displayName);
      if (pendingStart === request) { pendingStart = null; save(config.startKey, null); }
      return play;
    },
    finish(play: Play | null, score: number, resultType: PendingResult['resultType'], lostBalls?: number): void {
      if (!play || finished.has(play.playId)) return;
      if (!validScore(score) || (lostBalls !== undefined && !validLostBalls(lostBalls))) { status = 'permanent_failed'; notify(); return; }
      finished.add(play.playId);
      pending.push({ play, submissionId: crypto.randomUUID(), score, resultType, clientVersion: config.clientVersion,
        ...(lostBalls === undefined ? {} : { lostBalls }) });
      submission(pending.at(-1)!, 'submitting');
      persist(); void retry();
    },
    async retry(): Promise<void> { await Promise.all([retry(), guests.retry()]); },
  };
}
