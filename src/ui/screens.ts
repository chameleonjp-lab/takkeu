import courtPreviewUrl from './court-preview.png';
import type { GameSnapshot, PauseReason } from '../game/types';
import { DEFAULT_PREFERENCES } from '../storage/preferences';
import type { Preferences, Quality } from '../storage/preferences';

type Actions = { start(): void; pause(): void; resume(): void; retry(): void; home(): void; toggleSound(): void; volume(value: number): void; sensitivity?(value: number): void; quality?(value: Quality): void };
const pauseMessages: Record<PauseReason, string> = {
  user: '深呼吸したら、またつづきから。', hidden: '画面を離れたので停止しました。', resize: '画面の向き・大きさが変わったので停止しました。',
  'slow-frame': '動作が一時的に遅くなりました。準備ができたら再開してください。',
  'context-lost': '描画が中断しました。復旧後に再開するか、ホームへ戻れます。', 'input-lost': '操作が中断したので停止しました。',
};

export function createScreens(root: HTMLElement, actions: Actions) {
  root.innerHTML = `
    <main class="shell">
      <section class="home-screen" data-home>
        <header class="brand"><span class="brand-mark" aria-hidden="true">t.</span><span>TAKKEU</span><span class="brand-note">卓球の、その先へ。</span></header>
        <div class="home-hero">
          <div class="hero-copy">
            <p class="eyebrow"><span class="status-dot"></span> ONE BALL. ENDLESS RALLY.</p>
            <h1>タッケウ<span class="title-dot" aria-hidden="true">.</span></h1>
            <p class="hero-lead">ワンバウンドをとらえて、<br>ラリーをつなぐ。</p>
            <p class="hero-description">指をすべらせて、ラケットを球に合わせる。<br>自分の台で一度弾んだ球に触れれば、打ち返せます。</p>
            <button type="button" class="button primary start-button" data-action="start">はじめる <span aria-hidden="true">↗</span></button>
            <p class="start-note">スマホはスワイプ・PCはドラッグ</p>
          </div>
          <div class="home-art" aria-hidden="true"><img src="${courtPreviewUrl}" width="600" height="415" alt="" decoding="async"></div>
        </div>
        <div class="how-to" aria-label="遊び方">
          <div><span class="step-number">01</span><p><strong>指を置く</strong><span>画面の好きな場所から。</span></p></div>
          <div><span class="step-number">02</span><p><strong>動かす</strong><span>左右・上下へスワイプ。</span></p></div>
          <div><span class="step-number">03</span><p><strong>つなぐ</strong><span>自分の返球で +1 ラリー。</span></p></div>
        </div>
        <footer class="home-footer"><p>自己ベスト <output aria-label="自己ベスト" data-best>0</output> ラリー</p><button type="button" class="button subtle" data-action="settings">設定</button></footer>
      </section>

      <section class="settings-screen" data-settings hidden aria-labelledby="settings-title"><p class="eyebrow">PREFERENCES</p><h2 id="settings-title" tabindex="-1">設定</h2><p>指の動かしやすさと音を調整できます。</p><div class="settings-fields"><button type="button" class="button subtle" data-action="sound">音：オン</button><label>効果音の音量<input type="range" min="0" max="1" step="0.05" value="0.65" aria-label="効果音の音量"></label><label>操作感度 <output data-sensitivity-value>1.0</output><input type="range" min="0.5" max="2" step="0.1" value="1" aria-label="操作感度"></label><label>描画品質<select aria-label="描画品質"><option value="standard">標準</option><option value="low">低負荷</option></select></label></div><button type="button" class="button primary" data-action="settings-back">戻る</button></section>

      <section class="game-screen" data-testid="game-screen" data-game hidden>
        <header class="game-header"><a class="wordmark" href="#" data-action="home">タッケウ<span aria-hidden="true">.</span></a><div class="game-tools"><button class="button icon-button" type="button" data-action="sound">音：オン</button><button class="button pause-button" type="button" aria-label="一時停止" data-action="pause"><span aria-hidden="true">Ⅱ</span><span>一時停止</span></button></div></header>
        <div class="hud"><div><span class="eyebrow">RALLY</span><output aria-label="ラリー数" aria-live="off" class="rally-number" data-score>0</output></div><div class="balls-counter"><span class="eyebrow">残球数</span><output aria-label="残球数" aria-live="off" data-balls>1</output></div><p class="smash-warning" data-smash-warning role="status" hidden>スマッシュがくる！</p><p class="hud-note" data-hud-note>ひとつずつ、<br>つないでいこう。</p></div>
        <div class="play-frame"><div class="input-surface" data-testid="input-surface"><div class="canvas-wrap"><canvas aria-label="卓球ゲームの描画領域"></canvas><span class="court-caption" aria-hidden="true">ONE BOUNCE · RETURN</span></div><div class="input-pad"><span class="swipe-symbol" aria-hidden="true">↔</span><p>ここからも操作できます<span>指を置いたまま、左右・上下へ</span></p><span class="pad-cross" aria-hidden="true">＋</span></div></div>
          <div class="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><div class="pause-card"><p class="eyebrow">PAUSE</p><h2 id="pause-title">ひと休み</h2><p data-pause-message></p><button type="button" class="button primary" data-action="resume">つづける <span aria-hidden="true">→</span></button><button type="button" class="button subtle" data-action="retry">最初からやり直す</button><button type="button" class="text-button" data-action="home">ホームへ</button></div></div>
        </div>
        <p class="game-hint"><span class="status-dot"></span> ワンバウンドした球にラケットを合わせよう。</p>
      </section>

      <section class="result-screen" data-result hidden><span class="brand-mark" aria-hidden="true">t.</span><p class="eyebrow">RALLY COMPLETE</p><h2>ナイスラリー！</h2><p class="result-label">今回のラリー数</p><output class="result-score" aria-label="今回のラリー数" data-result-score>0</output><p>自己ベスト <output aria-label="自己ベスト" data-best>0</output> ラリー</p><p class="result-message">もう1ラリー、つないでみよう。</p><button type="button" class="button primary" data-action="retry">もう一度 <span aria-hidden="true">↗</span></button><button type="button" class="button subtle" data-action="home">ホームへ</button></section>
      <p class="notice" data-audio-notice role="status" hidden>音声を利用できません。無音でも遊べます。音ボタンで再試行できます。</p>
      <p class="error-banner" data-error role="alert" hidden></p>
      <p class="notice" data-storage-notice role="status" hidden>この端末に保存できません。開いている間は設定と自己ベストを保持します。</p>
      <p class="sr-only" role="status" aria-live="polite" data-status></p>
    </main>`;
  const get = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const home = get('[data-home]'), game = get('[data-game]'), result = get('[data-result]');
  const settings = get('[data-settings]');
  const overlay = get('[role="dialog"]');
  const canvas = get<HTMLCanvasElement>('canvas');
  let lastPhase = '';
  let lastRemaining = -1;
  let settingsOpen = false;
  const showSettings = (open: boolean): void => {
    settingsOpen = open; settings.hidden = !open; home.hidden = open;
    (open ? get('#settings-title') : home.querySelector<HTMLElement>('[data-action="settings"]'))?.focus({ preventScroll: true });
  };
  const click = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
    if (!target) return;
    event.preventDefault();
    const action = target.dataset.action;
    if (action === 'start') actions.start();
    if (action === 'pause') actions.pause();
    if (action === 'resume') actions.resume();
    if (action === 'retry') actions.retry();
    if (action === 'home') actions.home();
    if (action === 'sound') actions.toggleSound();
    if (action === 'settings') showSettings(true);
    if (action === 'settings-back') showSettings(false);
  };
  const volume = get<HTMLInputElement>('[aria-label="効果音の音量"]');
  const onVolume = (): void => actions.volume(Number(volume.value));
  const sensitivity = get<HTMLInputElement>('[aria-label="操作感度"]');
  const quality = get<HTMLSelectElement>('[aria-label="描画品質"]');
  const onSensitivity = (): void => actions.sensitivity?.(Number(sensitivity.value));
  const onQuality = (): void => actions.quality?.(quality.value as Quality);
  const keydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || overlay.hidden) return;
    const buttons = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  };
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  volume.addEventListener('input', onVolume);
  sensitivity.addEventListener('input', onSensitivity);
  quality.addEventListener('change', onQuality);
  const setText = (selector: string, value: string): void => { const node = get(selector); if (node.textContent !== value) node.textContent = value; };
  return {
    canvas, surface: get<HTMLElement>('[data-testid="input-surface"]'), canvasWrap: get<HTMLElement>('.canvas-wrap'),
    render(snapshot: GameSnapshot) {
      if (snapshot.phase !== 'ready') settingsOpen = false;
      home.hidden = snapshot.phase !== 'ready' || settingsOpen;
      settings.hidden = !settingsOpen;
      game.hidden = snapshot.phase !== 'running' && snapshot.phase !== 'paused';
      result.hidden = snapshot.phase !== 'gameover';
      overlay.hidden = snapshot.phase !== 'paused';
      get<HTMLElement>('.game-header').inert = snapshot.phase === 'paused';
      get<HTMLElement>('.input-surface').inert = snapshot.phase === 'paused';
      const warning = snapshot.scheduledReturns.some(plan => plan.smash && plan.warningAt !== null && plan.warningAt <= snapshot.simTime + 1e-10 && snapshot.simTime < plan.departAt);
      get('[data-smash-warning]').hidden = !warning; get('[data-hud-note]').hidden = warning;
      setText('.court-caption', snapshot.progression.appliedMilestones.includes(360) ? 'OPPONENT · IN VIEW' : 'ONE BOUNCE · RETURN');
      const remaining = snapshot.balls.filter(ball => ball.phase !== 'lost').length;
      setText('[data-score]', String(snapshot.score)); setText('[data-balls]', String(remaining)); setText('[data-result-score]', String(snapshot.score));
      if (snapshot.phase === 'paused') setText('[data-pause-message]', pauseMessages[snapshot.pauseReason ?? 'user']);
      if (lastPhase !== snapshot.phase) {
        setText('[data-status]', snapshot.phase === 'paused' ? '一時停止中。再開ボタンで続けられます。' : snapshot.phase === 'gameover' ? `終了。${snapshot.score}ラリー。残球数0。` : snapshot.phase === 'running' ? `プレイ中。残球数${remaining}。` : 'ホーム');
        const focus = snapshot.phase === 'paused' ? overlay.querySelector<HTMLElement>('[data-action="resume"]') : snapshot.phase === 'gameover' ? result.querySelector<HTMLElement>('[data-action="retry"]') : snapshot.phase === 'running' ? game.querySelector<HTMLElement>('[data-action="pause"]') : home.querySelector<HTMLElement>('[data-action="start"]');
        focus?.focus({ preventScroll: true }); lastPhase = snapshot.phase;
      } else if (snapshot.phase === 'running' && remaining !== lastRemaining) {
        setText('[data-status]', `残球数${remaining}。`);
      }
      lastRemaining = remaining;
    },
    setSound(muted: boolean) { for (const button of root.querySelectorAll('[data-action="sound"]')) button.textContent = muted ? '音：オフ' : '音：オン'; },
    setAudioReady(ready: boolean) { get('[data-audio-notice]').hidden = ready; },
    setError(message: string) { const error = get('[data-error]'); error.textContent = message; error.hidden = !message; },
    setPreferences(value: Preferences = DEFAULT_PREFERENCES) {
      volume.value = String(value.volume); sensitivity.value = String(value.sensitivity); quality.value = value.quality;
      setText('[data-sensitivity-value]', value.sensitivity.toFixed(1));
      for (const best of root.querySelectorAll('[data-best]')) best.textContent = String(value.bestScore);
    },
    setStorageAvailable(available: boolean) { get('[data-storage-notice]').hidden = available; },
    setContextAvailable(available: boolean) { for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action="resume"], [data-action="retry"]')) button.disabled = !available; },
    dispose() { root.removeEventListener('click', click); root.removeEventListener('keydown', keydown); volume.removeEventListener('input', onVolume); sensitivity.removeEventListener('input', onSensitivity); quality.removeEventListener('change', onQuality); root.innerHTML = ''; },
  };
}
