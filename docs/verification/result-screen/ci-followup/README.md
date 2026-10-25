# PR #26 CI追補: reduce-motionの描画終了時に電撃が残る

初回CI: [run 40226178865](https://github.com/chameleonjp-lab/takkeu/actions/runs/40226178865)、対象head `457b87c`。

- core・WebKit interaction/load・Chromium loadは成功。
- Chromium interactionは87成功/1失敗。`result-presentation.spec.ts:29` でreduce motionへ切り替えた後の電撃0本に対し4本が残留。
- ローカルの全182件では検出されなかった順序依存。`draw()` がchangeイベントより先に `.matches` を読んで停止すると、再予約だけを止め、描画済みSVGと配列を片付けていなかった。

## 再現と修正

メディア設定の値だけを先に変え、changeイベントをまだ配送せず次の描画フレームを進める回帰テストを追加。修正前はRAFは止まるがSVGが3本残る（RED）。描画フレーム側の停止条件でも既存 `stop()` を呼ぶように統一し、SVG・配列・次回発生時刻を解放する。再開は既存の設定通知で1ループだけ起動する。

待機時間、リトライ設定、判定条件は緩めない。ゲーム・ランキング・音声・DBには変更なし。

- 全unit **778/778**、typecheck成功。
- 同じ実ブラウザテストをChromium/WebKit各5回繰り返し、**20/20成功**。reduce motionへの途中切替、停止状態維持、再開、disposeを含む。
- 初回の全CIジョブログ、RED、修正後unit/型/browserログと正式JSONを保存。
- 元の失敗動画・画像・トレースは[GitHub artifact](https://github.com/chameleonjp-lab/takkeu/actions/runs/40226178865/artifacts/12612250101)に残る。こちらの実行環境からのアーカイブ取得はHTTP403のためできず、取得済みとは扱わない。

修正を同じDraft PRへpushし、GitHub CIの全ジョブを再実行して最終確認する。
