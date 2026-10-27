import type { HallEntry, Play } from './client';
import type { SubmissionEvent } from './controller';

export type ResultHallState = Readonly<{ status: 'hidden' | 'anonymous' | 'pending' | 'retryable_failed' | 'failed' | 'ineligible'; displayName?: string }>
  | Readonly<{ status: 'registered'; hall: HallEntry }>;

/** Receipts belong to one result, even when an older queue request finishes late. */
export function createResultHall(onChange: (state: ResultHallState) => void = () => {}) {
  let target: Play | null = null, submissionId: string | null = null;
  let state: ResultHallState = { status: 'hidden' };
  const publish = (next: ResultHallState) => { state = next; onChange(next); };
  return {
    state: () => state,
    show(play: Play | null) {
      target = play; submissionId = null;
      publish(play ? { status: 'pending', displayName: play.displayName } : { status: 'anonymous' });
    },
    clear() { target = null; submissionId = null; publish({ status: 'hidden' }); },
    submission(event: SubmissionEvent) {
      if (!target || event.playId !== target.playId || (submissionId !== null && submissionId !== event.submissionId)) return;
      submissionId = event.submissionId;
      if (event.hallStatus === 'registered' && event.hall && event.hall.normalizedName === target.normalizedName) {
        publish({ status: 'registered', hall: event.hall });
      } else if (event.hallStatus === 'ineligible') publish({ status: 'ineligible', displayName: target.displayName });
      else if (event.hallStatus === 'failed' || event.status === 'permanent_failed') publish({ status: 'failed', displayName: target.displayName });
      else if (event.hallStatus === 'retryable_failed' || event.status === 'retryable_failed') publish({ status: 'retryable_failed', displayName: target.displayName });
      else if (state.status !== 'registered') publish({ status: 'pending', displayName: target.displayName });
    },
  };
}
