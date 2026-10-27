# 本番適用は承認待ち

2026-10-27の本番read-only確認は `production-audit.json`。transaction_read_only=on、3000用migration未適用、旧/新hallテーブルなし、clear RPCなし、共有score_max=100000000。このため未公開の `20261027032043_takkeu_hall_of_fame.sql` を整合させた。

SQLはgoal-3000-v1/v1 RPC互換とgoal-3500-v1/v2 RPCを含む。台帳・カウンターは独立し、旧pendingを新3500達成へ変換しない。新規に過去記録をbackfillしない。既存ランキングや分類の更新SQLを含まない。

本番へ新SQLを適用していない。現在の本番では新しい名前付きstart RPCは存在しないため、このDraftのクライアントを先に公開しない。公開前に改めてmigration履歴と同名objectがないことを読み取り専用で確認し、SQL適用とクライアント公開をそれぞれ承認された作業として実施する。もし3000 SQLが先に適用された場合はこのファイルを再適用せず、旧台帳を保持する追加migrationへ切り替える。

ローカルPGliteと使い捨てPostgreSQL17では、開始/確定/送信/登録順、同名/別名の同時登録、同じ要求の再送、正式番号と初回日付、旧4001記録、旧3000pending、新3500範囲、generic RPC迂回、anon/authenticatedの権限を検証する。private session/counter、public hallへの直接アクセスを拒否し、必要なpublic RPCのみEXECUTEを明示する。SECURITY DEFINERは既存の匿名・登録名ベースAPI契約を維持し、空search_pathと明示schemaを使う。
