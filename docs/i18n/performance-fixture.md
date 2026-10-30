# GL描画予算の既存fixture修正とベースライン比較

2026-10-30。ゲーム・描画実装は変更していない。変更対象は `tests/helpers/rallyGlHarness.ts` の既定予算用入力と `tests/performance/rally-gl.spec.ts` の検査だけ。

## 修正前のベースライン再現

ローカライズ前の `84b9122713b280255d762978c4bf9906f8b1987b` を `/workspace/takkeu-baseline` で検査した。元の「4回の実GL submission」テストはChromiumとWebKitの両方で同じように失敗した。

| ブラウザ | fixtureのスコア | 球数 | rally roots表示時 | 非表示時 | 差分 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chromium | 4270 | 30 | 27 | 27 | 0 |
| WebKit | 4270 | 30 | 27 | 27 | 0 |

`rallyPerformanceReplay(4000, 30, 2)` の中央フレームは `simTime=15.016666666666454`、phaseは `running`。4000から開始するため3500への到達を通らず、3500と一致したときのクリア条件を実行しない。通常プレイでは到達できないスコアである。

この時点の演出状態には有効なhit・arrival・loss・cueがない。既存の描画実装は1500以上の常設演出を描かず、hit ringとloss sparksも1500未満に限定しているため、差分0は描画実装と整合する。既存の `feedback-render-budget.test.ts` も高スコアで常設の描画が0であることを検査している。

さらに、現在の共有batchはtableとworldの2個で、両方とも既存実装で `forceSinglePass: true`。元の「厳密に4」は現在の実装に対応していない。

再現証跡：`/tmp/takkeu-rally-gl-baseline-results.json`、失敗traceは `/tmp/takkeu-rally-gl-baseline`。元のfixtureを新しい有効スコア検査で実行しても、両ブラウザで `4270 < 3500` の検査が失敗することを先に確認した（`/tmp/takkeu-rally-gl-invalid-red.json`）。

## 修正した既定予算fixture

既定予算だけを独立した短い実シミュレーションに切り替えた。555から30球で開始し、2球目以降を0.15秒遅らせる。最初の1球を実際に落とした後、既存replayと同じ自動返球入力へ戻す。実際の得点報酬で残球が30へ戻り、hit ringとloss sparksの両方が有効なフレームを選ぶ。演出eventの捏造、報酬を経ない残球の補充、描画回数の追加、material flagの変更はない。

選択されたフレームは両ブラウザで一致した。

| 項目 | 値 |
| --- | --- |
| phase / endReason | running / null |
| スコア / simTime | 584 / 0.974999999999999 |
| 残球 / 累計落球 | 30 / 1 |
| table / worldの有効quad | 252 / 6 |
| 有効batch | 2 |
| GL submission（表示 / 非表示 / 差分） | 36 / 34 / 2 |

既存と同じ実GL呼出しの「表示時−非表示時」を測る。元の4回上限を維持し、その範囲内で現在の2共有batchが厳密に2回で描かれることも要求する。phase、3500未満、30球、実際の1落球、snapshotと演出のrun一致、両batchの有効geometryを追加検査した。fixtureが空の状態を選んで成功する経路はない。

修正後はChromium・WebKitの2件とも成功し、typecheckも成功した。証跡は `/tmp/takkeu-rally-gl-live-green.json`。`profile(name)` 用の歴史的4000診断入力は変更していない。

## 実フレーム60秒の比較

元の `browser-load.spec.ts` の `standard・450` と `low・555` を、同じLinux環境・ブラウザ構成・4176番portでベースラインに対して各ブラウザ60秒ずつ実行した。4件ともページエラーなしで完了し、全ケースで連続したrunning状態を保った。GPU実行は直列にし、計測中は他のブラウザ実行と重い単体テストを停止した。

現在側は主担当が先に取得した `artifacts/performance-results.json` の対応する実フレーム測定を使用した。GL fixtureの修正はテスト入力だけであり、実フレーム測定の入力を変更していない。

| ブラウザ・設定・開始点 | baseline p95（ms） | 現在 p95（ms） | baseline 25ms以内 | 現在 25ms以内 |
| --- | ---: | ---: | ---: | ---: |
| Chromium・standard・450 | 166.7 | 166.6 | 15.67% | 16.80% |
| Chromium・low・555 | 100.0 | 100.1 | 21.96% | 20.93% |
| WebKit・standard・450 | 56.0 | 56.0 | 0.82% | 1.27% |
| WebKit・low・555 | 45.0 | 48.0 | 12.27% | 8.30% |

両側ともLinux参考目標「95%以上のフレームが25ms以内」を満たしていない。これは既存ベースラインでも再現する。単発の別時刻の比較なのでタイミングの同等性や小さな性能差を証明するものではなく、WebKit lowの現在側p95は3ms大きい。Linuxソフトウェア描画の参考記録であり、iPhone実機の性能合格判定ではない。

初期・最終の確保済みリソース数は4条件すべてで両側とも一致した。

| リソース | baseline / 現在 |
| --- | --- |
| geometry / texture / program | 55 / 4 / 17 |
| particle確保容量 | 8408 |
| rally確保容量 / geometry / material / node | 6872 / 2 / 2 / 4 |
| audio peakVoices | 全条件16 |
| standard・450のaudio peakNodes / peakSources | 283 / 100 |
| low・555のaudio peakNodes / peakSources | 246 / 82 |

baselineの全記録は `/tmp/takkeu-performance-baseline.json`、比較用の抽出は `/tmp/takkeu-performance-comparison-summary.json`。ベースラインのコードは変更していない（依存物を共有する `node_modules` symlinkのみ）。

実行したコマンドは共通の `PLAYWRIGHT_BROWSERS_PATH=/tmp/takkeu-browsers`、`LD_LIBRARY_PATH=/tmp/takkeu-browser-libs/root/usr/lib/x86_64-linux-gnu`、`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` と追加network権限を使用した。

```sh
# ベースライン上：既存GL失敗の再現
npx playwright test tests/performance/rally-gl.spec.ts --config=playwright.performance.config.ts --grep 'default rally draw budget' --reporter=list,json
# 現在側：有効な既定予算fixture
npx playwright test tests/performance/rally-gl.spec.ts --config=playwright.performance.config.ts --grep 'default live rally feedback' --reporter=list,json
# ベースライン上：4件の実フレーム比較
npx playwright test tests/performance/browser-load.spec.ts --config=playwright.performance.config.ts --grep 'standard・450|low・555' --reporter=list,json
```

各実行のJSON出力先を上記の別ファイルに指定し、主担当の元のperformance記録を上書きしていない。
