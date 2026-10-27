# 3000クリア・殿堂: 独立最終証拠監査

2026-10-27。製品コードの再レビューではなく、source720c06357beff5e7bdfe0073fb35293c7f45b372の正式報告・元データ・失敗保存・CI同一性を監査した。対象はgoal-3000 README/validation/measurements/deployment/source-protection、clear-stabilityの全frame metadata/保存PNG/解析/heap、local44/8/942の元結果、6CI試行のmetadataと28全job log、provider ZIP、保護sourceのbyte/hash。製品編集・新テスト/GPU/browser/build・live request・本番writeは行っていない。独立監査ファイルは本書と `/workspace/goal-3000-{ci,clear-pixel,provider}-independent-audit.json`。

**現時点の報告内容に性能・安全性の過大な成功表示は確認しなかった。監査で見つかったrelease成果物の誤コピーは原本を保持して訂正済み。最終provider ZIPと新CAS archive/restoreは作成・受領待ちのため、本書末尾へ追補するまで監査完了とはしない。**

## source・CI・件数

- current source720c063のsrc treeと93294e8のsrc treeが両方 `0a1fe7a15bee03e9cb5fe14d8556068ba31159b8` で一致。src/tests/scripts/.githubに未commit差分なし。720c063はDB試験起動のTCP待ち修正で、製品srcは93294e8の内容。
- source-protectionのrender16fileをb0b6760と、protected12fileを75a3640と、それぞれ全byte/SHA256で独立照合し不一致0。render/ball/camera/input/loop/44comment保護の報告と整合する。新3000端末条件に応じたsimulation変更まで不変とは主張していない。
- 最終push40449499893、PR40449517072のmetadataは各6job全success。各jobの非空全文logがあり、型、942unit、218browser（106interaction×2+3load×2）、root/Pages build、8release、Postgres concurrency stepを確認。1コード検証セットは942+218+8=1168成功。PR/pushを合算した重複件数を独立機能数としない。local44caseはこの218の関連subset。
- PRの実checkoutは720c063自身ではなく `29b0dd1dba17bed19ab74d1a948db9c5e7f1f8a1`。core logのcheckout/ref/git logとartifact名で直接確認。source-ci-provenanceは6試行の各checkout/source fulltree一致を保存し、最終2runはいずれもtree `cf7ed7ee335830f52c72bcbea21b0088ffa25705`。local720c063 treeも同値。PR merge objectそのものはローカルにないため、checkout tree値は保存されたread-only GitHub metadataの照合資料に基づく。監査者がlive fetchを行ったものではない。
- e2e8379のpush/PRは各browser interactionで新Hall read RPCの期待漏れにより失敗、93294e8は各coreで一時Postgres socketサーバー停止との競合により失敗。6試行をまとめて『全て成功』としていない。e2e12+932四つ+final12の実job全文log合計28を確認し、skipped matrix2件を実行済みに含めない。
- e2e/932のprovider ZIP計12本は全て独立SHA256/sizeを再計算し、metadataのGitHub digest/sizeと一致。最終10本は受領中で後追補対象。

## 局所試験と失敗の保存

- corrected-browser-results/results.jsonは44passed/0skip/0unexpected/0flaky/0retry、top-level errors0。metadataのgitCommitはprecommit e2e8379のまま（修正中の実行）、corrected-source-sha.txtがcanonical93294e8を記録する。単に旧metadataを新SHAへ読み替えず、最終720c063 CI218の成功を現sourceの正式合格根拠にする。
- corrected-release.logはroot/Pages各buildと配布物verificationが93294e8、8release成功。final-unit.log/corrected-unit.logは942/942成功。最終CIにも同じ数の正式結果がある。
- 最初のe2e-full-browser-resultsを個々のtest resultから数え直すと216中157passed/2failed/1interrupted/56notrun、retry0。validationの内訳に一致。skipped統計57を57実行と扱わない。canShare例外とG01のRED logs/trace/videoも別ディレクトリで保持。
- 初回static pixel equalityの失敗logとchanged PNG群、当時のassertionを再構築したinitial scriptを保存している。再構築scriptはhistorical byte原本の実行時hashを証明するものではない。失敗をfixed/passに変えず、現scriptでもexactPixelMatch=falseを明示している。

