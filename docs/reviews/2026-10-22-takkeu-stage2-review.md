# 第2段階の独立レビュー

実施日：2026-10-22。対象：`e6e5e9d..9d9b171` のT04〜T06。実装担当と別のコンテキストで正式設計・計画・差分・進捗ledgerを照合した。後続の `9154e9` と `45606d2` はテスト動画の時計と写真用の位置だけを変更し、ゲーム本体は同一。

結果：Critical 0、Important 0、Minor 0。未採用指摘・延期Minorなし。独立した関連単体41件／9ファイルも成功した。レビュー担当はファイル変更・画面検査を行っていない。

確認した内容：同時接触の閾値通過と落球・終了順序、一度だけの追加、待機球の生存扱い、前後双方の到着間隔、予約不変性、実行済み・予約済みスマッシュの間隔、不可視の計算・音の継続、球の全描画部品の共通表示条件、解放の維持、0.3秒／0.6秒の強弱。

判断：全解放後の相手が画面から切れないよう固定カメラのフレームを拡張した判断を受け入れた。カメラ位置・向きと操作可能なゲーム内範囲は同一で、縦横・PCの範囲テストを追加し、既存のブラウザ操作検査も通している。

実機性能、保存・詳しい復旧、人による音の確認、最終的な点滅基準の判定は第3段階の範囲として区別した。画像・動画の目視は実装担当による別の確認で、[第2段階検証記録](../verification/stage2/README.md)へ保存する。

独立検証コマンド：

```bash
npm run test:unit -- tests/unit/progression.test.ts tests/unit/scheduler.test.ts tests/unit/multiball.test.ts tests/unit/opponent.test.ts tests/unit/presentation.test.ts tests/unit/simulation-isolation.test.ts tests/unit/warning-ui.test.ts tests/unit/audio-events.test.ts tests/unit/camera.test.ts
```

結果：2026-10-22 13:10:15 UTC、Vitest 5.0.5、9ファイル／41件成功、2.05秒、終了コード0。独立担当は全文をファイルへ保存していないため、この欄は会話内の実行報告の記録。正式な全文ログは実装担当の一式検証へ分けて保存した。
