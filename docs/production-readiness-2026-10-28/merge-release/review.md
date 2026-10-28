# 独立した敵対的レビュー

実装者と別コンテキストのreview agentがコード・実YAML・設計を検査し、別のPG17環境で攻撃と非superuser適用を実行した。実装者の自己レビューだけで代用していない。本番SQL／Pages公開は実行していない。

## 指摘と修正

1. **重要：検査所有者への逆方向membershipを検出しなかった。** 所有者が他roleに属する方向だけの検査では、anonやLOGIN roleへ所有者membershipを与えても検査hashが一致した。独立側と実装側で再現。双方向を検査し、受領者／実効ADMIN・INHERIT・SETを固定。postgres以外のcallerは0、postgresはADMIN=true／INHERIT=false／SET=false。PG17の自動付与と明示GRANTのgrantor差は受領者別の実効flagsで正規化。実装側RED→GREEN、独立側でも新membershipでhash変化を確認。
2. **重要：非superuserの適用所有者ではALTER FUNCTION OWNERに失敗した。** 本番のpostgresはNOSUPERUSER CREATEROLE、createrole_self_grant空。superuserのローカル適用だけではこの前提を証明できなかった。独立PG17でSET ROLE権限不足を再現。CREATE ROLEに伴う自動ADMINを維持し、creator SETだけをtransaction内で有効化、関数ACLを所有権移転前に設定し、移転後にSETをfalseへ戻す。ADMINの再付与はPG17の循環grant拒否になるため行わない。非bootstrapのpostgresを使った本番同等fixtureで旧案失敗と両SQLの適用成功を確認。独立側でも6契約hash／自己hashが一致した。
3. **軽微：直接GRANTのWITH GRANT OPTIONが自己hashに入っていなかった。** 固定本文・NOLOGIN境界では直ちに書込み／漏えいにつながらないが、権限の完全一致という説明に不足。grant optionの追加を実PGでRED再現し、schema/relation/column/function/databaseの直接ACLへis_grantableを追加してGREEN。最終native32項目で確認。
4. **運用上の確認：PR file API用権限を明示。** public resource fallbackに依存せず、workflowのread scope／deploy jobにpull-requests:readを追加。Environment確認のactions:read、deployment照会のdeployments:readも明示した。
5. **実GitHub CIでの新規runner検証。** PR初回CIで、既存artifact directoryに依存していたログ保存がENOENTで失敗。空作業領域でRED再現し、検証開始時にdirectoryを作る修正でnative32項目がGREEN。GitHub上の再実行結果はPR本文を参照。
6. **配布テスト収集の分離。** Playwrightが同じdirectory内のNode .test.mjsまでimportしていたため、release configのtestMatchをブラウザ用.spec.tsへ限定。Nodeガードは通常CIのtest:release-guardsで必須実行する。

## 検証

- 実装側：PG17＋PostgREST16.5で32項目。両SQLを本番同等NOSUPERUSER CREATEROLEで適用。旧案SET不足、late transaction失敗、二重適用拒否、未適用原migration、INVOKER不足、GET/POST、間接definer書込み、欠落／RLS／ACL／grant option／membership／policy／owner改変、無採番、8RPC HEADとmissing canaryを検証。
- 独立側：非superuserで両案の適用、6契約hash／自己hash一致、逆membership改変検出、固定GETクライアントとGitHub merge認証／配布の12 focused regression成功。tar子プロセスはsandboxのEPERMを通常権限で再実行して成功。
- 原migrationの既存PG17 readiness33、旧native gate34、殿堂競合は変更せず成功。ゲームsrcのdiff0、原migrationのhash変更0。

## 12重点項目の結論

| 項目 | 結論 |
|---|---|
| gateの安全性 | LOGIN資格を配らずGET/HEADが強制するREAD ONLYへ変更。6区分の厳密照合は維持。信頼境界の変更はdesign.mdに明示 |
| 内部情報漏えい | 行／source／所有者名を返さずハッシュだけ。nonceと時刻は公開情報 |
| 書込み・任意SQL | 引数0、動的SQL0、固定カタログのみ。実APIで間接書込み拒否 |
| SECURITY DEFINER | 最小NOLOGIN role。非管理者、8列SELECT、限定policy、双方向membership／grant option固定 |
| ready定数 | 毎回実カタログから6区分＋自己契約hashを生成 |
| 古いSHA／偽merge | GitHub公式APIのPR番号／base／head／merge SHA／merger数値ID／CI ID・attempt・current mainを照合 |
| 権限不足の迂回 | API401/403、timeout、レスポンス異常はthrow。スキップ／fallbackなし |
| 他ゲーム | 旧SQLをそのまま追加適用、新APIの限定policy／roleのみ。他ゲームの関数／PUBLIC ACL変更0 |
| migration失敗 | 単一transaction、失敗後hash不一致／履歴なしで停止。本番の実一致は適用承認後にのみ判定 |
| 旧記録・殿堂 | readiness33／競合検証で旧pending・4000超・BOT・3000/3500分離を維持。テスト本番書込み0 |
| 同一成果物 | exact CI run manifestと公開run buildを照合、同run tar全バイトをdeploy前確認、公開後全ファイル比較 |
| 追加人手操作 | Environmentは現在main限定／reviewerなし。Secret不要。未承認A/Bとbackup確認が済むまでDraft／NO |

既知の限界：意図的に偽装するDB管理者は自己hashでも検出できない。main／DBとPages deployを原子的にlockできず、ごく短いTOCTOUは残る。deploy後の検査失敗は新版配信済みの可能性があり、自動rollback成功とは扱わない。CI再実行の最新attemptが所有者操作で全検査を満たす場合、最初の成功公開前は許容する。同SHAが一度成功公開されれば再公開を拒否する。無限自動再試行はない。

独立レビューの最終判定は「Draft PR準備可能、本番公開はA/B承認・backup・実本番契約確認・正式PR番号・実CI証拠が揃うまで禁止」。
