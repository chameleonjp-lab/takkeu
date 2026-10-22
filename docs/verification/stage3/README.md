# 第3段階（T07〜T10）の正式検証

正式ソース：`1e13fd4281721a2b843967a3b69b5801088da26e`。開始main：`c6e59a2e5400c34c464ce2e6f56fda1abd13437d`。この後の文書・証拠追加コミットはゲーム・テスト・設定を変更しない。

[全R/A/Q/Mの受入表](../acceptance.md) ／ [音の検証](../audio-review.md) ／ [独立レビューと修正](../../reviews/2026-10-22-takkeu-stage3-review.md) ／ [公開と復旧手順](../../release.md)。実機・実試聴・390の最終安全性判定は未確認。公開設定の有効化と公開実行は行っていない。

## 正式な実行

対象コミットを固定し、`scripts/verify-stage3.mjs`で次を順次実行した。実行時刻、完全なコマンド、終了コード、ログ・ソース・配布物のSHA-256は[正式マニフェスト](final-verification.json)を参照する。

| 検査 | 結果 | 全文・機械結果 |
|---|---|---|
| npm ci | 成功 | [全文](final-install.log) |
| 型 | 成功 | [全文](final-typecheck.log) |
| 単体 | 20ファイル・85件成功 | [全文](final-unit.log)／[JSON](final-unit.json) |
| 画面 | Chromium 25＋WebKit 25、計50件成功。skip/flaky/failure 0 | [全文](final-browser.log)／[JSON](final-browser.json) |
| ルート／Pages実配布検査 | 両ブラウザ計4件成功。型・2ビルド・配布隔離も成功 | [全文](final-distribution.log)／[JSON](final-release.json) |
| Linux実フレーム60秒 | 記録2件成功。連続負荷の測定は失敗（遅延で停止） | [全文](final-performance.log)／[JSON](final-performance.json) |
| 差分の整形 | 成功 | [全文](final-diff.log) |

依存・ツール版は変更していない。環境は[environment.json](environment.json)に記録。Debian 13、Node 24.19.0／npm 11.9.0、Playwright 1.64.1付属Chromium 156.0.8078.4／WebKit 27.2。WebKitはiPhone 13プロファイル（390×664、倍率3）のエミュレーション。402×874、874×402、844×390、1280×720と文字200%も検査する。iPhone実機ではない。

ローカルWebKitの不足ライブラリは公式Debianから/tmpへ展開し、実起動を確認した。ホスト依存の事前チェックだけをローカルで省略する。CIはUbuntu 24.04で公式の`install --with-deps`を使用する。

## 重点条件

- M10の5秒、390の位相、450の予告・球・予約は非表示／pagehide／停止中に進まない。画面が戻っても手動再開を待つ。実際のWEBGL_lose_contextの喪失・復旧、および描画再作成失敗からホームへ戻る動作も確認した。
- 指離れで実位置を保持し、2本目・回転・異常追跡喪失で入力を残さない。保存は壊れたJSON・不正バージョン・非有限値・負点・拒否・容量不足を検査し、ゲームを止めない。
- 4球・450以降・上限付近の専用状態から、テスト側の入力で30秒間4球を保持し実スマッシュも確認した。自然操作で450まで到達した検査ではない。計算の30/60/120Hz一致と高速接触の単体検査も維持した。
- 再挑戦20回・ホーム往復20回の基準状態は、購読22、未実行rAF 1、AudioContext生成1、geometry 16／texture 1／program 6／draw call 7。各反復後も同じ値。完全破棄後はrAF・購読・音声ノード0。GPU内部の全メモリ0は要求していない。[PC記録](media/chromium/retry-resources.json)／[WebKit記録](media/webkit/retry-resources.json)。
- 自他・予告の実音声ノード、初回開始・再開・再開拒否・ノード失敗時の案内と無音継続・再試行、旧音と重複の破棄を確認した。合成16音の最大ピークは約0.593。実際に聴いた快適さ・識別の合格ではない。[PC波形](media/chromium/waveform-measurements.json)／[WebKit波形](media/webkit/waveform-measurements.json)。
- 配布物にはindex.html、ハッシュ付きJS/CSS、release.jsonだけを含む。開発用経路は404、得点URLは無効、tests/の状態構築・自動操作は配布しない。release.jsonのSHAとcheckoutが一致する。

## 画面・動画・音

[画像PC](screenshots/chromium)／[画像WebKit](screenshots/webkit)。ホーム・ゲーム・結果・設定、200%文字、縦横、安全余白、実WebGL復旧後の予告、390／420を保存する。全19行の進行表はmilestones画面検査とpresentation等の単体で照合し、[第2段階の全節目画像](../stage2/README.md)も維持する。

- 390：[PC動画](media/pulse-chromium.webm)／[縦動画](media/pulse-webkit.webm)。映像の確認方法と限界は[映像・画像確認記録](visual-review.md)を参照。
- 450：[PC動画](media/smash-chromium.webm)／[縦動画](media/smash-webkit.webm)。ミュート・停止・手動再開・隠れた打球・自側での出現を記録。
- [開始・返球・結果・再挑戦のPC動画](media/basic-play-chromium.webm)。動画に音声は収録しない。
- 合成WAV：[自分](media/chromium/player.wav)／[相手](media/chromium/opponent.wav)／[予告](media/chromium/warning.wav)／[4音](media/chromium/four.wav)／[16音](media/chromium/sixteen.wav)。WebKit版もmedia/webkitへ保存。未試聴。

