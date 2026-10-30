import courtPreviewUrl from './court-preview.png';
import { CLEAR_SCORE, MAX_LOST_BALLS } from '../game/config';
import type { GameSnapshot, PauseReason } from '../game/types';
import { DEFAULT_PREFERENCES } from '../storage/preferences';
import type { Preferences, Quality } from '../storage/preferences';
import { RANKING_CONFIG, homeShareUrl, scoreShareUrl } from '../ranking/config';
import type { HallEntry, RankingEntry } from '../ranking/client';
import type { RankingState } from '../ranking/controller';
import type { ResultPositionState } from '../ranking/resultPosition';
import type { ResultHallState } from '../ranking/resultHall';
import { certificateDate, createCertificateControls } from './certificate';
import { resultComment } from './resultComments';
import { createResultEffects, resultEffectLevel } from './resultEffects';
import { getLanguage, onLanguageChange, setLanguage, t, translateError } from '../i18n/i18n';
import { getLanguageLocale, SUPPORTED_LANGUAGES } from '../i18n/languages';

type Actions = { start(): void; pause(): void; resume(): void; retry(): void; home(): void; toggleSound(): void; retryAudio?(): void; volume(value: number): void; quality?(value: Quality): void; retryRanking?(): void; retryPosition?(): void; refreshRanking?(): void };
const pauseMessages: Record<PauseReason, string> = {
  user: '深呼吸したら、またつづきから。', hidden: '画面を離れたので停止しました。', resize: '画面の向き・大きさが変わったので停止しました。',
  'slow-frame': '動作が一時的に遅くなりました。準備ができたら再開してください。',
  'context-lost': '描画が中断しました。復旧後に再開するか、ホームへ戻れます。', 'input-lost': '操作が中断したので停止しました。',
};

