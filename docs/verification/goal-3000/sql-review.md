# 3000殿堂 SQL 独立レビュー

2026-10-27。HEAD cc5f8beの後に置かれた未commit SQL `supabase/migrations/20261027032043_takkeu_hall_of_fame.sql`、`tests/helpers/hallDatabase.ts`、`tests/sql/shared-ranking-start.sql`、`shared-normalize-name.sql`、`tests/unit/takkeu-hall-sql.test.ts` を読み取り確認。対応する既存finish/submit/final-loss SQLも参照した。製品編集・本番への呼出し/書込みなし。PGliteを新たに実行せず、Docker/Postgresの並行race試験は実装者の別作業として未確認。

**公開RPCから旧playへ殿堂番号を付ける経路や、anonの直接table書込み経路は確認しなかった。採番はcounter row lockとunique制約で同名・別名を直列化できる構造。1件のNULL制約の修正推奨と、fixture/試験の追補点を以下へ記録する。新SQLの最終成功判定は修正・真の並行試験・現SHAでの再検証後。**

## S01 NULLのCHECK制約: defense in depth修正推奨

現制約の `(not takkeu_clear_verified or takkeu_rules_version = 'goal-3000-v1')` は、verified=trueかつrules_version=NULLのときUNKNOWNになる。先行のrules-version checkはNULLを許すため、CHECK全体もUNKNOWNとなって通過する。SQLのCHECKはfalseだけを拒否するため、コメント/意図と異なる状態を許す。

公開RPCはruleをIS DISTINCT FROMで検査し、table書込み権限もないため、このNULL単独でanonが殿堂登録を迂回できるわけではない。severityは防御的なdata invariantの欠落であり、確認した公開昇格漏洞ではない。`not verified OR rules_version IS NOT DISTINCT FROM 'goal-3000-v1'` 等でNULLもfalseにし、ownerで不正組合せをUPDATE/INSERTするとconstraint違反になるtestを足すことを推奨。old rowsのNULL/verified=falseは許可し続ける。

## S02 ranking_statusのNULL前提（条件付きの確認点）

既存ranking/position SQLはcoalesce(ranking_status,'normal')でNULLをnormal扱いする。一方Hallの登録はv_status IS DISTINCT FROM normal、一覧はgs.ranking_status=normalでNULLを除外する。

実schemaがNOT NULLであるなら問題なし。fixtureはNOT NULLを宣言しており、実schemaがnullableの場合は既存NULL名の再clearでランキングには載るのにHallだけ不適格になる。live read-only schema snapshotでNOT NULLを確認するか、既存rankingのnormal判定と同じcoalesceへ揃える。未確認のnullableを仮定してアクセス拡大する意図ではなく、既存契約に合わせる確認点。その他review/hidden/disqualified/provisional_bot/botの除外を維持する。

## 名前identityとfixture修正

初回helperはlower(trim)stubとAlice/ALICE同一名のtestを使っていた。しかし実normalize_player_nameはbtrim(coalesce(input_name,''))だけであり、大文字小文字/Unicodeの新規同一視はない。実装者の指摘後、helperが exact snapshot `tests/sql/shared-normalize-name.sql` を読むよう更新され、testもnormalized_name=Alice/Oldと同一exact名の再clearへ変わったことを読んで確認した。製品Hall SQLは最初から実normalize関数へ委譲しており新identityルールは導入していない。

追加すると良い最小ケースはAlice/ALICEを別の新rule playでclearした場合に別番号となること。trimの扱いは既存start入力検証を維持。DB normalized_nameにuniqueがあるため同じ実正規化結果を別番号へ登録しない。

## RPC/制約の構造監査

| 対象 | 独立確認 | 判定 |
|---|---|---|
| start_takkeu_clear_play_v1 | takkeu/固定new client versionをIS DISTINCTで検査、shared startへ委譲しstartId idempotence/既存rate/名前length/count経路を維持 | 妥当 |
| old sessionの後付昇格 | shared startのduplicate結果でrule印がない場合は拒否。current version文字列だけのgeneric startも昇格しない | 妥当。new versionをcallerが名乗るだけではrule印にならない |
| startのNULL | slug/version NULLは即拒否、startId/name NULLはshared startがrequired-input拒否 | 公開NULL入力のrule bypassなし |
| dedicated finish | score0..3000、clear iff score3000、wave1、clear loss0..99、rule印を検査 | 妥当。失敗/retire3000をclearへ偽変換しない |
| finishのdelegation | current finish_takkeu_v2でidentity/scoreとranking score/time-rate/final-loss/progress下限/idempotenceを再使用し、accepted後だけverifiedを設定 | 妥当。新しい緩いrateや推定loss0を追加していない |
| finishのNULL | score/result/wave/clear lossは先頭guard、その他NULLはv2 guardまたは未発見sessionで拒否 | 公開NULL入力からverified=trueになる経路なし |
| register | playId/submissionId/version/name/rule/verified/finished/clear/score3000/final lossを確認、score_runsを全identityで照合 | 既存best>=3000だけで番号を付けていない |
| legacy score保護 | 新migrationは旧score/runを書換えず、new ruleのsessionだけ登録対象。共有games maxを3000へ下げない | 旧4001等とold pendingのDB側rangeを維持 |
| moderation | 登録時FOR SHAREでtakkeu aggregate statusを確認。getHallも同名takkeu aggregateとjoinしてfilter | 既存番号は残り、非表示後の番号詰め/再割当なし。NULL前提はS02 |
| private情報 | getHallはnumber/displayName/normalizedName/dateだけ、limit30/default最大100、番号順 | session/start/submission/progress/counterを公開しない |

