# 3500ラリー変更の結果

製品HEADは `fdbdf46b9d8b846db200a2895cf73a73f8e2f02d`。Stage A `4bc1477`、Stage B `63d972c`、Stage Cは検証と発見した不具合の修正を分けて記録した。既存Draft PR #27のbranch `feat/rally-4000-effects` のみ更新し、本番migration適用・main push/merge・自動merge・Pages公開は実施していない。

|項目|結果・根拠|
|---|---|
|3500上限|2999→3000→3001継続。3499→3500で一度だけclear。30球同時返球でも3500を超えない。後続stepはscore/physics/simTime/events固定。|
|競合|既存時刻順→bounce→ball ID順を維持。異なる時刻と厳密同時刻、ball ID逆転の両方を確認。|
|物理保護|simulation/difficulty/milestones/progression/collision/scheduler/opponent/targets/trajectory/flightSpeed/viewpoint/input/loop/preferences/44コメントの18fileはbaseと一致。configのfixedDt1/120、maxSteps12、slowFrame1.5秒も維持。|
|一時電撃|500/1000/1500/2000/2500/2750/3000/3500。2個の共通bufferのみ、期限後drawRange0・vertex/upload停止。2750は別pattern、3000通過、3500のみfinish。3250等の常設stageなし。|
|通常feedback|1500以上でhit-ring/loss-sparkと通常fireworkの生成・描画を停止。音声・ゲームevents・counterを維持。|
|落球|1〜100のfactsを保持。10/20/30/40/50/55/60/70/77/80/88/90〜100をscoreと独立判定。到達と特殊落球の電撃は共存。100は99以下の数字を復帰させず2秒で結果へ。|
|3500finish|確定snapshotを変えず表示時計だけ2.8秒進める。電撃中も球・simTime固定、入力停止。通信は確定直後から開始。終了後の追加3D render0。|
|中断|hidden/contextlostで一時表示を失効し、score/loss dedupは保持。旧canvasはclean frameまで隠す。user pauseでは停止フレームを保持。direct restore/retry、reduced-motion、home/破棄、20回retryを検証。|
|音声|3000の大きな到達音後も打球と警告音が有効。3500専用fanfareは実AudioContextで末尾を保持し自然終了、sourceを解放。打球/警告優先順は維持。|
|旧記録|共有score_max=100000000維持。旧4001等のpendingは元の版/APIで再送。旧3000pendingもv1に固定。同名の旧first/best4001が新clear3500で書換えられないことをSQLで確認。|
|殿堂|goal-3500-v1 / takkeu-web-clear-3500-1 / v2 RPC。旧3000台帳とcounterを分離。verified finish+score receipt+normal分類を確認し登録。同名は同番号/初回日、別名並行採番と再送は実PostgreSQL17で確認。|
|SQL権限|anon/authenticatedは必要なRPCのみEXECUTE、hall/counter直接アクセス拒否。generic RPCで新rule3501以上を迂回送信できない。共有ranking分類を変更しない。|
|本番DB|20:17 UTCのREAD ONLY監査で3000 migration未適用、旧/新hall・clear RPCなし。未公開SQLを整合。適用は別承認待ち。deployment.md参照。|
|画面/賞状/共有|home/HUD/通知/結果/殿堂/manifest/OGP/Xを3500へ。PNG900×1200。正式番号はserver receipt確定時のみ。44コメントと旧自己ベスト共有を維持。|
|単体/ビルド|最終969 unit成功、型検査成功、通常/Pages build・配布物8条件成功、実PG競合成功。全件CIの正確なSHA/job/countはci-summary.json参照。|
|最終CI|push40584273034とPR40584299598は各6job成功・0失敗（5検証+1集約）。各runで969 unit+236 browser+8配布物=1213条件成功。製品SHAはfdbdf46b9d8b846db200a2895cf73a73f8e2f02d、PR checkoutの仮想merge2fffd2cc7f4eb450cb24e571245d15893d4b5a8cは全tree一致。ci-summary.jsonとci-logs/の完全logを保存。|
|縦横/入力/視認|既存の縦横・直接タッチ座標・低画質1px精度・文字200%検証を維持。280px危険表示のoverflowを発見して折返し修正。30球固定姿勢を静止画で確認。実iPhoneでの操作感は未確認。|
|点滅|同じ旧解析器のself-test5件、base8/変更後8条件×192frame=3072frame、60Hz・1024×768 SDR canvas。両群とも閾値超過0。全frameはlossless RGB復号hashを確認して保存。過去の別corpusの7警告は解消済み扱いにしない。|
|性能|実60秒×2engine×2画質、30球を全区間維持。最終Linux目標は4条件すべて未達。p95/p99の増加も記録し、改善を主張しない。performance.md参照。|
|メモリ|GC後heapは20回+975532B、100回+1470276B。100回の最後10回は+2736B、後半20回+19432B。DOM480/doc1/listeners55、geometry55/texture4/program17が一定。微増は残り、長期の漏れを否定する証明とは扱わない。|

実60秒は555開始の通常loopで、固定step・球数・難易度・slow guardを変更していない。3500境界/描画期限の仮想時計テスト、固定姿勢render+readback+PNG encodeは別の記録である。

独立reviewはreview.md、最終の独立静的監査と証拠照合はfinal-audit.md。最終監査で新たなCritical/Importantはなかった。到達と落球の排他表示、中断演出の再開、100後の99復帰、狭幅危険labelを再現して修正し、元のscore/priority/width/点滅/性能判定条件を保持した。意図的な判断は「hidden/context中断は残りの一時演出を失効する」。そのため中断前の残り演出は再生しない。

途中の失敗: 旧4000通知を期待する1種類のテストと、OGP旧説明期待4件を更新。100優先に合わせ旧99の3秒維持期待を更新。archive内のvalidation/takkeu-final-loss-browser.logはこの途中の2失敗を含むログで、最終成功ではない。修正後はvalidation/takkeu-loss-limit-final.logの両engine2成功と最終CIを参照する。280px/200%の実overflowはCSSで修正。ローカル42条件の1失敗はmanifest編集中のHMR navigationで、ソース固定後の同ケースは両engine成功。初期WebKit依存library不足は実行環境内のlocal sys/libで解消した。これらを成功結果で上書きせずログを残した。

未解決はLinux性能目標未達、GC後heap微増・長期実機未確認、実iPhone/Safari・HDR・人間の視認/操作感・正式な点滅適合、本番SQL適用/公開の承認待ち。機能テスト成功をこれらの解決と読み替えずDraftを維持する。
