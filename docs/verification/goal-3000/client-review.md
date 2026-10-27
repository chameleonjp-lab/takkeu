# 3000クリア・殿堂・賞状 クライアント独立レビュー

2026-10-27。`/workspace/takkeu-work` の `75a3640` に対するclient/controller/app/resultHall/screens/certificate/audio差分と新規テストを対象にした。レビュー終盤のHEADは `e2e8379ec649d1c4ee6b780142e024f813e90fb4`、対象clientファイルの未コミット差分はなかった。設計 `docs/superpowers/specs/2026-10-27-goal-3000-design.md` と実装計画を読み、実コード、保存済みログ、PNGを照合した。既存ソースの編集、新しいテスト、ブラウザ/DB起動、本番通信・書込みは行っていない。

## 結論

この範囲で、再現可能なCritical/Importantの欠陥は確認しなかった。旧pending保護、新ルールだけの殿堂登録、score ACKからHallへの永続再送、結果所有の照合、PNG破棄、clearの静的表示・最終音は要件に沿っている。以下は採用範囲の確認であり、最終SHAの全リリース検証を代替しない。

## 旧版・匿名・サーバー確定番号

- `src/ranking/config.ts` は旧named/guestのclientVersionを `takkeu-web-ranking-1` に固定し、新named開始だけを `takkeu-web-clear-1` / 専用開始RPCへ切り替える。guest queueのkeyと旧guest開始RPCは維持され、guestはscore/Hallを送らない。
- `ranking-manifest.json` のscore_maxは旧結果用の100,000,000を維持。3000上限を共通validScoreへ入れて旧pendingを捨てる実装ではない。
- `client.ts:21-26` はlegacy/resultType/rulesVersionとnew clear契約を分ける。旧4001点はrulesVersionなし・legacy versionのまま、loss countなしなら旧finish v1、ありなら旧finish v2へ送る。Hall対象にならない。`hall-ranking.test.ts:49-60` は旧4001点のfinish+submitとversionを確認する。
- 新規clearにはrulesVersion、score=3000、lostBalls<100を要求。Hall要求にはさらにplayId/submissionId、応答にはrulesVersion/normalizedName/正の安全整数番号/妥当なtimezone付き登録時刻を照合する。番号をローカル順位・件数から作る経路はない。
- `hallOfFame` は上限30件と番号の厳密昇順を検証する。名前/一覧はtextContent、証明書はCanvasのfillTextを使い、名前をHTMLとして挿入しない。

## ACKから殿堂登録の再送

`controller.ts:49-67` はfinish→score submit成功後に同じsubmissionIdの `scoreAcknowledged:true` をpendingへ保存してからHallを呼ぶ。再起動後はその行を復元し、finish/submitを繰り返さずHallだけを再送する。再送中も正式番号は作らない。

Hallのretryable失敗はACK済み結果を保持し、score statusはsubmittedのままHall statusをretryable_failedにする。moderationのhall_ineligibleは番号なしの終端として処理し、accepted scoreを失敗扱いにしない。permanent失敗は診断用pendingを保ち、後続プレイを処理する。承認済み行へ置換した後のcatchも、pending中の同じ置換オブジェクトを対象にpermanentFailureを付けるため、object identityによる無限再送は見当たらない。

対応証拠: `hall-ranking.test.ts` はreload後のHall再送でfinish/submit各1回・同一submissionIdを確認。browserはHall 503後も順位表示を保ち、同じ要求でHallを再送してscore submitが1回であることを確認している。

## 遅い応答・PNG・object URL

