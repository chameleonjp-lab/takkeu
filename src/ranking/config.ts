import manifest from '../../ranking-manifest.json';

const entry = manifest.ranking_entries[0]!;
export const RANKING_CONFIG = Object.freeze({
  gameSlug: entry.game_slug,
  canonicalUrl: manifest.canonical_url,
  clientVersion: manifest.client_version,
  releaseId: 'takkeu-20261023-01',
  nameKey: manifest.player_name.storage_key,
  startKey: 'takkeu.ranking.start.v1',
  pendingKey: 'takkeu.ranking.pending.v1',
  guestPendingKey: 'takkeu.guest-starts.v1',
  startRpc: manifest.play_count.rpc,
  guestStartRpc: manifest.play_count.guest_rpc,
  finishRpc: 'finish_game_play_v1',
  scoreRpc: manifest.submission.rpc,
  topRpc: 'get_best_score_ranking',
  timeoutMs: manifest.submission.timeout_ms,
  minScore: entry.score_min,
  maxScore: entry.score_max,
  maxNameLength: manifest.player_name.max_length,
  labUrl: 'https://chameleonjp-lab.github.io/chameleonjp_lab/',
  supabaseUrl: 'https://mlpnjgezrnhdxsxolyzj.supabase.co',
  publishableKey: "sb_publishable_drzcy0v97knU6FgjqSgBHw_0A9XPdFM",
});

export function scoreShareUrl(score: number): string {
  const params = new URLSearchParams({ text: `タッケウで${score}ラリー！\nもう1ラリー、つないでみよう。 #タッケウ`, url: RANKING_CONFIG.canonicalUrl });
  return `https://twitter.com/intent/tweet?${params}`;
}
