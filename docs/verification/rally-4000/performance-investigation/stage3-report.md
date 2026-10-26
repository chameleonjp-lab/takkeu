# Stage 3 — 最終検証

最終コードは`b697a98475e54dbc8c3a9458eafd7628d92dc062`。製品変更は`src/render/quality.ts`のみ。PR27開始時Bからゲーム計算・入力・加点・30球制限・終了条件・音声・43演出の状態生成・ランキング・自己ベスト・X共有は変更していない。採用した大画面低画質の比較改善と、残る絶対性能問題は[Stage 2](stage2-report.md)を参照。

## 判定を分ける

| 判定 | 結果と限界 |
|---|---|
| 機能 | CIの959単体+200ブラウザ+8配布物=1167件成功。Chromium/WebKit。下記の有限画像・native波形・入力検証で43演出を維持。人間/実機の知覚評価は未確認 |
| 絶対性能 | 正式交互比較18回・最終16条件すべて25ms/95%/59秒目標未達。全行を下記へ保存 |
| 比較性能 | 大画面低画質で3組すべてp95短縮25.05–33.27%。標準は200→200ms、統計的な悪化なしとは断定しない |
| 実機性能 | iPhone17 Pro Safari未確認。Linux WebKit、DPR2、phone viewportは実機の代替ではない |

## コードとCI