export function createScreens(root: HTMLElement, actions: Actions) {
  const languageControl = '<label class="language-control">言語<select data-language aria-label="言語"></select></label>';
  const soundControls = `<fieldset class="sound-panel"><legend>音声</legend><button type="button" class="button subtle" data-action="sound">音：オン</button><button type="button" class="button subtle" data-action="retry-audio">音声を再試行</button><label>効果音の音量<input type="range" min="0" max="1" step="0.05" value="0.65" aria-label="効果音の音量" data-volume></label></fieldset>`;
  root.innerHTML = `
    <main class="shell">
      <section class="home-screen" data-home>
        <header class="brand"><span class="brand-mark" aria-hidden="true">t.</span><span>TAKKEU</span><span class="brand-note">卓球の、その先へ。</span>${languageControl}</header>
        <div class="home-hero">
          <div class="hero-copy">
            <p class="eyebrow"><span class="status-dot"></span> ROAD TO 3500 RALLIES.</p>
            <h1>タッケウ<span class="title-dot" aria-hidden="true">.</span></h1>
            <p class="hero-lead">3500ラリーをつないで、<br>殿堂入りを目指そう。</p>
            <p class="hero-description">タップした位置にラケットを置き、ドラッグで球に合わせる。<br>自分の台で一度弾んだ球に触れれば、打ち返せます。<br>${CLEAR_SCORE}ラリーでゲームクリア。残球が0になるか、累計${MAX_LOST_BALLS}球落とすと終了です。</p>
            <div class="player-field"><label for="player-name">ランキングの名前 <span>任意</span></label><input id="player-name" data-player-name dir="auto" type="text" maxlength="40" autocomplete="nickname" placeholder="名前なしでも遊べます" aria-describedby="name-note"><details class="name-details"><summary>名前の公開と登録について</summary><p id="name-note" data-name-note>20文字以内。入力すると名前と記録が公開され、ランキングに参加します。同じ名前の記録は合算され、初回クリアで殿堂登録番号が付きます。再クリアも同じ番号です。名前なしでもクリア賞状を作れますが、殿堂番号は付きません。過去の記録は殿堂登録の対象外です。</p></details></div>
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

      <section class="settings-screen" data-settings hidden inert aria-labelledby="settings-title"><p class="eyebrow">PREFERENCES</p><h2 id="settings-title" tabindex="-1">設定</h2><p>音と描画品質を調整できます。ラケットは指やポインターの位置に直接合わせるため、操作感度の調整は不要です。</p><div data-settings-notices></div><div class="settings-fields">${languageControl}${soundControls}<label>描画品質<select data-quality aria-label="描画品質"><option value="standard">標準</option><option value="low">低負荷</option></select></label></div><button type="button" class="button primary" data-action="settings-back">戻る</button></section>

      <section class="game-screen" data-testid="game-screen" data-game hidden inert>
        <div class="input-surface" data-testid="input-surface"><div class="canvas-wrap"><canvas tabindex="0" aria-label="卓球ゲームの描画領域" aria-keyshortcuts="Escape"></canvas></div></div>
        <div class="hud"><div><span class="eyebrow">RALLY / ${CLEAR_SCORE}</span><output aria-label="ラリー数" aria-live="off" class="rally-number" data-score>0</output></div><div class="balls-counter"><span class="eyebrow">残球数</span><output aria-label="残球数" aria-live="off" data-balls>1</output></div><div class="losses-counter"><span class="eyebrow" data-losses-label>落球数</span><output aria-label="落球数" aria-live="off" data-losses>0 / ${MAX_LOST_BALLS}</output></div><p class="smash-warning" data-smash-warning role="status" hidden>スマッシュがくる！</p></div>
        <div class="game-notices" data-game-notices></div><p class="finish-label" data-finishing tabindex="-1" hidden>ゲーム終了</p>
        <div class="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" aria-describedby="pause-description" tabindex="-1" hidden inert><div class="pause-card"><p class="eyebrow">PAUSE</p><h2 id="pause-title">ひと休み</h2><p id="pause-description" data-pause-message></p><div data-pause-notices></div><button type="button" class="button primary" data-action="resume">つづける <span aria-hidden="true">→</span></button><button type="button" class="button subtle" data-action="retry">最初からやり直す</button><button type="button" class="text-button" data-action="home">ホームへ</button>${languageControl}${soundControls}</div></div>
      </section>

      <section class="result-screen" data-result hidden inert aria-label="ゲーム結果">
        <header class="result-header"><span class="brand-mark" aria-hidden="true">t.</span><p class="eyebrow">RALLY COMPLETE</p></header>
        <p class="result-label">今回のラリー数</p>
        <div class="result-score-stage" data-result-effects><output class="result-score" aria-label="今回のラリー数" data-result-score>0</output><span class="result-unit" aria-hidden="true">RALLY</span></div>
        <h2 data-result-comment>次こそ決めよう！</h2>
        <section class="hall-card" data-result-hall hidden aria-label="殿堂登録結果"><h3>殿堂入り</h3><p data-hall-message role="status" aria-live="polite"></p><p class="position-note" data-hall-note></p><button type="button" class="button subtle" data-action="hall-retry" hidden>殿堂登録を再送</button></section>
        <section class="certificate-card" data-certificate hidden aria-label="クリア賞状"></section>
        <div class="result-position" data-result-position hidden role="group" aria-label="自己ベストの全登録順位">
          <p data-position-message role="status" aria-live="polite" aria-atomic="true"></p><span class="result-top100" data-top100 hidden>TOP 100入り！</span>
          <p class="position-note" data-position-note></p><button type="button" class="button subtle" data-action="position-retry" hidden>順位を再取得</button>
        </div>
        <p class="result-best">この端末の自己ベスト <output aria-label="自己ベスト" data-best>0</output> <span>ラリー</span></p>
        <div class="result-actions"><button type="button" class="button primary" data-action="retry">もう一度 <span aria-hidden="true">↗</span></button>
          <a class="button share-button" data-share-x aria-disabled="true" tabindex="-1" target="_blank" rel="noopener noreferrer">Xでスコアをシェア <span aria-hidden="true">↗</span></a>
          <button type="button" class="button subtle" data-action="home">ホームへ</button></div>
        <p class="result-message" data-loss-limit-message hidden>累計${MAX_LOST_BALLS}球の落球で終了しました。</p><p class="result-message" data-ranking-participation>もう1ラリー、つないでみよう。</p>
        <div data-result-notices></div>
        <section class="ranking-panel" aria-labelledby="ranking-title"><p class="eyebrow">LEADERBOARD</p><h3 id="ranking-title">ランキング TOP 30</h3><p class="ranking-caption">新ルールの上限は3500ラリーです。過去の3000超・3500超の高スコアは旧ルールの記録として保持し、旧記録から殿堂番号は発行しません。</p><p data-ranking-message role="status">ランキングを読み込んでいます。</p>
          <div class="ranking-table-wrap"><table data-ranking-table hidden><caption class="sr-only">最高ラリー数の上位30名</caption><thead><tr><th scope="col">順位</th><th scope="col">名前</th><th scope="col">ラリー</th><th scope="col">回数</th></tr></thead><tbody data-ranking-body></tbody></table></div>
          <button type="button" class="button subtle" data-action="ranking-refresh">ランキングを更新</button><a class="lab-link" href="${RANKING_CONFIG.rankingUrl}">実験場で詳しいランキングを見る ↗</a>
        </section>
        <section class="ranking-panel" aria-labelledby="hall-title"><p class="eyebrow">HALL OF FAME</p><h3 id="hall-title">3500ラリー 殿堂入り</h3><p class="ranking-caption">新ルールの初回クリア・登録順の先頭30件。同名の再クリアは同じ番号です。</p><p data-hall-list-message role="status">殿堂一覧を読み込んでいます。</p><ol class="hall-list" data-hall-list hidden></ol></section>
      </section>
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
  // Keep the original text nodes: translating mixed labels must not replace their
  // controls, icons, line breaks, or listeners. Certificate copy has its own owner.
  const captionSources: Readonly<Record<string, string>> = {
    'ROAD TO 3500 RALLIES.': '3500ラリーへの挑戦', PREFERENCES: '設定', PAUSE: '一時停止',
    'RALLY COMPLETE': 'ラリー終了', RALLY: 'ラリー', LEADERBOARD: 'ランキング',
    'HALL OF FAME': '殿堂入り', [`RALLY / ${CLEAR_SCORE}`]: 'ラリー / 3500',
  };
  const textBindings: Array<{ node: Text; source: string; before: string; after: string }> = [];
  const walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.textContent ?? '', source = value.trim();
    if (!/\p{Letter}/u.test(source) || source === 't.' || source === 'TAKKEU') continue;
    textBindings.push({ node: node as Text, source: captionSources[source] ?? source,
      before: value.slice(0, value.indexOf(source)), after: value.slice(value.indexOf(source) + source.length) });
  }
  const attributeBindings: Array<{ node: HTMLElement; attribute: string; source: string }> = [];
  for (const node of root.querySelectorAll<HTMLElement>('[aria-label], [placeholder], img[alt]')) {
    for (const attribute of ['aria-label', 'placeholder', 'alt']) {
      const source = node.getAttribute(attribute);
      if (source) attributeBindings.push({ node, attribute, source });
    }
  }
  const languageControls = [...root.querySelectorAll<HTMLSelectElement>('[data-language]')];
  for (const select of languageControls) {
    for (const language of SUPPORTED_LANGUAGES) {
      const option = doc.createElement('option'); option.value = language.id;
      option.textContent = language.name; option.lang = language.id; option.dir = 'auto'; select.append(option);
    }
  }
  const resultEffects = createResultEffects(get('[data-result-effects]'), get('[data-result-score]'));
  const certificate = createCertificateControls(get('[data-certificate]'));
  let resultScore = 0;
  let cleared = false, certificateRun = '';
  let certificateBase: { achievedAt: string; lostBalls: number } | null = null;
  let hallState: ResultHallState = { status: 'hidden' };
  let positionState: ResultPositionState = { status: 'hidden' };
  let rankingState: RankingState = { status: 'idle', pendingCount: 0 };
  let leaderboardState: 'loading' | 'loaded' | 'error' = 'loading';
  let leaderboardCount = 0;
  let hallListState: 'loading' | 'loaded' | 'error' = 'loading';
  const hallItems: Array<{ node: HTMLElement; entry: HallEntry }> = [];
  let participation: boolean | null = null, soundMuted = false, errorSource = '';
  let preferences = DEFAULT_PREFERENCES;
  let latestSnapshot: GameSnapshot | null = null, displayKey = '';
  let announcementSource = 'ホーム';
  let announcementParameters: Record<string, string | number> = {};
  let phase: GameSnapshot['phase'] = 'ready';
  let finishing = false, lastFinishing = false;
  let preparing = false;
  let lastPhase = '';
  let lastRemaining = -1;
  let settingsOpen = false;
  const resultShare = get<HTMLAnchorElement>('[data-share-x]');
  let shareKey = '';
  const setInert = (node: HTMLElement, value: boolean): void => {
    node.inert = value; node.toggleAttribute('inert', value);
  };
  const show = (node: HTMLElement, visible: boolean): void => { node.hidden = !visible; setInert(node, !visible); };
  const updateVisibility = (): void => {
    show(home, !preparing && phase === 'ready' && !settingsOpen); show(settings, !preparing && phase === 'ready' && settingsOpen);
    show(game, preparing || phase === 'running' || phase === 'paused' || finishing); show(result, !preparing && phase === 'gameover' && !finishing); show(overlay, !preparing && phase === 'paused');
    resultEffects.update(!result.hidden && !cleared, resultScore);
    get('[data-finishing]').hidden = !finishing;
    setInert(surface, preparing || phase !== 'running'); setInert(hud, preparing || phase === 'paused');
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
    if (action === 'position-retry') actions.retryPosition?.();
    if (action === 'ranking-retry') actions.retryRanking?.();
    if (action === 'hall-retry') actions.retryRanking?.();
    if (action === 'ranking-refresh') actions.refreshRanking?.();
  };
  const quality = get<HTMLSelectElement>('[data-quality]');
  const input = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches('[data-volume]') && !target.closest('[hidden], [inert]')) actions.volume(Number(target.value));
  };
  const change = (event: Event): void => {
    if (event.target === quality && !quality.closest('[hidden], [inert]')) actions.quality?.(quality.value as Quality);
    if (event.target instanceof HTMLSelectElement && languageControls.includes(event.target) && !event.target.closest('[hidden], [inert]')) setLanguage(event.target.value);
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
  const updateShare = (): void => {
    if (phase !== 'gameover' && shareKey === 'inactive') return;
    const number = hallState.status === 'registered' ? hallState.hall.number : undefined;
    const key = phase === 'gameover' ? `${resultScore}:${cleared}:${number ?? ''}:${getLanguage()}` : 'inactive';
    if (shareKey === key) return;
    shareKey = key;
    const url = phase === 'gameover' ? scoreShareUrl(resultScore, cleared, number) : null;
    if (url) { resultShare.href = url; resultShare.removeAttribute('aria-disabled'); resultShare.removeAttribute('tabindex'); }
    else { resultShare.removeAttribute('href'); resultShare.setAttribute('aria-disabled', 'true'); resultShare.tabIndex = -1; }
  };
  const updateCertificate = (): void => {
    certificate.set(cleared && certificateBase ? { ...certificateBase,
      name: hallState.status === 'registered' ? hallState.hall.displayName : hallState.displayName ?? '',
      hall: hallState.status === 'registered' ? hallState.hall : null,
    } : null);
  };
  const number = (value: number): string => value.toLocaleString(getLanguageLocale(getLanguage()));
  const namedText = (node: HTMLElement, source: string, name: string, parameters: Record<string, string | number>): void => {
    // The translated sentence controls placement, while the name remains literal
    // text in an isolated inline element, including names containing HTML or RTL.
    const marker = '\uFFFC', parts = t(source, { ...parameters, name: marker }).split(marker);
    const content: Node[] = [];
    parts.forEach((part, index) => {
      if (index) { const bdi = doc.createElement('bdi'); bdi.dir = 'auto'; bdi.textContent = name; content.push(bdi); }
      content.push(doc.createTextNode(part));
    });
    node.replaceChildren(...content);
  };
  const displayParticipation = (): void => {
    setText('[data-ranking-participation]', t(participation === null ? 'もう1ラリー、つないでみよう。'
      : participation ? 'このプレイはランキングに参加しています。' : '名前なしのプレイです。プレイ回数のみ記録し、ラリー記録は送信しません。'));
  };
  const displayPosition = (): void => {
    const state = positionState;
    get('[data-result-position]').hidden = state.status === 'hidden';
    get('[data-result-position]').dataset.state = state.status;
    setText('[data-position-message]', state.status === 'loaded' ? t('{rank}位 / {total}登録中', { rank: number(state.rank), total: number(state.total) })
      : state.status === 'loading' ? t('順位を集計中…') : state.status === 'error' ? t('順位を取得できませんでした')
      : state.status === 'excluded' ? t('この登録名は現在ランキング対象外です。') : '');
    setText('[data-position-note]', state.status === 'loaded' ? t('登録名ごとの自己ベスト順位（{score}ラリー）', { score: number(state.bestScore) }) : '');
    get('[data-top100]').hidden = state.status !== 'loaded' || state.rank > 100;
    get('[data-action="position-retry"]').hidden = state.status !== 'error';
  };
  const displayRankingState = (): void => {
    const state = rankingState;
    const messages = { idle: '', submitting: 'ランキングに記録しています。', submitted: 'ランキングに記録しました。', retryable_failed: '記録を送信できませんでした。通信を確認して再送できます。', permanent_failed: '記録を登録できませんでした。ゲームとシェアは引き続き利用できます。' };
    get('[data-ranking-notice]').hidden = state.status === 'idle';
    const source = state.hallPendingCount === state.pendingCount && state.pendingCount > 0
      ? state.status === 'permanent_failed' ? 'ラリー記録は送信済みですが、殿堂登録を確認できませんでした。' : 'ラリー記録は送信済みです。殿堂登録を確認・再送しています。'
      : messages[state.status];
    setText('[data-ranking-status]', source ? t(source) : '');
    get('[data-action="ranking-retry"]').hidden = state.status !== 'retryable_failed';
  };
  const displayHall = (): void => {
    const state = hallState;
    get('[data-result-hall]').hidden = state.status === 'hidden';
    const messages = { hidden: '', anonymous: '3500ラリー、クリアおめでとう！', pending: '殿堂登録を確認しています。', retryable_failed: '殿堂登録は再送できます。', failed: '殿堂登録を確認できませんでした。', ineligible: 'この登録名は現在、殿堂登録の対象外です。' };
    setText('[data-hall-message]', state.status === 'registered' ? t('殿堂登録 第{number}号', { number: state.hall.number }) : state.status === 'hidden' ? '' : t(messages[state.status]));
    if (state.status === 'registered') namedText(get('[data-hall-note]'), '{name}・初回登録日 {date}（UTC）。再クリアも同じ番号です。', state.hall.displayName, { date: certificateDate(state.hall.registeredAt) });
    else setText('[data-hall-note]', state.status === 'anonymous' ? t('名前なしのクリアです。達成賞状を作れます。殿堂番号は付きません。')
      : state.status === 'pending' || state.status === 'retryable_failed' ? t('正式な番号はサーバーでの登録完了後に表示します。')
      : state.status === 'hidden' ? '' : t('番号なしの達成賞状は作成できます。'));
    get('[data-action="hall-retry"]').hidden = state.status !== 'retryable_failed';
  };
  const displayHallList = (): void => {
    const list = get<HTMLOListElement>('[data-hall-list]');
    for (const { node, entry } of hallItems) namedText(node, '第{number}号　{name}　{date}（UTC）', entry.displayName,
      { number: entry.number, date: certificateDate(entry.registeredAt) });
    list.hidden = hallListState !== 'loaded' || !hallItems.length;
    setText('[data-hall-list-message]', t(hallListState === 'loading' ? '殿堂一覧を読み込んでいます。' : hallListState === 'error' ? '殿堂一覧を取得できませんでした。「ランキングを更新」で再取得できます。' : hallItems.length ? '番号は登録名ごとの初回クリア順です。' : '最初の殿堂入りを目指そう。'));
  };
  const displayLeaderboard = (): void => {
    get('[data-ranking-table]').hidden = leaderboardState !== 'loaded' || !leaderboardCount;
    setText('[data-ranking-message]', t(leaderboardState === 'loading' ? 'ランキングを読み込んでいます。' : leaderboardState === 'error' ? 'ランキングを取得できませんでした。時間をおいて更新してください。' : leaderboardCount ? 'プレイ回数はゲーム開始時に数えます。' : 'まだ記録がありません。最初のラリーをつなごう。'));
    get<HTMLButtonElement>('[data-action="ranking-refresh"]').disabled = leaderboardState === 'loading';
  };
  const displaySound = (): void => {
    for (const button of root.querySelectorAll('[data-action="sound"]')) button.textContent = t(soundMuted ? '音：オフ' : '音：オン');
  };
  const displaySnapshotText = (snapshot: GameSnapshot | null, remaining: number): void => {
    if (snapshot?.phase === 'gameover') setText('[data-result] h2', cleared ? t('3500ラリー達成！ゲームクリア！') : resultComment(snapshot.score));
    else if (!snapshot) setText('[data-result] h2', resultComment(0));
    setText('[data-result] .result-header .eyebrow', t(cleared ? 'ゲームクリア' : 'ラリー終了'));
    const lost = snapshot?.lostBallCount ?? 0, danger = lost >= 90 && lost < MAX_LOST_BALLS;
    get('[data-losses]').dataset.danger = String(danger);
    setText('[data-losses-label]', danger ? t('落球注意 · あと{remaining}球', { remaining: MAX_LOST_BALLS - lost }) : t('落球数'));
    if (snapshot?.phase === 'paused') setText('[data-pause-message]', t(pauseMessages[snapshot.pauseReason ?? 'user']));
    // Keep the last announcement's meaning; switching language is not a phase transition.
    if (snapshot?.phase === 'gameover') announcementParameters = { ...announcementParameters, score: snapshot.score, remaining };
    setText('[data-status]', t(announcementSource, announcementParameters));
  };
  const refreshLanguage = (): void => {
    for (const binding of textBindings) binding.node.data = binding.before + t(binding.source) + binding.after;
    for (const binding of attributeBindings) binding.node.setAttribute(binding.attribute, t(binding.source));
    for (const select of languageControls) select.value = getLanguage();
    get('.shell').lang = getLanguage();
    displayParticipation(); displayPosition(); displayRankingState(); displayHall(); displayHallList(); displayLeaderboard(); displaySound();
    setText('[data-error]', errorSource ? translateError(errorSource) : '');
    displaySnapshotText(latestSnapshot, lastRemaining < 0 ? 1 : lastRemaining);
    get<HTMLAnchorElement>('[data-share-home-x]').href = homeShareUrl(preferences.bestScore);
    updateShare();
  };
  refreshLanguage();
  const unsubscribeLanguage = onLanguageChange(refreshLanguage);
  return {
    canvas, surface, canvasWrap: get<HTMLElement>('.canvas-wrap'),
    playerName() { return get<HTMLInputElement>('[data-player-name]').value; },
    setPreparing(value:boolean) { preparing=value;updateVisibility(); },
    setPlayerName(value: string) { get<HTMLInputElement>('[data-player-name]').value = value; },
    setStarting(starting: boolean) {
      for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action="start"], [data-action="retry"]')) { button.disabled = starting; button.setAttribute('aria-busy', String(starting)); }
      get<HTMLInputElement>('[data-player-name]').disabled = starting;
    },
    setRankingParticipation(named: boolean) { participation = named; displayParticipation(); },
    setResultPosition(state: ResultPositionState) { positionState = state; displayPosition(); },
    setRankingState(state: RankingState) { rankingState = state; displayRankingState(); },
    setResultHall(state: ResultHallState) {
      hallState = state; displayHall(); updateCertificate(); updateShare();
    },
    setHallOfFame(state: 'loading' | 'loaded' | 'error', rows: readonly HallEntry[] = []) {
      hallListState = state;
      const list = get<HTMLOListElement>('[data-hall-list]'); list.replaceChildren(); hallItems.length = 0;
      for (const entry of rows.slice(0, 30)) {
        const node = doc.createElement('li'); list.append(node); hallItems.push({ node, entry });
      }
      displayHallList();
    },
    setLeaderboard(state: 'loading' | 'loaded' | 'error', rows: readonly RankingEntry[] = []) {
      leaderboardState = state; leaderboardCount = rows.length;
      const body = get('[data-ranking-body]'); body.replaceChildren();
      for (const row of rows.slice(0, 30)) {
        const tr = doc.createElement('tr');
        for (const value of [row.rank, row.displayName, row.score, row.playCount]) {
          const cell = doc.createElement('td');
          if (typeof value === 'string') { const bdi = doc.createElement('bdi'); bdi.dir = 'auto'; bdi.textContent = value; cell.append(bdi); }
          else cell.textContent = String(value);
          tr.append(cell);
        }
        body.append(tr);
      }
      displayLeaderboard();
    },
    render(snapshot: GameSnapshot, showingFinalEffects = false) {
      latestSnapshot = snapshot;
      if (snapshot.phase !== 'ready') settingsOpen = false;
      resultScore = snapshot.score;
      cleared = snapshot.phase === 'gameover' && snapshot.endReason === 'clear';
      result.dataset.cleared = String(cleared);
      if (cleared && certificateRun !== snapshot.runId) {
        certificateRun = snapshot.runId; certificateBase = { achievedAt: new Date().toISOString(), lostBalls: snapshot.lostBallCount }; updateCertificate();
      } else if (!cleared && certificateRun) { certificateRun = ''; certificateBase = null; certificate.set(null); }
      const level = resultEffectLevel(snapshot.score);
      result.dataset.scoreColor = level.color; result.dataset.resultTier = level.tier;
      get('[data-result-score]').dataset.digits = String(snapshot.score).length > 5 ? 'long' : 'short';
      phase = snapshot.phase; finishing = phase === 'gameover' && showingFinalEffects; updateVisibility();
      const warning = snapshot.scheduledReturns.some(plan => plan.smash && plan.warningAt !== null && plan.warningAt <= snapshot.simTime + 1e-10 && snapshot.simTime < plan.departAt);
      get('[data-smash-warning]').hidden = !warning;
      const remaining = snapshot.balls.filter(ball => ball.phase !== 'lost').length;
      setText('[data-score]', String(snapshot.score)); setText('[data-balls]', String(remaining)); setText('[data-result-score]', String(snapshot.score));
      setText('[data-losses]', `${snapshot.lostBallCount} / ${MAX_LOST_BALLS}`);
      get('[data-loss-limit-message]').hidden = snapshot.phase !== 'gameover' || snapshot.lostBallCount < MAX_LOST_BALLS;
      updateShare();
      if (lastPhase !== snapshot.phase) {
        announcementSource = snapshot.phase === 'paused' ? '一時停止中。再開ボタンで続けられます。'
          : snapshot.phase === 'gameover' ? cleared ? '3500ラリー達成。ゲームクリア！{score}ラリー。残球数{remaining}。'
          : snapshot.lostBallCount >= MAX_LOST_BALLS ? '累計{limit}球の落球で終了。{score}ラリー。残球数{remaining}。' : '終了。{score}ラリー。残球数{remaining}。'
          : snapshot.phase === 'running' ? 'プレイ中。残球数{remaining}。' : 'ホーム';
        announcementParameters = { score: snapshot.score, remaining, limit: MAX_LOST_BALLS };
        if (snapshot.phase === 'paused') { overlay.scrollTop = 0; focusPause(); }
        else {
          const focus = snapshot.phase === 'gameover' ? finishing ? get<HTMLElement>('[data-finishing]') : result.querySelector<HTMLElement>('[data-action="retry"]:not(:disabled)') : snapshot.phase === 'running' ? canvas : home.querySelector<HTMLElement>('[data-action="start"]');
          focus?.focus({ preventScroll: true });
        }
        lastPhase = snapshot.phase;
      } else if (snapshot.phase === 'running' && remaining !== lastRemaining) {
        announcementSource = '残球数{remaining}。'; announcementParameters = { remaining };
      }
      const nextDisplayKey = `${snapshot.phase}:${snapshot.score}:${snapshot.lostBallCount}:${remaining}:${snapshot.pauseReason}:${cleared}`;
      if (displayKey !== nextDisplayKey) { displayKey = nextDisplayKey; displaySnapshotText(snapshot, remaining); }
      lastRemaining = remaining;
      if (lastFinishing && !finishing && phase === 'gameover') result.querySelector<HTMLElement>('[data-action="retry"]:not(:disabled)')?.focus({ preventScroll: true });
      lastFinishing = finishing;
    },
    setSound(muted: boolean) { soundMuted = muted; displaySound(); },
    setAudioReady(ready: boolean) { get('[data-audio-notice]').hidden = ready; },
    setError(message: string) { errorSource = message; const error = get('[data-error]'); error.textContent = message ? translateError(message) : ''; error.hidden = !message; },
    setPreferences(value: Preferences = DEFAULT_PREFERENCES) {
      preferences = value;
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
    dispose() { unsubscribeLanguage(); certificate.dispose(); resultEffects.dispose(); root.removeEventListener('click', click); root.removeEventListener('keydown', keydown); root.removeEventListener('input', input); root.removeEventListener('change', change); root.innerHTML = ''; },
  };
}
