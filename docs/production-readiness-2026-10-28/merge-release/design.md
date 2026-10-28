# 所有者のリリースPRマージを最後の公開操作にする

## 現状と判定

2026-10-28の再取得でmain `b6440fb8c5c288b66657f332251080f9a4814b54`、main push CI `40683884700` 成功、公開SHA `628439f5907601c9b34ee2ba01f70c918b6e8d18`。PR27/30/31はマージ済み。殿堂migration未適用。最新の全6契約区分は既存production-baseline.jsonと完全一致した。

github-pagesはworkflow方式、HTTPS、canonical URL、mainだけのbranch policy、required reviewers/wait timerなし。保護設定を変更する必要はなく、変更していない。Secret名一覧は403だが、新方式は公開クライアントに既にあるpublishable keyのみを使い、新Secretを必要としない。既存Secretsの値は取得しない。

**本番適用A・新API追加B・backup確認が未承認／未完了の間はDraft、マージ公開可能NO。** ローカル成功やPRのCI成功を本番契約一致と扱わない。

## A/B/C比較

| 方式 | 安全性／資格 | 利用可否・料金・監査・運用 | 選択 |
|---|---|---|---|
| A:固定GET API | サーバが強制するREAD ONLY transaction。パラメータなし、SQL実行指定なし、返却は不透明ハッシュ。公開キーは既存クライアントと同じ | 既存Data APIを利用。新規サービス・replica・有料機能なし。通常の既存API利用量の範囲で検査リクエストが増える。APIログとActionsに時刻／ハッシュを残す | 採用候補。PG17＋実PostgREST16.5で検証。承認後に本番経路を必ず確認 |
| B:公式Management API read-only SQL | 正式ドキュメントにBetaの `/v1/projects/{ref}/database/query/read-only` が存在。説明はsupabase_read_only_userによるSQL実行 | このセッションの接続ツールには当該経路／専用token発行／backup取得がない。管理API資格のscope・他の書込みAPIへの制限・利用料金の保証・契約SLAは未確認。Betaを独立した強制readonly資格と断定しない。PGAuditは監査であり書込み禁止ではない。replicaは追加課金・運用が必要 | 不採用。高権限PATをActionsへ渡して代用しない |
| C:直接PGログイン | PUBLIC標準LOB、TEMP/event trigger、非volatile経由書込みまでLOGIN全能力を制限する必要。read_only defaultは解除可能 | 広範囲PUBLIC剥奪は共有ゲームに影響。狭い8関数ACL変更だけでもLOB問題は残る。追加role/credential/Secretの保守が必要 | 不採用。既存他ゲーム／PUBLICを変更しない |

