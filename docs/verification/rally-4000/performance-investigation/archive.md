# 証拠の保存と復元

元のPR27検証記録は削除していない。この追補は2026-10-26の新しい試験系列を保存する。正式測定、失敗、計測方法の修正前、採用しなかったindex化、native画像v1の失敗を残す。集計値だけから元データを再生成したものではない。

| 証拠 | 保存先・形式 |
|---|---|
| Stage1全対照・計測環境 | environment.json、diagnostics-v2/、diagnostics-v3/、affinity4/、frozen-before/、各plan/runner/log。各frame、非同期query、source/test hashをgzip JSONで保存 |
| index化の不採用 | indexed-paired/全16回、frozen-indexed/、geometry比較、indexed-verdict.md。commit58ab1b0とrevert94a90b1を保持 |
| 採用変更の交互比較 | quality-paired/全18回、quality-paired-plan.json、quality-paired-summary.json。全frameと音声/heap/CPU countersを保持 |
| 最終性能 | final-performance/全16回、final-plan.json、final-performance-summary.json。絶対失敗を除外しない |
| DPR2音声補足 | dpr2-audio/全4回とplan。先の音声空の診断もquality-diagnostics/に保持 |
| 9段階とphoneの静止・時間差画像 | resolution-visuals.tar.gz.part-*、parts.json、resolution-visuals-members.json。1202ファイル。byte同一ファイルはtar hardlinkで重複排除し、全memberを復元してSHA照合済み |
| native30球連続画像 | native-visual/（v1FAILED）、native-visual-v2/（有限scopeで成功）。全metadata、375frame×4LOW sequence/版、標準control画像、全比較row、helper原文/ハッシュ。動画parts+サンプルPNG |
| 点滅 | flash/index.jsonから22sceneへ。13個の新RGB sequence、同じ全RGBの9sceneは既存または新保存先を参照。全capture/provenance/一次360row/固定field診断/警告を保持 |
| 新音声波形 | audio/。140native+終了impact4対照、WAV、全測定値、開始/終了source hash。probeは既存audio/probe.mjsとending-impact-probe.mjsのbyte同一コピーで実行、同じコードの巨大再複製はしない |
| CI | ci/。各workflowの全job log ZIP、正式b697の5artifact ZIP、全1037member CRC/SHA、GitHub digest、commit.txt、再集計。最新の補助コードCI結果も別項で照合 |
| 独立レビュー | measurement-review.md、implementation-review.md、final-adversarial-review.md。初期指摘と各addendumのscopeを残す |

## 分割ファイル

巨大バイナリは最大32MiBへ分割。各`*.parts.json`に元のbyte数・SHA256、各partのSHA256、復元コマンドがある。例：

```sh
cat capture-lossless.mp4.part-* > capture-lossless.mp4
sha256sum capture-lossless.mp4
```

出力hashがmanifestの`originalSHA256`と一致することを確認する。ZIPはその後展開し、CIのverified-artifacts.jsonのmember SHAとも照合できる。tarはhardlink先を含めてまとめて展開する。32MiB分割は内容を切り捨てる処理ではない。

## 画像と動画

連続PNGは既存packerのlibx264rgb/CRF0を使用。エンコード後に全動画をRGB24へ復号し、元全frameと同じ連結RGB hash・byte数を確認してから密なPNG列を圧縮保存へ置き換えた。`lossless-verification.json`に元PNG hash、RGB hash、動画hash、フレーム数がある。元PNGコンテナの圧縮byte列まで同じファイルを再生成する保証ではなく、復元対象は全RGB画素である。代表PNGは直接閲覧できる。

flashの`raw-reference.json`は、時刻/寸法/fps/全RGB hashが一致した別保存先を指す。現在の実行元・解析・警告は参照先へ混ぜず別々に残す。参照先の分割/単一動画のbyte hashも照合した。既存の小さなreduced-motion動画は単一MP4だったため、分割形式だけを認めた初回保存処理は停止した。その失敗logと7ba8004版を残し、単一動画も既存検証manifestで照合する修正を006b545で通常CIを起動した。

## 保持期限とCIの区別

GitHub Actionsのb697 artifactは2026-11-25期限（30日）。ここに保存した同一ZIPのpartsとmanifestはActions期限後もgitから復元できる。候補a180の全workflow logとcore artifactは履歴として保持し、巨大な中間browser artifactを同じ製品コードの正式b697セットと重複保存していない。中間runのGitHub側artifact期限と最終保存済み証拠を区別する。

性能対象b697とCIの6ee5216はrepository tree同一。後続の補助分析・保存コードを含む7ba8004/006b545は`[skip ci]`を付けずCIを起動した。重い証拠ファイルだけの後続archive commitは文書保存であり、そのCI skipをテスト成功とは呼ばない。全non-doc入力と追加解析scriptの同一性・対象SHAを最終provenanceに記録する。

local一時ファイル、展開したCIコピー、エンコード前と同じ画像の重複、node_modules、ブラウザcacheは成果物へ入れない。原測定・解析・正式失敗log・再構成に必要なbyteは省略しない。元の閾値、ゲーム規則、正式警告は保存処理で変更していない。

最新006b/CI40266770076も全6job成功。5artifact ZIP/1037memberと全workflowログを別の同一性検証付きセットで長期保存した。期限は2026-11-25。中間7ba8/CI40266515854は全workflowログと成功状態を保存し、同じruntimeの中間browser artifactを再複製していない。

[全保存ファイルの最終SHA一覧](artifact-file-manifest.json)は、自己参照するmanifest本体とその監査stdoutだけを除き、この追補の全ファイルを読み直してhashを記録する。part hashを各parts.jsonと再照合し、元ファイルの連結hashは作成時に検証済みのmanifestと結び付ける。[119元測定のbyte照合](raw-measurement-retention.json)と併用する。
