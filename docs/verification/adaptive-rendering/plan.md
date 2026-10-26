# 2段階描画最適化・実装検証計画

依頼仕様（2026-10-26）のStage1/Stage2をその順序で実行。自律実装・独立レビュー・Draft更新までの明示的な許可に従い、追加の設計承認待ちは設けない。

Baseline A: PR27 `6ec38720b4f720c71bf48c5aef3cdc5732fdd578`。main `aff31169fd6feaad7bad35f22fe3de26429296cf`。開始時open/draft/未merge。環境はLinuxソフトウェアWebGLでありiPhone実機の代用ではない。

## 不変条件
ゲーム計算/固定dt/maxSteps/遅延停止・30球/全同時返球/イベント・音声5条件・43条件の時刻/色/期間・44コメント・ランキング/共有を維持。本番スコア送信・DB変更・main commit/merge/deploy禁止。初期設定standard、v1保存を維持。自動のみstandard〜lowの解像度。絶対基準p95<=25ms、<=25ms率>=95%、sim>=59s/60s、30球、停止なしを変更しない。

## 設計と比較案
Stage1はlegacy celebration/fireworkのused-prefix転送を第一候補とする。既存4batch/indexed実験は再実装しない。不変星配置キャッシュを別候補で検証。透明pass/シェーダー統合は色・順序やfill costを変えるため証拠のないまま採用しない。カメラ外省略は動的境界と費用を調査して判定。古いイベントの整理は現在の上限と寿命を調査し、実効性不明なら変更しない。

Stage2は独立したpure controller（active RAF時刻だけ、3s window p95、2window>25msで1段down、<=18ms20sで1段up、10s cooldown、変更/復帰/resize後warmup）と3段階のbuffer sizeを導入。autoはstandardの演出/音声品質を維持し解像度だけを調整。view.setResolutionLevel はcamera/CSS/input mappingを触らずbuffer/viewport/uniformのみ更新。手動quality changeもlayout resizeと分離。休止/hidden/loading/context/rotation時履歴を破棄、retry/homeで段階リセット。

## タスク
- [ ] Aを取得・環境固定・baseline unit/正式性能/画像/転送測定。既存資料はgit blob SHAとSHA256で参照。
- [ ] Stage1候補を1つずつ検証。tests/unit/drawing-upload.test.tsで稼働/非稼働/再利用/寿命を検証、完全geometryと画像をA比較。3組交互測定、有効性と未立証を区別。調査表/元データ/敵対検証/独立レビューを保存、Stage1 commit。
- [ ] Stage2 tests/unit/adaptive-quality.test.tsを先に追加。60/120Hz・瞬間負荷/持続負荷/上限下限/反復/復帰/resetとv1 storage互換を検証。src/render/adaptiveQuality.ts、quality.ts、createView.ts、createApp.ts、preferences.ts、screens.tsを更新。loop/physics/audio実装変更なし。
- [ ] tests/browser/adaptive-quality.spec.ts: 実buffer切替中のheld pointer、中央/端座標、CSS/camera不変、orientation、pause/hidden/context/retry検証。fixturesだけに制御/計測。生産dist入口にdebug追加なし。
- [ ] C/D/E比較、8ラリー×画質、正式16条件、30球・60s、auto切替/最低/回復。CPU/GPU診断は別試行、同じrunnerで比較。未達・欠測を明記。
- [ ] Chromium/WebKit、型/unit、root/Pages build/release、43条件/音声/44コメント/ランキングモック、画像/点滅既存閾値/メモリ/資源、A01〜A16、独立レビュー。元ログと失敗を圧縮+hashで保存。Stage2 commit。
- [ ] Draft27をfast-forward更新、commitごとCIを確認し実checkout SHAを記録。資料リンクと段階表/未解決をPR本文に追加。公開しない。

## Review focus
入力中にbufferを変更してもlayout更新処理へ入らない。pause/finishの時刻とevent寿命を変えない。autoの低段階をaudio/effect densityと混同しない。単発stall/120Hz/rotationを長期遅延と誤認しない。比較対象に測定方式/CPU並行負荷/画角/球数の差を混ぜない。
