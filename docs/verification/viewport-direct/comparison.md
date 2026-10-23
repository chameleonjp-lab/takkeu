# Viewport変更の前後比較

20状態すべてでcanvasの左上は(0, 0)、幅・高さはbrowser viewportと一致し、最大誤差は0 CSS pxだった。台の前幅・奥行き、初期ラケット面、球の表示寸法は、対応する基準画像より1.185〜1.736倍に増加した。測定した台4隅、400個の境界配置でのラケット全頂点、可視軌道の球形状には、変更後の画面外へのはみ出しを認めなかった。

発光状態の明るい高彩度画素はviewportの71.705〜87.697%を占め、基準の3.042〜4.209倍になった。これは静止画の面積測定であり、点滅の安全性を判定した結果ではない。

## 条件と照合対象

- 変更前SHA: `3e7ceba208200db931af645fdae1ccb271f4a7b7`（`/workspace/takkeu-baseline`、port 4180）。
- 変更後SHA: `2c3d95d62e019c60bc17a6d7b00f737e1a86f3ea`（`/workspace/takkeu`、port 4178）。製品sourceは `139f972314edc77194d10075ee1b804b57821d12` と同じで、そこからの差分はtest/CIのみ。
- Chromium 156.0.8078.4 / WebKit 27.2、Linux headless、deviceScaleFactor=1、locale=ja-JP、reducedMotion=reduce。各画面サイズごとに新しいbrowser contextを作成。
- CSS viewport: 390×844、844×390、1280×720、320×568、280×360。各engineで `stage2.show(0, 1.25)` と `stage2.show(555, 1.25)` を撮影し、合計20状態を照合した。
- score 0は初期の通常表示、score 555は発光・多要素表示の比較に使った。時刻を一致させ、発光位相や配置の差を排除した。fixtureの固定snapshotであり、実プレイで555へ到達する動画ではない。
- 既存の `tests/helpers/viewportEvidence.mjs` と `viewportEvidenceAnalysis.py` は変更せず実行。GPU使用可の通知後に撮影を開始し、撮影中は他のbrowser/GPU処理を停止した。この担当ではunit/performanceを実行していない。

20状態すべてでconfig、eye/target、reference aspect、camera姿勢/near/far、初期paddle `(0, .5)`、実ラケットmesh頂点、clamp後の境界点、ball snapshot、trajectory planとworld sampleが前後一致した。サイズ差は同一world geometryの投影結果として比較できる。入力mappingを呼ばず、Threeのcamera行列で独立に投影した。

原データ: [前manifest](baseline/manifest.json)、[後manifest](after/manifest.json)、[後analysis](after/analysis.json)、[前後比較JSON](after/comparison-data.json)、[実行条件・file SHA256](after/run-context.json)。各 `*.json.gz` は生の数値を保持した可逆圧縮JSON。各状態にviewport/fullpage/canvasの3 PNGを保存した。

## 表示寸法

以下はscore 0のCSS px。score 555でも同じ拡大倍率で、両engineの幾何計測値は一致した。球はscore 0ではcore、555では可視glow外形を計測している。

| Viewport | Canvas面積率 前→後 | 台前幅 前→後 | 台奥行き 前→後 | ラケット面幅 前→後 | 球幅 前→後 | 共通拡大倍率 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 390×844 | 26.866% → 100.000% | 318.108 → 376.812 | 139.884 → 165.698 | 44.619 → 52.853 | 11.240 → 13.314 | 1.184541× |
| 844×390 | 25.553% → 100.000% | 315.026 → 499.432 | 138.529 → 219.619 | 44.186 → 70.052 | 11.131 → 17.647 | 1.585366× |
| 1280×720 | 26.993% → 100.000% | 531.066 → 922.028 | 233.530 → 405.451 | 74.489 → 129.326 | 18.765 → 32.579 | 1.736182× |
| 320×568 | 31.401% → 100.000% | 255.559 → 309.179 | 112.379 → 135.958 | 35.845 → 43.366 | 9.030 → 10.925 | 1.209816× |
| 280×360 | 41.888% → 100.000% | 219.802 → 270.531 | 96.655 → 118.963 | 30.830 → 37.945 | 7.767 → 9.559 | 1.230796× |

幅・高さ方向の倍率差は最大 `9.11e-15` で、非等方な引き伸ばしは観測されなかった。全viewportsでサイズが増加し、縮小する例外はなかった。縦画面は横幅が台の大きさを制約するため、横画面・PCほど倍率は増えない。視点を保ってcanvasを縦へ広げた分、上方の背景と手前の床が広く映る。

## 画面内への収まり

余白は対象の最外点からviewport端までの最短距離。変更後はcanvasとviewportが同じため両境界の値も一致する。ラケットはfaceだけでなくwood、front/back rubber、handle、grip、rimの実頂点を使用し、左右各101点・上下各99点の計400境界配置で測定した。軌道は64組のincoming/outgoing plan、各401時点を生成し、そのscoreで可視となる球の実mesh頂点を投影した。

