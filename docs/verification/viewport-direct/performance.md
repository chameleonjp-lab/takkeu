# 実時間性能の記録

60秒×8条件の記録処理は完了したが、Linux参考目標（実行を継続し、running区間の95%以上が25ms以内）は **0/8条件達成**。性能合格ではない。過去のLinux未達を引き継ぐ。実iPhone/Androidの測定は未実施。

対象製品/性能test SHA: `2c3d95d62e019c60bc17a6d7b00f737e1a86f3ea`。2026-10-23 20:19–20:28 UTC、Debian13、Chromium SwiftShader / WebKit。`npm run test:performance`を単独実行し、同じホストで別のbrowser、unit/build、画像解析・動画変換・artifact展開を並行しなかった。時計制御なし、生requestAnimationFrameを使用。

[実行ログ](logs/performance-2c3d95d.log)、[全Playwright結果](runs/performance-2c3d95d/performance-results.json)、[集計JSON](runs/performance-2c3d95d/summary.json)。各行の原データには全RAF間隔と各frameのwallMs/simTime/phase/pauseReasonを保存。

| Engine / 品質 / 開始score | 実経過秒 | ゲーム内経過秒 | 全RAF p95 ms | running p95 ms | running ≤25ms | 最終状態 | 原データ |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| chromium / standard / 450 | 60.197 | 41.917 | 249.9 | 249.9 | 17.400% | running / なし | [JSON](runs/performance-2c3d95d/chromium-browser-performance-60s-standard-450.json) |
| chromium / standard / 555 | 60.148 | 39.700 | 266.7 | 266.7 | 18.293% | running / なし | [JSON](runs/performance-2c3d95d/chromium-browser-performance-60s-standard-555.json) |
| chromium / low / 450 | 60.014 | 0.183 | 16.7 | 16.7 | 100.000% | paused / slow-frame | [JSON](runs/performance-2c3d95d/chromium-browser-performance-60s-low-450.json) |
| chromium / low / 555 | 60.080 | 39.592 | 283.3 | 283.3 | 16.803% | running / なし | [JSON](runs/performance-2c3d95d/chromium-browser-performance-60s-low-555.json) |
| webkit / standard / 450 | 60.004 | 58.775 | 54.0 | 54.0 | 0.000% | running / なし | [JSON](runs/performance-2c3d95d/webkit-browser-performance-60s-standard-450.json) |
| webkit / standard / 555 | 60.024 | 58.883 | 68.0 | 68.0 | 0.085% | running / なし | [JSON](runs/performance-2c3d95d/webkit-browser-performance-60s-standard-555.json) |
| webkit / low / 450 | 60.026 | 58.850 | 50.0 | 50.0 | 0.000% | running / なし | [JSON](runs/performance-2c3d95d/webkit-browser-performance-60s-low-450.json) |
| webkit / low / 555 | 60.059 | 50.367 | 175.0 | 175.0 | 4.424% | running / なし | [JSON](runs/performance-2c3d95d/webkit-browser-performance-60s-low-555.json) |

Chromium low/450はgame内0.183秒後にslow-frame停止した。running sample11、paused sample3497。全RAF p95=16.7msとrunning95%値が軽く見えるが、60秒連続実行を満たさず未達。停止境界の長い間隔は全intervalsに残り、running-only集計は両端runningの間隔だけなので、継続状態と合わせて判断する。

runningで終わった条件でも、実経過60秒に対しgame内39.592〜58.883秒だった。既存の1frame最大12計算/.1秒catchupにより超過時間を捨てるためで、実時間とgame内時間を同一とみなさない。1.5秒超の長遅延停止、計算回数上限、停止中の描画抑制は緩和していない。

ChromiumはCSS1280×720/DPR1、標準・低負荷とも内部1280×720（921600pixel）。DPR1では低負荷の倍率上限変更だけによる縮小はない。WebKitはCSS390×664/DPR3、標準585×996（582660pixel）、低負荷390×664（258960pixel）。全条件200万pixel以下。品質変更による人の快適さ・実機での熱/電池/安定性は未確認。

この参考計測は変更前後の同一性能環境比較ではない。旧Linux結果を上回った／悪化したという定量比較を主張しない。全面化で描画pixelが増えるため、実機Safariで標準/低負荷・450/555を各60秒連続計測して確認する。機能用の時計制御30ゲーム秒検査やCIの所要時間は実時間性能の代用にしない。