### E01: release-results誤コピー（監査で発見・修正済み）

当初goal-3000/release-results/results.jsonは44caseのcorrected-browser-resultsと全byte一致で、正しいrelease8 JSONではなかった。監査で通知後、実装者が原誤コピーをmiscopied-release-resultsへ保持、actual artifacts/release-results.json(expected8)とrelease-testsを正しいrelease-resultsへ収録し、release-copy-correction.jsonに由来/旧SHA/同一先を記録した。

訂正後を独立再読し、release8passed/0skip/0unexpected/0flaky/0retry、誤コピー44も別名で残ることを確認。テスト結果の改変や元失敗削除ではなく、証拠収集のパス訂正。CASで同一bytesを重複保存しない予定。

## clear静止・メモリ・点滅の独立再集計

| 対象 | Chromium | WebKit |
|---|---:|---:|
| capture frames |360|360|
| different from reference |32|0|
| max channel delta |1/255|0|
| max changed pixels/frame |10|0|
| snapshot before/after |完全一致|完全一致|
| additional 3D renders |0|0|
| warmup/measured retry |5/20|5/20|
| resource pattern count in20 |1|1|
| canvas count / oldPNG src |1 / null|1 / null|
| capture exceptions/external |0/0|0/0|

frame metadataを全件読み、保存reference PNGと各changed PNGを独立decodeし、pixelSHA256・差分最大・changed pixel数を照合した。Chromium changed32枚は同じ1種類のpixel差、WebKitはRGBA形式で完全一致。各360frameのRGB24 bytes系列を再構築し、解析入力hashと一致した。

- Chromium RGB24 sequence SHA256: `e27bfad07064bdf9cd6697532c800b04c487b6e3b6f18458b4e36992422bc42b`
- WebKit RGB24 sequence SHA256: `14806930fc5b673507db2d16d3b756a4bc99af2f879826c97088e87526de0ab1`

このframe証拠はtest-owned2999/30のclear fixtureから撮影した静止結果であり、0から人が214秒プレイした映像ではない。別のthrough-play.jsonが0→3000、25684tick、sim214.033333秒、hit3000/clear1/最大30/落球0を記録する。tick内得点増加の最大15と、各hitの1加点を混同しない。214秒のnative real-time試験とは記載していない。

CDP heapの25rowからwarmup5を除き再計算し、12281008→12707424=+426416bytes、backing10128331→10128331=0bytes、20測定を確認。geometry55/texture4/program17/particle capacity8284は同経路で一定。virtual performance.memoryはnullであり、実GC/CDPの別測定と区別する。JS小増加の帰属・native image/GPU総byte・WebKit heap・無期限leak-freeは未証明と正しく報告している。

flash analyzerの現ファイルSHA256は `daf77a431d9585044b30b64fa6d2f2e2a452f6c0ca621e2c4466dd64d2551f5d` で解析metadataと一致。自己試験5/5 logを確認。各analysisは360rows、一般/赤flash count/面積/頻度の全関連値0、flagged=false。input RGB hashも上記独立再構築と一致。元解析器を監査者が新たに実行したわけではないが、入力同一性/解析row/スクリプト同一性を確認した。

exact pixel equalityはChromiumで未達のまま。差を1へ緩めて成功にするassertionはなく、点滅判定とは別の失敗として維持。旧7警告や旧real4000の警告は新clear0flagsへ読み替えていない。SDRの終端画面のscreeningであり、HDR/人間/実機/正式WCAG合格ではない。

## PNG・URL・報告範囲

公開資料のclear Chromium/WebKit、certificate Chromium/WebKitの4PNGをview_imageで実見。clear3000・『クリアテスト』・殿堂登録第7号・UTC初回日・今回落球0を確認。certificateは900×1200、clearは縦長ページの元比率。画像が模擬応答で、本番7号の実績ではないことをREADMEで明示している。旧best4001と今回score3000も別表示される。