公式根拠（2026-10-28取得）：[PostgREST transactions](https://docs.postgrest.org/en/stable/references/transactions.html)、[Supabase read-only query Beta](https://supabase.com/docs/reference/api/v1-read-only-query)、[PGAudit](https://supabase.com/docs/guides/database/extensions/pgaudit)、[Changelog](https://supabase.com/changelog.md)。11月10日の旧TLS cipher廃止を確認。Node24の既定TLS検証を維持し、証明書検証を解除しない。

## APIと権限

`public.get_takkeu_release_contract_v1()` は引数0、PL/pgSQL、STABLE、SECURITY DEFINER。GET・transaction_read_only=on以外は本文先頭で拒否。HEADはゲームRPCのschema-cache到達確認のみに用い、検査API自身はnonce／時刻付きGETで呼ぶ。

SECURITY INVOKERをまず実試験し、anonからmigration履歴が読めず失敗することを確認。anonへ履歴アクセスを追加せず、新規 `takkeu_release_inspector` に次のみ付与する。

- NOLOGIN、NOINHERIT、NOSUPERUSER、NOBYPASSRLS、NOCREATEROLE、NOCREATEDB、NOREPLICATION。他roleへの所属なし。受領者側のmembershipはpostgresだけ（ADMIN=true/INHERIT=false/SET=false）に固定。anon/authenticated/authenticatorへmembership付与なし。
- publicとsupabase_migrationsのUSAGE。履歴のversion/name 2列SELECT。
- public.gamesの6列SELECTと、そのroleだけに適用する `game_slug='takkeu'` のSELECT policy1件。
- 関数所有権移転のためpublic CREATEをtransaction内だけで一時付与し、COMMIT前に剥奪する。
- 関数はPUBLIC EXECUTEを剥奪、既存API用3roleだけにEXECUTE。既存ゲーム関数のACLは変更0。
- search_path=pg_catalog、statement_timeout=15s、lock_timeout=3s、row_security=on。全て固定・schema修飾。動的SQL0、EXECUTE0、外部通信0、アプリケーションRPC呼出し0。プレイヤー／セッション／スコア行SELECT0。

一般のPUBLIC関数能力が所有者roleにも存在する点は隠さない。このroleを「全能力が書込み不能なLOGIN資格」とは呼ばない。ログイン／role切替経路をクライアントへ与えず、監査した固定本文の到達範囲とGET transactionで制限する。

カタログで全対象の列/default/IDENTITY/生成式、制約、index、RLS/policy、triggerとevent trigger、関数の本文SHA256／署名／default／戻値／所有者／設定／volatility／strict／実効ACLを読み、既存6契約区分をそのままハッシュ化する。JSはPostgreSQL jsonbの正規化規則と同じUTF8バイト順で期待値を計算し、PG17実値と照合する。単なるready定数ではない。

検査関数自身の本文・設定・ACL・所有者属性／直接GRANT／所属数／設定表RLS／限定policyも別のハッシュに含める。返却はformat、固定project、read_only、要求nonce、サーバ時刻、6契約ハッシュ、検査器ハッシュのみ。関数source、テーブル名一覧、内部所有者名、migration一覧、プレイヤーデータ、Secretは返さない。応答項目の追加すら拒否。要求nonce一致と±30秒でキャッシュ／再生を検出する。

本番の公開キーでOpenAPI rootを読むと `Secret API key required` となった。Secretを追加して解決しない。8RPCに対するHEADはDB側でREAD ONLY、全引数名をschema cacheで照合し、応答本文を取得しない。UUID零値・空名・空version・0を使うため実記録を作る正常入力にもならない。STABLE一覧は200、VOLATILEはPostgREST版により200または405を許容する。未知RPCのHEADが404であることもcanaryで確認する。404／401／403／5xx／timeoutは公開失敗。実PostgRESTで同経路を検証し、既存本番RPCでも正確な署名のHEAD200と存在しないRPCの404を確認した。

## 旧方式から維持／変更する保証と信頼境界

| 保証 | 新方式 |
|---|---|
| 正しいproject | 固定HTTPS origin、固定public構成、gateway、応答projectを照合。リダイレクト禁止 |
| migration・RPC・旧互換契約 | 既存6区分の完全一致を維持。部分欠落・本文・権限・制約driftを検出 |
| 他ゲーム保護 | 対象のDDLだけを個別承認。既存PUBLIC／他ゲームACL変更不要。原migrationの既存行fingerprint維持 |
| 検査が本番を書き換えない | LOGIN全権限の否定から、HTTP GET/HEADのサーバ強制READ ONLY＋固定本文に変更。間接VOLATILE SECURITY DEFINER書込みも実APIで拒否を再現 |
| 検査Secretの流出耐性 | PG password自体が不要。既存公開キー以上の資格をActionsへ渡さない |
| 検査器の通常の改変 | 自己本文／ACL／所有者／GRANT／policyハッシュの差分を検出 |
| 悪意あるDB管理者が検査器を偽造 | **保証しない**。管理者が関数を置換し、期待ハッシュ・nonce・時刻まで偽装すれば自己検査だけでは検出できない。直接カタログ方式より独立観測が一段減る。固定HTTPS／GitHub上のレビュー／本番適用時の独立した認証済カタログ照合を信頼境界とする |

DB管理者・Supabase gateway／PostgREST・GitHub管理者とActions基盤・レビューされたmainコードは信頼する。管理者の意図的な偽造も検知する要件なら本方式を公開可能と判定せず、独立したprovider attestationなど確認済み手段が必要。承認Bはこの境界を含めて判断する。通常のdrift検出と書込み事故・資格拡大防止は維持／改善するが、敵対的管理者への同等性を主張しない。

## マージから公開まで

1. 明示的release-target.jsonで今回のPR番号・head branch・3500versionを固定。今後すべてのPRを公開対象にしない。
2. main push CIが型・単体・PG17・競合・両配布・両ブラウザに成功。coreは配布全ファイルのSHA256 manifestをCI run内に保存。
3. `Pages release` がCIのworkflow_run completed/mainから起動。job条件は同一repositoryのmain push successだけ。PRの成功、Draft、別branchはpreflightへ進めない。
4. head_shaを明示してcheckout。workflow_runのgithub.shaを公開SHAと混同しない。GitHub APIで正式なCI run（ID/attempt/path/branch/SHA/所有者）と最新mainを再取得。
5. GitHub APIでPR merged=true／closed／draft=false／merge_commit_sha／base/main／同一repo／番号／head branch／merged_byのloginと数値IDを確認。コミットメッセージは使わない。PR変更ファイルにrelease markerがあることも確認。過去の同SHA成功deploymentがあれば停止。
6. PagesのURL/方式/HTTPSとEnvironment main限定・追加承認なしをAPI確認。不明・変更・権限不足なら停止。保護を自動変更しない。
7. GET APIの契約と8RPCのHEADを確認。公開run内で同一SHAをbuild/両配布検証し、exact CI runから取得したmanifestと全バイト照合する。CI全体の重複実行はしない。
8. 同じrunだけからPages artifactとmanifestを取得し、tar全ファイルのhash／size／inventory／symlink禁止を検証。
9. 正式マージ・最新CI・main・設定・DB契約を再確認。最後にmainをもう一度確認し、deploy-pagesへ進む。同時実行group固定、cancel-in-progress=false。
10. deploy-pagesがPages deployment成功をpollした後、canonical URL、release.jsonを含む全ファイルのバイト同一性、3500version、静的404なしをcache-busting URLで検査。APIも再検査。CDN待ちは最大3回、5秒間隔のみ。

チェックからdeploy API受付までの微小なTOCTOUをGitHub/DBと原子的にlockする手段はない。公開中はmain／DB契約を意図的に同時変更しない。事前の長いbuild／Environment待ちの間の更新は再検査で止める。旧コードに隠れて残る手動dispatchルートは新workflowにはない。

## 失敗と復旧

deploy-pages以前の失敗は旧正常版を変更しない。公開後の検査失敗は、新版が既に配信済みの可能性があり、旧版維持とは報告しない。GitHub Pagesには配信切替後の検証を原子的に巻き戻す保証がない。ログとsummaryに影響を明示し、公開物削除・force push・DB down migration・採番巻戻しはしない。

修正は別の明示的release PRで行う。旧正常SHAとその配布hashを保存し、旧クライアントが使える追加DB契約を残す。旧版への緊急再公開も、現在mainに対応する修正PRとその検証を経由し、所有者のマージを承認とする。再公開対象PRの番号／branch／release markerをレビューして更新する必要がある。失敗runを無限にrerunしない。

## 必須検証と未完了

`tests/release/workflow.test.mjs` は実YAMLのjob条件・needsと実gate関数で負例を実行し、deploy-pagesはカウンタに置換する。実GitHubではDraft PRのCIイベント、公開runが起動しないこと、設定を確認する。最終PRのマージを伴う実デプロイ試験は行わない。

原migration PG17 33項目、旧native gate34項目、REST APIのPG17／実PostgREST検証30項目、guard23、unit972、actionlint、root/Pagesビルド・配布8、Chromium/WebKitを実行。最終結果と独立レビュー指摘はREADME／review.mdに記録する。本番backupとA/B未適用は別の阻害条件であり、テスト成功では解消しない。
