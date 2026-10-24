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

- 全browser：102/102、失敗/skip/flaky=0、18.3分。既存ランキング・共有・入力・中断・全32段階・450/555の30ゲーム秒負荷を含む。
- 配布：CIの通常with-deps環境でroot/Pagesの4/4成功。ZIPのSHA-256/CRCを照合して結果を保存した。CLIの成果物redirectが403だったため、GitHubプラグインのdownload URLから取得した（検査失敗ではない）。
- Task 1: complete — unit358/358、型成功。Task 2: complete — browser102/102、iPhone画像52、配布4/4。Task 3: complete — 独立レビュー指摘なし、Draft PR #16、実装コミット436bf8fのCI40079161871は全6ジョブ成功。
- 製品・検査・設定130ファイルのSHA-256が実装コミットから変わらないことを再照合した。後続コミットは文書・証拠のみ。
- CIのテキストログは末尾の空白のみ正規化。core成果物の元ZIPは作業領域で保持し、取得したバイトのSHA-256とCRCを照合した。全browserの完全JSONはgzipで保存し、別途102件の読みやすい一覧を作成した。
- Linux実時間参考計測8/8完了（60秒×8、全条件continuousRun=true、保護停止なし）。95%以上が25ms以内の参考目標は0/8。完全な生RAF・フレーム別sim時刻とphase・資源値・環境・未達判定を保存し、機能検査や実機性能の合格とは区別した。
- 実装コミットのpush CI40079130048とPR CI40079161871は双方全6ジョブ成功。後続の文書/証拠コミットでは製品・検査を変更しない。
