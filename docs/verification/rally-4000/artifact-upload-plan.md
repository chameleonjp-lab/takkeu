# Gitへの記録・アップロードのグループ案

**計画のみ。** この文書の作成ではgitのstage/commit/push、artifact変換/削除、巨大hash照合を実行していない。baseline/initial/finalの3matrixは保存済みで全target未達。4000遅延悪化のP1とGPU原因調査はopen。CのCI4全6job成功と全archiveは取得済み。Draft PRも未作成。

| 順 | グループ | 含めるもの | 揃える条件 |
| --- | --- | --- | --- |
| 1 | 最終コードと対象test差分 | 最適化を採用する場合の実装、既存layout caseへ追加したbest/2600 assertionと対象ログ | 最終source SHAを確定。`0285168…`のCIと後続差分の検証を区別し、新sourceなら影響範囲を再検証 |
| 2 | 小さいレビュー記録 | README、coverage、pr-body（全38+音声5行）、各review/report、比較JSON、進捗、保護integrity、変更一覧 | `PERFORMANCE_P1_OPEN`を実測/保留の正確な結論へ更新。Draft URLは作成後だけ実値へ変更 |
| 3 | 性能の正式原データ | `baseline/chromium/`、`baseline/chromium-clean-repeat1/`、`after/chromium/`のreporter/measurement `.json.gz`、全ログ、source/fixture証明、再測定があれば別directory | 初回17before/16afterを上書きせず保持。実行成功とtarget両方0/16、4000悪化、再測定sourceを明記 |
| 4 | CIの原証拠 | `ci/40232449369/`の失敗、`ci/40234298364/`と`ci/40235973827/`の全job/JSON/selected記録、全artifact/workflow ZIPのcanonical partsとmanifests | 各exact SHA/全6job/全5artifactを対応。旧ZIPの重複コピーを追加する必要はなく、既存の復元可能なpartsを記録 |
| 5 | 光の失敗・原因調査 | `safety/worst-first/`、修正1/2/3、ablation/CPU pixel診断、captured source、正式analysis、lossless partsと照合記録 | 失敗結果・原flags・解析器・sourceを保持。最終成功として名前や判定を書き換えない |
| 6 | 最終14clipと追加診断 | `safety/final-primary-index.json`、final regular/fireworks/worst V4/low、全source/run/capture/analysis、lossless動画parts、固定field5診断 | 14scene/5040frameとsource stable、一致RGB/part manifestsが揃う。原9通過/5aux警告と追加2/2/2/2/1を併記し、規範的適合は未確認 |
| 7 | 実画像・native音声 | `evidence/{chromium,webkit}/`の全画像/metadata/contact sheets、best/2600追加画像とJSON、`audio/`のprobe/全測定JSON/保存WAV | before/during/after/no-repeat、通常2600の両engine証拠を保存。AI観察と人間試聴未確認を分離 |

グループはレビューしやすい記録単位で、gitの実際のcommit数を固定するものではない。各groupで必要なmanifestと対応partを同じ記録に含め、後から到着するpartへの依存を曖昧にしない。大きいbinaryは既存の32MiB以下canonical partsとmanifestを使い、再圧縮や画素/フレーム省略を行わない。ソースのcopyは実装ファイルではなくcapture時点の証拠として扱う。

記録前の最後に、重い計測が止まってから`python docs/rally-4000/refresh-report-index.py`で実ファイル一覧と保護照合を再生成する。手で作ったグループ表を実際の変更一覧の代用にしない。source/testリンクは最終検証SHA、文書/画像リンクは`feat/rally-4000-effects`へ合わせる。最適化の最終判定と必要な記録が揃ってからDraft PRを用意する。マージ・公開・DB変更は含めない。
