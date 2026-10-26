> **履歴：この自動画質実装は不採用。** 後続の実時間測定で同期resize経路の長い待ちを検出したため、[Stage2不採用記録](stage2-rejection.md)を最終判断として優先する。以前の機能テスト成功を採用成功とは扱わない。

# Stage 2 実装・検証台帳

実装は自動モードの明示選択、3段階の内部bufferサイズと純粋な負荷controller。仕様/定数は[auto-quality-spec.md](auto-quality-spec.md)。ゲーム計算、input、音声、ランキング、44コメントは変更していない。low/standard保存と固定サイズを維持。

実装検査: 全970unit、型検査、root/Pages build、配布物8件が成功。最初のstartup-app 5000ms timeoutはGPU検査と並行時に発生、同閾値・同コードのfocused24と全970再実行で成功。失敗を残し、timeoutや性能の閾値を引き上げない。

自動画質8browser case（Chromium/WebKit）はwarmup修正後成功。ただし最終のpoint-sprite補正後は全CI/描画回帰を新しいcommitで再実行する。policy上下/短い中断の2testだけGPU描画gateを使用し、タッチ・復旧・正式性能・画像には流用しない。初回4failはテスト手順不足、別の長いvirtual全GPU試験timeoutと中断も保存。

独立レビューでwarmup混入を発見し、専用test RED→GREEN。別のfull-render診断でauto時の花火のCSS footprint増大を発見し、同一stateのRGB寄与85–115%でRED→GREEN。最初のrunId不一致の診断は正式比較に含めない。修正理由と数値を仕様資料へ記載。

## これから確定する受入
性能A/C/D/E・8ラリー・正式16条件・auto切替/滞在、native30球の視認・全43条件・flash/7既存警告、長期資源、最終独立レビュー、CI元log/checkout SHAは証拠収集後に追記する。現時点では性能改善・性能目標達成・iPhone実機を主張しない。Draftを維持し、マージ/公開/本番記録/DB変更はしない。
