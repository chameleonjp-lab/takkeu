# 自動画質の仕様

追加指示「演出維持の制約を撤回」を適用。描画内容は[改訂Stage1](revised-effects.md)の簡略版を基準とする。以下の旧画素一致・全演出密度維持の記述より、この改訂と最新の測定を優先する。

ユーザーが設定で明示的に「自動（負荷に応じて調整）」を選択した場合だけ有効。既定値standard、v1 key、保存済みstandard/lowは維持。不正値はstandardへ復旧。auto時の音声はstandard、花火/電撃の密度もstandardのまま。実効解像度をlow音質や演出密度へ伝えない。

## 段階と入力
0=現在のstandard計算サイズ（DPR<=1.5・2Mpixel）、2=現在のmanual low計算サイズ（DPR<=1・518400pixel）、1=それらの幅/高さの中間を整数化。同じCSSサイズ/DPRで比較、0/2は既存寸法と完全一致。既存LOWより下げない。DPR1の小画面など同一サイズになる段階はbuffer再確保しない。

GameView.setResolutionLevel はrenderer.setSize(...,false)、viewportと解像度依存uniform（fieldのuResolution、spriteのuResolutionScale）を更新。Canvas CSS、camera fit、inputMapping生成、pointer mapping更新、swipe cancel、simulation/loop clockを呼ばない。layout resizeは従来のresize経路へ分離し、orientation/DPR/CSS変更時だけcameraをfitする。viewは最後の幅/高さを保存し、物理buffer寸法が変わる場合だけ確保する。

## 計測と初期定数
- 非重複の連続した3,000ms active描画区間を評価。p95はnearest-rank。
- p95>25msを2区間連続で観測すると1段階下げる候補。単一burstが評価境界をまたぐ誤判定を防ぐため、遅いsampleの開始〜最後が6,000ms以上あり、最後の遅いsampleが評価時点の1,000ms以内であることも要求する。
- p95<=18msの区間が累計20,000ms以上連続すると1段階上げる候補。
- 切替から次切替までactive時間で10,000ms以上。一度に1段階。
- 初期・切替・pause/resume・hidden・layout/rotation・WebGL restore・loadingの後は履歴を捨て、1,000msのwarmup後に新しい区間を開始。
- 非finite/逆行・1,500msを超える時刻gapは履歴を破棄。通常の遅延pause規則はloop側がそのまま判定し、そのframeを除外。
- 手動モードでcontrollerは介入しない。retry/homeは段階0へリセットし、古い履歴を持ち越さない。同じplayのpause/rotation/context復旧では段階は維持、履歴だけ破棄。
- 保持量は固定長4,096 sample。毎frameは時刻差と1sampleを書くだけ。並べ替えは3秒ごとの評価時のみ。GPU同期・毎frameログ・毎frameCanvas resizeなし。

最小段階で負荷が残ればそのまま維持して記録する。自動画質でpixel数を減らした効果は、同画質で描画効率が改善した結果から区別する。120Hzも同じwall-ms閾値を使い、frame数を3秒とみなさない。

## 事前に定める視覚・操作判定
Stage1は削除/簡略化した装飾を明記し、同じsnapshotの白中心・ラケット・警告・入力を検証する。画素完全一致を要求しない。auto0は改訂版standard同等、auto2はlow相当のbufferサイズに改訂版standardのfeedback/音声を保持する。

既存の客観閾値（baseline白core>=220の適格5×5領域はafter>=200、独立した加算batch各RGB寄与85〜115%、input<1CSSpx）を緩めない。初めから重なって隠れた球は白coreの標本外として件数を明記。full native aspect画像、標準/中間/低相当を別保存。輪郭差、光面積差は数値化する。point spriteが固定buffer-pixelサイズを使うことによるCSS上の見え方も未検証のまま同等と断定しない。

点滅は既存60Hz・6s・解析閾値のまま再測定。過去の7警告を解除しない。切替時を含めた追加観察を保存し、実機/HDR/正式WCAG/人間視認と区別する。

## 検証で見つかった補正
warmupをまたぐintervalは全体を評価から外す（単に末端時刻がwarmup後かどうかでは判定しない）。1000ms刻みの再現で6000msに降格した初期失敗を保存し、最短7000msへ修正した。短い200msのpause/hidden/context中断もlong-gap規則とは独立に検査する。

花火はgl_PointSizeがbuffer pixel単位のため、解像度だけを下げるとCSS上の直径と明るさが増えた。auto時だけ `currentBuffer / standardBuffer` の比でpoint sizeを補正し、manualのuniformは1を維持する。402×874/DPR2・同じsnapshot/stateで中間/最低のRGB寄与は補正前1.356–1.997倍、補正後0.998–1.004倍。85–115%基準を変更していない。最初の診断はrunIdが異なり色場がずれていたため失敗手法として保存し、別contextの同一runId/全stateで再比較した。これは描画資源統合による性能改善ではなく、解像度変更時の表示保護である。

policy上下と短期historyの2つのbrowser testは、virtual clockを進める間だけtest-owned render gateでGPU描画を省く。実App RAF→controller→real renderer.setSize/viewportとCPU uniformを検証し、GPU uniform upload・実性能・画像の証拠には使用しない。held pointer/lifecycleのbrowser test、すべての描画比較、正式A/C/D/E性能測定は全frame描画。実GL uResolution/viewportとpoint-sprite寄与は別のfull-render診断で照合する。

4秒の単発arrivalが2つの評価窓をまたぐ敵対的ケースで初期の3秒pressure-spanは誤降格した。pressure-spanを2評価区間の6秒へ変更し、first slow intervalの開始を起点にする。p95/3秒窓/2連続/cooldown/復帰閾値と絶対性能基準は変更しない。開始直後からの持続負荷はwarmup後2区間、途中からの負荷は評価位相により6〜9秒を確認する。これを検証で必要になった保守的な初期調整として記録し、旧b673の測定15回は初期版の記録へ分離する。

最終独立レビューで、先行する40msの1sampleがあり、その後に4秒burstが来る場合には降格し得ることも確認した。6秒guardはfirst-to-lastの間隔であり、その間の全sampleが遅いことの証明ではない。goodな評価窓でpressureを消す。孤立した1frameだけでは降格せず、2つのp95不良窓とcooldownは必須。「どの履歴でも4秒burstを必ず無視する」「連続6秒の過負荷を保証する」とは主張しない。
