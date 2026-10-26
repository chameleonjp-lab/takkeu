# 自動画質の仕様

ユーザーが設定で明示的に「自動（負荷に応じて調整）」を選択した場合だけ有効。既定値standard、v1 key、保存済みstandard/lowは維持。不正値はstandardへ復旧。auto時の音声はstandard、花火/電撃の密度もstandardのまま。実効解像度をlow音質や演出密度へ伝えない。

## 段階と入力
0=現在のstandard計算サイズ（DPR<=1.5・2Mpixel）、2=現在のmanual low計算サイズ（DPR<=1・518400pixel）、1=それらの幅/高さの中間を整数化。同じCSSサイズ/DPRで比較、0/2は既存寸法と完全一致。既存LOWより下げない。DPR1の小画面など同一サイズになる段階はbuffer再確保しない。

GameView.setResolutionLevel はrenderer.setSize(...,false)とscreen shaderのuResolution/viewportのみ更新。Canvas CSS、camera fit、inputMapping生成、pointer mapping更新、swipe cancel、simulation/loop clockを呼ばない。layout resizeは従来のresize経路へ分離し、orientation/DPR/CSS変更時だけcameraをfitする。viewは最後の幅/高さを保存し、物理buffer寸法が変わる場合だけ確保する。

## 計測と初期定数
- 非重複の連続した3,000ms active描画区間を評価。p95はnearest-rank。
- p95>25msを2区間連続で観測すると1段階下げる候補。単一burstが評価境界をまたぐ誤判定を防ぐため、遅いsampleの開始〜最後が3,000ms以上あり、最後の遅いsampleが評価時点の1,000ms以内であることも要求する。
- p95<=18msの区間が累計20,000ms以上連続すると1段階上げる候補。
- 切替から次切替までactive時間で10,000ms以上。一度に1段階。
- 初期・切替・pause/resume・hidden・layout/rotation・WebGL restore・loadingの後は履歴を捨て、1,000msのwarmup後に新しい区間を開始。
- 非finite/逆行・1,500msを超える時刻gapは履歴を破棄。通常の遅延pause規則はloop側がそのまま判定し、そのframeを除外。
- 手動モードでcontrollerは介入しない。retry/homeは段階0へリセットし、古い履歴を持ち越さない。同じplayのpause/rotation/context復旧では段階は維持、履歴だけ破棄。
- 保持量は固定長4,096 sample。毎frameは時刻差と1sampleを書くだけ。並べ替えは3秒ごとの評価時のみ。GPU同期・毎frameログ・毎frameCanvas resizeなし。

最小段階で負荷が残ればそのまま維持して記録する。自動画質でpixel数を減らした効果は、同画質で描画効率が改善した結果から区別する。120Hzも同じwall-ms閾値を使い、frame数を3秒とみなさない。

## 事前に定める視覚・操作判定
Stage1同解像度はRGBA完全一致、同snapshot/geometry/order。Stage2 manual standard/lowもAまたはStage1の同じ画質と完全一致を目標。auto0はstandard同等、auto2はlow相当のbufferサイズにstandardの全演出密度を保持する。

既存の客観閾値（baseline白core>=220の適格5×5領域はafter>=200、独立した加算batch各RGB寄与85〜115%、input<1CSSpx）を緩めない。初めから重なって隠れた球は白coreの標本外として件数を明記。full native aspect画像、標準/中間/低相当を別保存。輪郭差、光面積差は数値化する。point spriteが固定buffer-pixelサイズを使うことによるCSS上の見え方も未検証のまま同等と断定しない。

点滅は既存60Hz・6s・解析閾値のまま再測定。過去の7警告を解除しない。切替時を含めた追加観察を保存し、実機/HDR/正式WCAG/人間視認と区別する。
