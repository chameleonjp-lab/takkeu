# ラケットの貫通表示修正・第1／第2段階の再照合

基準main：`01ef27f2f521a8a09a82da385c928ba47b2355f7`。最終実装対象：`77f21a5f213d2f3d848a81fc743fcad890c77d6c`。正式コマンド・終了コード・時刻・ソース／配布物のハッシュは[最終マニフェスト](final-verification.json)を参照する。文書・証拠追加コミットは製品と検査を変更しない。

[正式設計](../../superpowers/specs/2026-10-22-takkeu-design.md)、[T01〜T06](../../superpowers/plans/2026-10-22-takkeu-implementation.md)、進捗・既存検証・[第1段階PR #2](https://github.com/chameleonjp-lab/takkeu/pull/2)・[第2段階PR #3](https://github.com/chameleonjp-lab/takkeu/pull/3)の実装履歴を確認した。[照合対象](history-review.json)。後から指定された参考画像の画角、台全体と両ラケットの初期表示、ワンバウンド後の投影接触を現行仕様として照合する。

## 原因と修正

| 問題 | 再現 | 修正 |
|---|---|---|
| 柄がラバーを突き抜ける | 円柱の柄は半径最大0.036、ラバー面はz=±0.018。接合部を両側からレイ検査するとラバーより先に柄へ当たる | 柄・グリップの奥行き倍率を0.45にし、最大厚み半分0.0162をラバー面の内側へ収める。赤青両方、表裏の検査を追加 |
| 奥の球がラケットを透過する | 球と虹色の輪郭のdepthTestが無効。GPUの赤いラバーの画素[209,0,27]が、奥の球を置くと[235,227,163]へ変わる | 球を通常の不透明・深度書込みへ戻す。輪郭も深度判定を行い、奥の球を手前へ強制表示しない。実GPUで奥／手前・通常／10／30／390を検査 |
| 相手ラケットへ球が埋まる | 初回修正後の追加寸法確認で、相手の打球点z=-1.95に球中心とラケット中心を置いていた。球半径0.045とラバー面0.018の合計0.063が食い込む | 球の軌道は保持し、相手モデルを0.063奥へ移して球表面とラバー面が接する配置にする。実メッシュの境界から接触位置を検査 |
| 第2段階の白い球の中心が抜けた | 参考画像へ合わせた黄色が発光中にも残り、白い中心の要件に不一致 | 発光中は白い不透明な中心と、外側だけ見える虹色の裏面シェル。終了・リトライで通常の黄色へ復元。390の強弱を球へ適用しない |

[修正前の単体失敗](regression-unit-before.log)は3件、[修正前の画面失敗](regression-browser-before.log)は両ブラウザ各1件。[修正後の関連25件](regression-unit-after.log)と[接触・GPU画面6件](regression-browser-after.log)は成功。白い中心の実画素検査を追加した[最終事前検査](gpu-final-preflight.log)も両ブラウザ成功。追加の相手打球位置についても[実メッシュの寸法](opponent-contact-before.json)と[失敗する単体](opponent-contact-unit-before.log)で再現し、[修正後26件](opponent-contact-unit-after.log)が成功した。正式検証は下記の最終固定コミットで別に実行する。

`before/*-failure-front-state.png`は最初の失敗時に最後に描いた「手前」の状態であり、奥の球の比較画像ではない。修正前の奥の球は`before/*-behind-0.png`を参照する。

[ゲーム計算・入力・音声・アプリ・保存の21ファイルは基準mainと同一](rule-isolation.json)。球の速度、加速式、接触半径、操作範囲、配球予約、閾値、M10の時間、390の周期、420の不可視、450の予告条件を維持する。ホームの静止プレビューも修正後のThree.jsで再生成した。[生成条件・ハッシュ](preview-generation.json)。比較用のポーズであり、実入力・実時間性能の証明には使わない。

## 第1・第2段階の対応

| タスク | 現在の実装と今回の確認対象 | 結果 |
|---|---|---|
| T01 基盤 | 版固定・lockfile、TypeScript、Three.js WebGL2、Vite、起動とCI。型・単体・画面・配布物の入口 | 成功 |
| T02 基本ラリー | 1球・自分だけ+1・重複防止・相手の確実な返球・バウンド・失球・終了。高速／移動ラケット・30/60/120Hz | 成功 |
| T03 操作・画面・SE | 相対スワイプ／PCドラッグ、指離れ・複数指、停止・手動再開・結果・再挑戦、自他SEイベント。柄と描画順を補修 | 成功 |
| T04 多球・加速・配球 | 30/50/150で各1球、最大4球、落球後も累計保持、5ごとの指数加速、予約不変、到着前後の移動成立 | 成功 |
| T05 全演出 | 部位の虹色、M10/M30、390の強弱、420の球サブツリー非表示。白い中心を補修 | 成功 |
| T06 スマッシュ | 450以降20%候補・全打球前後2秒・0.4秒前の構え／文字／音、ミュート・停止・不可視と続行 | 成功 |

初期B方式の「相手台・相手ラケットを初めは隠す」は、ユーザーの後続指定により変更済み。M70/190/240/300/330は通常表示から虹色への変更であり、欠落として旧非表示を復活させない。人物は360で出現し、球の相手側表示規則は元の得点条件を保持する。

最低視認時間は予約平面への予定到着までの基準。自コートで弾んだ後の接触を、その予定時刻まで待たせない。

## R01〜R12・音・受入条件

以下の成功は指定した自動検査の範囲。試聴・実機・性能・映像の最終評価とは分ける。

| ID | 確認対象・テスト | 結果 |
|---|---|---|
| R01 / Q01 | ワンバウンド後だけ+1、初期1球、実ドラッグ0→1・3ラリー。session / bounce-contact / contact | 成功 |
| R02 | 同じ接触を再加点せず、4球は個別に加点。collision / multiball | 成功 |
| R03 | 相手の確実な返球、ネット越え・台内の弾み。session / trajectory | 成功 |
| R04 / Q02 | 手前の範囲を全球が通るまで失球にせず、その球だけを除き累計保持。bounce-contact / multiball | 成功 |
| R05 | 30/50/150で各1回の追加、補充なし・4球上限。progression / multiball | 成功 |
| R06 | queued / waiting-returnを生存に含め、全球なしで一度だけ終了、450以後も続く。multiball / opponent / quality | 成功 |
| R07 | 5ごとの加速は新規予約から適用、既存予約の倍率と時刻は不変。progression / scheduler / opponent | 成功 |
| R08 | 球同士の衝突なし、球別に往復・落球・イベント。multiball / simulation-isolation | 成功 |
| R09 / Q08 | 前後の到着予約へ0.12秒+中心距離/6秒、通常0.60秒・スマッシュ0.50秒、4球と上限速度。scheduler / opponent / quality | 成功 |
| R10 / Q03 | 29→31 / 49→51 / 149→151の追加と加速、同時刻の処理順。progression / multiball | 成功 |
| R11 / Q04 | 停止中は球・5秒・位相・予約・予告が進まない。session / loop / lifecycle / smash | 成功 |
| R12 | リトライで得点・球・予約・重複情報・時間を初期化し、自己ベスト・設定を保持。session / audio-events / preferences / retry | 成功 |
| A01 / A03 / A04 / A06〜A08 | 自他の異なるWeb Audio、不可視の打球SE、8音制限、ID重複・旧run・停止音の破棄、定位なし、ミュート中の予告。audio-events / audio / simulation-isolation | 成功 |
| A02 / Q07 | 音の波形・高さ・発音は自動検査対象。実際に聞いて識別できるか | 未確認 |
| A05 | unlock拒否時の無音継続・操作で再試行は自動検査対象。実iPhoneの開始制限・アプリ復帰 | 未確認 |
| Q05 | 現行仕様の部位別の閾値と材質分離。presentation / milestones | 成功 |
| Q06 | 420で相手側の球・輪郭・影をまとめて隠し、自側・境界・解放済み部位を保持。presentation / smash | 成功 |
| Q09 | 30/60/120Hz一致、移動中と高速の連続接触。loop / pointer-loop / replay / collision | 成功 |
| Q10 / Q11 | 指離れ・複数指・回転・追跡喪失・非表示・音声／WebGL中断の自動検査は対象。実iPhoneの操作・ロック・切替 | 未確認 |
| Q12 | 各0.3秒・周期0.6秒、白い球・文字・予告の独立は自動検査と映像確認対象。実機を含む最終点滅安全性 | 未確認 |
| Q13 | 450の予告は隠れた球を暴露せず、450を超えても続行。opponent / smash / quality | 成功 |
| Q14 | 再挑戦20回・ホーム往復20回のループ・購読・描画／音声資源。retry | 成功 |
| Q15 | 保存・WebGL・音声の失敗と回復。storage / preferences / lifecycle / audio / quality | 成功 |
| Q16 | PC・縦横・44px・200%文字・ラベルは自動検査対象。実機・VoiceOver | 未確認 |
| Q17 | ルート／/takkeu/でJS/CSS/画像読込み、開発経路404、得点URL無効、fixture非混入。verify:release | 成功 |

## M05〜M450：全19行

| ID | 現行仕様との対応 | 結果 |
|---|---|---|
| M05 | 5ごとの指数加速、新規予約だけ。上限2.2倍 | 成功 |
| M10 | 実ゲーム時間5秒の虹色と白い中心。停止中は保持 | 成功 |
| M30 | 常時虹色が5秒の終了に優先、2球目を追加 | 成功 |
| M50 | 3球目を一度だけ追加、落球分を補充しない | 成功 |
| M70 | 両コートの縁が通常色から虹色 | 成功 |
| M100 | 自ラケットの縁だけが虹色 | 成功 |
| M130 | ネットが虹色 | 成功 |
| M150 | 4球目を一度だけ追加 | 成功 |
| M160 | 自コート画面右面が虹色 | 成功 |
| M190 | 相手コート画面右面が虹色 | 成功 |
| M210 | 自コート画面左面が虹色 | 成功 |
| M240 | 相手コート画面左面が虹色 | 成功 |
| M270 | 自ラケット本体も虹色 | 成功 |
| M300 | 相手ラケットの縁だけが虹色 | 成功 |
| M330 | 相手ラケット本体も虹色 | 成功 |
| M360 | 相手の身体を表示して虹色、返球動作 | 成功 |
| M390 | 解放済みの球以外が各0.3秒・周期0.6秒の強弱。球・背景・HUD・予告は対象外。最終安全性はQ12未確認 | 成功 |
| M420 | 相手側の球全体を隠し、計算・打球SEを維持 | 成功 |
| M450 | 予告付きスマッシュ20%候補、2秒間隔・0.4秒前、通常同様+1と続行 | 成功 |

## 正式結果と残る確認

初回6fa4b34の型・単体102件・画面60件・配布4件はコマンド上成功したが、追加の寸法確認で相手ラケットへの埋込みが分かったため最終合格として採用しない。[初回ログと対象SHA](attempts/6fa4b34/final-verification.json)を保存し、配置を修正した77f21a5で正式一式を取り直した。

最終対象77f21a5、2026-10-22 19:33:41〜19:46:36 UTC。導入・型・単体・画面・配布・負荷記録・差分確認の全コマンドが終了コード0。ソース102ファイルと配布物のハッシュを保存した。負荷記録のコマンド成功は、下記の連続負荷の合格を意味しない。

| 正式コマンド | 結果 | 全文・機械結果 |
|---|---|---|
| `npm ci --cache /tmp/takkeu-npm-cache` | 成功 | [導入](final-install.log) |
| `npm run typecheck` | 成功 | [型](final-typecheck.log) |
| `npm run test:unit`（default/json reporter） | 103件／23ファイル成功 | [全文](final-unit.log)・[JSON](final-unit.json) |
| `npm run test:browser` | Chromium30＋WebKit30、計60件成功。失敗・skip・flaky 0 | [全文](final-browser.log)・[JSON](final-browser.json) |
| `npm run verify:release` | ルート／Pagesビルド・非混入検査、両ブラウザ計4件成功 | [全文](final-distribution.log)・[JSON](final-release.json) |
| `npm run test:performance` | 両ブラウザ60秒の記録成功。連続負荷の受入結果は失敗 | [全文](final-performance.log)・[JSON](final-performance.json) |
| `git diff --check` | 成功 | [全文](final-diff.log) |

追加した検査専用画面・コードはルートと`/takkeu/`で404、JSにも非混入。同じ配布物のハッシュを[追加確認](fixture-isolation.json)で照合した。通常の公開得点URLも無効。

4球の30ゲーム秒検査は両ブラウザで450→482、4球を維持。draw calls44〜56、geometry50〜56（初回表示分）、texture4、program11。再挑戦20回・ホーム往復20回も資源・購読・更新ループ・AudioContext数が増え続けず成功。[計測データ](data)。テスト側の操作であり、人による450到達・実時間60秒性能の証明には使わない。

| 実時間負荷 | Chromium | WebKit |
|---|---:|---:|
| 記録時間 | 60.003秒 | 60.010秒 |
| 実ゲーム内進行 | 0.1167秒 | 0秒 |
| 最終状態 | slow-frameで停止 | slow-frameで停止 |
| 実スマッシュ | 0回 | 0回 |
| p95（停止中を含む参考値） | 16.8ms | 17ms |
| 60秒連続負荷の判定 | **失敗** | **失敗** |

0.10秒超の遅延で保護停止し、負荷状態を維持できなかった。停止中を含むp95や25ms以下の比率を性能合格に使わない。Linuxソフトウェア描画の結果であり、実機の未達と同一視しない。**iPhone 17 Pro Safariで縦横・4球・390以降・スマッシュを含む60秒、95%以上25ms以下の目標は未確認**。端末・OS・Safari版・電源・温度・品質を指定した実機測定が必要。

## 画像・動画・音声の確認

画像87点、動画6本、合成WAV10本、機械計測16件、修正前画像4点の計123ファイルを[ハッシュ付き一覧](media-manifest.json)へ整理した。環境は[environment.json](environment.json)。[画像・動画の確認範囲](visual-review.md)と[音声処理・未試聴の区別](audio-review.md)を参照する。

- 全節目の画像：[PC一覧](screenshots/milestones-chromium-grid.png)／[WebKit縦一覧](screenshots/milestones-webkit-grid.png)。開始＋19行、原寸もscreenshotsへ保存。
- 奥の球：[修正前](before/chromium-behind-0.png)／[修正後](screenshots/behind-0-chromium.png)。白い中心：[390で手前の球](screenshots/front-390-chromium.png)。GPU画素値はdataのgpu-occlusion。
- 実ドラッグの3ラリー：[PC動画](videos/three-returns-chromium.webm)／[縦動画](videos/three-returns-webkit.webm)。球の位置に合わせたポインター入力で、得点を変更していない。ゲーム本体への自動操作追加なし。
- 390：[PC動画](videos/pulse-390-chromium.webm)／[縦動画](videos/pulse-390-webkit.webm)。450：[PC動画](videos/smash-450-chromium.webm)／[縦動画](videos/smash-450-webkit.webm)。実動画から抽出した時系列フレームも保存・確認。

**未確認**：iPhone実機の操作・ホーム領域・ロック／復帰・VoiceOver、実際に聴いたSEの識別と快適さ、390映像の明るさ・面積・赤色を含む最終点滅安全性。動画の抽出確認やWebKitの成功を、実機・試聴・安全性の合格に置き換えない。

## 公開

本修正はPR提出時点で未公開。ユーザーがmainへマージすると、既存のPages releaseがmainの同じSHAを検査・ビルド・配備する。自動マージ・手動公開は行わない。[対象SHA照合・公開後確認・revert手順](../../release.md)を使う。公開後は`/takkeu/release.json`と配備runのSHA一致、PC・縦横の返球・停止・リトライ・保存、柄と球の奥行きを確認する。
