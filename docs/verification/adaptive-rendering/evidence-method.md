# 正式記録と復元方法

最終sourceは`b0b6760610c17dc5a1f19efebf42049a31df1150`、比較元は`6ec38720b4f720c71bf48c5aef3cdc5732fdd578`。記録の追加commitはdocsだけで、実行済みsource/test/config/packageを変更しない。CIの成功はb0bと実PR merge checkout e7424bcへ結び付ける。記録commit自体がCIで検査されたと偽らない。

## 保存形式

`evidence/manifest.json`は全file/CI member/内容object/partのbytesとSHA256を持つ。内容が同じファイルはSHA256で一度だけ保存し、過去の証拠と同じ場合は不変6ecのfileまたはCI ZIP memberへ参照する。新objectをtar+gzipし、8MiBのpartへ分割した。同じ巨大な既存音源・画像・CI証拠を再度全量保存しない。

通常5,930fileとCI12,888member、計18,818個/6,644,483,018bytes相当を保持した。新しい内容は6,630object/4,232,923,325bytesにまとめ、旧file92参照・旧CI member8,268参照を再利用する。圧縮後は3,634,514,451bytes、434part。既に圧縮された動画/traceが多く、重複を除いても大きい。[集計](evidence-build-summary.json) / [全復元の結果](restore-verification.json) / [独立復元監査](archive-review.md)。

GitHub CIのprovider ZIPはダウンロード時にAPIのdigest・bytes・ZIP CRCを照合し、正式log/JSON/画像/動画/traceを**memberのexact bytes**で保持する。元ZIPコンテナのtimestamp/圧縮形式そのものは保存/再現しない。この区別をmanifestの`originalZIPContainersRetained:false`へ明記する。

動画はlibx264rgb CRF0で保存し、全decoded RGBのSHA256/全bytes/全frame数を元撮影画像と一致確認してから原PNGを整理する。元の画素が復元できることと、元PNG圧縮コンテナが同じbytesで作れることは区別する。代表frameは元の縦横比で残す。既存動画を参照する場合は、新しい全360frameのRGB一致に加え、元part/whole video/decoded RGBの再復元照合を行う。

## 復元

このディレクトリの `restore_evidence.py` はアーカイブに含めた `runners/evidence-cas.py` と同じ検証器である。

過去の巨大証拠まで最初から取得しない場合は、partial/sparse cloneで本資料だけ取得できる。

```sh
git clone --filter=blob:none --sparse --single-branch --branch feat/rally-4000-effects \
  https://github.com/chameleonjp-lab/takkeu.git takkeu-evidence
git -C takkeu-evidence sparse-checkout set docs/verification/adaptive-rendering
cd takkeu-evidence
```

```sh
python3 docs/verification/adaptive-rendering/restore_evidence.py verify \
  docs/verification/adaptive-rendering/evidence /workspace/takkeu-reference-cache \
  --restore /workspace/takkeu-restored-evidence
```

最初の復元では、参照した6ecの旧file/CI ZIP partsをGitHubからcacheへ取得し、そのSHA256を確認する。cacheがそろった後は再利用する。全新part→archive→object→ordinary file/CI memberをSHA256で確認し、元CI ZIPは`.zip.members/`以下へ展開して復元する。nested trace ZIPもexact member bytesのまま残す。安全な相対pathだけを許可し、manifest外のtar memberや重複を拒否する。

旧動画の再復元は、復元した `runners/restore-flash-references.py` に `manual-flash` とcache pathを渡す。whole videoはcache内に作られ、元のframeはffmpegでdecoded RGBから取り出せる。正式な復元検証のcommand/log/結果/SHA256は、同じディレクトリの復元記録から参照する。

この旧動画用runnerはroot内の検証結果JSONを書き換えるため、再検証する場合は`lossless-reference.json`だけ別のscratch rootへ同じ相対pathでコピーして渡し、復元した正式原本を上書きしない。Python3とffmpegを使い、10本すべてのpart/video/decoded RGBは今回の正式検証で一致済みである。

## 記録への入口

| 資料 | アーカイブ内の主なpath |
|---|---|
| 最終性能 | `manual-performance-derived.json` / `manual-performance.csv` / `manual-performance/` / `manual-paired-repeat/` / `manual-original16/` / `manual-phone-performance/` / `manual-long-stability/` |
| 不採用auto | `adaptive-adoption-rejected.json` / `playable-performance-derived.json` / `withdraw-adaptive-source-map.json` / `playable-*` / `stage2-adaptive-adoption-review.md` |
| 38canvas+音声5の対応 | `manual-effect-decisions.{json,csv}` / `manual-catalogue-{A,F}/` / 6ecの144 native音源参照 |
| 視認/入力 | `manual-render/` / `manual-native/` / `manual-native-input*` / 各runner/plan |
| 資源/失敗 | `manual-resource-audit/` / `manual-resource-audit-initial-unequal-warmup/` / `manual-release-env-failure*` / `baseline-slow-frame-failure.json` |
| 点滅 | `manual-flash/` / `manual-physical-flash/` / `manual-final-safety-derived.json` / `old-flash-*` |
| 撮影手順の失敗・修正 | `manual-physical-flash-initial-clock-mismatch/` / `physical-flash-initial-clock-mismatch.json` / `physical-flash-clock-correction.json` / `physical-flash-aligned-launch-failure.json` / 元runnerと全log |
| CI | `ci-official-index.json` / `ci-all-checkout-tree-proofs.json` / `ci/*/run.json`・全78job log / `ci/downloads/`等の61provider artifact member |
| レビュー/保護 | `manual-protected-source.json` / `final-whole-branch-review.md` / `revised-stage1-code-review.md` / `stage2-adaptive-adoption-review.md` |

CIは13attempt/78full job log、全完了checkoutの14tree証明を保存した。cancel/failure/修正前のsourceも各SHAと区別する。provider artifactは61個をdigest照合し、同一内容をCASで再利用する。ダウンロードの一時署名URLや認証情報は正式記録へ保存しない。

閲覧用[性能JSON](performance-summary.json)は正式derived JSONの同一bytesコピーで、55実行と別枠の履歴profile参照を含む。CSVはstandalone39観測と履歴profile16参照で、従来16条件はJSONの別summary/正式attachmentを参照する。公開CSVはGit表示用にCRLF→LFだけ正規化した。全cell一致・前後SHAは[csv-newline-normalization](csv-newline-normalization.json)に保存し、元の正式CSVはCAS内でbyte不変である。

## 測定の再実行

package-lockと各source SHA、ブラウザversion、CPU quota/cpuset、drawing size/DPR、入力planとcommandを原logから合わせる。最終版と6ecを別checkoutにし、同じnode_modules/ブラウザを利用する。runnerは復元データをrepoの`artifacts/adaptive-rendering`へ配置すると、repoのnode_modulesを解決できる。plan内の絶対root pathを配置に合わせ、同じviewport/開始score/入力/音声/60秒/反復/閾値を保持する。

本番公開ページへ計測用scoreを注入したりランキングを送信したりしない。保存runnerはtest-onlyのlocalhost fixtureと外部通信遮断を使う。通常配布物へ診断panel/score setter/テストURL parameterを追加していない。

primaryはprofileなし、profile診断は別。GPU query/CPU timer/readback/collectorの原価をゼロと扱わず、ソフトウェア描画を物理iPhoneへ一般化しない。開始scoreから実物理と得点は進む。静止ablation/明示clock画像/実60秒性能の役割を混ぜない。
