# 残球加速・待機球非表示の検証

基点：マージ済みPR #15のmain `8f2a025df2f2f538c4e0f0484d862eb843df0331`。

実装コミット：`436bf8f5125dcdbb830973e7a4d65bbb7397ec49`。提出先は[Draft PR #16](https://github.com/chameleonjp-lab/takkeu/pull/16)。[130ファイルのソース・テスト・設定ハッシュ](source-manifest.json)と、[CIのPR用マージ参照との全file tree一致](ci-source-tree.json)を保存している。後続の証拠・文書追加を、製品変更と混同しない。

## 変更

100ラリーから相手の打球時の生存数を使用し、1球2倍、2球1.5倍、3球1.25倍、4球以上1倍。queued・返球待ち・飛行中を数え、lostは数えない。独立倍率を返球計画へ保存し、既存の下限を含む基本/スマッシュ飛行時間を割る。全球のラリー加速は同じ追加倍率を保持した新旧時間比で更新し、位置を保存する。プレイヤー返球には追加倍率を適用しない。

待機予約は暫定。打球時に倍率が変わっていた場合だけschedulerで既存予約との間隔を再検査し、必要なら出発を延期して再判定する。既に飛行中の球、既に出した予告時刻、555のバウンド位置を保存する。

queued / waiting-return / lostは球の本体・影・虹色輪郭を含むインスタンス全体を描画しない。相手側の飛行球は右190・左240・全面490の解放と既存の球発光条件を満たす場合のみ表示。70の縁だけでは表示しない。420〜479の相手球不可視も維持する。

## 実飛行時間

実際の固定刻みシミュレーションでz=0とz=1.95の通過時刻を観測・補間して計測した秒数。予定のarriveAtの差だけを検査していない。Chromium/WebKitとも35条件の実測で比率を確認し、ネットから自コートまでの時間比も一致した。

| ラリー | 1球 | 2球 | 3球 | 4球 | 8球 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 99 | .967395733 | .967395733 | .967395733 | .967395733 | .967395733 |
| 100 | .482324910 | .643099879 | .771719855 | .964649819 | .964649819 |
| 101 | .480974767 | .641299690 | .769559628 | .961949535 | .961949535 |
| 450 | .308973444 | .411964592 | .494357511 | .617946888 | .617946888 |
| 539 | .308167634 | .410890179 | .493068215 | .616335269 | .616335269 |
| 540 | .240751855 | .321002473 | .385202968 | .481503710 | .481503710 |
| 555 | .240695404 | .320927205 | .385112646 | .481390808 | .481390808 |

[WebKitの実測値](webkit-measured-flights.json) / [Chromiumの実測値](chromium-measured-flights.json)。通常球の最低時間を人為的に1.4秒にする検査でも、1球は0.7秒となることを確認。540以降のスマッシュも追加倍率で頭打ちにならない。

## iPhone縦画面の証拠

Linux Playwright WebKit・iPhone 13プロファイル、CSS viewport 390×844 / DPR 3。実機iPhoneのSafari撮影ではない。全52画像をscreenshotsのengine別フォルダへ保存した。

| 状態 | 画像 |
| --- | --- |
| 縁だけ解放した70：待機を非表示 | [70](screenshots/webkit/iphone-70-waiting.png) |
| 190：未解放の左側は飛行球も非表示 | [左](screenshots/webkit/iphone-190-left-incoming.png) |
| 190：解放した右側では飛行球が見える | [右](screenshots/webkit/iphone-190-right-incoming.png) |
| 240：両側解放後も待機を非表示 | [待機](screenshots/webkit/iphone-240-waiting.png) |
| 490：全面虹色でも待機を非表示 | [待機](screenshots/webkit/iphone-490-waiting.png) |
| 490：相手到達の直前 / 到達後 | [飛行中](screenshots/webkit/iphone-490-outgoing.png) / [到達し非表示](screenshots/webkit/iphone-490-arrived-hidden.png) |
| 490：相手が打った瞬間 / 自側へ移動 | [打球](screenshots/webkit/iphone-490-opponent-hit.png) / [自側](screenshots/webkit/iphone-490-own-incoming.png) |
| 実アプリの540で一時停止 / リトライ | [停止](screenshots/webkit/iphone-540-paused.png) / [リトライ](screenshots/webkit/iphone-retry-initial.png) |

実装者が70/190/240/490の待機・左右の飛行球・490打球の画像を開いて確認した。待機の残球表示は維持され、190の未解放側の台は暗く、解放側だけ球と影が見える。全面虹色では待機球の白い中心・輪郭がなく、打球後に飛行球として現れる。

## 自動検査と失敗履歴

- 型検査成功。unit **358/358**（既存275 + 新規83）。新規browser **6/6**。全browser **102/102**（Chromium51 / WebKit51、18.3分、失敗/skip/flakyすべて0）。[全件一覧](browser-all-summary.json) / [完全なJSONレポート](browser-all-results.json.gz) / [全文ログ](logs/browser-all.log)。
- [ソースのPR CI 40079161871](https://github.com/chameleonjp-lab/takkeu/actions/runs/40079161871)は**全6ジョブ成功**。通常のwith-deps環境で型・unit358・root/Pages配布4件・browser102件が成功した。[6ジョブの状態](ci-source-jobs.json) / [配布のJSON結果](ci-source-release-results.json) / [core全文ログ](logs/ci-source-core.log) / [Chromium操作](logs/ci-source-chromium-interaction.log)・[負荷](logs/ci-source-chromium-load.log) / [WebKit操作](logs/ci-source-webkit-interaction.log)・[負荷](logs/ci-source-webkit-load.log)。
- [CI成果物のID・SHA-256・保存期限](ci-source-artifacts.json)を記録。core ZIPは取得しSHA-256/CRC一致を検証、配布結果JSONとログをこのPRへ保存した。ブラウザの全動画・全画面等は各Actions成果物から取得できる（30日保持）。CIテキストログは行末の空白のみ正規化している。
- 99→100の同一tick内の増球、打球直前/直後の実失球、待機中の減球、次の打球の再判定、飛行中の全球加速、539→540の混在倍率、停止/再開/リトライを検査。
- 可視性は状態と位置の組み合わせ、解放前/片側/両側/全面/420〜479を検査。再利用された本体・影・輪郭の全GPU batchのcount=0を確認する。描画はsnapshotを変更しない。
- browserでは球なしと待機の全RGBAバッファのSHA-256が一致。相手側の飛行球は解放した側だけバッファが変わることを確認する。自然なoutgoing→waiting→incoming遷移でも待機中は残球2、位置・時刻を保持する。
- REDの速度32失敗・可視性26失敗、既存多球2失敗、検査fixture修正、環境設定、browser比較2失敗からの修正履歴は[作業記録](WORK-LOG.md)と[全文ログ](logs/)を参照。失敗した項目をskip/削除していない。
- [独立レビュー](review.md)：指摘なし。55,932組の混在倍率飛行の間隔、遅延したスマッシュ予告を追加検証した。
- ローカルの全browserは実装を作業ツリーで検証している途中に開始し、その同じ内容を`436bf8f`としてコミットした。保存した130ファイルのハッシュと最終提出の製品・検査ファイルが一致することを照合した。以後の追記は文書と証拠のみ。

## Linux実時間の参考計測

既存の`npm run test:performance`を8条件すべて実行し、測定処理は8/8成功。各60秒を単独で計測し、全8条件でrunningを維持、保護停止なし。**95%以上のフレームが25ms以下というLinux参考目標は0/8達成**。測定プログラムが完了したことを性能目標の合格として扱わない。

| Engine | 品質 | 開始ラリー | 実進行秒 | RAF p95 ms | 25ms以下 |
| --- | --- | ---: | ---: | ---: | ---: |
| Chromium | standard | 450 | 52.092 | 150.0 | 13.51% |
| Chromium | standard | 555 | 54.392 | 150.0 | 14.92% |
| Chromium | low | 450 | 51.142 | 166.6 | 15.45% |
| Chromium | low | 555 | 53.483 | 150.0 | 14.91% |
| WebKit | standard | 450 | 60.050 | 50.0 | 0.89% |
| WebKit | standard | 555 | 60.067 | 49.0 | 0.50% |
| WebKit | low | 450 | 60.058 | 45.0 | 11.37% |
| WebKit | low | 555 | 60.075 | 47.0 | 10.29% |

[数値・環境・進行・資源の要約](performance-summary.json) / [生RAF間隔・全フレームのsim時刻とphaseを含む完全JSON](performance-results.json.gz) / [全文ログ](logs/performance.log)。Chromiumは既存設定のSwiftShader、WebKitはLinux自動ブラウザで、iPhone実機ではない。今回の範囲ではGPU内部profileや実機性能を判定せず、未達の数値をそのまま残す。機能検査の時計制御した30ゲーム秒と、ここでの60実時間秒を混同しない。

## 未確認事項

実機iPhone Safariでの指操作・実時間性能・試聴、Xカードの再クロールは未確認。ランキングは既存のモックAPI境界を使う回帰検査で確認し、今回の修正では本番DBへ試験記録を送らない。mainへのマージ・本番公開・自動マージは今回の依頼に従って実施しない。

## 再実行

Node 24.19.0 / npm 11.9.0 / Playwright 1.64.1。標準のブラウザ依存をインストールできる環境では次を使用する。`test:performance`は実時間の参考計測で、必須CIの機能検査とは独立している。

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm run typecheck
npm test
npm run test:browser
npm run verify:release
npm run test:performance
```
