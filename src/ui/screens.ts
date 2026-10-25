import courtPreviewUrl from './court-preview.png';
import { MAX_LOST_BALLS } from '../game/config';
import type { GameSnapshot, PauseReason } from '../game/types';
import { DEFAULT_PREFERENCES } from '../storage/preferences';
import type { Preferences, Quality } from '../storage/preferences';
import { RANKING_CONFIG, homeShareUrl, scoreShareUrl } from '../ranking/config';
import type { RankingEntry } from '../ranking/client';
import type { RankingState } from '../ranking/controller';

type Actions = { start(): void; pause(): void; resume(): void; retry(): void; home(): void; toggleSound(): void; retryAudio?(): void; volume(value: number): void; quality?(value: Quality): void; retryRanking?(): void; refreshRanking?(): void };
const pauseMessages: Record<PauseReason, string> = {
  user: '深呼吸したら、またつづきから。', hidden: '画面を離れたので停止しました。', resize: '画面の向き・大きさが変わったので停止しました。',
  'slow-frame': '動作が一時的に遅くなりました。準備ができたら再開してください。',
  'context-lost': '描画が中断しました。復旧後に再開するか、ホームへ戻れます。', 'input-lost': '操作が中断したので停止しました。',
};

export function createScreens(root: HTMLElement, actions: Actions) {
  const soundControls = `<fieldset class="sound-panel"><legend>音声</legend><button type="button" class="button subtle" data-action="sound">音：オン</button><button type="button" class="button subtle" data-action="retry-audio">音声を再試行</button><label>効果音の音量<input type="range" min="0" max="1" step="0.05" value="0.65" aria-label="効果音の音量" data-volume></label></fieldset>`;
  root.innerHTML = `
    <main class="shell">
      <section class="home-screen" data-home>
        <header class="brand"><span class="brand-mark" aria-hidden="true">t.</span><span>TAKKEU</span><span class="brand-note">卓球の、その先へ。</span></header>
        <div class="home-hero">
          <div class="hero-copy">
            <p class="eyebrow"><span class="status-dot"></span> ONE BALL. ENDLESS RALLY.</p>
            <h1>タッケウ<span class="title-dot" aria-hidden="true">.</span></h1>
            <p class="hero-lead">ワンバウンドをとらえて、<br>ラリーをつなぐ。</p>
            <p class="hero-description">タップした位置にラケットを置き、ドラッグで球に合わせる。<br>自分の台で一度弾んだ球に触れれば、打ち返せます。<br>残球が0になるか、累計${MAX_LOST_BALLS}球落とすとゲーム終了です。</p>
            <div class="player-field"><label for="player-name">ランキングの名前 <span>任意</span></label><input id="player-name" data-player-name type="text" maxlength="40" autocomplete="nickname" placeholder="名前なしでも遊べます" aria-describedby="name-note"><p id="name-note" data-name-note>20文字以内。入力すると名前と記録が公開され、カメレオンの実験場のランキングに参加します。同じ名前の記録は合算されます。名前なしのプレイも回数だけ記録します。</p></div>
            <button type="button" class="button primary start-button" data-action="start">はじめる <span aria-hidden="true">↗</span></button>
            <p class="start-note">2本指で短くタップ、またはEscキーで一時停止</p>
          </div>
          <div class="home-art" aria-hidden="true"><img src="${courtPreviewUrl}" width="600" height="415" alt="" decoding="async"></div>
        </div>
        <div class="how-to" aria-label="遊び方">
          <div><span class="step-number">01</span><p><strong>タップで置く</strong><span>指やポインターの位置へ直接移動。</span></p></div>
          <div><span class="step-number">02</span><p><strong>ドラッグで動かす</strong><span>押している間は、その位置について動きます。</span></p></div>
          <div><span class="step-number">03</span><p><strong>離すと止まる</strong><span>最後の位置を保ち、自分の返球で +1。</span></p></div>
        </div>
        <footer class="home-footer"><p>自己ベスト <output aria-label="自己ベスト" data-best>0</output> ラリー</p><a data-share-home-x href="${homeShareUrl(0)}" target="_blank" rel="noopener noreferrer">Xでシェア</a><a href="${RANKING_CONFIG.rankingUrl}">ランキング</a><button type="button" class="button subtle" data-action="settings">設定</button></footer>
        <div data-home-notices></div>
      </section>

      <section class="settings-screen" data-settings hidden inert aria-labelledby="settings-title"><p class="eyebrow">PREFERENCES</p><h2 id="settings-title" tabindex="-1">設定</h2><p>音と描画品質を調整できます。ラケットは指やポインターの位置に直接合わせるため、操作感度の調整は不要です。</p><div data-settings-notices></div><div class="settings-fields">${soundControls}<label>描画品質<select aria-label="描画品質"><option value="standard">標準</option><option value="low">低負荷</option></select></label></div><button type="button" class="button primary" data-action="settings-back">戻る</button></section>

      <section class="game-screen" data-testid="game-screen" data-game hidden inert>
        <div class="input-surface" data-testid="input-surface"><div class="canvas-wrap"><canvas tabindex="0" aria-label="卓球ゲームの描画領域" aria-keyshortcuts="Escape"></canvas></div></div>
        <div class="hud"><div><span class="eyebrow">RALLY</span><output aria-label="ラリー数" aria-live="off" class="rally-number" data-score>0</output></div><div class="balls-counter"><span class="eyebrow">残球数</span><output aria-label="残球数" aria-live="off" data-balls>1</output></div><div class="losses-counter"><span class="eyebrow">落球数</span><output aria-label="落球数" aria-live="off" data-losses>0 / ${MAX_LOST_BALLS}</output></div><p class="smash-warning" data-smash-warning role="status" hidden>スマッシュがくる！</p></div>
        <div class="game-notices" data-game-notices></div><p class="finish-label" data-finishing tabindex="-1" hidden>ゲーム終了</p>
        <div class="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" aria-describedby="pause-description" tabindex="-1" hidden inert><div class="pause-card"><p class="eyebrow">PAUSE</p><h2 id="pause-title">ひと休み</h2><p id="pause-description" data-pause-message></p><div data-pause-notices></div><button type="button" class="button primary" data-action="resume">つづける <span aria-hidden="true">→</span></button><button type="button" class="button subtle" data-action="retry">最初からやり直す</button><button type="button" class="text-button" data-action="home">ホームへ</button>${soundControls}</div></div>
      </section>

      <section class="result-screen" data-result hidden inert><span class="brand-mark" aria-hidden="true">t.</span><p class="eyebrow">RALLY COMPLETE</p><h2>ナイスラリー！</h2><p class="result-label">今回のラリー数</p><output class="result-score" aria-label="今回のラリー数" data-result-score>0</output><button type="button" class="button primary" data-action="retry">もう一度 <span aria-hidden="true">↗</span></button><p>自己ベスト <output aria-label="自己ベスト" data-best>0</output> ラリー</p><p class="result-message" data-loss-limit-message hidden>累計${MAX_LOST_BALLS}球の落球で終了しました。</p><p class="result-message" data-ranking-participation>もう1ラリー、つないでみよう。</p><a class="button share-button" data-share-x aria-disabled="true" tabindex="-1" target="_blank" rel="noopener noreferrer">Xでスコアをシェア <span aria-hidden="true">↗</span></a><button type="button" class="button subtle" data-action="home">ホームへ</button><div data-result-notices></div><section class="ranking-panel" aria-labelledby="ranking-title"><p class="eyebrow">LEADERBOARD</p><h3 id="ranking-title">ランキング TOP 30</h3><p class="ranking-caption">最高ラリー数で競う、みんなの記録</p><p data-ranking-message role="status">ランキングを読み込んでいます。</p><div class="ranking-table-wrap"><table data-ranking-table hidden><caption class="sr-only">最高ラリー数の上位30名</caption><thead><tr><th scope="col">順位</th><th scope="col">名前</th><th scope="col">ラリー</th><th scope="col">回数</th></tr></thead><tbody data-ranking-body></tbody></table></div><button type="button" class="button subtle" data-action="ranking-refresh">ランキングを更新</button><a class="lab-link" href="${RANKING_CONFIG.rankingUrl}">実験場で詳しいランキングを見る ↗</a></section></section>
      <div class="screen-notices" data-notices>
        <div class="ranking-notice" data-ranking-notice hidden><p data-ranking-status role="status"></p><button type="button" class="button subtle" data-action="ranking-retry" hidden>記録を再送する</button></div>
        <p class="notice" data-audio-notice role="status" hidden>音声を利用できません。無音でも遊べます。設定または一時停止メニューの「音声を再試行」で再試行できます。</p>
        <p class="error-banner" data-error role="alert" hidden></p>
        <p class="notice" data-storage-notice role="status" hidden>この端末に保存できません。開いている間は設定と自己ベストを保持します。</p>
        <p class="sr-only" role="status" aria-live="polite" data-status></p>
      </div>
    </main>`;
  const get = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const home = get('[data-home]'), game = get('[data-game]'), result = get('[data-result]');
  const settings = get('[data-settings]');
  const overlay = get('[role="dialog"]');
  const canvas = get<HTMLCanvasElement>('canvas');
  const surface = get<HTMLElement>('[data-testid="input-surface"]');
  const hud = get('.hud'), notices = get('[data-notices]');
  const doc = root.ownerDocument;
  let phase: GameSnapshot['phase'] = 'ready';
  let finishing = false, lastFinishing = false;
  let lastPhase = '';
  let lastRemaining = -1;
  let settingsOpen = false;
  const resultShare = get<HTMLAnchorElement>('[data-share-x]');
  let shareScore: number | null = null;
  const setInert = (node: HTMLElement, value: boolean): void => {
    node.inert = value; node.toggleAttribute('inert', value);
  };
  const show = (node: HTMLElement, visible: boolean): void => { node.hidden = !visible; setInert(node, !visible); };
  const updateVisibility = (): void => {
    show(home, phase === 'ready' && !settingsOpen); show(settings, phase === 'ready' && settingsOpen);
    show(game, phase === 'running' || phase === 'paused' || finishing); show(result, phase === 'gameover' && !finishing); show(overlay, phase === 'paused');
    get('[data-finishing]').hidden = !finishing;
    setInert(surface, phase !== 'running'); setInert(hud, phase === 'paused');
    const host = get(phase === 'paused' ? '[data-pause-notices]' : phase === 'running' || finishing ? '[data-game-notices]' : phase === 'gameover' ? '[data-result-notices]' : settingsOpen ? '[data-settings-notices]' : '[data-home-notices]');
    if (notices.parentElement !== host) host.append(notices);
  };
  const showSettings = (open: boolean): void => {
    if (phase !== 'ready') return;
    settingsOpen = open; updateVisibility();
    (open ? get('#settings-title') : home.querySelector<HTMLElement>('[data-action="settings"]'))?.focus({ preventScroll: true });
  };
  const click = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
    if (!target || target.closest('[hidden], [inert]') || target.matches(':disabled')) return;
    event.preventDefault();
    const action = target.dataset.action;
    if (action === 'start') actions.start();
    if (action === 'resume') actions.resume();
    if (action === 'retry') actions.retry();
    if (action === 'home') actions.home();
    if (action === 'sound') actions.toggleSound();
    if (action === 'retry-audio') actions.retryAudio?.();
    if (action === 'settings') showSettings(true);
    if (action === 'settings-back') showSettings(false);
    if (action === 'ranking-retry') actions.retryRanking?.();
    if (action === 'ranking-refresh') actions.refreshRanking?.();
  };
  const quality = get<HTMLSelectElement>('[aria-label="描画品質"]');
  const input = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches('[data-volume]') && !target.closest('[hidden], [inert]')) actions.volume(Number(target.value));
  };
  const change = (event: Event): void => {
    if (event.target === quality && !quality.closest('[hidden], [inert]')) actions.quality?.(quality.value as Quality);
  };
  const focusable = (): HTMLElement[] => Array.from(overlay.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]'))
    .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && !node.closest('[hidden], [inert]'));
  const focusPause = (): void => { (focusable()[0] ?? overlay).focus(); };
  const keydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && phase === 'running' && !event.repeat) { event.preventDefault(); actions.pause(); return; }
    if (event.key !== 'Tab' || overlay.hidden) return;
    const controls = focusable(), first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); overlay.focus(); }
    else if (event.shiftKey && (doc.activeElement === first || !controls.includes(doc.activeElement as HTMLElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (doc.activeElement === last || !controls.includes(doc.activeElement as HTMLElement))) { event.preventDefault(); first.focus(); }
  };
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  root.addEventListener('input', input);
  root.addEventListener('change', change);
  const setText = (selector: string, value: string): void => { const node = get(selector); if (node.textContent !== value) node.textContent = value; };
  return {
    canvas, surface, canvasWrap: get<HTMLElement>('.canvas-wrap'),
    playerName() { return get<HTMLInputElement>('[data-player-name]').value; },
    setPlayerName(value: string) { get<HTMLInputElement>('[data-player-name]').value = value; },
    setStarting(starting: boolean) {
      for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action="start"], [data-action="retry"]')) { button.disabled = starting; button.setAttribute('aria-busy', String(starting)); }
      get<HTMLInputElement>('[data-player-name]').disabled = starting;
    },
    setRankingParticipation(named: boolean) { setText('[data-ranking-participation]', named ? 'このプレイはランキングに参加しています。' : '名前なしのプレイです。プレイ回数のみ記録し、ラリー記録は送信しません。'); },
    setRankingState(state: RankingState) {
      const messages = { idle: '', submitting: 'ランキングに記録しています。', submitted: 'ランキングに記録しました。', retryable_failed: '記録を送信できませんでした。通信を確認して再送できます。', permanent_failed: '記録を登録できませんでした。ゲームとシェアは引き続き利用できます。' };
      get('[data-ranking-notice]').hidden = state.status === 'idle';
      setText('[data-ranking-status]', messages[state.status]);
      get('[data-action="ranking-retry"]').hidden = state.status !== 'retryable_failed';
    },
    setLeaderboard(state: 'loading' | 'loaded' | 'error', rows: readonly RankingEntry[] = []) {
      const body = get('[data-ranking-body]'); body.replaceChildren();
      for (const row of rows.slice(0, 30)) {
        const tr = doc.createElement('tr');
        for (const value of [row.rank, row.displayName, row.score, row.playCount]) { const cell = doc.createElement('td'); cell.textContent = String(value); tr.append(cell); }
        body.append(tr);
      }
      get('[data-ranking-table]').hidden = state !== 'loaded' || rows.length === 0;
      setText('[data-ranking-message]', state === 'loading' ? 'ランキングを読み込んでいます。' : state === 'error' ? 'ランキングを取得できませんでした。時間をおいて更新してください。' : rows.length ? 'プレイ回数はゲーム開始時に数えます。' : 'まだ記録がありません。最初のラリーをつなごう。');
      get<HTMLButtonElement>('[data-action="ranking-refresh"]').disabled = state === 'loading';
    },
    render(snapshot: GameSnapshot, showingFinalEffects = false) {
      if (snapshot.phase !== 'ready') settingsOpen = false;
      phase = snapshot.phase; finishing = phase === 'gameover' && showingFinalEffects; updateVisibility();
      const warning = snapshot.scheduledReturns.some(plan => plan.smash && plan.warningAt !== null && plan.warningAt <= snapshot.simTime + 1e-10 && snapshot.simTime < plan.departAt);
      get('[data-smash-warning]').hidden = !warning;
      const remaining = snapshot.balls.filter(ball => ball.phase !== 'lost').length;
      setText('[data-score]', String(snapshot.score)); setText('[data-balls]', String(remaining)); setText('[data-result-score]', String(snapshot.score));
      setText('[data-losses]', `${snapshot.lostBallCount} / ${MAX_LOST_BALLS}`);
      get('[data-loss-limit-message]').hidden = snapshot.phase !== 'gameover' || snapshot.lostBallCount < MAX_LOST_BALLS;
      const finalizedScore = snapshot.phase === 'gameover' ? snapshot.score : null;
      if (!Object.is(shareScore, finalizedScore)) {
        const url = finalizedScore === null ? null : scoreShareUrl(finalizedScore);
        if (url) {
          resultShare.href = url; resultShare.removeAttribute('aria-disabled'); resultShare.removeAttribute('tabindex');
        } else {
          resultShare.removeAttribute('href'); resultShare.setAttribute('aria-disabled', 'true'); resultShare.tabIndex = -1;
        }
        shareScore = finalizedScore;
      }
      if (snapshot.phase === 'paused') setText('[data-pause-message]', pauseMessages[snapshot.pauseReason ?? 'user']);
      if (lastPhase !== snapshot.phase) {
        const endMessage = `${snapshot.lostBallCount >= MAX_LOST_BALLS ? `累計${MAX_LOST_BALLS}球の落球で終了。` : '終了。'}${snapshot.score}ラリー。残球数${remaining}。`;
        setText('[data-status]', snapshot.phase === 'paused' ? '一時停止中。再開ボタンで続けられます。' : snapshot.phase === 'gameover' ? endMessage : snapshot.phase === 'running' ? `プレイ中。残球数${remaining}。` : 'ホーム');
        if (snapshot.phase === 'paused') { overlay.scrollTop = 0; focusPause(); }
        else {
          const focus = snapshot.phase === 'gameover' ? finishing ? get<HTMLElement>('[data-finishing]') : result.querySelector<HTMLElement>('button:not(:disabled)') : snapshot.phase === 'running' ? canvas : home.querySelector<HTMLElement>('[data-action="start"]');
          focus?.focus({ preventScroll: true });
        }
        lastPhase = snapshot.phase;
      } else if (snapshot.phase === 'running' && remaining !== lastRemaining) {
        setText('[data-status]', `残球数${remaining}。`);
      }
      lastRemaining = remaining;
      if (lastFinishing && !finishing && phase === 'gameover') result.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
      lastFinishing = finishing;
    },
    setSound(muted: boolean) { for (const button of root.querySelectorAll('[data-action="sound"]')) button.textContent = muted ? '音：オフ' : '音：オン'; },
    setAudioReady(ready: boolean) { get('[data-audio-notice]').hidden = ready; },
    setError(message: string) { const error = get('[data-error]'); error.textContent = message; error.hidden = !message; },
    setPreferences(value: Preferences = DEFAULT_PREFERENCES) {
      for (const volume of root.querySelectorAll<HTMLInputElement>('[data-volume]')) volume.value = String(value.volume);
      quality.value = value.quality;
      for (const best of root.querySelectorAll('[data-best]')) best.textContent = String(value.bestScore);
      get<HTMLAnchorElement>('[data-share-home-x]').href = homeShareUrl(value.bestScore);
    },
    setStorageAvailable(available: boolean) { get('[data-storage-notice]').hidden = available; },
    setContextAvailable(available: boolean) {
      for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action="resume"], [data-action="retry"]')) button.disabled = !available;
      if (phase === 'paused' && (!overlay.contains(doc.activeElement) || doc.activeElement?.matches(':disabled'))) focusPause();
    },
    dispose() { root.removeEventListener('click', click); root.removeEventListener('keydown', keydown); root.removeEventListener('input', input); root.removeEventListener('change', change); root.innerHTML = ''; },
  };
}
