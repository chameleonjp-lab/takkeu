# PR30後の本番公開準備

**本番への変更・公開は未承認、未実施。公開停止を維持する。** コードと検証の準備、本番DB/環境の準備、実際の公開を別々に判定する。

## 最新の観測

認証済みGitHub GETとSupabase `BEGIN READ ONLY`、2026-10-28 10:04 UTC以降の観測。値・URL・取得時刻は[evidence](evidence/)に保存。日本時間は+9時間。

| 対象 | 結果 |
| --- | --- |
| main / PR30マージ | `754b71bc7aa6ce982a4ceb7221ad14fabd600c95` |
| main CI | [40657102956](https://github.com/chameleonjp-lab/takkeu/actions/runs/40657102956)、completed/success |
| Pages workflow | workflow_dispatchのみ。push公開なし。最後の新仕様run40604783819はcancelled |
| 公開版 | `628439f5907601c9b34ee2ba01f70c918b6e8d18`、release.jsonと配布JSを取得。JS SHA256=`c42fe62394310206964276fd77b6aacc5d47c0f6616c84a4a91e6fc05327d879`、3500識別子なし |
| Supabase | `mlpnjgezrnhdxsxolyzj`、migration20261027032043・新旧殿堂4表・2列・8 RPCなし。部分適用/衝突なし。既存契約は再取得時点でPR30 baselineと一致 |
| 構成 | shared、score_min=0、score_max=100000000。既存スコアは縮小/削除しない |
| 行数 | players3831、score_runs18838、game_scores3774、全session11701（takkeu11665）。観測中も正規トラフィックで増える |
| サイズ | players622592B、score_runs9502720B、game_scores1359872B、sessions5398528B。サイズ/推定行数と正確なcountは取得時刻が異なる |
| takkeu分類 | normal3071、hidden1、provisional_bot3。既存provisional最大45773300を観測。これを3500へ縮小しない |
| GitHub環境 | main限定。required reviewersなし。can_admins_bypass=true。協力者GETでは所有者のみ |
| Secrets | 名前のメタデータGETが403。未設定とは断定しない。値は取得していない |
| backup | この連携では既存backup/PITRと復元実績を確認できない。承認Aの阻害要因。課金機能は有効化しない |

## 今回の変更と根拠

ゲームsrcと既存殿堂migrationは変更しない。PR30の手動承認・完全SHA・main/CI・配布物・同一run・concurrency条件を維持する。

1. 通常ロールがPUBLICの標準large-object関数で永続領域を作成できることをPG17で再現。roleのdefault_transaction_read_only=onも本人が解除できた。本番では関数を実行せずACLだけ読んだ。ゲートは該当能力を拒否する。
2. スキーマ複製にscore_runsのGENERATED ALWAYS AS IDENTITYが落ち、実送信が失敗することを再現。identity/generated属性を契約へ加え、削除時の拒否と正しい複製での実送信を検証する。
3. 独立レビューのSTABLE→VOLATILE呼出しによる書込みを再現。属性だけで読取りと判断せず、現在PUBLICから到達する7読取りroutineと内部helper1件の正確な本文・実行設定を照合し、未知の非volatile routineも拒否する。既存VOLATILE拒否は残す。
4. 対象migrationだけを単一transactionで適用/履歴記録/事前事後契約照合/既存行fingerprint比較する**オフラインSQL生成器**を用意。接続も自動適用もしない。
5. PUBLIC8件の限定変更と正確な復元SQLを用意し、anon/authenticated/service_roleの実呼出しをPG17で比較。新ゲートの値を固定したり検査を削除したりしない。

## PUBLICと接続方式の結論

[詳細調査](public-privileges.md)。PUBLICで呼べる通常VOLATILEは8件（読取り5・書込み3）。5件を悪意ある書込みとは判定していない。Sainome/Saisupi/Binkarabin等の公開クライアントと、デプロイ済みSainome service_role利用を確認した。外部SQL利用者/旧クライアントすべての不存在は証明できない。

| 案 | セキュリティ | 他ゲーム影響 | 運用・復元・継続利用 | 判断 |
| --- | --- | --- | --- | --- |
| A:8件だけを先に3利用roleへGRANTしPUBLIC EXECUTEを除く | 対象application書込みをreaderから除ける。しかし標準large-object書込みは残る | 既知3roleの動作は局所検証。その他caller未確定 | 小規模、正確なACL復元、本文/設定driftなら停止。将来のPUBLIC新関数はgateが拒否 | 独立承認Bの**条件付き提案**。これだけで接続準備完了としない |
| B:プロバイダ側で実際にread-onlyを強制する接続/限定監査API | 検証できればDB書込みを接続境界で抑止できる | 既存PUBLIC権限変更を避け得る | 既存提供手段/認証/最小権限/監査/復元/料金を先に確認。未確認の仕組みを実装済みとしない | 要件上は優先候補だが、この連携で利用可能な安全な実手段は未確認 |

**推奨する現在の判断は、公開を止めたままBの実利用可否を所有者と確認すること。** 有料replica/サービスの新設、他ゲームやpg_catalogへの広範囲REVOKEは提案SQLへ含めない。A8は有用な整理案だが、A8と新roleだけで厳格なgateが通るとは報告しない。新role設計は[承認B](approvals-and-operations.md)に示すが、接続方式未確定のため本番role/credentialは未作成。

既存の`supabase_read_only_user`はBYPASSRLS=trueとdefault_transaction_read_only設定を持つ。名前や設定だけでこの専用readerに流用しない。TEMP/自己role設定などを含む全PostgreSQL操作の形式的非書込み証明をgateのbool一つで主張しない。検査自身は固定SQL・READ ONLY・timeoutで実行し、既知の永続書込み能力があれば停止する。

## 検証資料

- `npm run typecheck`、全単体972件、生成/実sparse配置を含むguard13件、native gate30ケース、native migration/caller33チェックが成功。
- `node tests/helpers/checkReleaseDatabase.mjs`: PG17で正常契約、履歴/表/RPC/ACL/RLS/trigger/identity、権限不足、timeout、LOB/未知routine/間接書込みを検査。
- `node tests/helpers/checkProductionReadiness.mjs`: PG17で原SQL初回/二重/途中失敗・ROLLBACK、全件数、旧pending/4000超、新旧台帳、正式送信前拒否、3500/3000/3501/100落球、分類、直接アクセス、3role caller parity、限定ACL apply/restore・drift拒否。
- 既存`checkHallConcurrency.mjs`の**新規同名**/別名の同時登録と安定receiptも維持する。新helperの同名競合は既存番号の再利用であり、両試験を区別する。
- ゲーム/Chromium/WebKit/ビルド/Pages検査は通常CIで実行する。最終CI URLと結果はDraft PRに追記し、証跡時点のmain CIと混同しない。
- 負例のpermission denied/division by zeroログは意図した拒否で、最後の成功集計とexit 0を確認する。初回の実装/fixture不備と修正は[独立レビュー](adversarial-review.md)とログに記録する。

他ゲームのverified本体はこの複製で全機能再実行していない。必要なrowtype定義は複製し、Takkeu/sharedの実通過経路と対象RPCの既知callerを試験した。権限や呼出し元が不明な部分を「安全性確認済み」に変えない。

## 判定と残作業

- A: コード・検証準備は、Draft PRとCIの結果をもって判定する。接続候補未確定は明示した阻害条件である。
- B: 本番DB・公開環境の準備は未完了。migration・安全な接続・backup・Secrets/reviewersに未承認/未確認事項が残る。
- C: 3500版は未公開、公開後確認も未実施。現状の旧正常版を維持する。

阻害条件は4群: P0安全な接続方式、P0 migration適用/backup確認、P1 Secrets権限・独立reviewer選定、P1対象SHA公開承認。実施順は[承認A–Dと操作手順](approvals-and-operations.md)を参照。A/B/C/Dは互いの操作許可を含まない。


生成済みSQLの完全hash/byte数: [proposal-hashes.json](evidence/proposal-hashes.json)。[対象migration transaction](proposals/migration-approved-only.sql.gz)、[限定8件ACL](proposals/scoped-public-approved-only.sql)、[正確なACL復元](proposals/restore-scoped-public-approved-only.sql)は**承認用提案**であり本番未実行。オフライン生成器で同じファイルを再生成して比較できる。
