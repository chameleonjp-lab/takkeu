# 独立した承認A–Dと操作手順

**未承認のため本番操作を行っていない。** 以下は対象と影響をレビューする資料であり、実行依頼ではない。新ブランチのマージも所有者の判断が必要。

## A:対象migrationだけの適用

- プロジェクト: `mlpnjgezrnhdxsxolyzj`、DB postgres、適用所有者 **postgres**。service_roleや別所有者に置換しない。これをGitHub Actionsへ渡さない。
- payload: `supabase/migrations/20261027032043_takkeu_hall_of_fame.sql`、SHA256 **b6a9828852e3b87840348814559353dec8b0286d6d6642dee7952b4fe9ef009b**。
- 永続変更: public2表、private2表、既存sessions2列、public8/private2関数、2trigger、NOT NULL以外21制約、8index、counter初期2行、履歴1行。hall初期行0。新sequence0。
- 既存全session11701行の論理値にNULL/falseを追加。shared score_max100000000、既存スコア/first/best/分類/イベント/旧pendingの書換え・削除・backfillなし。取得行数/サイズはREADMEと証拠の時刻を確認し、直前に再取得する。
- ロック: sessionsのALTER/CHECK検証は全ゲームにACCESS EXCLUSIVE。FKはplayers/sessionsを参照し、score_runsのCREATE TRIGGERも共有書込みを待たせ得る。5秒lock timeout/120秒statement timeout案。実測サイズとメンテナンス枠を承認し、自動再試行しない。
- ownerのdefault ACLを確認する。postgresのpublic新表はservice_roleへTRUNCATE/REFERENCES/TRIGGER/MAINTAINを継承し得る（RLSはTRUNCATEを防がない）。supabase_adminのALLデフォルトで代替しない。anon/authの新表直接権限は全て剥奪、API8関数のEXECUTEだけ明示grant、SECURITY DEFINER/空search_pathを確認。
- **backupは未確認**。Supabase Dashboard→Database→Backupsで既存の最終成功時刻、保持期間、復元対象、実行者、復元テストを所有者が確認する。課金/PITRを勝手に有効化しない。共有DB全復元は他ゲームの新規記録を失うため通常のrollbackにしない。

承認後の所有者操作例（このセッションでは実行しない）:

```sh
# 生成はオフライン。SQLを表示・レビューして生成物のSHA256も承認記録に固定する。
node scripts/release/prepare-production.mjs
sha256sum supabase/migrations/20261027032043_takkeu_hall_of_fame.sql artifacts/production-preparation/*.sql
# 認証済みの対象プロジェクト再監査、backup確認、owner/default ACL/衝突ゼロを確認してから:
PGHOST=db.mlpnjgezrnhdxsxolyzj.supabase.co PGPORT=5432 PGDATABASE=postgres PGUSER=postgres \
  PGSSLMODE=verify-full PGSSLROOTCERT=system \
  psql -X -W -v ON_ERROR_STOP=1 -f artifacts/production-preparation/migration-approved-only.sql
```

passwordは端末のプロンプトへ入力し、コマンド・ログ・PR・GitHub secretsへ管理者資格を載せない。直接hostのIPv6が利用できなければ、Dashboardで取得した正確な対象poolerと所有者資格を別途照合する。証明書検証は無効にしない。

生成器は対象hashを固定し、BEGIN REPEATABLE READ、owner/DB照合、同対象advisory lock、部分適用/名前衝突/履歴/依存contract照合、原SQL、対象履歴1行、transaction内の完全な事後contractと既存行fingerprint/空台帳/counter1を確認してCOMMITする。無関係のmigrationや`db push`は使わない。DDLは一つのDO/SPI実行に含み、途中失敗なら全transactionをROLLBACK。SQL生成器自体は接続/実行機能を持たない。

エラー時は接続を閉じ（未COMMITはrollback）、READ ONLYで履歴/全対象表/列/関数/triggerを再監査する。IF NOT EXISTSで黙って部分適用を補完しない。COMMIT後はROLLBACKで戻らないため、新API/台帳を維持し、前進修正と旧クライアント継続を優先する。DROP/down migration/履歴削除/台帳番号の巻戻しは別の具体的承認なしに行わない。

## B:ロール・権限の準備