| Viewport | 台4隅の最小余白 | ラケット400配置の最小余白 | 可視軌道 score0 最小余白 | 可視軌道 score555 最小余白 |
| --- | ---: | ---: | ---: | ---: |
| 390×844 | 1.719px | 2.393px | 30.134px | 28.109px |
| 844×390 | 74.750px | 41.066px | 51.003px | 7.938px |
| 1280×720 | 138.001px | 75.814px | 94.159px | 14.655px |
| 320×568 | 1.411px | 1.964px | 24.725px | 23.064px |
| 280×360 | 1.234px | 1.718px | 21.634px | 20.181px |

変更後は全20状態で初期paddleと台4隅がviewport内にあり、境界配置のclip件数、可視軌道球のclip sample数はともに0だった。400境界配置は投影計測であり、スクリーンショット自体は初期paddle位置の静止画である。軌道は可視sampleがscore 0で25,728、score 555で51,328あり、すべての乱数seed・連続位置を証明するものではない。

基準の280×360では、score 0のcanvas実可視面積はviewportの36.413%、score 555では19.817%だった。score 555の台前方は48.350px、初期paddle全体の最下端は38.539px、最低境界のpaddleは72.364pxだけviewportを越えていた。変更後は両scoreともcanvasの100%が可視となり、これらのはみ出しは解消した。

基準score 555の軌道外形は、保存済みworld sampleとcamera行列から実glow mesh（24×16）へ再投影済みの値を用いた。変更後captureも同じglow meshを使用する。[基準の補正記録](baseline/glow-sphere-sampling-correction.json)を保持している。

## 発光状態の画面面積

画面内canvasに含まれる「max(R,G,B) ≥ 192、HSV彩度 ≥ 0.3」の画素を明るい高彩度画素として数えた。高輝度画素はlinear sRGB相対輝度 ≥ 0.5。以下はscore 555、Chromiumのviewport全体に対する割合である。

| Viewport | 明るい高彩度画素 前→後 | 面積倍率 | 高輝度画素 前→後 |
| --- | ---: | ---: | ---: |
| 390×844 | 21.870% → 81.986% | 3.749× | 9.787% → 29.571% |
| 844×390 | 20.838% → 87.697% | 4.209× | 9.564% → 35.244% |
| 1280×720 | 22.152% → 85.801% | 3.873× | 9.919% → 36.350% |
| 320×568 | 25.567% → 77.784% | 3.042× | 11.492% → 30.973% |
| 280×360 | 18.630% → 71.705% | 3.849× | 9.166% → 33.318% |

WebKitとの差は変更後の全状態で明るい高彩度画素が最大0.128 percentage points、高輝度画素が最大0.062 percentage pointsだった。全数値と、同一canvas上でのscore0→555の色差・輝度差画素数は[analysis.json](after/analysis.json)にある。

これはshaderの発光領域を直接分離するmaskではなく、描画後の画素に対する代理指標である。canvas上に重なるHUDやfocus outlineも含まれる。旧280×360の低い面積率にはviewport下への欠けが影響する。発光表示が占める面積は明確に増加しており、この1時刻の静止画から時間方向のflash頻度・光刺激の安全性は判断していない。

## 全20画像の目視記録

変更後の全20 `*-viewport.png` を画像viewerで実際に開いた。下表の各「後」がその20枚に対応する。初期paddleの面・柄、台の前端・奥端、球、HUDを確認した。両engineで同じ構図となり、280×360でもscore 555のpaddleと台が画面内に見える。青緑の細い画面周囲の線はcanvasのfocus表示として写っている。

