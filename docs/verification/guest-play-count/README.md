# 名前なしプレイの回数と公開更新

基点main: `8af2b6e95ddf12f7124e42fd157358bf754ea3b7`（PR #16マージ後）。ユーザー依頼に従い、名前なしも開始時に回数へ加え、ラリー記録を登録せず、検証済みページを公開する。

## 実装・DB
- 専用`private.takkeu_guest_plays_v1`へ開始ID/プレイID/クライアント版/時刻のみ保存。名前/ラリー値は列自体がない。
- `start_takkeu_guest_play_v1`はtakkeuのみ受理し同じ開始IDの再送は同一play_id。名前ありのセッション・スコアAPIは変更しない。
- `get_game_play_stats('takkeu')`の合計だけへ匿名回数を加算。実験場のindex.htmlが使用する既存APIなので、実験場側のコード変更は不要。player_countは名前あり人数のまま。他ゲームは従来の集計を維持。
- Supabase migration `20261024095634_takkeu_guest_play_count`を適用。CLIで作成したSQLを適用後、サーバーが付与した正式versionへファイル名を同期。
- RLS有効、anon/authenticatedの表への直接権限を剥奪。RPCは空search_path・入力制限・開始IDロックと一意制約・毎分10000件の粗い制限を持つ。匿名の一意人物数や不正カウント防止を保証するものではない。

## 検証
- RED: 名前なしを数えない既存処理を単体で再現。新規検査5件の失敗から修正した。
- DB RED: `guest RPC missing`を確認。適用後に`tests/sql/guest-play-count.sql`が成功。匿名+1、同じID再送+0、anonとしての実行、直接権限なし、プレイヤー/スコア/名前ありセッションの不変、別ゲーム不変をASSERT。検査データはROLLBACK。
- 型、全単体366件が成功。匿名開始・再プレイ・503応答喪失・複数送信待ち・再読込・オフライン復帰・名前ありのスコア/共有をChromium/WebKitで14件検査し、すべて成功。
- onlineイベントが古い通信の失敗より先に来ると再送が止まる不具合を追加検査で再現。古い通信の完了後にも再送するよう修正し、同じ開始IDを維持する。
- 独立レビューで複数タブの送信待ち上書きと、古い失敗中に新しく開始したプレイの再送契機喪失を指摘。3件のRED検査で確認し、通常のWeb Storageでは開始IDごとの独立キーへ保存/削除する方式へ変更した。複数タブのACKが他の未送信記録を消さない。新規開始が進行中の送信へ重なった場合は、その完了後に1回の追加ドレインを予約し、無制限の再送はしない。

## Supabase advisors
事前/事後を確認。今回の追加について、private表の[RLS enabled/no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)は意図した直接アクセス拒否。[anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)と[authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)からsecurity definer関数を呼べる警告は、匿名開始だけを書き込む公開RPCとして意図したもの。名前・得点・他ゲームの任意書き込みやprivate表の読取を許可していない。既存の他ゲームの設定は変更しない。

## 公開確認
PRの必須CI、手動マージ、Pages配備、公開release.json SHA、実ブラウザの匿名開始/再プレイによる回数加算・スコア非送信を確認後に追記する。自動マージ機能は使用しない。
