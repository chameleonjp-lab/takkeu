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
- [PR #17](https://github.com/chameleonjp-lab/takkeu/pull/17)を必須CI成功後に手動マージ。main `f5bc00f20f467cd468adfb96139ecb0b99bbbd83`。自動マージ機能は使用しない。
- [ソースCI](https://github.com/chameleonjp-lab/takkeu/actions/runs/40085240925)、[main CI](https://github.com/chameleonjp-lab/takkeu/actions/runs/40086225661)、[Pages release](https://github.com/chameleonjp-lab/takkeu/actions/runs/40086225725)がすべて成功。単体366件、ブラウザ108件、ルート/Pages配布物4件を通過。
- 配備は2026-10-24 10:47:53 UTCに完了。公開`release.json`のSHA/baseを照合。実際の公開HTML/JS/APIをTLS検証ありのプロキシ経由でChromium 390×844から確認（実機iPhoneではない）。
- 名前なし開始と停止メニューからの再プレイで異なる開始IDが2件保存され、それぞれ合計+1を確認。API送信項目は開始ID/ゲームslug/版のみ。名前あり開始・終了・スコア登録RPCへの送信0件、当該IDの名前ありセッション0行。
- 実験場は通常のアコーディオンを開いて`122回`を表示。API合計と一致。初回の検証スクリプトは閉じたカード内のscroll操作で失敗したため、その失敗ログを保持し、カードを通常操作で開く読み取り専用検査を追加して成功した。
- 公開画像: [開始](live/anonymous-start.png)、[結果](live/anonymous-result.png)、[一覧](live/lab-count.png)。[一覧/API検証JSON](live/lab-verification.json)。

## ブラウザ検査通信の追加修正
- 公開前の10:19～10:41 UTCに、通常入口を使う既存ブラウザ検査が119件を本番の専用guest表へ作成していた。公開前のアプリにはこのRPC呼出がなく、公開後の確認プレイ2件とは時刻/IDを区別できる。ID・時刻・版をローカルの`artifacts/guest-count/test-data-backup.json`へ退避した。
- 削除は自動承認審査が「本番119件の削除には明示的な許可が必要」と拒否したため、未実行。現状の合計122回にはこの119件が含まれる。公開後の2件・既存の名前あり記録を削除対象にしない。
- 追加修正は共有Playwright fixtureで全Supabase通信を検査内に留める。匿名開始はACK、ランキング読取は空配列、未知の通信は遮断して失敗。既存の名前あり/通信障害検査は優先する`page.route`の明示モックで維持。
- 通信abort版のREDで未ACK記録1件が残ることを確認。新規回帰検査は実入口の開始/再プレイで2種類の開始IDとACK後の送信待ち削除、終了時の読取だけを検査。独立レビューの追加指摘なし。
- 追加修正後の型、全unit366件、Chromium/WebKitの影響browser22件、ルート/Pages配布物4件が成功。[RED](isolation-red.log)、[unit](isolation-unit.log)、[browser](isolation-browser.log)、[配布物](isolation-release.log)。22件の前後で本番guest表は121件のまま変化なし。一覧の既存ランキングも実API読取200・「1〜3位」表示を確認。
- 追加修正の最終結果はPRとCI成果物へ記録する。製品コードやDBスキーマは追加修正では変更しない。