| Engine / viewport | score0 | score555 |
| --- | --- | --- |
| chromium / 390×844 | [前](baseline/chromium-390x844-score0-t1.25-viewport.png) / [後](after/chromium-390x844-score0-t1.25-viewport.png) | [前](baseline/chromium-390x844-score555-t1.25-viewport.png) / [後](after/chromium-390x844-score555-t1.25-viewport.png) |
| chromium / 844×390 | [前](baseline/chromium-844x390-score0-t1.25-viewport.png) / [後](after/chromium-844x390-score0-t1.25-viewport.png) | [前](baseline/chromium-844x390-score555-t1.25-viewport.png) / [後](after/chromium-844x390-score555-t1.25-viewport.png) |
| chromium / 1280×720 | [前](baseline/chromium-1280x720-score0-t1.25-viewport.png) / [後](after/chromium-1280x720-score0-t1.25-viewport.png) | [前](baseline/chromium-1280x720-score555-t1.25-viewport.png) / [後](after/chromium-1280x720-score555-t1.25-viewport.png) |
| chromium / 320×568 | [前](baseline/chromium-320x568-score0-t1.25-viewport.png) / [後](after/chromium-320x568-score0-t1.25-viewport.png) | [前](baseline/chromium-320x568-score555-t1.25-viewport.png) / [後](after/chromium-320x568-score555-t1.25-viewport.png) |
| chromium / 280×360 | [前](baseline/chromium-280x360-score0-t1.25-viewport.png) / [後](after/chromium-280x360-score0-t1.25-viewport.png) | [前](baseline/chromium-280x360-score555-t1.25-viewport.png) / [後](after/chromium-280x360-score555-t1.25-viewport.png) |
| webkit / 390×844 | [前](baseline/webkit-390x844-score0-t1.25-viewport.png) / [後](after/webkit-390x844-score0-t1.25-viewport.png) | [前](baseline/webkit-390x844-score555-t1.25-viewport.png) / [後](after/webkit-390x844-score555-t1.25-viewport.png) |
| webkit / 844×390 | [前](baseline/webkit-844x390-score0-t1.25-viewport.png) / [後](after/webkit-844x390-score0-t1.25-viewport.png) | [前](baseline/webkit-844x390-score555-t1.25-viewport.png) / [後](after/webkit-844x390-score555-t1.25-viewport.png) |
| webkit / 1280×720 | [前](baseline/webkit-1280x720-score0-t1.25-viewport.png) / [後](after/webkit-1280x720-score0-t1.25-viewport.png) | [前](baseline/webkit-1280x720-score555-t1.25-viewport.png) / [後](after/webkit-1280x720-score555-t1.25-viewport.png) |
| webkit / 320×568 | [前](baseline/webkit-320x568-score0-t1.25-viewport.png) / [後](after/webkit-320x568-score0-t1.25-viewport.png) | [前](baseline/webkit-320x568-score555-t1.25-viewport.png) / [後](after/webkit-320x568-score555-t1.25-viewport.png) |
| webkit / 280×360 | [前](baseline/webkit-280x360-score0-t1.25-viewport.png) / [後](after/webkit-280x360-score0-t1.25-viewport.png) | [前](baseline/webkit-280x360-score555-t1.25-viewport.png) / [後](after/webkit-280x360-score555-t1.25-viewport.png) |

観察事項として、844×390・score 555の左上には両engineで黒い三角形の背景領域が現れる。同時刻・同スコアの基準canvas左上40×100pxでは暗画素（max RGB ≤ 20）が0、変更後は719画素、範囲はx=0〜22/y=0〜65だった。[比較数値](after/upper-left-background-observation.json)、[基準canvas](baseline/chromium-844x390-score555-t1.25-canvas.png)、[変更後canvas](after/chromium-844x390-score555-t1.25-canvas.png)。この領域は台（最小余白74.750px）やラケット可動境界（41.066px）と重ならず、canvasや必要なラケット可動範囲の欠損とは区別する。背景表示の差として残し、この証拠収集では原因を特定していない。

## 再現手順と環境

撮影は次の既存スクリプトで行った。capture失敗0、pageerror/console error 0。Vite logには独立投影用Three importに伴う `Multiple instances of Three.js being imported` warningがあり、原ログを保持している。

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/takkeu-browsers \
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
LD_LIBRARY_PATH=/tmp/takkeu-browser-libs/root/usr/lib/x86_64-linux-gnu \
node tests/helpers/viewportEvidence.mjs \
  --url=http://127.0.0.1:4178 \
  --source=/workspace/takkeu \
  --output=docs/verification/viewport-direct/after
python3 tests/helpers/viewportEvidenceAnalysis.py docs/verification/viewport-direct/after
python3 docs/verification/viewport-direct/after/compare-evidence.py
```

capture script SHA256: `1a23bb790af1fbf03791dcf3324328366901dcec05a750f6d82a463eb4a4a042`。analysis script SHA256: `a91ad8b5c1fa2f98896b207e49469363d5dfb8b718bf68a1953f02b9de919ea0`。撮影前後で既存スクリプトは変更していない。

host要求確認をskipした理由は、WebKit用GLESv2等をroot権限のない環境の `/tmp` に配置したため、Playwrightのsystem `ldconfig` 検査から見えないこと。実共有ライブラリloadと両browserの描画は基準時に確認済みで、browser testをskipする設定ではない。詳細は[基準環境記録](baseline/README.md)を参照。

ログ: [capture](after/capture.log)、[analysis](after/analysis.log)、[comparison](after/comparison.log)、[Vite](after/server.log)。

## この比較の限界

Linux headless browser・指定CSS viewport・DPR1の固定状態を対象とする。実iPhone、可変browser chrome、実端末safe area、VoiceOver、音の聴取、連続点滅の安全性は検証していない。実pointer入力と物理接触の整合、通常プレイでの遷移、実時間performanceは別の検証結果と合わせて判断する。境界と軌道の数値は指定sample内の幾何学的な包含を示し、全乱数や全連続状態の網羅、HUDによる全状態の遮蔽までを証明しない。