**現在は安全な本番接続方式が未確定のため、B全体の実施準備完了とは判定しない。** A8と普通の新roleだけで新gateが通ることはない。pg_catalogや他ゲーム全体へのPUBLIC剥奪は提案しない。

B1候補: reviewed-public-rpcs.jsonの正確な8関数だけ。読取り5/書込み3を区別し、既知匿名クライアントとSainome serviceの契約を保つためanon/authenticated/service_roleにEXECUTEを先にgrantしてPUBLICから除く。8 ACL変更、最大24個の利用role明示grant（多くは既存）、関数本文/owner/引数/default/戻値/language/strict/search_pathは変更0。テーブル/データ変更0。生成物`scoped-public-approved-only.sql`は現在の正確な本文/設定/ACLに違いがあれば中止する。全て単一transaction。

復元は`restore-scoped-public-approved-only.sql`。変更後のACL/本文/実行設定が計画どおりであることを確認して、同じ8関数の元ACLへ戻す。新しい正当なgrantがあれば勝手に消さず停止する。全文SQL/対象一覧は[PUBLIC監査](public-privileges.md)。サポート外SQLロールや外部callerの不在は未確認のため、所有者による確認と個別承認が必要。匿名/認証/service3roleの局所実行結果一致は全外部利用者への保証ではない。

B2設計:専用`takkeu_release_reader`、既存role変更なし。安全な接続境界を確定した後にのみ検討する例:

```sql
-- PROPOSAL ONLY. 単独ではPUBLICのlarge-object等を拒否できず、本番適用しない。
CREATE ROLE takkeu_release_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
GRANT CONNECT ON DATABASE postgres TO takkeu_release_reader;
GRANT USAGE ON SCHEMA public, supabase_migrations TO takkeu_release_reader;
GRANT SELECT (game_slug,is_active,submission_mode,score_order,score_min,score_max)
  ON public.games TO takkeu_release_reader;
GRANT SELECT (version,name) ON supabase_migrations.schema_migrations TO takkeu_release_reader;
CREATE POLICY takkeu_release_config_v1 ON public.games FOR SELECT TO takkeu_release_reader
  USING (game_slug='takkeu');
```

対象は新role1、policy1、schema2、構成table1の6列・履歴table1の2列・DB CONNECT。private行/プレイヤー/スコアSELECT、sequence、変更/CREATE、他role membershipは不要。既存PUBLICの読取りRPCも継承する点を開示する。default_transaction_read_onlyは補助設定で、実書込み不可の証明ではない。LOGIN/passwordの有効化もDB変更なので承認Bの対象に含め、Secret登録Cと区別する。

新roleの復元は、接続利用者を停止しactive接続0と依存を確認後、当該policyだけDROP、上記に列挙したgrantだけREVOKEし、**この作業で新規作成したroleだけ**DROPする案。DROP OWNED/CASCADE、既存role削除、無関係ACL変更、強制切断は使わない。追加依存があれば停止して別判断とする。資格更新時は新旧credentialの有効範囲と無効化をB/Cで分けて承認する。

## C:GitHub EnvironmentとSecrets

対象repositoryはchameleonjp-lab/takkeu、environmentはgithub-pages。現状main限定、required_reviewersなし、管理者bypass可。secret名metadataは403で未確認、値を取得しない。

- 安全性を実証した接続だけのPGHOST/PGPORT/PGUSER/PGPASSWORDを、`TAKKEU_RELEASE_PGHOST`/`TAKKEU_RELEASE_PGPORT`/`TAKKEU_RELEASE_PGUSER`/`TAKKEU_RELEASE_PGPASSWORD`という4 environment secretsへ所有者が登録する。今は接続方式未確定なので登録しない。
- Settings→Environments→github-pagesでsecret名を確認する。CLIなら`gh secret list --repo chameleonjp-lab/takkeu --env github-pages`（値は出ない）。登録はWeb UIのSecret値入力または安全なstdinを使い、コマンド引数/チャット/ログへpasswordを渡さない。管理者/postgres/service_role資格で代用しない。
- Required reviewersはpublic repositoryではFreeを含む対応planで利用可能というGitHub仕様に基づくが、実設定の保存/実待機は未検証。現在API上は未設定。独立reviewerのGitHub loginと権限を所有者が指定する必要がある（取得した協力者は所有者のみ）。prevent_self_review=true、can_admins_bypass=false、main限定を推奨。所有者本人だけをreviewerにしてself-review禁止にすると全公開が停止する。
- 手動実行者は現workflow上chameleonjp-labのみ。二者承認を追加してもapprove_production/full SHA/main/CI/DB照合を削除しない。actor制限を変えるには別コードレビューが必要。
- 変更前の環境JSON、reviewer/branch設定、secret名一覧を保存。Secretの旧値はAPIで復元できないため、既存値を管理者の承認済み保管先に確保してから置換する。復元は保存した環境設定と保管資格で行い、値をログへ出さない。
- 設定後GET environment/deployment-branch-policiesとSecret名一覧を再取得。required_reviewers/prevent_self_review/bypass/main制限/4名を確認する。権限403なら所有者UIによる証拠が必要。未承認の本番dispatchで保護動作を試さない。実待機確認は承認Dのrunで行う。

