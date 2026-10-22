export function mountHome(root: HTMLElement): void {
  root.innerHTML = `
    <main>
      <h1>タッケウ</h1>
      <p>スワイプでラケットを動かして、ラリーをつなごう。</p>
      <button type="button">はじめる</button>
    </main>`;
}
