# Stage 3 — 最終検証

最終コードは`b697a98475e54dbc8c3a9458eafd7628d92dc062`。製品変更は`src/render/quality.ts`のみ。PR27開始時Bからゲーム計算・入力・加点・30球制限・終了条件・音声・43演出の状態生成・ランキング・自己ベスト・X共有は変更していない。採用した大画面低画質の比較改善と、残る絶対性能問題は[Stage 2](stage2-report.md)を参照。

## 判定を分ける

| 判定 | 結果と限界 |
|---|---|
| 機能 | CIの959単体+200ブラウザ+8配布物=1167件成功。Chromium/WebKit。下記の有限画像・native波形・入力検証で43演出を維持。人間/実機の知覚評価は未確認 |
| 絶対性能 | 正式交互比較18回はすべて25ms/95%/59秒目標未達。最終16条件は実行中。完了後に全行を追記する |
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
