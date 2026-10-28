# 3500版の所有者マージによる公開準備

**[PR #32](https://github.com/chameleonjp-lab/takkeu/pull/32)、判定：NO（Draft）。本番DBのA/B適用・backup確認が未完了。** 本書はPR31時点の手動公開案を更新する。A/Bの個別承認なしに本番変更せず、準備未完了でReady for reviewにしない。

- [A/B/C比較・信頼境界・マージ後フロー](design.md)
- [個別承認A/B・適用・復元](approvals.md)
- [独立レビュー・再現と修正](review.md)
- [実装計画／検証記録](../../superpowers/plans/2026-10-28-merge-release.md)

## 再取得した実環境

| 項目 | 観測 |
|---|---|
| main | b6440fb8c5c288b66657f332251080f9a4814b54 |
| main push CI | 40683884700成功 |
| 公開SHA | 628439f5907601c9b34ee2ba01f70c918b6e8d18 |
| Supabase | mlpnjgezrnhdxsxolyzj、ACTIVE_HEALTHY、PG17.6 |
| 原殿堂migration | 未適用、全6区分baseline一致、部分適用なし |
| 所有者 | postgres NOSUPERUSER/CREATEROLE/CREATEDB、creator self grant空、必要列／schemaのgrant optionあり |
| Environment | github-pages、mainだけ、required reviewers/wait timerなし、設定変更0 |
| Secrets | 一覧403。新方式で新規・変更・参照すべきSecrets0 |
| 公開キー | 既存クライアントのpublishable key。既存正確署名のHEAD200、未知RPC404。OpenAPI rootはSecret要求のため使用しない |

## 実装と検証

自動公開は `Pages release` のCI workflow_run（main push成功）を起点とし、コードに固定した今回のrelease PRが所有者ID283055705によってmainへ正式マージされたことをGitHub APIで確認する。直接push／PR CI／別branch／未マージ／別のmerger／古いSHAは公開不可。latest CI・main・DB・Environmentをdeploy直前にも再確認する。新Secret・管理者接続なし。

CIが生成したmanifestと公開runで生成した同SHA全ファイルを比較し、同runのPages tar全バイトも確認してからdeployする。公開後はrelease.json・HTML・JS・CSS・PNGすべてをcache-busting URLで比較し、3500versionとDB応答を確認する。deploy前の失敗は旧正常版を維持。deploy後の不一致は失敗として明示し、削除／force push／DB逆migrationは行わない。

実行済み：型検査、単体87file/972、公開guard23、原migration PG17 readiness33、旧native gate34、新APIのPG17＋実PostgREST30、殿堂別接続競合、actionlint。通常／Pages buildと配布8も成功。ゲーム全Chromium/WebKitは検証中。正式な公開対象PRは32、branchはrelease/3500-merge-to-pagesに固定済み。最新headの実GitHub CI結果と最終ブラウザ結果は[PR #32のChecksと本文](https://github.com/chameleonjp-lab/takkeu/pull/32)を正本とする。

ブラウザ環境は既存workspaceからDocker公式Playwright1.64.1-nobleを使い、hostのNode24.19.0をreadonly mountした。初回のGit所有権／host WebKit library不足は試験環境の問題として修正し、ゲーム仕様・テスト条件を緩和していない。Codex Cloud environmentの作成／利用開始、課金サービス追加は行っていない。

## 残る解消単位

1. A承認＋既存backup情報を確認し、原migrationだけを適用・実DB再照合。
2. B承認で固定GET検査APIだけを適用し、独立カタログと公開GET/HEADの実経路で一致を確認。
3. 実PRの全CI成功・全配布検証・Environment再確認後にReady for reviewへ変更。

この3点の前にPRをマージするだけで公開可能とは報告しない。A/B待ちの間もコード・検証・Draft PRを完成させる。
