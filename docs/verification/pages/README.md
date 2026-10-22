# Pages公開・自動反映の検証（2026-10-22）

ユーザーの追加指示に基づく公開と、今後のmain更新の自動反映を対象とする。第3段階の未確認事項を合格へ変更する作業ではない。

## 対象と構成

- 第3段階マージ済みmain：`fe0ee999d9e3033d9ea732e0caa1f1622da151f3`（PR #4）。
- 公開URL： https://chameleonjp-lab.github.io/takkeu/ 。
- 開始時のPages設定：Source `workflow`、HTTPS有効。設定の追加変更は不要だった。
- 初回の手動公開：[`39801025571`](https://github.com/chameleonjp-lab/takkeu/actions/runs/39801025571)。`expected_sha`に上記mainの完全SHAを指定した。実行結果はActionsと公開後の照合記録で確認する。
- 自動反映：`deploy.yml`をmainへのpushでも実行し、pushのSHAを固定する。型・単体・画面・配布検査の成功後、同じrunの成果物を配備する。PR自動マージは有効にしない。
- 手動実行、検査前と配備直前の最新main／checkout照合、ログ90日保存を維持する。

## ローカル検証

2026-10-22 15:04〜15:05 UTC、上記mainを基準にworkflowと文書だけを変更した作業ツリーで実行した。ゲーム・テスト・配布スクリプトは変更していない。ログ内の`release.json`は当時のHEADである上記mainを示す。設定変更自体の確定コミットはPRのCIと公開ワークフローで追跡する。

| 検査 | 結果 |
|---|---|
| actionlint 1.7.7：deploy.yml / ci.yml | 成功（終了0、指摘なし） |
| 型検査 | 成功 |
| 単体 | 成功、85件／20ファイル |
| ルート／Pagesのビルド・配布隔離 | 成功 |
| 実配布物のChromium／WebKit | 成功、計4件 |
| git diff --check | 成功 |

全文ログ：[型](typecheck.log)、[単体](unit.log)、[配布](distribution.log)。ブラウザはLinux Chromium 156／WebKit 27.2。既存のPlaywright取得先とWebKit共有ライブラリを使用した。iPhone実機ではない。

## 継続する未確認

iPhone 17 Pro Safari実機の操作・VoiceOver・60秒性能、人による音の試聴、390の最終点滅基準は未確認。[第3段階受入表](../acceptance.md)と[音の確認](../audio-review.md)を維持する。