## D:3500版の手動公開

**現時点では承認を求められる公開可能SHAは未確定。** 観測main754b71bc…はDB/接続未準備で公開不可。新PRを所有者がマージした場合はmain SHAも変わる。Dの対象はその時点で再取得した小文字40桁SHAで、A/B/Cの承認をDと解釈しない。

公開前チェック:

- [ ] Aの履歴/全新旧表/RPC/列/trigger/owner/search_path/GRANT/RLS、shared max、旧契約がREAD ONLY検証に一致。
- [ ] 安全な検証接続で本番catalog全契約が一致し、過剰権限/未知routine/LOB等の拒否条件に該当しない。認証/timeout失敗を迂回しない。
- [ ] 現在mainと承認対象/checkoutが完全一致し、最新main push CI成功、root/Pages実配布成功。
- [ ] Environmentを再取得し実際の承認者/branch/bypass/Secret準備を確認。
- [ ] 前の正常公開SHA628439f5907601c9b34ee2ba01f70c918b6e8d18と成果物を確保。公開中のmain/DB schema・ACL変更を凍結する。
- [ ] ユーザーが**対象SHAを明示してDを承認**。

D承認後にのみ所有者がActions→Pages release→main、expected_sha=<承認済みSHA>、approve_production=trueで実行する。検査失敗は停止して旧成果物を維持する。公開済み成果物はrunのcancelだけでは戻らない。

## COMMIT/設定/公開後の読み取り確認

1. authenticated READ ONLY監査でmigration履歴と全対象オブジェクトを照合し、catalog.sql/expected-contractと比較する。初期counter1は実登録前だけで、稼働後は安易に1へ戻さない。
2. PostgRESTのOpenAPI `GET /rest/v1/`を公開クライアントと同じroleで参照できるなら、8 RPCの署名/公開経路を確認する。応答や権限が不明なら未確認として止める。GETとして安全な一覧RPC以外、開始/終了/送信/登録をテスト呼出ししない。schema-cacheの反映も確認する。
3. 専用接続の実ユーザー、membership、CREATE/表/列/sequence/履歴書込み、到達可能routineと閉包を読取り確認する。実書込み可否の負例試験は使い捨てPG17で行い、本番へテスト行やLOBを作らない。
4. GitHub environmentを再取得し、承認済みDだけを実行。成功後はキャッシュ回避付きrelease.json、HTML/配布JSのSHA256と参照先/200/必要v2識別子を照合する。
5. 本番のブラウザ確認では開始ボタンを自動で押さず、不要な匿名開始記録も発生させない。実プレイ・送信・賞状/殿堂の確認は、ユーザーが行う工程として分ける。

## 復旧

未公開の失敗は現在の旧版を維持する。公開済み不具合は、正常ゲーム内容へ戻す別PRを検証しユーザーが承認/マージ、復旧後mainの新SHAに別のD承認で手動公開する。SHA照合を迂回して過去SHAを直接公開しない。DBは原則追加契約を維持し、新旧クライアント/pendingを残す。

migration未COMMITの失敗はtransaction全rollback。COMMIT後の不具合は公開停止・前進修正が基本。台帳/番号/score/分類/旧pendingを削除せず、全DB復元で他ゲームの新しい記録を巻き込まない。権限B1だけの復旧は正確な8 ACL復元SQLを使い、変更後driftがあれば停止。全て対象・件数・影響・復元方法を再提示した個別承認が必要。
