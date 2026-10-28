# 個別承認と本番適用手順

**A/Bは未承認・未適用。backup未確認。まだマージ公開可能ではない。** PRの承認／マージと、本番DBの事前変更承認を混同しない。

## A: 原殿堂migration

- project `mlpnjgezrnhdxsxolyzj`、database `postgres`、owner `postgres`（実測NOSUPERUSER、CREATEROLE、CREATEDB）。
- [原SQL](../../../supabase/migrations/20261027032043_takkeu_hall_of_fame.sql) SHA256 `b6a9828852e3b87840348814559353dec8b0286d6d6642dee7952b4fe9ef009b`。
- [オフライン生成器](../../../scripts/release/prepare-production.mjs)の `migration-approved-only.sql` SHA256 `72536610960ad68664bd6da96de48de81832c4287eb3df4a296abc3627fffdc9`。
- 4表、既存sessions 2列、10関数、2trigger、21制約（NOT NULL以外）、8index、counter 2行、対象履歴1行。新sequence 0。殿堂の初期行0。
- 12:20 UTC観測：players3831、game_scores3774、score_runs18848、sessions11712（takkeu11676）。直前に再取得。既存行の更新／削除／分類書換え／旧4000超縮小なし。sessionsには新列NULL/falseの意味を追加する。
- 依存・本文・ACL・default ACL・event triggerを含む最新6契約区分は既存baselineと一致。名前衝突0、long transaction0、対象lock待ち0。score_max100000000を維持。
- sessions ALTERと共有score_runs trigger等のロックで他ゲームの書込みが短時間待つ可能性。lock_timeout5秒、statement_timeout120秒、自動再試行なし。単一REPEATABLE READ transaction内で事前契約・原payload・履歴・事後契約・既存行fingerprint・counter初期状態を照合する。
- 途中失敗は全ROLLBACK。COMMIT後は旧正常クライアントと追加DB契約を残し、別承認の前進修正。自動down migration／番号巻戻し／共有DB全復元を行わない。

**backup確認が必要**：既存backupの最終成功時刻、保持期間、復元担当者、復元確認／テスト実績。現在のMCPにはbackup一覧取得経路がなく、管理APIの資格も提供されていないので、確認済みと捏造しない。PITR等の課金機能を新規作成しない。共有DB全復元は他ゲームの新規記録も失い得るため通常の復元手段にしない。

承認は「Aの正確な生成SQL／上記影響を承認」とbackup確認を記録してから。承認後も直前の本番再監査がbaselineと違えば適用を中止し、差分を再審査する。無関係migration一括適用やdb pushは使わない。

## B: 固定GET検査API（Aとは別承認）

- [個別SQL](../../../supabase/migrations/20261028124434_takkeu_release_rest_inspector.sql)は公式CLI2.122.0のmigration newで生成したファイルへ、オフライン生成器の固定SQLを格納したもの。
- SQL SHA256 `6cd7f3b046aee78e960d64363f14ac8b9c1b1e3490bd9c4f96180d6b1d8a7d34`。
- 新role1（NOLOGIN/NOINHERIT/非管理者）、関数1（引数なしSTABLE）、そのrole限定のgames SELECT policy1、履歴1行。
- schema USAGE2件、SELECT8列（games6＋履歴2）。関数の3role EXECUTE。既存PUBLIC・ゲーム関数・他ゲームpolicyの変更0。新table/column/index/trigger/sequence 0。既存業務行の更新／削除／追加0。
- 関数は最小所有者へ移転。postgresに対するcreator SET membershipとpublic CREATEをtransaction内のみで一時付与し、COMMIT前にSET=false／INHERIT=falseとCREATEなしにする。PG17が自動作成するcreator ADMINは維持する。最終的な実効membershipの受領者は信頼済みpostgresだけ（ADMIN=true/INHERIT=false/SET=false）。anon/authenticator等のmembershipは0。
- CREATE ROLE／policy／functionの重複は拒否し、途中失敗は全ROLLBACK。原migrationと同じく個別の単一transactionで適用し、必要な履歴だけ1行追加する。
- 関数の返却は固定project、時刻、nonce、read_onlyと不透明SHA256だけ。任意SQL・オブジェクト名指定・ゲームRPC呼出し・プレイヤー行読み取りは0。空search_pathの代わりにpg_catalog固定と全対象schema修飾を用いる。
- [信頼境界](design.md)のとおり、意図的に偽装するDB管理者への独立attestationではない。通常の本文／ACL／grant option／所有者属性／双方向membership／policy変更は検出する。

復元：適用中失敗はROLLBACK。COMMIT後の異常は公開を停止し、既存ゲーム・殿堂を残す。緊急停止が必要なら、この新APIだけのEXECUTE剥奪を別途具体的承認して行う。全撤去は、当該関数の本文／所有者／ACLと追加依存を再確認し、当該関数・policyだけDROP、列／schemaの当該role GRANTだけREVOKE、当該新roleだけDROP、当該履歴1行だけ削除する順序で、別途復元SQLの個別承認を受ける。DROP OWNED/CASCADE、他role／他ゲーム変更はしない。roleへ未知の依存があれば全撤去を中止する。

## 本番実行と証拠

1. A/Bを別々に承認し、SQL全文とSHA256を承認記録へ固定する。Aのbackup確認も必要。
2. 対象projectを認証済みAPIで再取得し、owner/default ACL/全依存/既存行数/lock/衝突/履歴をREAD ONLYで再確認。
3. 承認されたSQLだけを実行する。GitHub Actionsには管理者資格を置かない。SQLに含まれる正確なversionを履歴へ記録し、ツールに別versionを自動追加させない。適用途中の失敗なら接続を終了しREAD ONLYで部分適用0を確認する。
4. 本番を新しく取得して原migrationの6区分の完全一致と、Bの所有者属性・双方向membership・8列GRANT／grant option・policy・本文hash・履歴を独立カタログから確認する。
5. `node scripts/release/check-database-rest.mjs` を実際の公開キー・本番GET/HEAD経路で実行する。リダイレクト／認証／timeout／応答不整合／schema-cache欠落は停止。登録・開始・終了・採番用のPOSTは行わない。
6. 旧正常版のrelease.json／HTML／JS hashを再確認する。DB追加によって公開版を変更しない。
7. A/B成功をREADMEとPRへ記録。backup、Environment、CI、配布、レビューも全成功の場合のみReady for reviewへ移す。

## Secrets／Environment／料金

新Secret0、既存Secret変更0、Environment変更0、外部有料サービス0。GitHub Environmentはmain限定・追加reviewerなしを毎回再確認する。新たにreviewer／wait timerが設定されたら勝手に解除せず、追加承認が必要なため公開を止める。Secrets一覧403は、不要な資格が存在すると仮定する理由にも、設定完了と偽る理由にもしない。新方式はSecrets値を参照しない。