- `resultHall.ts:19-27` は現在playIdと最初に紐付けたsubmissionIdを照合し、正式receiptはnormalizedNameも確認する。home/新runではtargetをclearする。別playの遅い番号は新しい結果へ入らない。
- `createApp.ts` のleaderboard/Hall一覧は同じepochで古い取得結果を除外する。Hall登録後のpending減少/submit状態に応じて一覧を更新する。
- `certificate.ts` はresultデータ変更・home/retry/disposeでepochを更新し、既存URLをrevokeし、画像src/download href/Fileを消す。PNG生成完了後にもepochを確認し、古い結果にはURLを作らない。
- 登録番号・名前・登録日が確定するとcertificateのkeyが変わり、古い番号なしプレビューは破棄される。名前なし/対象外は番号なし賞状であることを明示する。
- PNGはユーザーの作成操作で900×1200のCanvas 2Dから一度生成し、finallyでcanvasを0×0へ戻す。通常のplay frameには画像生成を追加していない。
- `canShare`の例外はPNG保存と分離してcatchする。失敗しても作成済み画像・保存linkを維持し、共有buttonだけを隠す。先行REDを保持した追加browser回帰がGREENになっている。

## clear・入力・最終音

appはclearとlossをendReasonで区別し、clearでも最後のplayer-hit/game-clearイベントをaudioへ届ける。audioはgame-clear時に通常contactを退役させ、fanfare/impactの終了を保つ。app側もclear直後にsuspendしない。新runのwasFinishingをfalseへ戻すため、以前のloss演出終了のsilenceが新clearへ混入する問題も見当たらない。

finishPresentationはclearへ即座に `finishing:false` を返す。appはclear後に継続3D drawをせず、swipe cancel/timeline clearで操作を終える。screensはinput surfaceをinertにし、結果effectsを無効化し、clear結果のCSS animation/transitionを止める。未達結果は既存44段階コメントを使い、clearは別文言となる。

`goal-clear.test.ts` は同一tickの2999→3000、2970から30球すべての返球、2969から30球返球後2999継続、clear/loss競合の既存順序、終端後score/time/events不変、reset、fixedDt/maxSteps/slow pause不変を確認する。`clear-app-audio.test.ts` は実appが最終eventを届け、3秒後もdraw/suspendが増えないことを検査する。音源単体も3000phraseを残して後続game音を拒否する回帰を持つ。

## 保存済みログとPNGの確認

- `browser-first.log`: Chromium/WebKit計36件成功。実3000/30球clear、静的3D、PNG/download、ACK→Hall再送、stale response、匿名、2999loss、長い名前と対象外、既存ranking/position回帰を含む。
- `share-fallback-red.log`: canShare例外ケースの両engine失敗を保持。`share-fallback-green.log`: 修正後の同ケースと生成中home遷移の両engine計4件成功。
- `new-features-green.log`: 対象5ファイル26unit成功。`terminal-adversarial-2.log`: terminal/audio対象2ファイル10unit成功。
- `pre-freeze-unit.log`: 83ファイル942unit成功。`pre-freeze-typecheck.log`: TypeScript診断なし。
- `postgres-concurrency.json`: ローカルPostgreSQL 17.11で同名2接続が番号1/同じ登録時刻、別名が2/3、entries=3、nextNumber=4、result=passed。これはログの整合確認であり、DB試験の再実行や本番確認ではない。

`browser-first-results` のChromium/WebKitそれぞれのcertificate.png、WebKit clear-result.png、WebKit long-name-certificate.pngの計4PNGを直接実見した。900×1200の賞状に名前・殿堂登録 第7号・2026年10月27日UTC・落球数0が整って表示されていた。20絵文字名は縮小されて枠内へ入り、対象外の賞状に正式番号は出ていない。resultは通常のretry/home/保存操作を保っていた。

## 別途残る検証・制約

このレビューは現在のworking treeとpre-freezeの保存済み証跡を対象とする。最終commitの全browser/build/release/配布物・実行SHAの結合は後続確認が必要。新しい実性能/flash解析、実機iPhoneの保存・ネイティブ共有、音の人間による聴取、全SQL権限/サーバー側の完全な監査は今回の範囲外である。

named pendingは既存の単一localStorage配列を使う。複数tabの同時更新・storage使用不能時の永続化をこのレビューや新テストで保証していない（使用不能時は実装どおりmemory保持）。in-flight PNGのstale結果は破棄するが、開始済みCanvas/toBlobの処理自体をabortする仕組みではない。これらをImportantな新規欠陥として立証したものではなく、保証範囲の限界として分けて記録する。