[GitHub Actions40260338558](https://github.com/chameleonjp-lab/takkeu/actions/runs/40260338558)は全6job成功。PR headはb697a98、実際にcheckoutされたmergeは`6ee52161b532a0b8dddce904771a74631c2419db`。src/tests/scripts/package lock/CI設定の差分なしを照合した。core:型検査・959unit・root/Pages両build・両engineの8release、browser:各engine97interaction+3load。CIのGitCommitInfo補助fetchには3秒timeoutの警告があるが、checkout SHAはartifact commit.txtから別に確認した。

全5artifactのGitHub digest、ZIP全memberのCRC/SHA256を検証済み。workflow全logも保存する。GitHub側のartifactは2026-11-25期限（30日）；長期証拠はこのPRの分割ZIPとmanifestで復元可能にする。候補a180f27の成功CI40256324051も履歴として区別し、最終CIへ読み替えない。文書だけの後続commitがCIをskipしても、それを成功と数えず、全non-doc入力の同一性を別記録する。

## 43条件と保護した機能

[既存の全43行対応表](../coverage.md)は対象条件の定義・旧証拠への索引として保持する。そこにある旧性能数値/旧CIは今回の成功結果へ流用しない。今回のCIは同じ条件を含む現行suiteを新しく実行した。

| 条件群 | 今回の根拠 |
|---|---|
| R01–R23：到達・常設23条件 | rally-effects/rally-render単体、rally-effects.specの全23閾値before/arrival/during/afterと動き。500/1000/1500/2000/2500/2750/3000/3500/4000を別のbefore/after画像108組で比較 |
| L01–L13：落球13条件 | loss-position/rally-effects/rally-render、実落球座標と寿命、累計100終了のbrowser検証。終了後の演出と停止したボールを区別 |
| N01–N02：自己ベスト・通常通知 | rally-noticeとbrowserのbest/通常数字、再演出防止、200%文字、320px/横画面、通知と警告 |
| 音声5条件 | rally-audio単体、audio/audio-layered/audio-fanfareの実Web Audio波形・graph・終了/再開/voice上限/警告優先検証。製品音声変更なし。新CIのWAV/JSONを保存、人間の試聴は未実施 |
| ゲーム計算・入力 | simulation-isolation/rally-through-play等で0→4001、実RNG/events/snapshot・球速/加速/衝突/バウンド/スマッシュ/30球。低画質native1280×720で9位置のtap/dragを両engineで検査し誤差1CSSpx未満 |
| PR26・ランキング・再試行 | 44段階result-comments、順位/自己ベスト、X共有、通信失敗/再送/匿名/再読込、pause/retry/load/release。通信は既存stub/遮断を維持し、本番スコア送信なし |
| 資源 | 固定buffer/material/geometry上限、長時間load・再試行、native audio source/node回収のCIを通過。有限時間の測定であり、任意時間のリーク不在を証明したとはしない |

## 見た目と操作

[事前許容条件](visual-acceptance.md)に対し、9段階×3時点×2画質×2engineの108組を比較。標準RGBA完全一致、全snapshot/effect state/stats一致。低画質の3加算batchの各色寄与比0.963996–1.071015（規定0.85–1.15内）、標本白中心の最小227。phone402×874の追加12組は全RGBA一致。これらは2球のresample画像なので、それだけを30球の見やすさの証明とはしない。

独立レビュー指摘を受け、[native連続比較](native-visual-acceptance.md)を追加。両engine/両コード/両画質で実物理・autoplay3999→4000、30球、6秒375frameを同じ16ms内容clockで進めた。低画質は全frameをnative1280×720スクリーンショット、標準は各engine1枚のcontrolを保存。**実時間の性能動画ではない。**1500組の全状態/events/resources/警告/CSS座標が一致、752画像組で判定0件失敗。各engineで可視警告106frame、幾何的に重ならない白中心94標本（incoming48/outgoing46、9ID）、変更後最小221を確認した。全11250ball-frame中の除外数も保存し、重なった全30球の知覚を保証しない。

最初のnative v1は339件失敗のまま保存。RAF間の初期化で232組に1固定step差があり、白中心失敗107中105は状態不一致。残り2件は重なる球で実際に226→192となった観測であり消していない。v2はRAF callback timestampで初期化し、baselineだけで投影した保守的な球境界で重なりを除外した。220/200の明るさ閾値は変更せず、最初の失敗を後から成功へ置き換えていない。独立レビューが修正理由・全状態一致・選択画像を確認した。

低画質の輪郭は解像度低下により柔らかくなる。演出の数・色・動き・時間、ゲーム座標は同じだが、画素完全一致や全視認性同等を主張しない。代表native画像をAIでも確認した。人間の視認/連続運動の快適性/実機入力遅延は未確認。

## 光安全性

変更後18scene、比較用の変更前390/1000両画質4scene、計7920frame（各60Hz/6秒）を既存の閾値・解析器で検査。既存14sceneと同条件の標準7sceneはRGB全frame hashが旧記録と一致。低画質では点滅面積の増減があるため「悪化なし」と包括的に断定しない。

一次解析の保守的警告は変更後7件。従来の1500両画質/3000低/4000両画質の5件を保持し、追加した1000両画質の2件は変更前でも同じ警告。390両画質は警告なし。高頻度点滅面積はすべて21824未満。変更前後の最大面積増加は390低6594→6890（+4.49%）、1500低7616→7899（+3.72%）などで、分類は変わらなかった。

追加の固定field診断は変更後7件・変更前1000の2件とも同一位置1秒内count<=3、赤0。しかしこれは一次警告を解除しない。規範的WCAG適合、HDR、眼球運動/視距離、CSS全体、人間の光知覚、iPhone実機の安全性は未確認。reduced-motionの装飾抑制は維持。詳細は[flash-report.md](flash-report.md)。

## 敵対的検証と実機

独立した計測レビューと最終敵対的レビューを実施。計測初期化・GPU回収・CPU/GPU区別・音声実生成・再集計・変更前後のhash・入力/画像を検査。HTTPのiPhoneテスト入口でUUID APIがない問題を両engineで実再現し、test専用互換処理とエラー記録を追加して4テスト成功。上記native画像不足と初期化誤差も修正し、失敗を保存した。レビューはAIによる独立検査であり人間試聴/実機検査ではない。

[iPhone単体で後から測る手順](iphone-procedure.md)を準備済み。1500/2600/3000/4000、30球、手動入力、音声、発熱前後、文字拡大/VoiceOverを対象とする。test用スコア操作・計測表示はtest fixtureのみ。本番公開やDB/認証/ランキング仕様の変更は行っていない。

## 最終16条件：全測定を保持

[元データ](final-performance/) / [再集計](final-performance-summary.json) / [実行log](logs/final-performance.log)。1500/2000/3000/4000×標準/低×2、各計測window60秒以上、warmup3秒、full/profile:false、30球、通常物理。全16でsourceStable、全sample running/30球、全10秒区間に実native音源生成、例外/外部要求0。最終productionはb697a98。GPU/詳細CPU時間は正式長期計測ではnullとし、別のprofiled診断と混ぜない。

| 開始ラリー | 画質 | 回 | p50 ms | p95 ms | p99 ms | <=25ms割合 | sim秒/60実秒 | 絶対目標 |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 1500 | standard | 1 | 100.0 | 183.4 | 250.0 | 13.20% | 50.792 | 未達 |
| 1500 | low | 1 | 66.7 | 133.4 | 166.7 | 10.31% | 55.910 | 未達 |
| 2000 | standard | 1 | 100.0 | 216.6 | 250.0 | 12.11% | 47.806 | 未達 |
| 2000 | low | 1 | 66.7 | 133.3 | 166.6 | 10.02% | 56.469 | 未達 |
| 3000 | standard | 1 | 100.0 | 216.6 | 283.3 | 13.48% | 47.888 | 未達 |
| 3000 | low | 1 | 66.7 | 149.9 | 166.7 | 13.97% | 55.166 | 未達 |
| 4000 | standard | 1 | 100.0 | 200.1 | 233.4 | 12.54% | 49.446 | 未達 |
| 4000 | low | 1 | 66.7 | 149.9 | 183.3 | 12.74% | 55.370 | 未達 |
| 1500 | standard | 2 | 100.0 | 200.0 | 233.3 | 11.84% | 50.694 | 未達 |
| 1500 | low | 2 | 66.7 | 133.4 | 166.7 | 11.18% | 55.189 | 未達 |
| 2000 | standard | 2 | 100.0 | 200.0 | 233.3 | 10.49% | 49.987 | 未達 |
| 2000 | low | 2 | 66.7 | 133.4 | 166.7 | 10.63% | 55.792 | 未達 |
| 3000 | standard | 2 | 100.0 | 200.0 | 266.7 | 11.02% | 48.926 | 未達 |
| 3000 | low | 2 | 66.7 | 133.4 | 166.7 | 11.39% | 55.989 | 未達 |
| 4000 | standard | 2 | 100.0 | 200.0 | 216.7 | 11.18% | 50.044 | 未達 |
| 4000 | low | 2 | 66.7 | 133.3 | 150.1 | 10.01% | 56.212 | 未達 |

**16/16で絶対基準失敗。** 動作継続・収集処理の完走を性能合格へ読み替えない。標準p95は183.4–216.6ms、低133.3–149.9ms。低でも59秒目標未達。中央値だけでなく全反復を示す。比較改善率は事前の18回交互測定から算出し、この最後のmatrixを都合よく混ぜない。

### 初回部分区間の扱いを開示

従来runnerのindex0は`RAF timestamp − performance.now(start)`であり、2番目以降の`RAF timestamp − preceding RAF timestamp`とは異なる。final010ではindex0が−4.1msだった。原値・失敗した監査v1を保存し、負の値を物理的フレーム間隔として扱わない。以前から保存していた「先頭を除く感度分析」を、今回観測後に全18交互+全16最終のp50/p95/p99/25ms割合へ一律に適用して主要なフレーム分布とした。元の全値を含む指標もJSONに保持した。計測collectorや対象コード、duration、simTime、測定の採否、性能閾値は変更していない。

全34回でp95は元集計と同値、全6組のp95改善率・sim差、全絶対未達判定は変わらない。計測windowは全回60秒以上だが、完全なRAF間隔だけの集計spanは交互59.681–60.131秒、最終59.864–60.248秒である。この分布の端点と計測windowを混同しない。

### ゲーム時間の遅れとの対応

[追加監査](frame-budget-audit.json)は既存`fixedDt=1/120`・`maxStepsPerFrame=12`（100ms上限）を変更せず、同じRAF間隔から既知状態以降の進行を再構成した。全34回・23613区間のstep差は0件不一致。未知の初期端数と最初のanchorの破棄量は除外し、covered wall/sim/loss/final remainderを記録。これは自動返球・入力flushなしの記録に限る。manual入力やiPhone記録へ一般化しない。

描画待ちが長いと、既存の追いつき計算上限でゲーム内時間が遅れる機構を裏付ける。描画待ち自体の原因をこの監査から特定したり、上限変更を正当化したりはしない。`clippedFramesAfterAnchor`は解析側の浮動小数点演算で正のoverflowを数えた派生値で、100ms境界の微小端数に依存する。nativeのclamp発生回数を直接記録した値ではなく、因果推定にはstep差・進行時間・保存則を使う。

### 音声の追加実波形

変更後に既存のbyte同一probeで140native offline renders（各engine70）と終了impact4対照を再実行。全成功、最大peak0.322451234、最大fading込みvoice16、全node解放。終了impactと対照の最大差は約1.32e−24。専用1000/3000/4000、best/loss、mute/zero/quiet/fallback、重複warning残差を保存。[新WAV/JSONとsource hash](audio/)を参照。これは新しい波形検証であり、旧WAVを新実行として扱っていない。人間試聴は未実施。

### 保護対象と資源の照合

[保護対象・配布物監査](protected-and-distribution-audit.json)で、Bから変更された製品ファイルがquality.tsだけ、残り59ファイルがbyte同一であることを確認。実際のCI root build7ファイルに今回の診断marker混入0。Pages/root両配布は別途8release検査成功。[全34回の資源範囲](resource-stability.json)も保持し、最終16ではgeometry57/プログラム17が各run内で一定、取得heap26.0–29.4MBだった。これは有限60秒と既存再試行/load検査の範囲であり、任意長時間のリーク不在の証明ではない。

[独立最終レビュー](final-adversarial-review.md)は元コード・全34raw・比較画像・正式logを参照し、指摘と修正の履歴を保持する。数値の機械可読な主要列は[interval-statistics-policy.json](interval-statistics-policy.json)で宣言し、plain列を旧境界込みの参照値として残す。

## 最後の補助コードCIも成功

補助分析・保存コード006b5456af88b72ab7875bb1035034c968b43149の[CI40266770076](https://github.com/chameleonjp-lab/takkeu/actions/runs/40266770076)も全6job成功。実checkout61556b4e897a133c479d1c07a4ff1ce564085eadは006b545と全tree同一。959unit/72files+200browser+8release=1167件成功。4browser reporterを全件再集計し、retry/skip/flaky/unexpected/top-level errorはすべて0。追加のroot配布物7ファイルも診断marker0を照合した。

[最新CIの全5ZIP・1037member照合](ci/006b/verified-artifacts.json)、[200browserの再集計](ci/006b/test-verdict-audit.json)、[実行対象との対応](ci/006b/source-equivalence.json)、[全workflowログ](ci/006b/workflow-logs.zip.parts.json)。2026-11-25のActions期限後も同一ZIPをpartsから復元できる。中間7ba8004のCI40266515854も全6job成功、全workflowログと状態をci/7ba8へ保存した。中間browser artifactは再び巨大複製せず、期限付きGitHub側記録と正式006b/b697長期保存セットを区別する。

最終archiveで250実行入力（全non-docと2integrity checker）を006b545と照合し、分析3scriptも同じbyte/hashであることを確認。[archive-provenance.json](archive-provenance.json)を参照。文書だけのskipは成功CIではない。source/tests変更を含むb697と分析/保存コード変更を含む7ba/006bにはskipを使っていない。
