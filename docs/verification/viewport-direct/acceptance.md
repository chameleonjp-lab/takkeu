# 検証の対応表

正式な成功/失敗数、対象SHA、実行ログは[検証記録](README.md)を正とする。この表はどの条件を何で調べるかを示す。自動検査と実機確認を混同しない。

| 分野 | 実施方法・証拠 | 限界 |
| --- | --- | --- |
| 全面canvas・見やすさ | 390×844 / 844×390 / 1280×720 / 320×568 / 280×360、Chromium/WebKit、score0/555・同時刻1.25、before/after画像・生投影値 | 実iPhoneのツールバー/ノッチを撮ったものではない |
| 必要領域の保持 | table四隅、実ラケットmeshの400境界配置、64seed×往復2方向×401時点の球core/glow軌道、独立camera投影 | 全乱数空間の数学的証明ではない。既存非表示規則を適用 |
| 直接操作 | `mapping`単体の独立camera投影往復、実canvasのnative down/drag/up/hover、縦横PC最小画面、高さ別左右clamp、外capture/release | WebKit mouseプロトコルは整数CSS pixelで入力。実指の触感は未確認 |
| 複数pointer/中断 | gesture100/250ms・10pxの単体境界、両releaseで停止、追加指非移譲、drag失効、cancel/capture-loss、連打、resize後の旧pointer拒否 | touch/penは合成PointerEventも使用。実機OS中断は未確認 |
| 時刻・接触 | `direct-contact`/`pointer-loop`/`loop`/`collision`/`timeline`：瞬間移動誤接触、配置重なり、drag、保持、前bounce/lost/outgoing/重複拒否、同時刻入力と複数球 | 連続sweepは従来の投影端点近似を維持 |
| 最高速と密入力 | 実設定漸近最速（往復片道2/2.6/1.6秒）、人工的な1tick横断、2000Hz生入力を別fixture。seed7・同時刻列で30/60/120Hzの状態/イベント/得点一致 | ゲーム時計を制御した検査を実時間性能と呼ばない |
| UI撤去/情報 | DOM・Tab順・反応領域から旧UIなし、HUD/警告pointer-events:none、safe-area CSS変数44/34/8pxを模擬してcanvas不縮小 | 実safe-area envとブラウザUI伸縮は実機で追加確認 |
| 状態・復旧 | start/pause/resume/retry/home/settings/result、20回反復、音声生成拒否/再試行、WebGL喪失/復旧/復旧失敗、visibility/pagehide、resize burst・描画抑制 | native WebGL喪失拡張も使用。実OSアプリ切替は未確認 |
| キーボード/拡大 | start/resume canvas、pause resume/home fallback、result retryへfocus。Tab/Shift+Tab trapに音量を含む。200% CSS文字・縦横のボタン44px/scroll到達、aria snapshot | VoiceOverと実際の読み上げ操作は未実施。200%文字はピンチzoom実機の代替ではない |
| 音 | 実Web Audioノード・音声中断/復旧・イベント重複防止・WAV/peak/RMS | 人による試聴と識別・快適さは未確認 |
| 負荷/性能 | 標準/低負荷×450/555×2エンジン、各60秒生RAF/実経過/simTime/phase/pauseReason、drawCalls/資源/pixel capを保存 | Linux参考計測。従来Linux未達とiPhone実機性能を解消扱いにしない |
| 配布 | 既存verify:releaseでrootと/takkeu/をbuild・実ファイルserver起動、参照パス・query無効・fixture非配信・sourceSha確認 | Pagesへの公開はしない |
| 発光 | score0/555同画角のbright/saturated/luminance/差分面積、既存直前/到達閾値検査 | PR13報告は未再現のまま。静止面積や動画確認だけでWCAG点滅安全合格とはしない |

## 実機で依頼する操作

対象headをiPhone Safariで開き、OS/Safari版・画面サイズ・向き・品質を記録する。ホームで遊び方を確認し、中央/上下/左右端でtap→drag→releaseを行う。指とラケット中心の一致、clamp時のずれ、指離し後の保持と返球を観察する。hoverで動かないPC、押下dragのpenも可能な端末で確認する。

二本指をほぼ同時に置き両方を短く離して停止、二本目だけ置く/drag中に追加する/いずれかを動かすと停止しないことを確認する。停止メニューで音量・mute・音声再試行・resume/retry/homeを操作し、背後の球/得点/ラケットが動かないことを確認する。Safariツールバー伸縮、縦横回転、アプリ切替/ロック/復帰で自動再開しないことを確認する。

VoiceOverでホーム/設定/停止/結果の読み上げ順、見出し/ボタン/sliderの名前と操作、拡大時のスクロールを確認する。自他/予告/多球の音を実際に聴く。標準/低負荷、450/555を各60秒継続し、生RAF・実時間・simTime・停止理由を分けて計測する。390以後の点滅頻度・輝度・赤色・表示面積について別途安全性を評価する。Android Chromeも利用できる場合は同じ操作を行う。