registerのsession.ranking_score=3000を直接再比較はしないが、verifiedは新finishがv2を通過した後にしかsetされず、そのv2/shared finishがscore/ranking_score一致を必須にするため、確認したAPIだけを使う状態では保たれる。owner直書きの破損まで想定した追加CHECKは任意だが、これをanonの迂回と誤報しない。

## privilege監査

- public Hall tableはRLS有効、PUBLIC/anon/authenticatedのall privilegeをrevoke、policyなし。anon/authenticatedがData APIから直接SELECT/INSERT/UPDATE/DELETEする経路なし。
- private counterはRLSと同じrevoke。sessionsの新columnsは既存private tableの権限を継承し、column/table権限を追加していない。
- 4公開RPCはsecurity definer/空search_path、schema修飾参照を使用。PUBLIC default EXECUTEをrevokeし、必要anon/authenticated/service_roleへ明示grant。
- anonymous named-player契約は既存と同じ。auth.uid必須を新設して既存ゲームを壊さず、publishable keyの一般callerが指定したplayId/name/versionに対する限定操作へ絞る。service-role keyをclientへ出す変更はこのSQLにない。
- Hall表のfirst_play_idはprivate sessionへのFK、normalized_nameはplayersへのFK、number/name/playはそれぞれuniqueで整合する。service_role/ownerの管理操作は既存のtrusted管理境界であり、公開clientの権限とは分ける。

unitはSET ROLE anonでgetHall/registerと直接SELECT/INSERT/counter読取拒否を検査する。start/finishは現testでは主にowner実行なので、anon/authenticatedで通常4RPCが使えtable操作は拒否される試験を足すと実公開契約を確認しやすい。

## 競合・採番・冪等性

registerはsession FOR UPDATE→game_scores FOR SHARE→singleton counter FOR UPDATE→既存Hall lookup/必要ならINSERT→counter更新。同playの重複はsession、同名の別play/別名の登録はcounter rowで直列化される。READ COMMITTEDではcounter待ち解除後の次lookupが先行commitのHall entryを読み、同名再送は既存number/dateを返してcounterを進めない。2つの別名も同じnext_numberを同時に使わない。unique(number/name/first_play_id)は追加の整合性保護。

初回registered_atはlockを取得してからINSERT default clock_timestampで記録し、transaction開始時刻で逆転させない。Hall登録とcounter更新は同一RPC transactionでrollback/commitし、途中失敗で半分だけ永続化しない。counter max+1だけの無lock計算ではない。

既存entryを再登録してもimmutable displayName/first_play_id/registered_atを書換えない。除外名は既存entryでもstatusチェックで拒否、一覧から消えるがstored row/counterを削除しない。新規Bobが同名再clear後も2番となるunitはcounter消費なしを検証する。

現unitの逐次PGliteはcross-connectionのlock競合そのものを検証しない。実装者が追加しているPostgres17二接続raceでは、同名別play、別名同時、同play応答喪失後再送、status更新と登録の競合、正常なlock順/timeoutを確認すること。Docker試験の結果は本書作成時点で未確認。

## rule-bypassのtest追補（コード上の漏洞の発見ではない）

現在testはgeneric current-version startをnew startへpromoteしないこと、専用finishがそのplayを拒否することを確認する。加えて次の2経路を最後のregisterまで完結させるとverified印の意味を直接証明できる。

1. generic start(new version)→legacy finish_takkeu_v2(clear3000)→shared submit→register(new version)がnew rule欠如で拒否。
2. dedicated new start→legacy finish_takkeu_v2(clear3000)→shared submit→registerがverified=falseで拒否。続いてdedicated finishの正当検証を通した場合のみ登録できる。

旧playのregisterへ旧client versionを渡して拒否されるtestだけだとversionの入口guardしか検証しない。新client versionを偽装してもsession/rule/verified guardが効くことを確かめる。NULL matrix/score-runの別play/submission/name/version不一致、hidden→normalで同番号復帰、他gameのstatusと番号に影響しないことも重要な境界。

## migration/fixtureの適用境界

Hall migrationは既存final-loss column、rate-checked shared start/finish/submit、ranking_status、playersを前提にする。helperは明示順でshared start→guard→rate refinement→final loss→Hallを適用しており、その前提に合う。repoの旧日付8桁SQL群と今回のCLI生成14桁migrationは、全てを空DBへファイル名順適用する手順の検証ではない。既存本番への適用済み履歴と新migrationだけの前提/適用手順を区別し、試験で本番applyしない。

shared-ranking-start.sqlはlive read-only snapshotを使用するが、helperのgames/players/session/score_runs DDLは必要列を模した縮小schema。実制約/trigger/default privilegeまで完全に再現したと断定しない。特にnormalized identityは今回exact snapshotへ修正済み、ranking_status NULL前提と既存session identity columnsのNOT NULLは実schema snapshotで照合する価値がある。

## 最終判定

S01のNULL constraintは修正推奨、S02は実NOT NULLの確認または既存coalesceとの整合確認が必要。公開権限/新旧rule分離/採番の基本構造にcriticalな問題は確認しなかった。PGlite greenの報告はあるが、更新中normalize fixtureとSQL修正後の全unit、Postgres17 race、最終commit/source/CIの照合は別途必要。番号は人の人数ではなく登録名単位の『殿堂登録 第○号』、クライアント申告のプレイを完全証明する認証ではないという限界も保持する。
