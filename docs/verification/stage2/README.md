# 第2段階（T04〜T06）検証記録

基準main：`e6e5e9d8a4eaa4fbf5c04c616f6b7a92ce02f8c9`（第1段階PR #2のマージ後）。正式なソース対象：`45606d2`。以後の文書・証拠追加コミットでゲームとテストを変更しない。マージ・公開・第3段階の実装は行わない。

## 正式な結果

型検査、単体 **66件／17ファイル**、画面 **20件**（Chromium 10／WebKit 10）、ビルドが成功。skip・flaky・failureは0件。Node 24.19.0／npm 11.9.0、Debian 13。依存の版・lockfileは第1段階のまま。

- [実行時刻・対象SHA・コマンド・終了コード・ソースと証拠のSHA-256](final-verification.json)
- 全文：[型](final-typecheck.log)／[単体](final-unit.log)／[ビルド](final-build.log)／[画面](final-browser.log)
- 正式な機械結果：[単体JSON](final-unit.json)／[画面JSON](final-browser.json)
- [配布物へのテスト専用状態・経路の非混入検査](build-isolation.json)
- [独立レビュー](../../reviews/2026-10-22-takkeu-stage2-review.md)

単体の正式コマンドは `npm run test:unit -- --reporter=default --reporter=json --outputFile=docs/verification/stage2/final-unit.json`。通常の `npm test` も66件成功。`npm test` へreporterオプションを渡すと入れ子のnpmが引数を消費したため、直接のscript呼び出しへ修正した。最初のログは `final-unit-cli-argument-initial.log` に保存している。

ローカルWebKitは不足していた共有ライブラリを公式Debianパッケージから `/tmp` に展開した。ブラウザのwrapperが `LD_LIBRARY_PATH` を上書きするため、ブラウザ内の探索先へ配置した。ローカルのみ `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` を使用し、実際のWebKitを起動して全画面検査を通した。CIはUbuntu 24.04で既存の公式 `install --with-deps` を使う。

## 19行の対応と画像

テスト専用の状態で得点と到達済み節目を直接設定する。450までの自動操作は行わない。テストの状態構築・動画駆動・操作補助は `tests/` にあり、アプリの得点設定機能・URLパラメーター・自動ラケット操作として配布しない。写真用の4球は重ならない位置に置き、420の前後で自側2球と相手側2球を比較できる。

全行を実装・単体検査済み。開始、全19行、M10終了の画像を両ブラウザで保存した。画像で示せない加速・配球・接触・音は単体とイベント検査を根拠にする。

| ID | ラリー | 実装 | PC画像 | 縦画像 |
|---|---:|---|---|---|
| M05 | 5ごと | 指数式で上限2.2倍へ。新規予約から適用 | [5](screenshots/chromium/milestone-005.png) | [5](screenshots/webkit/milestone-005.png) |
| M10 | 10 | 5秒間、両側の球が虹色 | [10](screenshots/chromium/milestone-010.png) | [10](screenshots/webkit/milestone-010.png) |
| M30 | 30 | 常時虹色・2球目を1回追加 | [30](screenshots/chromium/milestone-030.png) | [30](screenshots/webkit/milestone-030.png) |
| M50 | 50 | 3球目を1回追加 | [50](screenshots/chromium/milestone-050.png) | [50](screenshots/webkit/milestone-050.png) |
| M70 | 70 | 両側の縁。相手面は隠れたまま | [70](screenshots/chromium/milestone-070.png) | [70](screenshots/webkit/milestone-070.png) |
| M100 | 100 | 自ラケットの縁 | [100](screenshots/chromium/milestone-100.png) | [100](screenshots/webkit/milestone-100.png) |
| M130 | 130 | ネット | [130](screenshots/chromium/milestone-130.png) | [130](screenshots/webkit/milestone-130.png) |
| M150 | 150 | 4球目を1回追加 | [150](screenshots/chromium/milestone-150.png) | [150](screenshots/webkit/milestone-150.png) |
| M160 | 160 | 自コート右面 | [160](screenshots/chromium/milestone-160.png) | [160](screenshots/webkit/milestone-160.png) |
| M190 | 190 | 相手コート右面 | [190](screenshots/chromium/milestone-190.png) | [190](screenshots/webkit/milestone-190.png) |
| M210 | 210 | 自コート左面 | [210](screenshots/chromium/milestone-210.png) | [210](screenshots/webkit/milestone-210.png) |
| M240 | 240 | 相手コート左面 | [240](screenshots/chromium/milestone-240.png) | [240](screenshots/webkit/milestone-240.png) |
| M270 | 270 | 自ラケット全体が虹色 | [270](screenshots/chromium/milestone-270.png) | [270](screenshots/webkit/milestone-270.png) |
| M300 | 300 | 相手ラケットの縁だけ | [300](screenshots/chromium/milestone-300.png) | [300](screenshots/webkit/milestone-300.png) |
| M330 | 330 | 相手ラケット全体 | [330](screenshots/chromium/milestone-330.png) | [330](screenshots/webkit/milestone-330.png) |
| M360 | 360 | 相手の身体 | [360](screenshots/chromium/milestone-360.png) | [360](screenshots/webkit/milestone-360.png) |
| M390 | 390 | 解放済みの非球部品を滑らかに強弱 | [390](screenshots/chromium/milestone-390.png) | [390](screenshots/webkit/milestone-390.png) |
| M420 | 420 | 相手側の球の全描画を隠す | [420](screenshots/chromium/milestone-420.png) | [420](screenshots/webkit/milestone-420.png) |
| M450 | 450 | 予告付きスマッシュを混在、続行 | [450](screenshots/chromium/smash-warning-muted.png) | [450](screenshots/webkit/smash-warning-muted.png) |

