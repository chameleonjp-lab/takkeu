# Pages公開・自動反映の検証（2026-10-22）

ユーザーの追加指示に基づく公開と、今後のmain更新の自動反映を対象とする。第3段階の未確認事項を合格へ変更する作業ではない。

## 対象と構成

- 第3段階マージ済みmain：`fe0ee999d9e3033d9ea732e0caa1f1622da151f3`（PR #4）。
- 公開URL： https://chameleonjp-lab.github.io/takkeu/ 。
- 開始時のPages設定：Source `workflow`、HTTPS有効。設定の追加変更は不要だった。
- 初回の手動公開：[`39801025571`](https://github.com/chameleonjp-lab/takkeu/actions/runs/39801025571)。`expected_sha`に上記mainの完全SHAを指定した。実行結果はActionsと公開後の照合記録で確認する。
- 自動反映：`deploy.yml`をmainへのpushでも実行し、pushのSHAを固定する。型・単体・画面・配布検査の成功後、同じrunの成果物を配備する。PR自動マージは有効にしない。
- 手動実行、検査前と配備直前の最新main／checkout照合、ログ90日保存を維持する。

## 初回公開後の実URL確認

公開URLの`release.json`はHTTP 200、commitは`fe0ee999d9e3033d9ea732e0caa1f1622da151f3`、baseは`/takkeu/`で一致した。公開ジョブの配備工程も成功した。ワークフロー集約状態はActions側で遅れて報告されるため、[実行URL](https://github.com/chameleonjp-lab/takkeu/actions/runs/39801025571)で別に追跡する。

2026-10-22 15:09 UTC、実際の公開URLをLinux Chromium 156（1280×800）、WebKit 27.2（390×844、844×390）で確認した。3条件すべて成功。入口・JS・CSSは200、例外・通信失敗なし。設定変更→再読込で保存を確認し、開始・停止・手動再開・リトライ・ホームを操作した。`?score=450&debug=1`で0ラリー・1球から始まり、開発経路4件は404、windowにテスト用入口なし。時計は停止させた画面・配信の確認であり、自然プレイや実機性能の検査ではない。

[成功JSON](initial-live-check.json)、[実行スクリプト](check-live.mjs)、[画像](screenshots/)。PC・縦横のホーム／停止画像6枚を保存し、縦ホームと横停止の原寸画像を開いて確認した。

最初のブラウザ確認はクラウド環境のプロキシCAをChromiumが信頼しないため`ERR_CERT_AUTHORITY_INVALID`で失敗した（[失敗JSON](initial-browser-certificate-failure.json)）。curlとPlaywright APIの通常の証明書検証ではHTTPS取得に成功した。ブラウザ部分のみプロキシ証明書検査を回避して再実行し、上記3条件が成功した。公開アプリやPagesのTLS設定は変更していない。この回避をHTTPSの独立した安全性判定には使わない。

再実行例：`node docs/verification/pages/check-live.mjs <現在の公開40文字SHA> <記録名>`。クラウド固有のCA問題がある環境では、API／curlで通常検証に成功したことを別に確認し、`TAKKEU_BROWSER_PROXY_TLS_BYPASS=1`を明示する。出力は`artifacts/pages/<記録名>/`へ保存する。

## 自動公開の追跡

[PR #5](https://github.com/chameleonjp-lab/takkeu/pull/5)のCIと、マージ後mainのpushで開始される`Pages release`を追跡する。PR本文に最終run URL・公開SHA・公開後確認を記録する。検証ログ・`revision.json`・配布SHA-256は各公開runの`release-verification-<対象SHA>`成果物に保存する。

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
