# 点滅の最終一次検査

元の`rallyFlashAnalysis.py`（SHA256 `daf77a431d9585044b30b64fa6d2f2e2a452f6c0ca621e2c4466dd64d2551f5d`）と5自己検査、0.1 luminance/赤UCS0.2/341×256の25%面積21,824px/1秒3閃光の閾値を変更していない。SDR/sRGBの6秒/360frame/60Hz、native1024×768でcanonical36sequenceをA/F撮影した。LOWは同じCSS比率で描画し、縦横を取り違えた拡大をしていない。

今回のfresh A/F canonical一次警告 **9→1**、新しい警告 **0**。元の7警告は1000両品質・1500両品質・3000低・4000両品質で、元log/動画/全解析rowを残す。新しいA/Fは同じscene状態・撮影条件で比較したが、一部の旧6ec動画と新しいAのwhole RGBは一致しない。snapshotとRallyEffectsStateが一致する確認例もあり、RGB差の原因は未分離である。旧RGBとの一致/不一致を行ごとに記録し、**原7警告の無条件な全面解決とは扱わない**。今回の有限な観測から正式WCAG適合や実機での光安全性を保証しない。

| scene | A警告 | 最終警告 | A/Fの平均輝度peak | A/Fの一般高頻度面積 | A/Fの赤高頻度面積 |
|---|---|---|---:|---:|---:|
| 1000-low | True | True | 0.61395/0.44823 | 6432/6432 | 0/0 |
| 1000-standard | True | False | 0.65738/0.51750 | 10267/10265 | 0/0 |
| 1500-low | True | False | 0.64765/0.22760 | 7899/7811 | 0/0 |
| 1500-standard | True | False | 0.64805/0.23578 | 9207/10395 | 0/0 |
| 2600-low | True | False | 0.55834/0.23512 | 9152/10328 | 0/0 |
| 2600-standard | True | False | 0.55982/0.23578 | 9207/10395 | 0/0 |
| 3000-low | True | False | 0.53211/0.21972 | 6824/7335 | 0/0 |
| 3000-standard | False | False | 0.54473/0.23935 | 9175/9875 | 0/0 |
| 390-low | False | False | 0.44997/0.44968 | 6890/6890 | 0/0 |
| 390-standard | False | False | 0.45139/0.45109 | 6594/6594 | 0/0 |
| 4000-low | True | False | 0.53141/0.22959 | 8769/8566 | 0/0 |
| 4000-low-fireworks | False | False | 0.57209/0.26182 | 10410/10846 | 0/0 |
| 4000-low-loss100 | False | False | 0.55644/0.23063 | 6985/2804 | 0/0 |
| 4000-low-reduced | False | False | 0.56001/0.23732 | 0/0 | 0/0 |
| 4000-standard | True | False | 0.53087/0.21527 | 6293/6377 | 0/0 |
| 4000-standard-fireworks | False | False | 0.56289/0.24516 | 9483/10357 | 0/0 |
| 4000-standard-loss100 | False | False | 0.55760/0.23113 | 10822/2853 | 0/0 |
| 4000-standard-reduced | False | False | 0.52537/0.20058 | 0/0 | 0/0 |

各pixelが必ず暗くなった、全ての局所指標が低下したとは主張しない。個別指標の増加は`manual-final-safety-derived.json`のmetricIncreasesに値を含めて保存する。台/白球/光の面積、赤の急変、平均/最大輝度、closing-frameの数は元rowから確認できる。reduced-motion/100loss/64花火facts・30ballIDsの重複stressも対象とした。

残る1000-lowの警告は一般のlarge-closing frameが1秒に4回で、既存の3回上限を超える。赤pixelの最大回数も2→3へ増加し、2600標準の高頻度面積も9207→10395pxへ増加する。この局所的な悪化を「追加警告なし」から隠したり、安全性改善と数えたりしない。残存警告と正式な光安全性は未解決のままDraftに残す。

さらに実物理で3999→4000→以後の30球を各mode/A-Fで6秒/360frame、計4sequence撮影した。こちらはCSS HUDも含むnative1024×768のブラウザ全画面で、nominal60Hz（16/17ms刻み、採取時刻誤差1ms以内、実RAFも保存）の**補足検査**。canonicalのcanvas-only/synthetic overlapと区別する。原解析器が出力する汎用method注釈の「canvas-only」「synthetic」は、この補足撮影の性質を表していないため、capture-scope.jsonを併記する。

補足の警告：A['standard', 'low']、最終['standard', 'low']、新規[]。標準/低画質の両方で残存しており、光安全性の合格とは扱わない。

| 補足mode | A/F警告 | A/F平均輝度peak | A/F一般高頻度面積 | A/F赤高頻度面積 | A/F一般large-closing回数/秒 |
|---|---|---:|---:|---:|---:|
| standard | True/True | 0.52779/0.24709 | 40783/37098 | 6/2 | 7/1 |
| low | True/True | 0.52551/0.24542 | 38613/34713 | 2/1 | 7/1 |


再撮影した各modeの360対、合計720対で、snapshot/effects/newEvents/renderingEnabled/clock/球の投影座標/CSS/drawingSize/警告/通知の全キーが厳密一致した。`manual-physical-flash/frame-equality.json`に比較キーとcapture SHA256を保存した。初回4sequence/1440frameはDate時計だけを揃えたためnavigation由来のperformance.timeOrigin差が残り、一部の物理状態も不一致となった。初回データは`manual-physical-flash-initial-clock-mismatch/`へ保存し、採用比較には使わない。test時計をperformance.now=120000、initialRAF=120016へ厳密に揃えて取り直した。0frameの環境起動失敗、修正runner/command/RED→GREENの照合も保存する。製品/閾値/360frame/6秒を変更していない。
全40sequence/14,400frameの解析row、撮影状態、PNG/SHA256、lossless RGB動画/参照を保存した。以前の動画を再利用する場合も、新しく撮影した全360frameのdecoded RGBが一致することを確認し、6ecのvideo parts/whole video/全decoded RGBをこのsessionで再復元検証する。無損失RGBと元PNGコンテナの再現は区別する。

**未確認：** 人間の視認、正式なWCAG/PEAT/Harding認証、実機HDR/端末の残像・PWM・高輝度表示。prefers-reduced-motionの装飾運動抑制は機能検査と低運動sequenceで確認し、物理演算/入力は変更しない。
