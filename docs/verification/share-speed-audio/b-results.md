# B: 残球速度の検証

製品変更は `src/game/difficulty.ts` の残球倍率関数のみ。旧倍率との対応は [b-expectations.md](b-expectations.md) を参照。`flightDuration`・通常加速・スマッシュ係数・scheduler・シミュレーションの発射時固定処理・入力・描画は既存処理を使う。

## 受入内容

| 項目 | 証拠 |
| --- | --- |
| 0/99/100/101/450/539/540/555 × 1/2/3/4/5/8球、D/新倍率の実飛行時間と自側視認時間 | unitの実座標z通過時刻を補間して計測。5球がD、精度8桁。 |
| 元の最低視認時間の適用後に残球倍率を反映 | 通常D=1.4秒→1球1.0秒。540スマッシュも1.4倍、539より短い。 |
| score/countの不正値、0–99、最後の失球 | 不正値は1倍、最後の失球はgameoverとなり新規相手打球なし。 |
| 生存球の定義 | queued/waiting-return/outgoing/incomingの全てを数え、lostのみ除く。 |
| 5→4・4→3・2→1・1→2 | 予約後/実打球後の両方を確認。飛行中は固定し、次の相手打球で再評価。 |
| 予約衝突と再評価 | 101/540/555で到着間隔を確保して延期、待機中の2→1を次の実打球時に1.4倍へ再評価。 |
| 99→100と増球の同tick/同時刻、失球の打球前後 | 時間順の現在score/生存数を採用し、打球後の減少は遡及しない。同時刻にID1の100到達/増球→ID2失球→ID3打球なら生存3球の1.2倍。 |
| 全球の既存ラリー加速と540スマッシュ | 異なる残球倍率を保持し到着間隔0.12秒以上、更新時の位置は10桁精度で一致。 |
| 555軌道・高速接触・outgoing非適用 | 101/450/539/540/555で実接触→基本時間のoutgoing→再評価した次の相手打球。555の往復は実生成bounceXを確認し、555→556の加速でもbounceXと現在位置を保存。 |
| 予告 | 重なる3球と延期時に実予告から相手打球まで0.40秒以上。 |
| 停止/再開/リトライ | 確定済みplanを停止中/再開後に保持し、リトライ初速2秒・等倍へ戻す。 |
| 30/60/120Hz | 109→110の同じ時刻付き入力で1.4/1.3倍と増球を経由し、snapshot・全イベント時刻・乱数状態が完全一致。既存47球のgrowing-replay、2000Hz入力のpointer-loopも実行。 |

既存actionの同時刻順は、時刻昇順→バウンド優先→球ID昇順（`simulation.ts` のactions.sort）。同時刻失球ID1/打球ID2では失球後の1球1.4倍、打球ID1/失球ID2では打球時の2球1.3倍となる。球ID99のバウンドもID1の打球より先に処理することをunitで明示した。イベント種別全般への「加点が常に先」等の新しい優先規則は追加していない。

## 実行結果

