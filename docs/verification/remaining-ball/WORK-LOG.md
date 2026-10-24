# SDD ledger — plan: docs/superpowers/plans/2026-10-24-remaining-ball-speed.md

- 基点：main `8f2a025df2f2f538c4e0f0484d862eb843df0331`。新規cloneの専用ブランチ `feat/remaining-ball-speed` を使用。PR #15のマージと変更内容、既存の速度・予約・描画を確認。
- Baseline：sandbox内274/275。公開SHA子プロセス検査が実行制約で失敗。通常実行では275/275成功。検査を除外せず、以後の全unitは通常実行を使用。
- Pre-flight：schedulerの追加倍率はflightSpeedの時間比率にも渡す。追加倍率の保存先はReturnPlanだけとし基本speedMultiplierへ混入しない。
- Task 1 RED：新規速度50検査中32失敗。追加倍率が実飛行時間へ反映されないことを再現。
- Task 1 GREEN：新規50/50成功。追加の同一tick境界・混在倍率検査を含め最終53/53成功。
- Ruling: 追加倍率が変化した時だけ出発予約を調整する — 変化のない予約まで作り直すと、既存47球検査の明示倍率2.6を再計算した値で上書きし、到着枠を後方へ送り続けて進行が450→470で停滞したため — 誤っていた場合は他球との間隔が崩れるので全多球回帰と独立55,932組検査で確認。
- Task 2 RED：旧仕様の待機可視・未解放面の球可視を含む26件の失敗を保存。
- Task 2 GREEN：可視性42/42成功。phaseゲート→自側/相手領域→既存発光・420規則の順で判定し、instance全体を除外。
- 全unit：初回は既存多球2件が失敗。上記原因の修正後、358/358成功。新規最短時間検査のfixtureにも同じconfigを渡すよう修正した。
- 新規browser初回：4成功/2失敗。DOMスクリーンショットは球なしと待機で残球HUDも変わるため一致しなかった。実GPUの全RGBAバッファのSHA-256比較へ変更し、球関連画素だけを検査。HUDの残球表示は別assertionで保持。
- 新規browser修正後：Chromium3 + iPhoneプロファイルWebKit3 = 6/6成功。画像52点と境界イベント・実飛行時間を保存。
- 環境：Playwright WebKitの不足ライブラリをDebian署名付き索引から取得し、/tmpのブラウザコピーのsys/libへ配置。ホストの事前ldconfig検査だけを省略し、実WebKit起動・全assertionは実行した。失敗ログを保存。CIでは既存の通常with-depsを使用する。
- Final review：独立レビューはCritical/Important/Minorすべてなし。見送った軽微事項なし。実機性能・本番公開を今回の検証成功とは扱わない。
- 全browser・root/Pages配布・最終commit/CIの結果はREADMEへ追記する。