goal-3000内Markdownの現19ローカルリンクを解決し欠落0。SQLへの../../../参照、specへの../../superpowers参照、画像4ファイルは実在。CI/公開のURLを監査者がlive取得していない。source-ci-provenanceのsource/checkoutとmetadata/logのID対応は一致している。archive追加後の新リンクは追補で確認する。

README/measurementsはnative p50/p95/p99/実60秒を今回未測定とし、旧4000同画質値を旧測定として引用する。引用表は旧adaptive-rendering/final-results.mdと一致。『新3000前の描画効率改善未立証』『旧性能目標未達』『iPhone実機/音/タッチ/画像共有/HDR/正式WCAG未確認』という限定は適切。静止後0renderをactive gameplayの60FPS成功と呼んでいない。

テストのDB書込みはPGlite/一時Postgresのみ、captureはlocal origin外abort/WebSocket close、raw external/errorsが0。新migrationの本番適用、merge、Pages公開を本監査は行っていない。『本番への書込みなし』はこの保存証拠・試験境界で確認する範囲であり、全外部サービスの独立履歴監査を行ったという意味ではない。

## この時点の残作業

1. 最終10provider ZIPのGitHub digest/size/CRCと正式results/実checkoutを受領後確認。
2. CAS archiveの全manifest entry、unique blobs、parts hash、復元と元byte一致を独立検査。
3. E01訂正・initial script再構築・旧証拠hash参照を含む保存範囲と新リンクを確認。
4. archive作成/記録commit後の実行入力不変を確認し、記録only commitを新CI成功と称しない。

上記が揃うまでfinal archive監査はpending。製品の新たな不具合や追加source変更を要求する所見はこの証拠監査からはない。


## 追補: 最終provider成果物受領・独立検査

最終push/PR計10ZIPを受領後、全ZIP containerのSHA256とbyte数をmetadataのGitHub digest/sizeへ独立照合し10/10一致。ZipFile.testzipによる全member CRC検査も不良0。各ZIPのartifacts/commit.txtはpush720c063、PR29b0dd1でjob logと一致した。

各runの4browser JSONは106+106+3+3=218件、core内release JSONは8件、全てskip/unexpected/flaky0・top-level errors0。unit942はcore全文logの成功値を別に確認している。独立結果は `/workspace/goal-3000-final-provider-independent-audit.json`。これで旧12+最終10=22provider ZIPのdigest/sizeを独立確認し、最終分はCRC/commit/結果JSONまで確認した。

残作業は新CAS archive/manifest/restoreと記録commitの入力不変性。前節の『最終10ZIP受領待ち』はこの追補で解消した。


## 追補: CAS・全復元の独立監査完了

完成したmanifest/全14partと、実装者が実際に全復元した `/tmp/takkeu-goal-restored` を独立に読み取って検査した。pack/restore/selftestの公開Python206行も読んだ。新しい製品試験やlive requestは行っていない。独立検査結果は `/workspace/goal-3000-cas-independent-audit.json`。

| 検査 | 独立結果 |
|---|---|
| manifest SHA256 |5327b2dc15759d79add06d2d7289c40bb957085f0fe1a84fd3be0047160d40f6、一致|
| part |14/14のbyte数・SHA・順序一致、全て32MiB以下|
| 結合archive |438866486bytes、SHA256 6dcc71ececb51141b26ddea17a694bb9a98da8796ac3c9e41310e1a489137c0d、一致|
| tar objects |全7266個の実size/hash/nameをstream読取、manifestとの集合一致|
| 元source files |1150path集合・全size/SHA一致|
| 実復元files |1150path集合・全size/SHA一致、余分/欠落0|
| 論理総byte |1097701583bytes、一致|
| provider元ZIP |22/22の復元byte SHA/公式digest/size/全member CRC一致|
| recipe |全fileのobject存在・length合計が一致|
| 不一致 |0|

