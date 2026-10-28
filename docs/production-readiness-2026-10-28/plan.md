# PR30後の公開準備計画

対象main: 754b71bc7aa6ce982a4ceb7221ad14fabd600c95。ユーザーのStage A–Eを実行する。A/B/C/Dの本番変更は一つも承認されていない。新branchのみ。ゲームsrcと殿堂migrationは変更しない。

- [x] 認証済みGitHub・本番READ ONLYでmain/CI/公開/環境/履歴/部分適用/ACL/行数とサイズを再取得。
- [x] 現行baselineとの一致確認。通常型検査・単体972・guard10成功。
- [x] PostgreSQL17で初回migration/transaction検証/rollback/重複/旧新契約/分類/並行・再送を検証。
- [x] PUBLIC8件の限定変更案と正確な復元SQL、実呼出し元とローカルの匿名/認証/service parityを準備。
- [x] 標準large-object書込みを検査できない現行gateの再現テストを先に実行し、Fail Closedを補強。値固定や既存検査の削除は禁止。
- [x] 案A/Bの限界と阻害条件、A–D独立承認、backup/lock/secret/reviewer準備、適用/公開後の読取り確認と復元計画を提出。
- [x] 独立敵対的レビュー、通常CI/配布検査、Draft PR準備、最終3段階判定（実GitHub CIはPR上で追跡）。

実装判断: PUBLIC8件を無承認適用しない。5件は読取り、3件は書込みであり、VOLATILEを悪意と同一視しない。8件だけの変更はapplication書込みの抑制に有用でも、pg_catalog large-object等を残す実接続を完全なreadonlyと呼ばない。安全な接続を実証できなければ公開停止を維持する。
