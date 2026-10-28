# 3500本番A・Bと最終リリース Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; request one independent whole-branch review. Track evidence in docs/production-apply-2026-10-28/.

**Goal:** 明示承認されたA・Bのみを本番へ適用・検証し、新PRの所有者マージだけで3500版を公開する。
**Architecture:** 既存の単一transaction SQL生成器、固定GET検査API、CI完了連動Pages workflowを継続する。新PR番号はGitHub発番後に厳密固定する。
**Tech Stack:** PostgreSQL17 / PostgREST / Node24 / GitHub Actions.
**Spec:** この依頼のStage A–D。SQL範囲と運用は docs/production-readiness-2026-10-28/merge-release/approvals.md にも記載。

## Global Constraints
- Project mlpnjgezrnhdxsxolyzj. A/B別承認。Aはbackup確認必須。
- main直接push、merge/auto-merge、無関係migration/db push、本番ゲーム書込み禁止。
- Cloud environments不使用。認証済みGitHub/Supabase接続とGitHub Actionsのみ。
- 新Secret、高権限CI DB接続、料金機能の導入なし。ゲーム仕様・src・assets・tests閾値の変更なし。

## Review Focus
- 旧PR32/33またはmarkerのPR番号だけを差し替えた偽装を拒否すること。
- A/B欠落、404、ACL改変時、PRをReadyにしないこと。
- 共有DB・旧pending・高スコア・分類と他ゲームACLを維持すること。
- 適用途中の失敗でDDLと履歴を単一transaction内ROLLBACKできること。
- COMMIT後の全体復元が他ゲームの新規記録を失わせる危険を別承認にすること。

## Task 1: 読み取り監査と承認パケット
- [x] 最新main、project、migration履歴、既存カタログ6区分、所有者、default ACL、行数/fingerprint、lock/collisionをREAD ONLYで取得。
- [x] A原SQL b6a98288…、A生成SQL 72536610…、B原/生成SQL 6cd7f3b0…を照合。
- [ ] 所有者からbackup6項目を取得。A/B別の承認を記録。
- [ ] 同内容を適用直前に再監査、変化時は中止。

## Task 2: 新Draft PRと公開認証
Files: scripts/release/release-target.json, merge-authorization.mjs, tests/helpers/mergeReleaseFixture.mjs, tests/release/merge-authorization.test.mjs, tests/release/workflow.test.mjs, .github/workflows/ci.yml.
- [ ] 最新mainから専用branch、証跡をcommit、新Draft PR作成、返却された正式番号を取得。
- [ ] 新番号・release・head_refを一体として固定。旧32/33と番号差替え拒否のRED→GREEN。
- [ ] PR/main CIに公開GET契約ゲートを加え、verifyがその成功を必須とする。
- [ ] 既存release guards、PG17適用/rollback、PostgREST、並行登録、全unit/browser/distributionを既存CIで実行。条件は緩めない。
Expected: SQLテスト・guardsはpass。本番gateはA/B未適用時に404でfail closed。適用後のみpass。

## Task 3: 承認後のA/B適用
Files: evidence/production-*.json, approvals.md (記録のみ; SQLは固定)
- [ ] A: backup/明示承認/直前契約/locksを確認後、生成SQL全文を1回のraw SQL実行へ渡す。履歴自動付与ツール不使用。
- [ ] COMMIT・履歴・6区分・既存fingerprint・台帳0件/counter各1を確認。失敗はrollback/部分適用0を確認。
- [ ] B: A成功・B明示承認後に固定SQL全文を単一transactionで実行。role/双方向membership/ACL/grant option/RLS/policy/本文/設定/履歴を確認。
- [ ] 本番check-database-rest.mjs(GET nonce/freshness/6hash/self hash + 旧新8RPC HEAD)をGitHub Actionsで実行しログと時刻を保存。本番POSTなし。

## Task 4: 独立レビューと提出
- [ ] 実装者とは別のレビュー担当がSQL・本番結果・互換性・新PR認証をレビュー。
- [ ] 重要指摘は再現試験で解消し、最新SHAのCIを確認。
- [ ] A/B/backup/API/全hash/全CI/レビューが成功した場合だけReady。未完了ならDraft維持して阻害を具体的に報告。
