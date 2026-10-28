# タッケウの本番公開手順

公開URL: https://chameleonjp-lab.github.io/takkeu/ 。Pages SourceはGitHub Actions。

**mainへのマージは公開承認ではない。** CIはPR/main pushで自動実行するが、Pages releaseは`workflow_dispatch`だけで開始する。DB未適用・未確認・認証失敗・タイムアウトは公開禁止。失敗時に前の公開物を削除しない。

2026-10-28の緊急対応で以前の自動公開方針を撤回した。[事故記録](incident-2026-10-28/report.md)、[DB適用前監査・復元計画](incident-2026-10-28/db-apply-plan.md)を参照。この修正は新PRのマージ後に有効になる。PR作成だけで既存workflowやrunが停止するわけではない。

PR30はマージ済み。以後の最新調査・独立承認A–D・接続の阻害条件は[本番準備資料](production-readiness-2026-10-28/README.md)を参照する。PUBLIC8関数の整理だけでは標準large-object書込みを拒否できず、普通の新roleを準備完了とは扱わない。ゲートはidentity/generated、許可した読取りroutine/内部helperの本文・引数/default・実行設定、未知routineやPUBLIC triggerの経路も確認する。検査のboolは全PostgreSQL操作の形式的な非書込み証明ではない。

## 公開の条件

1. 所有者`chameleonjp-lab`が現在mainの完全な小文字40桁SHAをレビューし、そのSHAの本番公開を承認する。
2. 当該main pushの最新`CI` run/attemptが全体で`completed/success`。PRのCI成功だけでは不足。
3. 手動実行でも同じSHAの再利用CIで、型・単体・使い捨てPostgreSQL・Chromium/WebKit操作/負荷検査を再実行する。
4. rootと`/takkeu/`の実配布検証に成功し、同一runの`dist`と`release.json`を確保する。
5. 本番DBを最小権限接続で読取り専用検査し、履歴・11テーブル・22関数・列・制約・index・trigger・RLS/policy・列ACL・有効権限・関数本文hash等がレビュー済み契約に一致する。
6. environment待機後、DB・承認・CI・現在mainを再確認して同じrunの成果物を配備する。

`takkeu-pages` concurrencyで直列化し、新runで進行中の正常な公開を自動キャンセルしない。待機中にmainが進めば古いrunは拒否する。GitHubのmain更新とdeploy APIは原子的操作ではないので、最終照合から配備完了までmainとDBスキーマ/権限を変更しない運用も必要。

## environmentと承認の実態

2026-10-28の読取り確認ではpublic repoで管理権限を確認。`github-pages`はmainブランチのみ許可、**required reviewersは未設定**、管理者bypassは有効だった。今回設定は変更していない。YAMLの`environment:`指定だけではreviewer承認は必須にならない。

現実装の承認は所有者による手動dispatchの`approve_production=true`（初期値false）、SHA入力、actor/triggering actor一致で判定する。CodexやCIは公開dispatchを行わない。

二者承認も必要なら、管理者が Settings → Environments → github-pages → Deployment protection rules → Required reviewers に実在の承認者を指定する。Prevent self-reviewにはdispatch所有者とは別の承認者が必要。管理者bypassを禁止し、Deployment branchesはmainのみを維持する。保存後GET `/repos/chameleonjp-lab/takkeu/environments/github-pages`で`required_reviewers`を再取得し、無承認runが待機することを確認する。未設定のまま二者承認必須と報告しない。

## DB接続準備（本番変更には別承認）

管理者が`TAKKEU_RELEASE_PGHOST` / `TAKKEU_RELEASE_PGPORT` / `TAKKEU_RELEASE_PGUSER` / `TAKKEU_RELEASE_PGPASSWORD`をgithub-pages environment secretsに設定する。既存secret名の列挙はintegrationの403で確認できず、安全な接続の存在は未確認。今回secretを作成・登録していない。

接続先はプロジェクト`mlpnjgezrnhdxsxolyzj`に固定。直接hostは`db.mlpnjgezrnhdxsxolyzj.supabase.co`。poolerはDashboardの正確な`*.pooler.supabase.com`ホストと`<読取りロール>.mlpnjgezrnhdxsxolyzj`ユーザーを使う。DB=postgres、port=5432/6543、TLS=verify-full、system CA必須。証明書エラーをdisableで回避しない。

