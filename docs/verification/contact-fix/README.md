# 公開後：見える接触と参考画像への修正

2026-10-22、ユーザーから「球が手前まで飛んでこないまま終了」「ラケットと重なっても終了」と報告。参考画像と、その後の「参考画像に合わせて」という指示に基づく改訂。基準mainはPR #6マージ後の `a8a667eb681fdfde5717d4f64c676f736a111d1c`。旧版の再現は同じゲーム実装の `fe488a01864b2449f334584e0d2260a3c5670549` で行った。

## 原因と変更

旧版は奥行き `z=1.95 ± 球半径` でだけ接触し、`z>1.995` ですぐ失球していた。斜め視点での重なりと一致しない。最初の球に対してラケットを上端 `y=0.85` に構えると、1.8秒のバウンドで球がラケットの裏に隠れ、2.533秒に0点のまま終了する。画像 [before-overlap.png](before-overlap.png)、[before-result.png](before-result.png)、[状態](before-state.json) に保存。旧単体85件と従来の到着予約を使う自動操作では、この利用者の操作を検出できなかった。

- 自コートで一度弾んだ後、見えている球を共通の固定視点からラケット平面へ投影して接触を調べる。球の投影半径を含め、球とラケットの両方の移動を120Hzで区間判定する。バウンド前・返球後の再加点を防ぐ。
- 球全体が画面上の打球範囲の下端を通過した時点で失球する。予定到着時刻や奥行き平面の通過だけで消さない。球の速度・加速式・既存到着予約は変更しない。
- 参考画像に合わせ、透視投影、全体が見える緑の台、白いライン、赤と青のラケット、木の色の床、台の厚みと脚を表示。球はラケットの裏に隠さず、台上の影で高さを示す。
- 台・相手ラケットの通常表示は開始時から有効にする。70/190/240/300/330の虹色への変更条件、人物の360解放、球の発光・420不可視、450スマッシュは維持する。正式要件書の冒頭に旧B方式との差異を記録した。
- 停止・終了中の不要な3D再描画を止め、停止時・回転時・描画復旧時には必要な画面を1回描く。再開後は通常描画へ戻す。CIのソフトウェアGPU競合を避けるため画面検査を1 workerに統一し、全ジョブの予算を20分にそろえる。
- 描画と接触は同じ視点定数を使用し、縦横変更は画角だけを変える。球の投影楕円を囲む円を接触に使用するため、縁にはわずかな許容がある。発光の大きさを判定に使わない。

## 作業中の失敗と再検証

| 検査 | 初回 | 原因・対応 |
|---|---|---|
| バウンド接触・失球の再現 | 失敗2件（修正前） | [regression-before.log](regression-before.log)。期待どおり不具合を検出。修正後の同じ検査は成功。 |
| 実画面で上へスワイプして返球 | 失敗（修正前） | [browser-before.log](browser-before.log)。0点のまま。修正後はChromium/WebKitとも成功。 |
| 旧衝突・多球テスト | 失敗5件（変更途中） | [implementation-first.log](implementation-first.log)。旧3D平面への到着だけを期待した検査。見える接触と新しい下端での失球を検査するよう更新し、多球の加点・順序・終了・再接触防止の検査は維持。 |
| 最初の画面検査 | 失敗後、再実行成功 | [browser-contact.log](browser-contact.log)、[browser-contact-rerun.log](browser-contact-rerun.log)。開発サーバー再読込でホームへ戻った。生成レポート類をVite監視から除外し、正式検証では編集を止めてサーバーを新規起動。 |
| 全画面検査の途中 | 失敗・途中終了 | [browser-full-iteration.log](browser-full-iteration.log)。音声テストはブラウザcontext作成約18.3秒、描画・画像保存を含み30秒のテスト予算超過。テスト予算だけを60秒へ変更し、ゲームの遅延停止0.10秒や性能基準は維持。改訂と追加検査のため途中終了（exit 130）。 |
| 音声再開拒否の再実行 | 失敗後、成功 | [visible-input-iteration.log](visible-input-iteration.log) は開発サーバーの再読込でホームへ戻った。新規サーバーからの [audio-fresh-server.log](audio-fresh-server.log) は成功。音声実装の変更なし。 |

