import type { LoadingState } from '../app/loadingProgress';
import { MAX_LOST_BALLS } from '../game/config';
import './loading.css';

type LoadingActions = { cancel(): void; retry(): void };

const tips = [
  'タップで、ラケットを置く。',
  '押したまま動かして、球に合わせる。',
  'ワンバウンドをとらえて、ラリーをつなぐ。',
];
let nextScreenId = 0;

export function createLoadingScreen(root: HTMLElement, actions: LoadingActions) {
  const doc = root.ownerDocument;
  const titleId = `loading-title-${++nextScreenId}`;
  const section = doc.createElement('section');
  section.className = 'loading-screen';
  section.dataset.loadingScreen = '';
  section.hidden = true;
  section.inert = true;
  section.setAttribute('inert', '');
  section.setAttribute('role', 'dialog');
  section.setAttribute('aria-modal', 'true');
  section.setAttribute('aria-labelledby', titleId);
  section.innerHTML = `
    <div class="loading-content" data-loading-content>
      <header class="loading-header">
        <p class="loading-brand"><span aria-hidden="true">t.</span> TAKKEU</p>
        <h2 id="${titleId}" tabindex="-1">プレイを準備しています</h2>
      </header>
      <div class="loading-progress-block">
        <p class="loading-percent" data-loading-percent>0%</p>
        <div class="loading-meter" data-loading-progress role="progressbar" aria-label="ゲームの準備" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span aria-hidden="true"></span></div>
        <p class="loading-stage" data-loading-stage role="status" aria-live="polite" aria-atomic="true"></p>
        <p class="loading-eta" data-loading-eta></p>
      </div>
      <section class="loading-instructions" aria-label="遊び方と終了条件">
        <h3>準備のあいだに、遊び方をチェック</h3>
        <p class="loading-tip" data-loading-tip></p>
        <ul class="loading-rules" data-loading-rules>
          <li>タップした位置にラケットを置きます。</li>
          <li>押したまま動かすと、指やポインターについて動きます。</li>
          <li>自分の台で1回バウンドした球を打ち返そう。</li>
        </ul>
        <p class="loading-end" data-loading-end>残球が0になるか、累計${MAX_LOST_BALLS}球落とすとゲーム終了です。</p>
      </section>
      <p class="loading-error" role="alert" aria-atomic="true" hidden></p>
      <div class="loading-actions">
        <button type="button" class="button primary" data-loading-action="retry" hidden>もう一度準備する</button>
        <button type="button" class="button subtle" data-loading-action="cancel">ホームへ</button>
      </div>
    </div>`;
  root.append(section);

  const get = <T extends HTMLElement>(selector: string): T => section.querySelector<T>(selector)!;
  const heading = get('h2');
  const progress = get('[data-loading-progress]');
  const fill = get('[data-loading-progress] > span');
  const percentLabel = get('[data-loading-percent]');
  const stage = get('[data-loading-stage]');
  const eta = get('[data-loading-eta]');
  const tip = get('[data-loading-tip]');
  const alert = get('[role="alert"]');
  const retry = get<HTMLButtonElement>('[data-loading-action="retry"]');
  const cancel = get<HTMLButtonElement>('[data-loading-action="cancel"]');
  let disposed = false;
  let hadError = false;
  const setText = (node: HTMLElement, value: string): void => {
    if (node.textContent !== value) node.textContent = value;
  };

  const click = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-loading-action]') : null;
    if (disposed || !target || !section.contains(target) || target.closest('[hidden], [inert]') || target.disabled) return;
    event.preventDefault();
    if (target === cancel) actions.cancel();
    if (target === retry) actions.retry();
  };
  const keydown = (event: KeyboardEvent): void => {
    if (section.hidden || event.key !== 'Tab') return;
    const controls = retry.hidden ? [cancel] : [retry, cancel];
    const first = controls[0]!;
    const last = controls.at(-1)!;
    const active = doc.activeElement;
    if (event.shiftKey && (active === first || !controls.includes(active as HTMLButtonElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (active === last || !controls.includes(active as HTMLButtonElement))) {
      event.preventDefault(); first.focus();
    }
  };
  section.addEventListener('click', click);
  section.addEventListener('keydown', keydown);

  return {
    show(state: LoadingState | null): void {
      if (disposed) return;
      if (state === null) {
        section.hidden = true;
        section.inert = true;
        section.setAttribute('inert', '');
        hadError = false;
        return;
      }
      const firstShow = section.hidden;
      const hasError = state.error !== null;
      section.hidden = false;
      section.inert = false;
      section.removeAttribute('inert');
      section.setAttribute('aria-busy', String(!hasError));
      const percent = Number.isFinite(state.percent) ? Math.max(0, Math.min(100, state.percent)) : 0;
      const elapsed = Number.isFinite(state.elapsedSeconds) ? Math.max(0, Math.floor(state.elapsedSeconds)) : 0;
      setText(percentLabel, `${Math.floor(percent)}%`);
      progress.setAttribute('aria-valuenow', String(percent));
      progress.setAttribute('aria-valuetext', `${Math.floor(percent)}%、${state.stage}`);
      fill.style.width = `${percent}%`;
      setText(stage, state.stage);
      setText(heading, hasError ? '準備を完了できませんでした' : 'プレイを準備しています');
      eta.hidden = hasError;
      setText(eta, hasError ? '' : state.remainingSeconds !== null && Number.isFinite(state.remainingSeconds)
        ? `あと約${Math.max(0, Math.ceil(state.remainingSeconds))}秒（目安）`
        : `${elapsed}秒経過 · 通常より時間がかかっています。準備ができるまでお待ちください。`);
      setText(tip, tips[Math.floor(elapsed / 4) % tips.length]!);
      alert.hidden = !hasError;
      setText(alert, state.error ?? '');
      retry.hidden = !hasError;
      if (firstShow) section.scrollTop = 0;
      if (hasError && (firstShow || !hadError)) retry.focus();
      else if (firstShow || hadError && !hasError) heading.focus({ preventScroll: true });
      hadError = hasError;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      section.removeEventListener('click', click);
      section.removeEventListener('keydown', keydown);
      section.remove();
    },
  };
}
