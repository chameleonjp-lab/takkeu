# 証跡の復元と対象SHA

`evidence/manifest.json` の `productHead` は製品・テストの最終SHA `fdbdf46b9d8b846db200a2895cf73a73f8e2f02d`。以降の証跡だけのcommitは製品検証SHAへ読み替えない。実60秒性能のafterは `1ac6943b04ab7278de0ab0fc772abcb195b7d9bc` で、最終との差分は狭幅/拡大文字の落球label折返しCSSだけである。

baseは `572b2e638a8e8c12498b26adbf69af9cb5144133`。`source-freeze.json` はbeforeの68入力がbaseのblobと一致すること、物理/難易度/入力/遅延停止/44段階コメントの18ファイルが最終まで不変であることを記録する。

リポジトリrootで次を実行して復元する。先に各partのbytes/SHA256もmanifestと照合する。archiveのSHA256は `8745d2df3c6649fe3b12115b126bf3ad2d8aba72310df91b209c6c33c275ad0e`、444053870 bytes、53 parts、249 files。

```sh
cat docs/verification/goal-3500/evidence/objects.tar.gz.part-* > /tmp/takkeu-goal-3500-evidence.tar.gz
sha256sum /tmp/takkeu-goal-3500-evidence.tar.gz
mkdir -p /tmp/takkeu-goal-3500-evidence
tar -xzf /tmp/takkeu-goal-3500-evidence.tar.gz -C /tmp/takkeu-goal-3500-evidence
```

復元後の各fileのbytes/SHA256はmanifestのentriesに記録してある。CIは別途 `ci-summary.json`、`ci-logs/*.log.gz` の完全job log（ANSI色指定を除去）、GitHub Actionsの正式なartifactを参照する。gzip logは `gzip -cd PATH` で復元でき、hashとbyte数はci-logs/manifest.jsonに記録する。CIログ中のPostgreSQL起動待ちのconnection refusedは、その後の競合検証成功とは区別する。

`before/after` は390×844・DPR1・各条件1回の**実時間60秒**。555開始・30球・通常fixed step・autoplay入力のみで、p95≤25ms、95%以上≤25ms、sim進行≥59秒、全区間30球の基準を変更しない。`visual-before/visual-after/render-load.json` は固定姿勢30球のrender+readback+PNG時間であり、実プレイfpsの測定ではない。`memory` と `memory-100` は仮想時計・CDP GC後の20/100 retryで、60秒性能の証拠ではない。

点滅は変更していない `tests/helpers/rallyFlashAnalysis.py` と同じ閾値を使う。各側4 scene×2品質、1024×768 SDR/sRGB、60Hz×3.2秒=192 frames。sceneは3000、3500、3200+loss100、3000+loss99。解析self-testは5件成功。過去の別corpusにある7警告を解消したという主張はしない。

点滅用の全frameは既存 `packRallyFlashEvidence.py` のlibx264rgb CRF0で `capture-lossless.mp4` に保存した。`lossless-verification.json` に元PNGのhash一覧、連結RGB24のhash、復号hash、commandを記録し、解析時のRGB24 hashとも一致することを確認した。解析済み3072frameすべてを復元可能で、代表PNGも保存する。再エンコードしたPNGのbyte列が元PNGと一致するという意味ではない。

```sh
ffmpeg -v error -i capture-lossless.mp4 -f rawvideo -pix_fmt rgb24 - | sha256sum
```

再解析する場合は60Hzの順序を保ってPNGへ復号し、同じcapture.jsonと解析器を使う。元capture.jsonは元PNGのhashを含むため、再生成PNGのbyte hashを元と同一とみなさず、lossless RGB照合記録も併せて残す。HDR、UI全体の正式適合、人間の視認/操作感、iPhone実機はこの解析の対象外である。

`preliminary` はunit検査と重なった旧測定、`intermediate` は最終採用しない途中測定を保持する。`validation` は途中の失敗と修正後のログを残す。最終結果に都合よく採用し直さない。memory-100のmethod文に残った「20回」はnumeric repeats=100/100行と矛盾していたため、原本をmemory.raw.jsonへ保存したうえでmetadataだけ補正した。測定行は変更していない。