restore-verification.json/pack.log/restore.logの集計と上記独立値は一致。ZIPのcompressed payload等を区切り、header/central-directory/data-descriptorを含む全区間の順番を保持するため、今回のprovider ZIPはcontainerそのものの元bytesも保持する。復元した22本全digest一致でこの主張を実証した。mtime/owner/permissionは対象外という文書記載にも整合する。

自己試験logを正式package内で確認し、空file/重複file/2ZIP共通圧縮payload/元ZIP完全復元/改ざんpart拒否/親path拒否が成功と記録される。監査者は自己試験を重複実行せず、実package全object/元file/実復元file照合を独立実行した。verify-onlyは復元先fileを作らないが一時領域にarchive/object cacheを書き込むため、厳密なfilesystem write0とは説明しない。

新packageの旧参照manifest SHA b7be8ecae0d850e4af0e27c12085a8593f1c8c5e99a6dd138e857d2442c6c5a6は実旧manifest bytesに一致し、archive SHA b345e28c6bf7f9ab11371e83a5cbe60258788d80123ac65f7dac504af3f7c9c0もその旧manifestのarchiveSHA256に一致。旧3.6GB archiveを今回複製せず、新packageは旧archive不要で1150fileを復元できる。

E01訂正原本/initial失敗/全6CI試行の失敗とskip/4独立JSON監査/各builder・SQL・client・全体レビューがmanifestの保存範囲へ含まれる。pack後の本追補とCAS独立監査JSONはarchiveへの自己参照を作らず外付報告とする。frozen元sourceへ後から追記していない。

この追補時点の新34ローカルリンクは、本書をpublic evidence-review.mdへ配置すれば解消する2本だけが未配置だった。他の32本は存在。実装者が配置後に最終link確認し、docs-only commitと720c063の実行入力不変proofを記録する必要がある。

**CAS/復元・正式結果の証拠監査は合格。残りは文書配置と記録commit後のsource-input照合。Chromiumのexact pixel未達、JS heap小増加、native FPS/実機/正式WCAG等の限定はそのままであり、archive成功を製品性能成功へ読み替えない。**


## 最終判定: 記録commit前の独立監査

最終レビュー配置前のstaged tree `7b17e4e9da7aca06eeaf973061141abeb9e5a824` とCI source720c063をgit treeで独立比較し、docs以外のroot21entry（src/tests/scripts/.github/package/設定等を含む）が全て同じmode/type/object SHAであることを確認した。staged変更41pathは全てdocs配下、unstagedのnon-doc変更0。追加される本レビューもdocs配下の報告だけで、製品・試験入力を変えない。独立比較JSONは `/workspace/goal-3000-staged-input-independent-audit.json`。

文書のverify-only説明も『復元ファイルを出力せずに検証（一時領域は使用）』へ訂正され、実装と一致した。新evidence-review.mdへの2リンクは本書をpublicへ配置する段階で解消する。記録commit後に最終non-doc比較を別途read-only確認するが、その確認のために報告を再帰的にcommitし直す必要はない。

**結論：正式結果・失敗保存・source/CI対応・元画像/解析/heap・全1150file/22ZIPの圧縮復元の証拠監査は合格。監査で見つかったE01誤コピーは履歴付きで修正済み。追加の製品修正要求はない。**

合格は証拠と報告の正確性についてであり、Chromiumの画素完全一致やnative性能の合格ではない。Chromium max1channel/10pixelのexact equality未達、JSheap+426416bytes、旧Linux性能目標未達、旧点滅7警告等の未解決、iPhone/人間試聴/タッチ感/HDR/正式WCAG未確認をそのまま残す。

最後の製品CI成功SHAは720c063（PR実checkout29b0dd1、全tree一致）。これから作る文書・archiveの記録commit自体を新しい製品CI成功と称さず、CI成功済み実行入力の不変性を根拠にする。Draft維持・本番DB未適用・main未merge・Pages未公開の境界を保持する。