専用LOGINはNOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS、他ロールmembershipなし、ユーザースキーマCREATE・テーブル/列の変更・sequence USAGE/UPDATE・MAINTAIN・可変RPC実行権限なしとする。postgres接続・管理者password・service_roleを渡さない。

承認対象の接続準備:

- DB CONNECT、public/supabase_migrations USAGE、public.gamesの構成6列、履歴version/name列のSELECTだけを付与。プレイヤー/スコア/セッションのSELECTは不要。
- gamesの既存SELECT policyはanon向けだった。専用ロールがgame_slug=takkeuの構成行だけを読めるSELECT policyを別承認で用意する。anonのmembershipで代用すると書込みRPCも継承するので禁止。
- PUBLIC権限はロールから個別拒否できない。本番で他ゲームを含むPUBLIC実行可能VOLATILE関数を確認した。ロール作成だけで最小権限にはならない。必要な実利用ロールへPUBLIC権限を狭める場合は、対象/件数/他ゲームへの影響/復元GRANTを調査し別承認を得る。準備完了までは公開ゲートを失敗させたままにする。高権限接続で回避しない。
- `BEGIN READ ONLY`、statement timeout=15秒、lock timeout=3秒、接続10秒/プロセス25秒で検査する。アプリRPC試行や本番テスト記録を使わない。

通常CIに本番接続を渡さない。DB出力は時刻・プロジェクト・件数・結果だけ。password/接続URL/psql stderrをログへ流さない。正当なスキーマ変更も契約と違えば停止し、新しい読取り監査・ローカル検証・PRレビューでbaseline/expected contractを更新する。

## 承認後の実行

先に[DB適用計画](incident-2026-10-28/db-apply-plan.md)を承認・実施し、適用後の読取り専用確認を完了する。DB適用とPages公開の承認は別。準備済みを適用済みと呼ばない。

所有者が現在mainのSHAとCIを確認し、Actions → Pages release → Run workflow → branch=main、expected_sha=完全SHA、approve_production=trueで実行する。承認済み所有者向けCLI例:

```sh
gh workflow run deploy.yml --ref main -f expected_sha=<完全40桁SHA> -f approve_production=true
```

environment reviewers設定時はその承認も必要。失敗を無視してdeployジョブだけ起動しない。過去runの再実行も公開承認に含めて扱う。

## 公開後と復旧

- クエリー付き`https://chameleonjp-lab.github.io/takkeu/release.json`でcommitとbase=/takkeu/を照合。Actions URL・SHA・取得時刻を保存する。
- JS/CSS/OGPの200、通常開始/匿名開始/ランキング取得を確認。本番スコア送信や殿堂採番を検証目的で行わない。
- 公開前失敗は旧Pagesを維持する。公開後はrunをキャンセルしても元に戻らない。
- 復旧にはユーザー承認が必要。正常SHAのゲーム内容へ戻すブランチ/PRを作り、検証後ユーザーがマージし、復旧後mainの新しいSHAを承認して手動公開する。force push・DB逆migration・ランキング削除はしない。古いSHAの照合を回避する裏口も作らない。
- 名前/自己ベスト/旧pendingを消さない。3500 pendingを旧クライアントが理解する保証はないため、保存領域を残し互換性を個別確認する。

## ローカル確認

Node/npmは固定版。すべてローカル/使い捨てDBで、本番secretを渡さない。

```sh
npm ci
npm run typecheck
npm run test:unit
npm run test:release-guards
node tests/helpers/checkReleaseDatabase.mjs
node tests/helpers/checkHallConcurrency.mjs
npx playwright install --with-deps chromium webkit
npm run test:browser
npm run verify:release
```

DB機能/競合はPostgreSQL/PGlite、workflowは実YAML graphと実gate関数をfixtureで実行する。GitHubのenvironment待機/配備そのものはローカルモデルで保証しない。iPhone/Safari実機、音・視認・性能の従来未確認項目も[受入記録](verification/acceptance.md)のまま維持する。
