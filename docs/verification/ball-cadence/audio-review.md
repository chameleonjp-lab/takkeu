# 音声の確認範囲

人による試聴は**未確認**。本環境ではiPhone Safariの実機音声やスピーカー・イヤホンを通した聞き分け、重なりの快適さ、予告との音量バランスを聴いて評価していない。

製品の音声処理は基準mainと同一（preserved-production.json）。今回の正式検査でWeb Audioの生成・開始・失敗時の継続、単体の47球イベント個別発音と再投入の重複防止、8音＋最大8本の短いフェード尾、停止・終了・リトライ後の古い音の破棄を検査した。

Chromium/WebKitのOfflineAudioContextで自分・相手・予告・4音重ね・最大16音相当を合成し、各波形のピークとRMSを測定。値はsummary.jsonのaudioとdata内のwaveform-measurements.jsonへ保存する。WAVは各エンジン5本、計10本。処理の成功・波形の差・ピークの余裕を、人が聞いて合格した記録へ読み替えない。

試聴時は音量を控えめにし、次を記録する。

- [自分](audio/chromium-player.wav)と[相手](audio/chromium-opponent.wav)を単独で聞き分けられるか。
- [予告](audio/chromium-warning.wav)が返球音から分かり、[4音](audio/chromium-four.wav)や[16音](audio/chromium-sixteen.wav)でも不快な音割れがないか。
- 実ゲームで相手が見えない状態、複数球、ミュート、アプリ切替後の手動再開、終了・再挑戦直後に古い音が出ないか。
- 対象SHA、端末・OS・Safari版、スピーカー/イヤホン、端末音量とゲーム音量、確認者・日時、成功/失敗/未確認を残す。

合成WAVを並べた確認は端末での音声開始制限や復帰の実操作の代用ではない。Safari実機の開始・復帰失敗は、ゲームを止めず無音で続行できることも確認する。
