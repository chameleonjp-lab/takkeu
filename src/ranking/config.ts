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
  finishWithLossRpc: 'finish_takkeu_play_v2',
  scoreRpc: manifest.submission.rpc,
  topRpc: 'get_best_score_ranking',
  positionRpc: manifest.player_position.rpc,
  progressRpc: 'report_takkeu_progress_v1',
  timeoutMs: manifest.submission.timeout_ms,
  minScore: entry.score_min,
  maxScore: entry.score_max,
  maxNameLength: manifest.player_name.max_length,
  rankingUrl: `https://chameleonjp-lab.github.io/chameleonjp_lab/ranking.html?game=${encodeURIComponent(entry.game_slug)}`,
  supabaseUrl: 'https://mlpnjgezrnhdxsxolyzj.supabase.co',
  publishableKey: "sb_publishable_drzcy0v97knU6FgjqSgBHw_0A9XPdFM",
});

function validShareScore(score: number): boolean {
  return Number.isFinite(score) && Number.isInteger(score) && score >= 0;
}

function shareUrl(text: string, url?: string): string {
  const params = new URLSearchParams({ text });
  if (url) params.set('url', url);
  return `https://twitter.com/intent/tweet?${params}`;
}

export function scoreShareUrl(score: number): string | null {
  return validShareScore(score) ? shareUrl(`タッケウで${score}ラリー達成！\nあなたは何ラリーできるかな？\n#タッケウ\n${RANKING_CONFIG.canonicalUrl}`) : null;
}

export function homeShareUrl(bestScore: number): string {
  return shareUrl(validShareScore(bestScore) && bestScore >= 1
    ? `卓球ゲーム「タッケウ」で自己ベスト${bestScore}ラリー！\n何ラリーつなげられる？ #タッケウ`
    : 'タップ＆ドラッグで遊べる卓球ゲーム「タッケウ」！\n何ラリーつなげられる？ #タッケウ', RANKING_CONFIG.canonicalUrl);
}
