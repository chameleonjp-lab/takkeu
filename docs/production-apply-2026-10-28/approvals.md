# 本番A・B承認パケット

未承認・未適用。バックアップ未確認。現時点ではマージ公開不可。

## 固定するSQL（全文）
- [A原SQL](../../supabase/migrations/20261027032043_takkeu_hall_of_fame.sql): `b6a9828852e3b87840348814559353dec8b0286d6d6642dee7952b4fe9ef009b`
- [A適用SQL全文](migration-approved-only.sql): `72536610960ad68664bd6da96de48de81832c4287eb3df4a296abc3627fffdc9`
- [B適用SQL全文](../../supabase/migrations/20261028124434_takkeu_release_rest_inspector.sql): `6cd7f3b046aee78e960d64363f14ac8b9c1b1e3490bd9c4f96180d6b1d8a7d34`

最新main `a2354abb69516c4f146e241f68556accce05491a` から再取得・再生成して一致。既存生成器をメモリ上で実行し、公開ファイル読取とSHA256以外のI/Oなし。適用前にGitHub ActionsのNode24でも同じ生成器とhashを照合する。

| 承認 | 対象/影響 | 適用中の失敗 | COMMIT後 |
|---|---|---|---|
| A（未承認） | 4表、sessions2列、10関数、2trigger、21制約(NOT NULL除外)、8index、counter2行、履歴1行 | 全transaction ROLLBACK後READ ONLY再取得 | 追加schemaを残し別承認の前進修正。全DB復元/採番巻戻しなし |
| B（未承認） | NOLOGIN role1、固定GET function1、限定SELECT policy1、schema USAGE2、SELECT8列、履歴1行 | role/GRANT/policy/function/履歴を全ROLLBACK | 公開停止。APIのEXECUTE剥奪・全撤去は具体的SQLの別承認 |

AとBは独立した本番SQL承認対象。依頼文、PR作成、レビュー、PRマージは本番SQLの承認として扱わない。

## バックアップ（Aの必須前提）
認証済みMCPにはbackup一覧/復元履歴/復元権限の取得機能がない。対象projectのACTIVE_HEALTHYはbackup成功の証拠ではない。
所有者確認画面: https://supabase.com/dashboard/project/mlpnjgezrnhdxsxolyzj/database/backups
1. 最新backupの成功状態と日時(UTC)
2. 保持期間と復元可能日時の範囲
3. 復元対象(database/Storage metadata/実体を区別)
4. 復元担当者と実行可能な権限
5. 既存の復元確認/テスト日時と結果（未実施なら明記）
6. 適用中失敗はROLLBACK。COMMIT後は通常前進修正。全DB復元は他ゲームの以降の記録を失い得るため別承認・保守計画で行う
PITR等の新たな有料機能は有効化しない。バックアップ未確認ならAは承認を得ても実行しない。

## A適用契約
project `mlpnjgezrnhdxsxolyzj` を認証済みAPIで確認後、DB/current_user `postgres` で実行。ownerは実測NOSUPERUSER/CREATEROLE/CREATEDB/BYPASSRLS。
単一 `BEGIN ISOLATION LEVEL REPEATABLE READ`〜`COMMIT`。lock_timeout5秒、statement_timeout120秒、advisory xact lock、再試行なし。
事前/事後6区分契約、重複/部分適用拒否、履歴1行、業務5表の同一snapshot fingerprint、新台帳空/counter各1をtransaction内部で検証する。
共有sessions ALTERとscore_runs triggerにより他ゲームの書込みが短時間待つ可能性がある。既存score/分類・旧pending/3000・過去3500超・score_max100000000は変更しない。
COMMIT前失敗はすべてROLLBACKし、別のREAD ONLY観測で部分適用がないことを確認する。

## B安全性・適用契約
引数なし `public.get_takkeu_release_contract_v1()` のみ。GETかつREAD ONLYを必須とし、任意SQL/識別子を受け取らず、player/score/秘密情報を返さない。公開応答はformat/project/read_only/nonce/時刻と不透明な6契約hash/self hashのみ。
SECURITY DEFINER所有者 `takkeu_release_inspector` はNOLOGIN/NOINHERIT/非管理者。games6列＋履歴2列SELECTとschema USAGE2だけを追加。既存PUBLIC権限・既存game関数のGRANTは変更しない。
postgresのcreator ADMIN=trueは保持するが、transaction内の所有権移転後SET=false/INHERIT=falseとpublic CREATEなしを検証する。双方向membership、grant option、本文/設定、policy/RLSを検証する。
単一BEGIN〜COMMIT。lock_timeout5秒、statement_timeout120秒。NOTIFY pgrstのschema cache更新を含む。既存業務行の変更0。
故意に自己検査を偽装するDB管理者への独立attestationではないという既存の信頼境界を維持する。

## 実行経路と証跡
SQL全文を1回のraw SQL呼出しで渡し、明示transactionを維持する。自動migration履歴追加のapply_migration/db pushは使わない。SQL内の正確なversionだけを記録する。
承認・backup・直前カタログ/ロックを確認後のみ実行し、A成功後にBへ進む。契約不一致/lock異常は承認済みでも中止。
本番COMMIT/履歴/検証時刻は実行後だけ記録する。未実行を成功としない。
現在の認証済みREAD ONLY観測: [catalog](evidence/production-catalog-before.json)、[audit](evidence/production-audit-before.json)、[migration履歴](evidence/migrations-before.json)。

## テスト
既存CIでPG17 A適用/重複拒否/rollback/旧データ/並行登録、Bの非superuser所有権移転・権限改変・実PostgREST・別承認撤去を実行する。テスト中のACL変更やgame書込みは使い捨てDB限定。本番はREAD ONLY。
本番gateは実APIで実行し、A/Bが欠ける現在は失敗を期待する。成功前にReadyへ移さない。