[開始PC](screenshots/chromium/milestone-000.png)／[開始縦](screenshots/webkit/milestone-000.png)／[M10終了PC](screenshots/chromium/milestone-010-ended.png)／[M10終了縦](screenshots/webkit/milestone-010-ended.png)。画像一覧は [screenshots](screenshots)、比較一覧は [review](review)。

## 重点検査

| 条件 | 根拠・結果 |
|---|---|
| 29→31、49→51、149→151 | progression／multiball：同時接触を個別加点、各閾値は一度だけ追加 |
| 途中の落球、待機、終了 | 補充せず、50で残り1球なら2球。queuedも生存、全球なしで終了1回、将来の報酬は発生しない |
| 4球と高速移動 | 移動中ラケットを含む連続判定。上限付近・スマッシュ入りの30秒を専用状態から検査し、4球を保持して得点継続 |
| 配球 | 前後双方へ `0.12 + 中心間距離 / 6` 秒。既存予約を動かさず、空きがなければ新規打球だけを待たせる |
| 速度・初回追加 | 通常最低0.60秒、スマッシュ最低0.50秒。追加球の初回到着は追加から1秒以上 |
| M10・M30 | 5秒ちょうどで終了、30の常時発光が優先。停止中はゲーム時刻が進まない |
| 70〜360 | 指定した左右・面・縁・本体・身体だけを解放。材質を共有せず、未解放部位の影や反射は生成しない |
| M390 | 強→弱→強0.6秒、各遷移0.3秒。弱時も表示を保ち、球・文字・予告には強弱を適用しない |
| 419→420 | 相手側の球の描画サブツリー全体を隠す。自側・`z=0`・解放済み部品は残す。残像・影は実装しない |
| 449→450 | 20%候補、実行済みと予約済みの前後2秒を検査。配球で遅れた最終打球時刻でも再確認 |
| スマッシュ | 予告0.40秒以上、予約時の1.2倍と視認下限、接触は通常どおり+1。予告・実打球は各1イベント |
| 予告中の加速 | 別球が454→455へ進めても予約済み倍率・時刻は不変 |
| 音・描画の分離 | 同じ入力を2つの計算へ渡し、片方だけ描画・ミュート・重複イベント消費を行っても、状態・予約・乱数・イベントが一致 |
| 回帰 | 第1段階の相対ドラッグ、スワイプ、指離れ、停止、再挑戦、30/60/120Hzの検査も成功 |

## 動画・音と目視

- 390：[PC動画](media/pulse-chromium.webm)／[縦動画](media/pulse-webkit.webm)。3周期のアニメーションをブラウザのフレーム時刻で駆動して収録。強・弱の比較画像も保存した。
- 450：[PC動画](media/smash-chromium.webm)／[縦動画](media/smash-webkit.webm)。ミュート中の構え・文字予告、停止・再開、隠れた打球、自側への出現、残球による続行を記録。打球と予告のイベント列は `media/smash-state-*.json` に保存。
- 実Web Audioで合成：[自分音](media/player-hit.wav)／[相手音](media/opponent-hit.wav)／[予告音](media/smash-warning.wav)。波形・上昇音・イベント数を検査。人による試聴合格の代わりにはしない。
- 画像54枚、動画4本を保存する。全節目を比較一覧と必要箇所の原寸で確認し、動画は実ファイルから連続フレームを抽出して動きも確認する。確認対象とハッシュは正式マニフェストに記載する。

## 検査中に分かったことと修正

1. 初回npmの既定cacheが書込可能領域外だったため、`--cache /tmp/takkeu-npm-cache` で依存導入を完了した。
2. WebKitの不足ライブラリとwrapperの探索先を確認し、実行環境だけを修復した。ホスト検査を無効にするだけで合格にはしていない。
3. 初期の画像確認で相手が従来の画角から切れたため、カメラ位置・方向は維持してフレームを広げた。縦横・PCの投影テストと基本操作の回帰を追加確認した。
4. スマッシュ停止検査の初回失敗は、テスト用状態の `pauseReason` の同期漏れだった。テスト用状態を修正し、両ブラウザで再検証した。最初の全文は `t06-browser-initial.log`。
5. 動画の駆動を呼出し間の待機からブラウザのフレーム時計へ変更し、写真用の球を4つとも区別できる位置にした。ゲーム本体への自動操作は追加していない。

## 未確認・第3段階へ残すこと

iPhone 17 Pro実機の操作・音の聞き分け・60秒性能測定、390映像の明るさ・面積・色変化を含む最終的な点滅基準の判定は未確認。WebKitの画面検査を実機合格として扱わない。

T07〜T10の保存・設定・詳しい復旧、音の最終調整、反復資源・性能・読み上げの網羅検査、配布設定は実装していない。今回は第2段階の機能と証拠の提出まで。

## GitHub CI

正式ソース `45606d24bd735824fec46aef30f8b49e167a67ab` の [CI実行39785218844](https://github.com/chameleonjp-lab/takkeu/actions/runs/39785218844) は成功。依存導入・型・単体・ビルド・画面・成果物保存の全工程が成功した。[全文ジョブログ](ci-source-job.log)、[工程結果](ci-source-jobs.json)、[成果物メタデータ](ci-source-artifacts.json) を保存。成果物 `verification-45606d24bd735824fec46aef30f8b49e167a67ab` にも全文ログ・画面結果・対象SHAを保持する。
