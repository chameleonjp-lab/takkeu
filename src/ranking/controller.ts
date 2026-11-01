import {createDeferredStarts} from './deferredStart';
import type {NamedRun} from './deferredStart';
import {createResultStore} from './pendingStore';
import { RANKING_CONFIG as config } from './config';
import { createRankingClient, RankingError, validLostBalls, validScore, validUuid, validPendingContract, clientVersionForPlay } from './client';
import type { HallEntry, PendingResult, Play, RankingApi } from './client';
import type { StorageLike } from '../storage/preferences';
import { createGuestPlayCounter } from './guestPlays';

export type SubmissionStatus = 'idle' | 'submitting' | 'submitted' | 'retryable_failed' | 'permanent_failed';
export type RankingState = Readonly<{ status: SubmissionStatus; pendingCount: number; hallPendingCount?: number; storageFailed?: boolean }>;
export type SubmissionEvent = Readonly<{ playId: string; submissionId: string; status: Exclude<SubmissionStatus, 'idle'>;
  hallStatus?: 'pending' | 'registered' | 'retryable_failed' | 'failed' | 'ineligible'; hall?: HallEntry }>;
export function validateName(value: string): string {
  const name = value.trim();
  if ([...name].length > config.maxNameLength) throw new RankingError(false, '名前は20文字以内で入力してください。');
  return name;
}
function isPending(value: unknown): value is PendingResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<PendingResult>, play = row.play;
  return !!play && validUuid(play.startId) && validUuid(play.playId) && typeof play.displayName === 'string' && play.displayName.length > 0 && [...play.displayName].length <= config.maxNameLength && typeof play.normalizedName === 'string' && validUuid(row.submissionId) && validScore(row.score) && (row.lostBalls === undefined || validLostBalls(row.lostBalls)) && (row.scoreAcknowledged === undefined || typeof row.scoreAcknowledged === 'boolean') && validPendingContract(row as PendingResult);
}
export function createRankingController(storage: StorageLike, api: RankingApi = createRankingClient(), onChange: (state: RankingState) => void = () => {}, onSubmission: (event: SubmissionEvent) => void = () => {}) {
  const guests = createGuestPlayCounter(storage, api);
  const read = (key: string): unknown => { try { return JSON.parse(storage.getItem(key) ?? 'null'); } catch { return null; } };
  const save = (key: string, value: unknown): void => { try { storage.setItem(key, JSON.stringify(value)); } catch { /* Keep the in-memory record and send immediately. */ } };
  const resultStore=createResultStore(storage,isPending);
  let pending=resultStore.list();
  let storageFailed=false;
  let status: SubmissionStatus = pending.length ? pending.some(row => !row.permanentFailure) ? 'retryable_failed' : 'permanent_failed' : 'idle';
  let inFlight: Promise<void> | null = null;
  let pendingStart: { startId: string; displayName: string } | null = null;
  const savedStart = read(config.startKey);
  if (savedStart && typeof savedStart === 'object' && 'startId' in savedStart && validUuid(savedStart.startId) && 'displayName' in savedStart && typeof savedStart.displayName === 'string') pendingStart = { startId: savedStart.startId, displayName: savedStart.displayName };
  const finished = new Set(pending.map(row => row.play.playId));
  let deferred:ReturnType<typeof createDeferredStarts>|undefined;
  const state = (): RankingState => {
    const count = pending.filter(row => row.scoreAcknowledged && row.resultType === 'clear').length;
    const waiting=deferred?.state();
    return { status: waiting?.count ? waiting.permanent?'permanent_failed':'retryable_failed' : !pending.length&&resultStore.conflicted()?'permanent_failed':status, pendingCount: new Set([...pending.map(row=>row.submissionId),...resultStore.conflictIds()]).size+(waiting?.count??0), ...(count ? { hallPendingCount: count } : {}),...((storageFailed||waiting?.storageFailed)?{storageFailed:true}:{}) };
  };
  const notify = () => onChange(state());
  const persist = (rows=pending) => {
    storageFailed=false;
    for(const row of rows)if(!resultStore.save(row))storageFailed=true;
    return !storageFailed;
  };
  const submission = (row: PendingResult, status: SubmissionEvent['status'], hall: Pick<SubmissionEvent, 'hallStatus' | 'hall'> = {}) => onSubmission({ playId: row.play.playId, submissionId: row.submissionId, status, ...hall });
  function retry(): Promise<void> {
    if (inFlight) return inFlight;
    pending=resultStore.list();
    if (!pending.some(row => !row.permanentFailure)) return Promise.resolve();
    status = 'submitting'; notify();
    inFlight = (async () => {
      for (;;) {
        let next = pending.find(row => !row.permanentFailure);
        if (!next) { status = pending.length ? 'permanent_failed' : 'submitted'; notify(); return; }
        const selectedId = next.submissionId;
        const needsHall = next.resultType === 'clear' && !!next.play.rulesVersion;
        submission(next, next.scoreAcknowledged ? 'submitted' : 'submitting', needsHall ? { hallStatus: 'pending' } : {});
        try {
          if(!persist([next]))throw new RankingError(true,'記録を端末に保存できません。','storage_unavailable');
          if (!next.scoreAcknowledged) {
            await api.finish(next); await api.submit(next);
            {
              next = { ...next, scoreAcknowledged: true };
              const acknowledged = next;
              pending = pending.map(row => row.submissionId === selectedId ? acknowledged : row); persist([next]);
              if(needsHall)submission(next, 'submitted', { hallStatus: 'pending' });
            }
          }
          let hall: HallEntry | null = null;
          if (needsHall) {
            if (!api.hall) throw new RankingError(true, '殿堂登録に接続できません。');
            hall = await api.hall(next);
          }
          resultStore.acknowledge(selectedId);pending = pending.filter(row => row.submissionId !== selectedId);
          submission(next, 'submitted', needsHall ? hall ? { hallStatus: 'registered', hall } : { hallStatus: 'ineligible' } : {});
        } catch (error) {
          if(error instanceof RankingError&&error.reason==='storage_unavailable')storageFailed=true;
          const retryable = !(error instanceof RankingError) || error.retryable;
          if (retryable) {
            // This failure blocks every later result too. Report each affected
            // identifier without implying that any of them was acknowledged.
            for (const waiting of pending) if (!waiting.permanentFailure) submission(waiting, waiting.scoreAcknowledged ? 'submitted' : 'retryable_failed', waiting.scoreAcknowledged ? { hallStatus: 'retryable_failed' } : {});
            status = 'retryable_failed'; notify(); return;
          }
          pending = pending.map(row => row.submissionId === selectedId ? { ...row, permanentFailure: true } : row); try{persist(pending.filter(row=>row.submissionId===selectedId))}catch{/* Keep conflicting original bytes. */}
          submission(next, next.scoreAcknowledged ? 'submitted' : 'permanent_failed', next.scoreAcknowledged ? { hallStatus: 'failed' } : {});
          // Keep the rejected record for diagnosis and continue with later plays.
        }
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  }
  const enqueue=(row:PendingResult):boolean=>{
    if(!isPending(row))return false;
    const existing=pending.find(x=>x.play.playId===row.play.playId);
    if(existing&&existing.submissionId!==row.submissionId)return false;
    if(!existing){finished.add(row.play.playId);pending.push(row);submission(row,'submitting')}
    try{storageFailed=!resultStore.save(row)}catch{status='permanent_failed';notify();return false}
    if(storageFailed){status='retryable_failed';notify();return false}
    void retry();return true;
  };
  deferred=createDeferredStarts(storage,api,enqueue,notify);
  return {
    state,
    begin(value:string):NamedRun|null {const name=validateName(value);save(config.nameKey,name);if(!name){guests.record();return null}return deferred!.begin(name)},
    finishRun(run:NamedRun|null,score:number,resultType:PendingResult['resultType'],lostBalls:number):void {deferred!.finish(run,score,resultType,lostBalls)},
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
      const row: PendingResult = { play, submissionId: crypto.randomUUID(), score, resultType, clientVersion: clientVersionForPlay(play),
        ...(lostBalls === undefined ? {} : { lostBalls }) };
      if (!validPendingContract(row)) { status = 'permanent_failed'; notify(); return; }
      finished.add(play.playId); pending.push(row);
      submission(pending.at(-1)!, 'submitting');
      try{persist([row])}catch{status='permanent_failed';notify();return} void retry();
    },
    async retry(): Promise<void> { await deferred!.retry();await Promise.all([retry(), guests.retry()]); },
  };
}
