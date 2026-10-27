# 3000クリア・殿堂入り 実装台帳

2026-10-27。ユーザー確定: 登録名ごとの初回クリア順、同名は同番号、新ルール公開後のみ（旧記録の移行なし）。本番へのDB適用・テスト送信・マージ・公開は禁止のまま。

- 基準PR27: `75a36404d1a5fce7f842596293fb47908cdc55a3`。main: `628439f5907601c9b34ee2ba01f70c918b6e8d18`。
- Task 1 complete: `996b1e2` 最新mainのランキング保護・最終落球数と演出終了待ちを統合。型検査成功、単体922/922。最初の環境制限付き検査の921/922と、その後の同一ソース再検査を別ログで保存。
- Task 2 complete: `cc5f8be` 3000の返球でclear終端。step/速度/30球は維持。0→3000実物理リプレイ、全30球返球、終端後freeze。単体929/929。
- Task 3 complete: `6794418` 新開始/終了/登録/一覧RPC、private rule/verified印、RLSと公開RPC権限、counterの行ロック+normalized_name一意制約。PGlite成功、PostgreSQL17.11の別backend同名/別名競合成功。
- Task 4 complete: `e2e8379ec649d1c4ee6b780142e024f813e90fb4` 旧pending/version/rangeと匿名queue互換、Hall再送永続化、結果の所有権、900×1200 PNGとURL回収、静的clearと音声tail。型検査・単体942/942。ブラウザー36/36と画像共有例外/生成中離脱4/4が成功。
- Task 5 complete: 製品修正 `93294e8`、DB試験起動修正 `720c063`。最終PR/push CI各6job成功、単体942・Chromium/WebKit218・配布8の1168条件成功。0→3000物理、clear後360×2frame、5warmup+20retry×2、実GC/CDP heap、元閾値の点滅解析を記録。独立source/SQL/client/全体レビューと証拠監査を分離。元1150file・22公式ZIPを14partへ保存し、全復元とhash/CRCを照合した。新証拠は旧巨大アーカイブへ混ぜず、正式結果をsource720c063へ結び付ける。

## 実装者の決定と根拠

- Ruling: 殿堂番号はサーバー登録の確定順。オフライン中の端末時刻で番号を予約しない。— 登録順を再送・並行時にも確定可能にするため。— 通信遅延中のクリアは後から登録され得る。
- Ruling: 登録名の正規化は既存DBのtrimのみを継承。大文字小文字を新たに同一視しない。— 実関数をread-onlyで確認。— 既存と同様、同名の別人は区別できない。
- Ruling: 新開始の保存キーだけv2へ分け、無印旧startを新ルールへ格上げしない。旧スコアpending/匿名count queueは元の版で再送。— 過去記録保護。— 旧版の開始待ちは新クリア開始には再利用されない。
- Ruling: PNGは結果画面で要求時に生成し、DBにはメタデータを保存。— プレイ中のCPU/GPU/転送を増やさない。— 名前なし/未登録時は番号なし賞状になる。
- Ruling: 3000到達以降は3Dを継続描画せず、3000ファンファーレは鳴り終える。— 終点化と必要な音声を両立。— 中断・ホーム・再挑戦では音声を停止する。

## 検出と修正

- SQLのCHECKがtrue/NULLをUNKNOWNとして通した。再現テストRED→IS NOT DISTINCT FROMへ変更→GREEN。公開RPCは元からNULLを拒否しており、公開経路の昇格は再現されていない。
- 初期Hall payloadに不要なp_game_slugがあった。厳密なRPC引数のテストRED→4引数へ修正→GREEN。
- canShare例外時に保存可能なPNGへ失敗表示を出した。Chromium/WebKit両方のREDを保存。共有可否の例外を局所処理し、PNG保存を継続して両方GREEN。
- 終端競合の初期テストはhitが既に開始時に重なったfixtureだった。衝突投影と時刻を確認し、loss-firstをbounce前のincomingに修正。基準・物理計算は変更していない。両終端順序とapp音声tail計10件成功。
- 全体レビューG01: 共有処理の古い拒否応答が別の結果へ出る。両engineでREDを保存し、結果/画像の所有権を確認してGREEN。製品srcは93294e8以後固定。
- e2e8379 CI: 新しい読み取りHall RPCを通信一覧の厳密な期待へ追加。全通信mockは維持。93294e8 CI: Postgres bootstrap socketサーバーとの競合を最終TCPサーバー待ちへ修正。両失敗と修正後の正式成功を保存。
- 独立証拠監査E01: release-resultsに44関連browserの誤コピーを検出。誤コピーは別名で保持し、正式な8release結果を追加。訂正一覧と両原本をarchiveへ保存。
- 追加の画素一致試験はChromiumで失敗。最大1/255・10画素と記録し、元の点滅解析の警告0と混同しない。

## 保留

本番スキーマ・公開ページは未変更。iPhone実機、実Safariの音/操作感、正式WCAG/HDRは未確認。3000以前の既存性能・点滅の問題が終点化だけで解決するとは主張しない。