| コマンド | 結果 | ログ |
| --- | --- | --- |
| `npm run test:unit -- tests/unit/remaining-ball-speed.test.ts`（製品変更前、fixture修正後） | 57失敗/44成功、exit 1 | [RED](b-unit-red-final.log) |
| 同上（製品変更後） | 101成功、exit 0 | [GREEN](b-unit-green.log) |
| `npm run test:unit -- tests/unit/remaining-ball-speed.test.ts tests/unit/growing-replay.test.ts tests/unit/pointer-loop.test.ts tests/unit/extended-safety.test.ts tests/unit/waiting-visibility.test.ts` | 最終5ファイル151成功、exit 0。残球速度は109件 | [最終関連回帰](b-unit-final.log)、[先行149件](b-unit-regressions.log) |
| `npm test`（他task RED作業中） | 42ファイル成功/2失敗、453成功/8失敗、exit 1 | [全unit](b-full-unit.log) |
| `npm run typecheck`（音響interface実装前） | 音響テストの未実装rallyScore/audioStage/playSmashSuccessの3型エラー、exit 1 | [型](b-typecheck.log) |
| `npm run typecheck`（interfaceとJSON保存helper実装後） | 成功、exit 0 | [最終型検査](b-typecheck-final.log) |
| `npx playwright test tests/browser/remaining-ball.spec.ts --list --reporter=list` | 両エンジン計6件を検出、exit 0 | [検出](b-browser-list.log) |
| `npx playwright test tests/browser/remaining-ball.spec.ts --reporter=list --output=docs/verification/share-speed-audio/b-browser-artifacts`（network-enabled） | Chromium 3件/WebKit 3件、計6件成功、29.3秒、exit 0 | [ブラウザ](b-browser-green.log)、[画像52枚](b-browser-artifacts/) |
| `npx playwright test tests/browser/remaining-ball.spec.ts --grep 'ブラウザの実シミュレーション飛行時間' --reporter=list --output=docs/verification/share-speed-audio/b-browser-measurement-artifacts`（JSON永続化helper追加後、network-enabled） | Chromium/WebKitの計2件成功、5.0秒、exit 0 | [再計測](b-browser-measurements.log)、[生の出力](b-browser-measurement-artifacts/) |

途中の全unitの失敗は、`layered-tones.test.ts` の音源層・音階段階・全音源終了・mute復旧・球別成功音・voice上限・低負荷の7件と、既存 `release-revision.test.ts` の完全SHA/main照合の1件。残球速度の失敗はない。音響interfaceの実装後に型検査は成功した。全unitの最終結果は統合検証に記録する。REDの失敗・途中の全unit/型失敗を最終成功で上書きしない。

初回のブラウザ実行は、既定のnetwork sandboxがローカルViteの `127.0.0.1:4173` listenをEPERMで拒否したため検査開始前にexit 1（[初回ログ](b-browser.log)）。同じ6件をnetwork-enabledで再実行して成功した。既存のランキング遮断fixtureを使い、外部ランキングへの実送信はしない。

ブラウザの残球速度specは42行の5球基準計測、既存の待機非表示、実アプリの停止/再開/リトライを両エンジンで実行した。WebKit用の既に用意されたnative libsを `LD_LIBRARY_PATH=/tmp/takkeu-libs/root/usr/lib/x86_64-linux-gnu` で参照し、`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` はシステムldconfigによる事前検出だけを回避する。実エンジンが起動し全6件を実行、skip/retryなし。timeout・描画・固定計算・停止閾値を変更していない。

WebKitの490待機到達時/自側incoming時の画像を実際に開き、待機中の2球HUDと別の飛行球、次の自側incomingで対象球が表示される状態を確認した。待機球本体/影/発光の完全非表示は、別球を除いたGPUピクセルhashとの一致で判定した。実機iPhone操作・性能は自動ブラウザ検査と区別する。

## 実移動の数値

JSON添付をlist reporterでも残すため、出力パスへ保存してからattachするように検査だけを変更し、計測2件を再実行した。各エンジン42行の生データは [Chromium](b-flights-chromium.json) / [WebKit](b-flights-webkit.json)、[集計](b-measurement-summary.json)。出発→ネット→自側paddle面の順序は全行で成立し、Dとの倍率比の最大誤差は両エンジンとも `1.2878587085651816e-14`。下表の時間は両エンジンで一致した。

| score / 状態 | 生存1球 | 生存4球 | 生存5球のD |
| --- | --- | --- | --- |
| 100 / 通常 | 0.6890355851秒 | 0.8769543811秒 | 0.9646498192秒 |
| 540 / スマッシュ | 0.3439312213秒 | 0.4377306452秒 | 0.4815037098秒 |

実時間性能の基準検査とのGPU同時使用は避けた。52枚の画面検査と固定計算上の実移動時間の成功を、実時間fpsや実機の性能合格とは扱わない。
