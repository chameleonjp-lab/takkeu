import { RANKING_CONFIG as config } from './config';

export type Play = Readonly<{ startId: string; playId: string; displayName: string; normalizedName: string }>;
export type PendingResult = Readonly<{ play: Play; submissionId: string; score: number; resultType: 'game_over' | 'retire'; clientVersion: string; permanentFailure?: boolean }>;
export type RankingEntry = Readonly<{ rank: number; displayName: string; score: number; playCount: number }>;
export type RankingApi = ReturnType<typeof createRankingClient>;
export class RankingError extends Error {
  constructor(readonly retryable: boolean, message: string) { super(message); }
}
export const validUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const validScore = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= config.minScore && value <= config.maxScore;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const validName = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && [...value].length >= 1 && [...value].length <= config.maxNameLength;
function requireResponse(valid: boolean): asserts valid { if (!valid) throw new RankingError(false, 'ランキングの応答を確認できませんでした。'); }

export function createRankingClient(fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args)) {
  async function rpc(name: string, payload: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl.call(globalThis, `${config.supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const code = record(data).code;
        const retryable = [408, 425, 429].includes(response.status) || response.status >= 500 || code === '42900' || code === 'PT425';
        throw new RankingError(retryable, `ランキング通信に失敗しました（${response.status}）。`);
      }
      if (record(data).accepted === false) {
        throw new RankingError(record(data).reason === 'play_rate_limited', 'ランキングへの記録を受け付けられませんでした。');
      }
      return data;
    } catch (error) {
      if (error instanceof RankingError) throw error;
      throw new RankingError(true, 'ランキングに接続できません。通信を確認して再送してください。');
    } finally { globalThis.clearTimeout(timeout); }
  }
  const identity = (play: Play) => ({ p_display_name: play.displayName, p_game_slug: config.gameSlug, p_client_version: config.clientVersion });
  return {
    async startGuest(startId: string): Promise<void> {
      requireResponse(validUuid(startId));
      const data = record(await rpc(config.guestStartRpc, { p_start_id: startId, p_game_slug: config.gameSlug, p_client_version: config.clientVersion }));
      requireResponse(data.accepted === true && data.start_id === startId && validUuid(data.play_id)
        && data.game_slug === config.gameSlug && data.client_version === config.clientVersion);
    },
    async start(startId: string, displayName: string): Promise<Play> {
      requireResponse(validUuid(startId) && validName(displayName));
      const data = record(await rpc(config.startRpc, { p_start_id: startId, p_display_name: displayName, p_game_slug: config.gameSlug, p_client_version: config.clientVersion }));
      requireResponse(data.accepted === true && data.start_id === startId && validUuid(data.play_id) && data.display_name === displayName && typeof data.normalized_name === 'string' && data.normalized_name.length > 0 && data.game_slug === config.gameSlug && data.client_version === config.clientVersion);
      return { startId, playId: data.play_id, displayName, normalizedName: data.normalized_name };
    },
    async finish(pending: PendingResult): Promise<void> {
      requireResponse(validScore(pending.score) && validUuid(pending.play.playId) && pending.clientVersion === config.clientVersion);
      const data = record(await rpc(config.finishRpc, { ...identity(pending.play), p_play_id: pending.play.playId, p_result_type: pending.resultType, p_reached_wave: 1, p_score: pending.score, p_ranking_score: pending.score }));
      requireResponse(data.accepted === true && data.play_id === pending.play.playId && data.game_slug === config.gameSlug && data.result_type === pending.resultType && data.reached_wave === 1 && data.score === pending.score);
    },
    async submit(pending: PendingResult): Promise<void> {
      requireResponse(validScore(pending.score) && validUuid(pending.submissionId) && validUuid(pending.play.playId) && pending.clientVersion === config.clientVersion);
      const rows = await rpc(config.scoreRpc, { ...identity(pending.play), p_play_id: pending.play.playId, p_submission_id: pending.submissionId, p_score: pending.score });
      requireResponse(Array.isArray(rows) && rows.length === 1);
      const data = record(rows[0]);
      // Duplicate acknowledgements return the aggregate's current display name.
      // Another play can change its spelling; the normalized identity stays fixed.
      const nameMatches = data.result_display_name === pending.play.displayName || (data.was_duplicate === true && validName(data.result_display_name));
      requireResponse(data.accepted === true && data.result_submission_id === pending.submissionId && data.result_play_id === pending.play.playId && nameMatches && data.result_normalized_name === pending.play.normalizedName && validScore(data.result_first_score) && validScore(data.result_best_score) && data.result_best_score >= pending.score && Number.isSafeInteger(data.result_play_count) && Number(data.result_play_count) >= 1);
    },
    async top(): Promise<RankingEntry[]> {
      const rows = await rpc(config.topRpc, { p_game_slug: config.gameSlug, p_limit: 30 });
      requireResponse(Array.isArray(rows) && rows.length <= 30);
      return rows.map(value => {
        const row = record(value);
        requireResponse(Number.isSafeInteger(row.rank_no) && Number(row.rank_no) >= 1 && validName(row.display_name) && validScore(row.best_score) && Number.isSafeInteger(row.play_count) && Number(row.play_count) >= 1);
        return { rank: Number(row.rank_no), displayName: row.display_name, score: row.best_score, playCount: Number(row.play_count) };
      });
    },
  };
}
