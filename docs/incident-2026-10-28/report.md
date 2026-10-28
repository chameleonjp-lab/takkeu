# 2026-10-28 タッケウ公開事故の抑止と再発防止

状態: **対象の未公開runをキャンセル確定。再発防止コードを準備。本番DB未適用・新クライアント未公開。** 「本番3500対応済み」ではない。新workflowはこのPRをユーザーがマージするまでmainへ反映されない。

## 現状と時刻付き証拠

取得値とURLは[evidence/final-observations.json](evidence/final-observations.json)へ保存。UTCに9時間を加えると日本時間。

| 項目 | 確認結果 |
| --- | --- |
| PR #27 | merged、`15df010f950b1ca8a1f803d523e3a9aee086396a`、2026-10-27 23:49:50 UTC |
| main | 同じ`15df010f950b1ca8a1f803d523e3a9aee086396a`、00:24:58 UTC頃再取得 |
| Pages #40604783819 | workflow ID=393025362、deploy.yml、同じSHA。作業開始時in_progress、公開job未開始を確認してこのrunだけcancel。00:03:06 UTCにcompleted/cancelled確定、00:24:58頃再取得 |
| main CI #40604783564 | completed/success、同じSHA、00:08:15 UTC更新。キャンセル対象外 |
| 最新成功Pages | deployment 7340699682、`628439f5907601c9b34ee2ba01f70c918b6e8d18`、2026-10-26 18:52:36 UTC成功 |
| 現在のサイト | 00:25:00 UTCにrelease.jsonと実HTML/JS取得。公開SHAは上の旧SHA。実JSにv2開始RPC/3500クライアント識別子なし、旧開始/匿名開始RPCあり |
| 本番DB | [読取り監査](evidence/production-readonly-audit.json)の時刻で履歴20261027032043なし、殿堂2表/カウンタ2表/8 RPCなし。共通ランキング上限100000000、shared/descを維持 |

run URL: https://github.com/chameleonjp-lab/takkeu/actions/runs/40604783819 。CI URL: https://github.com/chameleonjp-lab/takkeu/actions/runs/40604783564 。公開URL: https://chameleonjp-lab.github.io/takkeu/ 。対象DB: https://supabase.com/dashboard/project/mlpnjgezrnhdxsxolyzj 。DBの完全な対象定義/権限snapshotは`scripts/release/production-baseline.json`に保存（カタログ情報のみ）。

取消要求の受付と停止確定は区別した。要求直後はin_progressだったため繰り返しGETし、completed/cancelledを取得した。無関係のCI/runはキャンセルしていない。公開履歴・release.json・実JSも照合して、今回の成果物が公開されていないことを確認した。

## 原因と影響

旧deploy.ymlはmain pushでPages releaseを起動し、コード/配布物の検証後にDB確認なしで公開できた。SQLの承認待ちという文書上の注意はworkflowの公開条件になっていなかった。

- 3500クライアントの登録名あり開始は`start_takkeu_clear_play_v2`の応答を待つため、未適用DBでは開始に失敗する。終了/殿堂登録/殿堂一覧もv2へ依存する。
- 名前なしプレイは開始を殿堂RPCで待たず、既存のguest開始/再送経路を使う。ゲーム自体は遊べるが殿堂の読取りは未適用なら失敗する。今回の公開中旧版は新RPCを要求していない。
- 既存ランキング/自己ベスト/過去3500超/旧pending/匿名記録を削除・縮小していない。現時点の共有ランキングは正常3068、hidden1、暫定BOT3という読取り観測で、これを固定するテストや書戻しは行わない。
- 新pendingはルール/クライアント識別子で旧3000と分岐し、旧pendingは元のfinish/殿堂RPCを使う。保存キーや旧ランキング再送を変更していない。新3500が旧3000殿堂へ送られない既存テストも維持した。

## 変更した公開条件

自動CIを維持し、Pagesのpushトリガーだけを削除。所有者本人の明示的workflow_dispatch、完全SHA、approve_production=trueを必要とする。現在mainとcheckout/dispatchのSHA一致、最新main CI成功、再利用CI成功、root/Pages配布検証成功を要求する。CI API応答の欠落/異常も拒否する。

本番DB検査は公開job内だけ。TLS検証付きの専用最小権限接続で`BEGIN READ ONLY`し、履歴・構成・11表・22関数の本文/引数/戻値/definer/search_path、RLS/policy、列ACL、有効GRANT、制約/索引/triggerを照合する。全ユーザースキーマの変更/CREATE/sequence権限、他ロールmembership、可変RPC実行権限を持つreaderも拒否する。存在確認だけでは合格にしない。DB認証/権限/timeout/不完全適用は公開停止。

concurrencyは同じtakkeu-pagesで直列化。environment待機後にDBとGitHub証拠、配備直前にmainを再照合し、同一runの検査済み成果物だけをdeploy-pagesへ渡す。他workflowに公開権限/公開actionがないことも検査する。

