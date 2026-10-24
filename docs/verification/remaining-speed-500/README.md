# 残球加速: 500ラリー以上・1球のみ1.1倍

Base main: `b9b16af8400d63bc2657ef9b043bbc7a61e8440f`。remoteは`https://github.com/chameleonjp-lab/takkeu.git`。開始時open PRなし、既存証拠branchはclean。独立worktree `/workspace/takkeu-speed500` / `fix/remaining-ball-speed-500` で実施し、前回の証拠を変更しない。

## 今回の仕様

| 累計ラリー | 生存球 | 追加倍率 |
| --- | --- | --- |
| 0–499 | 1以上 | 1 |
| 500以上 | 1 | 1.1 |
| 500以上 | 2以上 | 1 |

製品変更はdifficulty.tsの倍率関数だけ。失球以外の全phaseを数え、相手の実打球で固定、待機中は再判定、飛行中の球数変化では固定、自分の返球には非適用という既存処理を使う。通常の毎ラリー加速・smash係数・時間下限・予告・到着間隔・音声・共有は変えない。

## 手順と履歴

1. 新しい閾値/倍率の期待値でRED: 141件中86失敗/55成功、exit1（red.log）。
2. 倍率関数を2行置換。初回141件中135成功/6失敗（green-initial.log）。失敗は3球を同時刻へ独立予約したfixtureが、旧3球ボーナスによる再予約を暗黙に頼っていたため。等倍では予約変更が不要なため、実際のschedulerへ同時要求を順に渡して有効な予約を作るfixtureへ修正した。到着gap0.12秒・実予告0.4秒のassertionは維持する。製品のscheduler/simulationは変更しない。
3. 修正後の速度unit141成功、exit0（green.log）。

同じ理由で延期再判定fixtureも予約時から有効な到着間隔を作る。499/500/501の境界、1球1.1倍/2球以上等倍、500到達と増球、499からの飛行中に500へ到達してもボーナスを遡及しないこと、500→502増球時の30/60/120Hz一致を検査する。

レビューで、5球のfixtureだけでは各phaseの数え漏れを検出できなくなったことを確認した。2球目をqueued / waiting-return / outgoing / incoming / lostとする5ケースを追加し、前4種は等倍、lostだけ1.1倍になることを実打球・飛行時間で検査した。製品コードの追加修正はない。

## 検証対象と結果

実装commitは `c5d13e0776306e0427a63c767cff0cd1bafbba0c`。unitとbrowserはcommit前の同一製品/テスト内容で実行し、commit後に`git diff --exit-code c5d13e0776306e0427a63c767cff0cd1bafbba0c -- src tests index.html package.json package-lock.json scripts .github`がexit0であることを確認した。browser検査後の変更はunitの5ケース追加のみ。証拠追加commitは製品/テストを変更しない。

環境: Linux 6.18.55、Node v24.19.0、npm 11.9.0、Playwright 1.64.1、2026-10-24 UTC。以下はローカルの自動検査で、iPhone Safari実機の検査ではない。

| 検査 | 結果 | 終了コード | 証拠 |
| --- | --- | --- | --- |
| `npm test`（最終） | 45 files / 514 tests成功。速度146件を含む | 0 | [unit-final.log](unit-final.log) |
| `npm run test:browser -- tests/browser/remaining-ball.spec.ts --reporter=list,json --output=artifacts/remaining-speed-500-browser` | Chromium 3件・WebKit 3件、skip/retryなし | 0 | [browser.log](browser.log), [browser-report.json](browser-report.json) |
| `npm run verify:release`（実装commit後） | 型検査・root/Pagesビルド・配布物検査・Chromium/WebKit 8件成功 | 0 | [release.log](release.log), [release-report.json](release-report.json) |
| `git diff --check` | 空出力 | 0 | commit前後で確認 |

初回の全unit509件成功は[unit.log](unit.log)、追加5ケース後の514件成功は最終ログへ残した。初回配布検査[release-working-tree.log](release-working-tree.log)も成功したが、未commitのためrelease.jsonがbase SHAを表示していた。そこで実装commit後に配布検査を再実行し、正式ログ[release.log](release.log)では上記実装SHAを確認する。

ローカルbrowser/releaseコマンドには`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`を付けた。必要なWebKit共有ライブラリはPlaywright bundleのライブラリパスに配置済みで実エンジンは動作するが、systemのldconfig検査から見えないため。テスト本体やassertionは省略しない。browserのJSON reporterはstdoutへ出たため、そのJSONを抽出してreportファイルへ保存した。

## 実飛行時間

各エンジンで60条件を測定し、5球時をDとした`D / 実測時間`の期待値との最大誤差は`7.33e-15`。ネット通過と到着はシミュレーションの実座標から観測する。[Chromiumの全測定](flights-chromium.json)と[WebKitの全測定](flights-webkit.json)を保存した。数値は両エンジンで同じ。

| ラリー | 1球の飛行秒 | 2球以上の飛行秒 | 比率 |
| --- | --- | --- | --- |
| 499 | 0.616868559832 | 0.616868559832 | 1 |
| 500 | 0.560774657929 | 0.616852123722 | 1.1 |
| 501 | 0.560759881896 | 0.616835870086 | 1.1 |
| 540 | 0.437730645241 | 0.481503709765 | 1.1 |
| 555 | 0.437628007306 | 0.481390808037 | 1.1 |

旧→新の対応は、100–499の1/2/3/4球を1.4/1.3/1.2/1.1→すべて1、500以上では1球1.4→1.1、2/3/4球1.3/1.2/1.1→すべて1。5球以上と0–99は従来どおり1。倍率を重ね掛けせず置換する。通常加速により同じ球数でもラリーごとのDは少し変わる。

時刻付き入力による30/60/120Hz検査は機能の決定性の証拠であり、実時間性能の証拠にはしない。到着gap0.12秒、スマッシュの実予告0.4秒を緩和していない。

## CI・公開・未確認

Draft PR作成後のCI結果はPR本文に対象head SHAとrun URLを記録する。CIは既存workflowにより全browser suiteも実行する。

テスト通信は既存browserTestで本番ランキングから分離。merge・auto-merge・手動公開・本番ランキング送信・X投稿は実施しない。この変更はDraft PRの段階では公開ページへ反映されず、merge後の既存Pages workflowの成功を別途確認する必要がある。

今回は倍率条件だけの修正で、音声波形/試聴、実時間の450/555性能、iPhone Safari実機、スピーカー/イヤホン、Xカードの実プレビューは再測定していない。過去の未確認/未達事項を解消済みとは扱わない。
