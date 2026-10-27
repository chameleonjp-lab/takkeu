import { expect, it } from 'vitest';
import { createResultHall } from '../../src/ranking/resultHall';
import type { Play } from '../../src/ranking/client';

const play: Play = { startId: 'start', playId: 'first', displayName: '名前', normalizedName: '名前', rulesVersion: 'goal-3500-v1' };
const hall = { number: 3, displayName: '名前', normalizedName: '名前', registeredAt: '2026-10-27T03:00:00Z' };
it('keeps a delayed hall receipt attached to its play and submission', () => {
  const result = createResultHall(); result.show(play);
  result.submission({ playId: 'first', submissionId: 'one', status: 'submitted', hallStatus: 'pending' });
  result.submission({ playId: 'first', submissionId: 'wrong', status: 'submitted', hallStatus: 'registered', hall });
  expect(result.state().status).toBe('pending');
  result.submission({ playId: 'first', submissionId: 'one', status: 'submitted', hallStatus: 'registered', hall });
  expect(result.state()).toEqual({ status: 'registered', hall });
  result.show({ ...play, playId: 'second' });
  result.submission({ playId: 'first', submissionId: 'one', status: 'submitted', hallStatus: 'registered', hall });
  expect(result.state().status).toBe('pending');
  result.clear();
  result.submission({ playId: 'second', submissionId: 'two', status: 'submitted', hallStatus: 'registered', hall });
  expect(result.state().status).toBe('hidden');
});
it('allows an anonymous clear without assigning an official number', () => {
  const result = createResultHall(); result.show(null);
  expect(result.state()).toEqual({ status: 'anonymous' });
});