`github-pages`のrequired reviewersは**現時点では未設定**。今回YAMLだけでenvironment承認が必須になったとは扱わない。実際の承認は所有者の手動実行と明示確認で担保し、二者承認の設定手順は[公開手順](../release.md)へ記載した。設定もsecret作成も今回行っていない。secret名一覧は403で未確認。

## DB適用前の監査と承認対象

[DB適用計画](db-apply-plan.md)に対象/件数/影響/安全性/復旧/検証を記載。migration自体は変更しなかった。

- 4表、2列、10関数、2trigger、21制約、8index、2カウンタ初期行を追加。既存スコア/分類の更新、過去殿堂backfill、既存maxの縮小はしない。
- 新3500はちょうど3500、落球0..99、正式送信済みのnormal登録名だけ。旧3000は別表/別RPC。カウンタ行ロックと一意制約、再送時の同じreceiptを検査した。
- 非冪等SQLなので、既存オブジェクト/部分適用を事前確認し、payloadと履歴を一つの明示トランザクションで適用する。既適用なら上書きせず追加migrationを検討する。日付だけの旧migrationもあるため、共有DBへ一括db pushしない。
- 専用readerの構成行SELECTには承認済みpolicy/列grantが必要。本番には他ゲームのPUBLIC実行可能なVOLATILE RPCもあるため、ロール作成だけでは最小権限にならない。対象/件数/他ゲーム影響/復元方法を監査して別承認で権限を準備するまで、本ゲートは失敗する。高権限接続での代用は禁止。

## 検証と限界

| 検査 | 結果 |
| --- | --- |
| 型検査/全単体 | 成功、87ファイル972テスト |
| 実YAML graph/実gate関数 | 成功、10テスト。push、DB未適用/一部、認証/timeout、古いSHA、CI失敗、配布失敗、無承認、main移動を拒否。全条件時のみdeploy actionの代替カウンタへ到達 |
| ネイティブPG17 DB gate | 成功、22ケース。空の本番スキーマ複製で実readonlyロール/権限不足/timeout/列grant/履歴write/可変RPC/依存欠落等を試験。本番接続なし |
| SQL機能/互換性 | disposable PGliteで旧新ルール、上限/落球、正式送信前拒否、旧4001 best、旧pending、RLS/GRANT、部分適用/重複/採番rollbackを成功 |
| ネイティブPG17同時登録 | 成功。別backend PIDによる同名/別名競合、再送receipt/採番数一致 |
| root/Pages実配布 | Chromium/WebKit計8件成功。OGP/実ファイル/開始/保存/開発機能非混入 |
| actionlint | CI/deploy両YAML成功 |
| ブラウザ全回帰 | 実行中。最終ログで更新する |
| GitHub上PR CI | Draft PR提出後に追跡する。公開dispatchは実行しない |
| 本番DB | カタログと構成/分類SELECTのみ。適用も機能テスト書込みも未実施 |

初回のローカル検証には環境起因の失敗があった。npm cache/browser保存先を/tmpへ変更し、node子プロセスのsandbox EPERMは許可されたローカル実行で再確認。WebKit標準OSライブラリ不足は使い捨てDebianから/tmpのブラウザ配下へ追加し、ldconfig事前検査だけを省略、**実ブラウザ8件は実行して成功**した。GitHub workflowの標準install --with-depsは維持した。native schema replicaのFK順序/接続DB名/RLS/search_path/出力改行のfixture不備も修正後再実行し、失敗を成功として数えていない。

[独立敵対的レビュー](adversarial-review.md)は3つの抜けを検出。CI不完全応答、列/履歴/可変RPC権限、progress/guest依存を補強し、再現テストとnative gateで検証した。レビュー担当が修正後の全suiteを独立再実行したとは扱わない。

GitHub実エンジンのmain push発生やenvironment approval待ち/実deployは、本番を動かさない条件のため未実施。ローカルgraphモデルを実GitHub配備の実行済み証拠と混同しない。main更新とPages API間の短い原子的でない境界は、公開中のmain/DB変更凍結でも保護する。実機の性能/音/演出など従来の未解決項目は今回の範囲外で、成功に変更しない。

## 復旧と残作業

今回は旧正常版が公開中なのでロールバック不要。仮に公開済みならキャンセルだけでは戻らない。正常な公開SHAを確保し、ゲーム内容を戻す別PRを検証後ユーザーが承認/マージし、復旧後mainの新SHAを別承認で手動公開する。DBは原則前進互換で残し、殿堂/ランキング/未送信保存領域を削除しない。DB適用中失敗はtransaction rollback、適用後は新クライアント公開停止・旧版維持が基本で、稼働後のDROP/逆migrationは件数/依存/backupを調査した別承認が必要。

ユーザーが承認する工程: 新PRのマージ、DB payloadの本番適用、最小権限接続/policy/PUBLIC権限整理とsecret登録、必要に応じenvironment二者承認設定、最後に対象SHAの本番公開。今回はmain直接push/マージ/自動マージ、本番DB書込み/採番/スコア送信、ロールバック、再公開、秘密情報作成、追加料金のあるサービス作成、Codex Cloud environments利用を行っていない。