初回CI [39815823410](https://github.com/chameleonjp-lab/takkeu/actions/runs/39815823410) は53件成功・停止画面の1件が60秒超過。画像一致や返球の検査結果の不一致ではない。[全文ログ](ci-first.log)、[トレース](ci-pause-failure-trace.zip)、[所要時間](ci-pause-timings.json) を保存した。ブラウザcontext準備約28秒、2回の画面取得約8秒と22秒が時間予算を消費した。2 workerがソフトウェアGPUを共有していたため、直列化して読み出し競合を避ける。

加えて、ゲームの停止中にも再描画が続くことを [paused-render-before.log](paused-render-before.log) で検出した（0.5秒で描画回数7→38）。停止・終了中は描き直さず、停止・リサイズ・復旧・再開は正しく描くよう変更。[paused-render-after.log](paused-render-after.log) の両ブラウザ4件は成功。この追加変更後の全検証を最終結果とする。

## 正式検証

最初のソース4a7d847では型・単体94・画面54・配布4が成功し、[attempts/4a7d847/](attempts/4a7d847/) に保存した。停止中の再描画とCI直列化を追加した最終ソースを固定し、`TAKKEU_VERIFICATION_DIR=docs/verification/contact-fix node scripts/verify-stage3.mjs` で検証した。対象SHA・ソースのSHA-256・コマンド・日時・終了コードは `final-verification.json` に記録した。

最終対象 **f9a2a19d811b31bdd330b2d702ce38ea6fda3f00**、2026-10-22 16:57:16〜17:08:31 UTC。ソース変更なしで完走し、各コマンド終了コードは0。マニフェストの `passed` は検査・記録コマンドの完了を示し、下記の実機・連続負荷の判定とは区別する。

| 検査・受入対象 | 結果 | 根拠 |
|---|---|---|
| 型検査 | 成功 | final-typecheck.log |
| 単体94件／21ファイル | 成功 | final-unit.log/json。ワンバウンド後の投影接触・失球下端、バウンド前禁止、重複防止、動くラケット、高速4球、30/60/120Hzの一致を含む。 |
| 画面56件（Chromium/WebKit各28） | 成功 | final-browser.log/json。失敗・skip・flaky 0。見える球に実ドラッグで3ラリー、縦横、中断、保存、音声失敗、全19段階、4球450の30秒、再挑戦20回・ホーム往復20回。 |
| 停止中・終了中の不要描画 | 成功 | render-loop.spec.ts。停止中の描画回数は増えず、回転・復旧・再開時は描画。停止中の画面一致も両ブラウザ成功。 |
| 描画資源の反復安定性 | 成功（自動検査） | 20回の反復で増殖なし。4球30秒のサンプルでdraw callは最大42、geometryは初回表示により36→42の範囲。継続的な増殖ではない。 |
| ルートと /takkeu/ のビルド・配布4件 | 成功 | final-distribution.log、final-release.json。開発用経路・得点変更・fixtureの非混入を検査。dist/release.jsonも対象f9a2a19・base=/takkeu/。 |
| workflow構文 | 成功 | actionlint、workflow-lint.json/log。 |
| 修正後CI | 成功 | [39818363543](https://github.com/chameleonjp-lab/takkeu/actions/runs/39818363543)。型・単体94・配布4・画面56が成功。ci-final.log、ci-final-run.json、ci-final-jobs.json。 |
| Linux実フレームの連続負荷60秒 | **失敗（連続プレイ未成立）** | 下記。記録コマンドの2件成功と連続プレイの成立を分ける。 |
| iPhone 17 Pro Safariの操作・性能 | **未確認** | 実機なし。Linux WebKit／iPhone 13プロファイルを代替合格にしない。 |
| 実際の試聴・390の安全性最終評価 | **未確認** | 音声ノード・合成WAV・動画の連続フレームを確認した範囲は visual-review.md。人の試聴と実機輝度・面積・赤色を含む最終評価は未実施。 |

### Linux連続負荷の制限

4球・450の60秒採取で、Chromiumは実ゲーム内進行0.192秒、WebKitは0秒で `slow-frame` 停止した。どちらも実スマッシュ0回。p95は16.7ms／17ms、25ms以下の割合は99.86%／99.92%だが、**ほぼ停止中の値なので性能合格に使わない**。停止中の再描画を省くことで採取値が改善しても、実プレイ中の性能を証明しない。performance-chromium.json、performance-webkit.jsonに端末条件・全間隔・資源・状態を保存。正式な実機目標「iPhone 17 Pro Safari、4球・390以降・スマッシュを含む60秒、95%以上25ms以下」は未確認のまま。

### 画像・映像・音

[画像・動画・音声の確認記録](visual-review.md)、[媒体一覧とSHA-256](media-manifest.json)。スクリーンショット19点、動画6本、合成WAV10本。台全体・遠近感・配色、縦横の収まり、返球、390発光と球の輪郭を確認した。テスト時計で制御した返球動画を、人の試遊や実時間の速度確認とは扱わない。

[修正後のスマホ画面](screenshots/three-returns-phone.png) · [PC画面](screenshots/three-returns-desktop.png) · [横画面](screenshots/game-874x402.png)

## 公開

[Draft PR #7](https://github.com/chameleonjp-lab/takkeu/pull/7)へ提出。修正版のマージ・公開は未実施。ユーザーは画像・未確認事項・Checksを確認し、Draftを解除してmainへマージする。既存の `Pages release` がマージされた完全SHAを固定し、同じコミットを検査・ビルドして自動反映する。手動公開の `expected_sha` 照合も維持している。

公開後はActionsの成功、`/takkeu/release.json`のSHAとmainの一致、縦横で台全体とワンバウンド返球・リトライを確認する。問題があれば [公開・ロールバック手順](../../release.md) に従ってrevert PRをmainへマージする。自動マージ、修正版の公開実行、課金設定変更、オンラインランキング追加はしていない。
