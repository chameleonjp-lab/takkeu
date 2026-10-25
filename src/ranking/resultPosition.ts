import type { PlayerPosition, Play, RankingApi } from './client';
import type { SubmissionEvent } from './controller';

export type ResultPositionState = Readonly<{ status: 'hidden' | 'loading' | 'error' | 'excluded' }>
  | (PlayerPosition & Readonly<{ status: 'loaded' }>);

/** A result belongs to a play AND its acknowledged submission, never the queue. */
export function createResultPosition(api: Pick<RankingApi, 'position'>, onChange: (state: ResultPositionState) => void = () => {}) {
  let state: ResultPositionState = { status: 'hidden' };
  let target: Play | null = null, submissionId: string | null = null, accepted = false, epoch = 0, disposed = false;
  const publish = (value: ResultPositionState) => { state = value; onChange(value); };
  async function refresh(): Promise<void> {
    if (disposed || !target || !accepted) return;
    const request = ++epoch, name = target.normalizedName;
    publish({ status: 'loading' });
    try {
      const position = await api.position(name);
      if (!disposed && request === epoch) publish(position ? { status: 'loaded', ...position } : { status: 'excluded' });
    } catch { if (!disposed && request === epoch) publish({ status: 'error' }); }
  }
  function clear(): void {
    epoch++; target = null; submissionId = null; accepted = false; publish({ status: 'hidden' });
  }
  return {
    state: () => state,
    show(play: Play | null): void {
      if (disposed) return;
      clear(); target = play;
      if (play) publish({ status: 'loading' });
    },
    clear,
    async submission(event: SubmissionEvent): Promise<void> {
      if (disposed || !target || event.playId !== target.playId) return;
      if (submissionId !== null && event.submissionId !== submissionId) return;
      submissionId = event.submissionId;
      if (event.status === 'submitted') { accepted = true; await refresh(); }
      else if (!accepted) publish({ status: event.status === 'submitting' ? 'loading' : 'error' });
    },
    // The caller retries the submission queue first if acknowledgement is absent.
    retry: refresh,
    dispose(): void { disposed = true; clear(); },
  };
}