## 途中の失敗と未確認

[台帳](work-log.md)と各`*-red.log`／`*-initial.log`／`*-investigation*.log`は途中の失敗・原因・修正の記録であり、正式成功ログから分ける。検査の要素選択・時計の誤り、音声の世代管理・出力初期化・失敗案内、WebKit不足ライブラリ、配布検査の時計と出力先衝突を修正して再検証した。

未確認：iPhone 17 Pro Safariの縦横操作・ホーム操作領域・アプリ切替・画面ロック・音声復帰・VoiceOver、実機60秒で95%以上25ms以下の性能、人による試聴、390映像の最終点滅基準。公開前に対象SHA・端末・OS/Safari版・条件と結果を追記する。自動検査の成功で置き換えない。


## Linux参考性能計測

| ブラウザ | 全フレームp95 | 25ms以下の割合 | 60秒中のゲーム内進行 | 最終状態／実スマッシュ |
|---|---:|---:|---:|---|
| Chromium（SwiftShader） | 50.1ms | 51.46% | 0.158秒 | slow-frameで停止／0回 |
| WebKit（Linux・iPhoneサイズ） | 34ms | 81.59% | 0秒 | slow-frameで停止／0回 |

[PCの全間隔と条件](media/chromium/browser-performance-60s.json)／[WebKitの全間隔と条件](media/webkit/browser-performance-60s.json)。初回の描画遅延が0.10秒を超え、仕様どおり手動再開待ちとなった。60秒連続の4球・スマッシュ負荷は成立していない。p95は停止中も含むため、プレイ中の性能目標と比較できない。コマンドの成功は記録の保存成功であり、性能合格ではない。

ヘッドレスのソフトウェア描画環境とiPhone実機は異なる。起動時コンパイル・描画・計算負荷等の遅延の内訳、および実機での再現性は未確認。球速・判定・加速・解放を緩めていない。実機で基準を満たすまで公開を保留する。

## 配布候補と来歴

[Pages用ビルドZIP](distribution/takkeu-pages-1e13fd4.zip)は正式検証で作成したdistのコピーであり、公開はしていない。release.jsonは上記のソースSHAと/takkeu/を示す。公開時はこのZIPを無条件に再利用せず、docs/release.mdに従い承認済みmainのSHAを照合し、そのコミットで検査・ビルドした成果物だけを配備する。

[証拠ファイルのSHA-256と確認対象](media-verification.json)に画像・動画・WAV・測定JSON・配布ZIPの来歴を記録する。


## 初回描画後の補助切分け

同じゲームソースで、450の専用状態→1秒の描画準備→手動再開→実フレーム60秒を追加測定した。測定中は自動再開しない。[実行スクリプト](diagnose-warm-load.mjs)／[全文](diagnose-warm-load.log)。

| 条件 | ゲーム内進行 | 残球／実スマッシュ | 全フレームp95・25ms以下率 | 判定 |
|---|---:|---|---|---|
| Chromium・描画準備後 | 60.017秒 | 4球／10回 | 33.3ms・93.43% | 連続負荷成立。参考25ms条件は未達。実機合格ではない |
| WebKit・描画準備後 | 0.767秒 | 4球／1回 | 22ms・98.44% | 再びslow-frameで停止。停止中を含み、連続負荷不成立 |

[PC測定](media/chromium/warm-performance-60s.json)／[WebKit測定](media/webkit/warm-performance-60s.json)。Chromiumは描画準備後に60秒継続し、初回準備の影響を示した。WebKitは準備後も停止したため、原因が初回準備だけとは断定しない。元の失敗結果を上書きせず、実機での負荷と描画／計算の内訳は引き続き公開前の課題とする。

## Draft PR・GitHub CIの外部制約

[Draft PR #4](https://github.com/chameleonjp-lab/takkeu/pull/4)を作成した。mainへのマージ・公開はしていない。

証拠追加head b06b646の[PRイベントCI](https://github.com/chameleonjp-lab/takkeu/actions/runs/39795978382)と[push CI](https://github.com/chameleonjp-lab/takkeu/actions/runs/39795806505)は、**全工程成功**を確認した。PR側の[全文ジョブログ](ci-source-job.log)／[工程結果](ci-source-jobs.json)／[成果物](ci-source-artifacts.json)を保存した。型・単体85件・2パス配布4件・画面50件・証拠保存が成功。PR CIはGitHubのmerge ref bfc0c9b、push CIはhead b06b646自体をcheckoutしている。

最初はAPIにqueued／in_progressと表示されたが、後から取得したジョブログでは処理自体は14:28〜14:33 UTCに進んでいた。GitHub公式はActions degraded_performance、Incident with Actions Results investigatingを報告していたため、これは結果報告の遅延として記録し、実際のランナー停止とは断定しない。[公式レスポンス](ci-github-status.json)／[初回の状態観測](ci-observation.json)／[成功確認](ci-resolution.json)。未確認時に成功と記載せず、ログと最終状態を確認して更新した。

文書・補助測定追加後の最新headのCIは、PR本文・Checksで追跡する。実機・試聴・390最終判定と性能の未確認はCI成功とは別に残る。課金・Actions設定変更・公開は行っていない。
