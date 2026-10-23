# 実canvasの操作動画と確認記録

縦画面の確認用動画は、最初からviewport・録画枠とも390×844に固定した。[Chromium native demo](chromium-native-demo.webm)（6.52秒）と[WebKit native demo](webkit-native-demo.webm)（7.64秒）。対象SHA `01768abab9979f4e422bb8d17d1f63ad361fb01a`。製品コードは画像比較・最終実入力検査の `2c3d95d62e019c60bc17a6d7b00f737e1a86f3ea` と同一。

実際のcanvasへPlaywrightのnative mouse down/move/upを送り、初回配置→左右のdrag→release→hoverしても保持→Escape停止を記録した。目標座標をsimulationへ注入していない。黄色/灰色の位置マーカーとevent名は撮影用DOMのみで、pointer-events:none。cameraによる投影で入力点を用意し、既存の製品入力へ渡している。[撮影script](capture-demo.mjs)、[全入力後snapshot](native-demo-input.json)、[録画情報](native-demo-manifest.json)、[実行ログ](../logs/native-demo-and-pixel-caps-01768ab.log)。

ゲーム時計は制御して各入力後25ms進め、見える時間を確保するため実時間の待ちを入れた。実時間性能の動画ではない。位置マーカーはDOM eventで更新し、ラケットは固定計算後の次の描画で更新するため、入力直後の一部frameには次の描画を待つ差が写る。試験の最大1tick待ち/1px整合は別の単体・browser検査で確認した。実指/ペン/OS操作の撮影ではなく、実iPhoneは未確認。

元動画をFFmpegで順序通り4fpsのframeに展開し、全57sample frameを6枚の時刻入り連続画像で目視した。初回前のラケット表示、配置、drag時の中心とマーカー、release後の保持、離したpointerの移動でラケットが動かないこと、停止メニューを確認した。これは人が端末を操作しながら実時間で再生した評価ではない。元の全frameを含む動画も保存している。

| Engine | 時刻順の確認画像 |
| --- | --- |
| Chromium | [0–2.75秒](chromium-native-demo-sequence-01.jpg) / [3–5.75秒](chromium-native-demo-sequence-02.jpg) / [6秒以後](chromium-native-demo-sequence-03.jpg) |
| WebKit | [0–2.75秒](webkit-native-demo-sequence-01.jpg) / [3–5.75秒](webkit-native-demo-sequence-02.jpg) / [6秒以後](webkit-native-demo-sequence-03.jpg) |

最終28件browser再検査の元動画も保持した（SHA2c3d95d）。[Chromium3返球](chromium-three-rallies.webm) / [WebKit3返球](webkit-three-rallies.webm)は、現在見える球の位置から実canvasへnative入力し、ワンバウンド後の返球を3回つないだ記録。autoplayや未来の目標注入を使わない。1fpsで全時間を抽出した51sampleを時刻順に目視し、球とラケットの移動、score3への到達、最後の位置の保持を確認した。時計制御・画像取得/録画後処理による静止区間があるため、動画の実時間長さをゲームの速度や性能とみなさない。

[Chromium直接操作](chromium-direct-390.webm) / [WebKit直接操作](webkit-direct-390.webm)、[Chromium二本指](chromium-two-finger.webm) / [WebKit二本指](webkit-two-finger.webm)も5fpsの時刻順sampleで目視した。二本指は合成PointerEventによる検証。両release成立、明示再開後のdrag、入力中断による別の停止を含む。元のPlaywright録画枠はcontext作成時のサイズで固定されるため、試験途中のviewport変更で灰色のletterboxがある。ゲームのviewport余白ではない。上のnative demoはこの録画上の余白をなくした追加証拠で、元動画を削除/加工置換していない。

[元録画のmanifest](manifest.json)に対応する全13枚のsequence画像を確認した。録画サイズ・sample周期・元ファイルへの対応を記録している。これらの動画・静止sampleだけで、高速接触の網羅、実機の操作感、読み上げ、点滅安全性を合格としない。

同じscriptで、実製品ページの設定から品質を変更し、DPR3・390×844と3000×2000を両engine/両品質で検査した。[実canvasのpixel cap8条件](actual-pixel-caps.json)。CSS矩形はviewportと一致。390×844は標準585×1266、低負荷390×844。3000×2000は両品質で200万pixel以下かつ199万pixel以上となり、実描画bufferでも上限が働くことを確認した。
