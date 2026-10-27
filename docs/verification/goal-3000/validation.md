# 正式検証と修正履歴

## 実装と独立レビュー

設計の独立builder確認、SQL監査、client/PNG監査、最後の全体レビューを分けて実施した。[各報告](README.md)はコード・元ログ・PNG・PostgreSQL別backend記録を参照している。全体レビューはe2e8379時点でCritical/Importantなし、Minor G01（古い共有失敗の文言）を指摘した。最終検査・アーカイブはそのレビュー時点では未完であり、報告を後の成功扱いへ書き換えていない。

G01は再現ブラウザー試験を両エンジンでREDにし、epoch/file所有権の照合を追加してGREENへ直した。93294e8で共有済みのfileと現在の結果が一致する場合だけエラーを表示する。再挑戦・ホーム・新画像へ古いエラーを持ち越さない。

## 検査の履歴

|対象|結果|扱い|
|---|---|---|
|main統合時の型検査|成功|996b1e2|
|統合時の最初の単体|921成功/1失敗|sandbox内の子git実行制限。ログ保持|
|同一ソースの適切な実行環境での再検査|922/922成功|公開照合の基準は不変|
|3000終端の単体一式|929/929成功|cc5f8be|
|UI/再送/SQL等の単体一式|942/942成功|e2e8379および修正版の内容|
|初回の関連ブラウザー|36/36成功|Chromium/WebKit、PNG保存を含む|
|canShare例外再現|両方失敗→修正後追加4/4成功|RED・trace・動画を保持|
|G01共有応答の所有権再現|両方失敗→修正後関連44/44成功|93294e8|
|e2e8379の全216ブラウザー試行|157成功/2失敗/1中断/56未実行|既知の失敗を保持し修正版へ切替。全件成功とはしない|
|93294e8相当のローカル型/単体|型成功・942/942成功|製品コード固定|
|93294e8の通常/Pages配布物|両build・配布物検証・8/8 browser成功|開発機能混入なし|
|720c063の最終CI|型/単体942、browser218、配布8、PostgreSQL競合が成功|PR/pushとも全6job成功|
|PostgreSQL最終サーバー待ち修正版|3起動反復、同名/別名×3組の競合成功|720c063。30秒の期限・検査条件は不変|
|元の点滅解析自己試験|5/5成功|スクリプト・閾値不変|
|clear画面360×2の点滅解析|警告0|画素完全一致の追加試験とは別|

## CIで見つかった問題

e2e8379のpush `40446563006` / PR `40446576259` は失敗。追加された読み取りRPC get_takkeu_hall_v1が、旧通信一覧テストの期待3件に含まれていなかった。実際の全通信はmockされており、スコアの本番送信ではない。期待値へ新RPCとp_limit=30の厳密な検査を加えた。検査を削除したり外部通信を許可したりしていない。

93294e8のpush `40448414109` / PR `40448430299` はunit942件成功後、CIのDB起動試験で失敗。PostgreSQL公式imageは初期化中にsocket専用の仮サーバーを起動・停止する。socketでSELECT 1が成功した直後、その停止とfixture実行が競合した。image内のentrypointを確認し、最終サーバーだけが受け付けるTCP localhostへ検査接続を変更した。最終サーバーを待つ修正であり、SQLの検証・期限・性能目標を緩めていない。

両段階の失敗したjobログ・provider artifactとGitHubのSHA256 digest照合を保存する。skippedのmatrixは実行済みとしない。最終720c063のpush/PRの全件結果・checkout SHA/tree・artifact一覧は正式証拠のciディレクトリに収録する。

最終成功: [PR 40449517072](https://github.com/chameleonjp-lab/takkeu/actions/runs/40449517072)、[push 40449499893](https://github.com/chameleonjp-lab/takkeu/actions/runs/40449499893)。各coreでunit942と配布8、browser4群で各engineのinteraction106＋load3、合計218が成功した。全体の1168条件を二重の実行回数で水増ししていない。28の実行済みjobログと2つのskip metadata、6 workflow attemptを区別する。

## 証拠の独立監査

独立監査E01でrelease-resultsの収集先が44関連browser結果の誤コピーと判明した。誤コピーはmiscopied-release-resultsへ保持し、実際の8release結果とrun-artifactsを追加した。release-copy-correction.jsonへ由来とhashを記録し、テスト結果の内容は変更していない。最終CIの8releaseも別の正式根拠として保存した。

全1150fileを[14partのpackage](evidence-method.md)から復元し、元のpath/byte/SHA256と照合した。GitHub公式artifact22ZIPは元containerの全byteを保持し、公式digest/size/全member CRCも確認した。[独立証拠監査](evidence-review.md)は測定の元frame/heap、CI/log、失敗の保存、全part/object/fileのhashまで検査する。記録commitを新たな製品CI成功のSHAと称しない。

## 敵対的確認

|失敗の想定|確認|
|---|---|
|2999から30球で得点が超過|3000で一度だけclear。2969→2999では全30球の加点を保持|
|100落球とclearの競合|従来の時刻・bounce・ballId順を保持し、先に成立した終端を固定|
|終端後に物理や得点が進む|継続stepでsnapshot/events固定、appの3D renderも停止|
|旧開始/旧終了APIからの殿堂昇格|新rule/verified印なし、未送信、誤ID、旧version、score/loss不整合は拒否|
|同名/別名の同時採番|実PostgreSQLの別PID接続を競合させ、同名同番号・別名別番号・counterを照合|
|score受領後の通信断|scoreAcknowledgedを永続保持し、再読込後はHallだけを同じIDで再送|
|別結果に古い番号/画像/エラー|play/submission/nameとPNG/share epochを照合。RED→GREEN保存|
|名前が画像/DOMへコードとして入る|textContent・canvas文字・alt属性。20絵文字の実画像も確認|
|番号をローカルで予測|サーバー受領前は確認中。匿名/対象外は番号なし賞状|
|終了で到達音を切る|game-clearの音声tailとappのsuspend非実行を検査|
|試験の本番スコア送信|全browser通信をmock/abort、DBの書込みはローカルPGlite/一時PostgreSQLのみ|
|快適さ/警告解消の過大報告|Linux実行と実iPhone、静的終了と稼働中性能、画素一致と点滅を区別|

未確認は実機の音・タッチ感・共有保存・HDR/正式WCAG、無期限のメモリ挙動、今回未測定のnative性能。旧性能/点滅の未解決事項を[測定結果](measurements.md)に残す。
