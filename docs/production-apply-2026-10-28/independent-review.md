# 独立レビュー
Reviewer: /root/independent_release_review. Initial reviewed head: 9827d1401222901e9c43b5171bf17106092ebc7f.

- Critical / Important: 確認範囲内で指摘なし。
- A/B原SQL・生成器・指定テストを確認。メモリ上で生成器を独立実行し、A原・A生成・B原/生成のSHA256を独立照合。
- 保存カタログ6区分がbaselineと一致。本番READ ONLYで既存6関数本文hashも一致。Aのtransaction、rollback、履歴1行、既存行保持検査、共有triggerの他ゲーム除外を確認。
- Bの限定SELECT、RLS、双方向membership、grant option、所有者・本文検査を確認。故意に偽装するDB管理者は信頼境界外。
- 実認証関数・fixtureの独立実行でPR34受理、別PR32/33/35/999と旧release/ref拒否の7件を確認。
- 未検証: レビュー担当によるPG17/PostgREST/全CIの再実行、本番A/B適用後、backup/復元可能性。
- 本番SQL承認・backup・適用後契約/API・最新headのCIが未完了。Draft維持、本番実行/Ready不可。

## CIで追加発見した問題と実装者による修正
既存guards.test.mjsは通常CIの本番接続を明示禁止しており、新本番jobをci.ymlに置いたため最初のCIで失敗した。
既存テストは変更せずci.ymlを完全復元。本番GET/HEADを独立した読み取り専用PR readiness workflowへ移動する。
新回帰試験で専用ゲートの必須性と通常CIの非接続条件を同時に検査する。公開workflowの二重本番ゲート・SHA/CI/配布検証に変更なし。
最終テスト結果はevidence/verification-summary.jsonへ別途記録する。未実行を成功と記録しない。
