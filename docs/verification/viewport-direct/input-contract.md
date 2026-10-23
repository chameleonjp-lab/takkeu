# 全面表示・直接操作の仕様と依存関係

2026-10-23の今回指定が旧仕様に優先する。Fullscreen API/PWAは使わず、ブラウザのページviewportを使う。ゲーム中のヘッダー・タイトルリンク・常設停止/音ボタン・下部操作padはDOMから撤去した。ホーム/設定/結果は従来の文書レイアウト、プレイ/停止は全面canvasとoverlayになる。

## 表示から物理への依存

`styles.css`のgame shellのみをviewport寸法へ変更 → `createView.resize` → `fitCamera`が同じ`VIEWPOINT`と`viewFrame`から現在aspectのoff-axis projectionを作る。縦長では横幅が制約となり上下に背景が残る。横長では台・ラケットの全高さを収める制約となり左右に背景が残る。非等方伸縮や必要領域のcropはしない。

`VIEWPOINT`は描画cameraと`projectBall`の接触投影が共用。`viewFrame`はcameraの構図と`paddleHorizontalRange`の基準frameに関係するため、今回いずれも変更しない。高さごとの可動範囲は現在viewportではなく既存`REFERENCE_ASPECT=225/157`のframeを使い、回転しても到達可能領域が変わらない。`clampPaddle`、配置点の生成、飛行時間、配球の予約計算も変更しない。装飾glowは可視軌道検査に含めるが当たり半径へ含めない。

| 項目 | base → 今回 | 理由 |
| --- | --- | --- |
| table半幅/半長/Y | 1 / 1.8 / 0 → 同じ | 画面構成だけを先に広げる |
| VIEWPOINT eye/target | (.34,1.3,3.4) / (.34,0,0) → 同じ | 見える重なりと接触投影を保つ |
| ballRadius / paddleRadius | .045 / .12 → 同じ | CSS pixelが増えても世界内判定は拡大しない |
| paddleZ / min-max Y / nominal X | 1.95 / .15–.85 / ±1.05 → 同じ | 高さ別左右clampも同じ |
| paddleSpeed | 6 → 6 | 配球間隔に必要。直接操作の速度制限には使わない |
| fixedDt / 最大計算回数 | 1/120秒 / 12 → 同じ | 固定刻みと性能防護維持 |
| 長遅延停止 / 短遅延catchup | 1.50秒超 / 最大.10秒 → 同じ | 過大な計算負債を作らない |
| 描画pixel上限 / 標準倍率 / 低負荷倍率 | 2,000,000 / 1.5 / 1 → 同じ | 全面化後も内部解像度を制限 |
| 球速・飛行時間・球数・段階解放・配球 | 変更なし | 最速条件・多球も既存規則のまま検査 |

定数だけで判断せず、上記依存ファイルのbaseとの差分、独立投影、全mesh境界/軌道sample、実入力による返球、30/60/120Hzの時刻付き入力再生で確認する。変更したのはラケットの移動契約。感度/追従速度がなくなり任意の有効位置へ直接届くため、旧操作より到達しやすい。難易度の人による比較は未確認であり、同一難易度とは主張しない。数値を相殺調整しない。

## 入力座標・所有権

CSS pixelの`clientX/Y`を現在canvas表示矩形でNDCへ変換し、**実際に描くcamera**のrayとz=paddleZ平面の交点を`clampPaddle`へ渡す。DPR/内部canvas解像度/感度は掛けない。mappingは矩形とcamera行列のsnapshotを検査し、古ければ入力を拒否する。resize時は停止・所有権解除・再fit・mapping更新後、明示再開を待つ。

- 最初の有効primary pointerdownは`place`。初回前も基準と同じ(0,.5)の赤いラケットを表示する。
- moveは同じ絶対変換。mouse/penは主ボタンを押している間だけ。hoverは無効。
- upは最後に受理したtargetの`release`を保存し、先行moveとともに順序を保って確定する。up自体の座標から新しい移動を作らない。確定した位置・表示・通常接触を保持する。
- HUD/スマッシュ警告/ゲーム中の非操作通知はpointer-events:noneで背後canvasへ届く。safe-areaもcanvasを縮めず同じ座標契約。情報/メニューのみ安全余白を使う。
- canvas外からのdownは無効。capture後の外ドラッグは平面交点をclampして追随し、documentのupで終了する。
- 二本目以降は所有権を奪わない。最初を離しても残る指へ引き継がず、すべて離れてから新しいdownを受理する。
- NaN/無限座標、古い表示変換、確定済み/停止前のtimestampを拒否。通常upのcapture解除は中断ではない。pointercancel/想定外lostcaptureは入力中断として停止する。

保存済みの旧sensitivity fieldはデータ互換のため保持するが、UI/入力計算から取り除く。他の自己ベスト/音量/mute/品質は保持する。

## 固定時刻・接触の順序

DOM timestampはperformance time基準（epoch形式ならtimeOriginを引く）から、現在の未確定accumulatorへ対応付ける。イベント受信時はその時刻より前に終わる**完了可能な固定区間だけ**先にflushする。入力時刻ちょうどで終わる最後のtickは未確定に残し、sampleを入れてから次の通常RAFで処理する。これによりhandler自身が旧位置の境界接触を先に確定しない。すでに以前のRAFが同じ境界を確定していた場合は巻き戻さず、同時刻を次の未確定区間の開始として到着順で適用する。その場合、確定済み境界のゲームイベントが先、後着入力は後となる。確定済みwall区間より古いイベントはNaNとして拒否し現在へ付け替えない。停止・再開のclock reset前も拒否する。短遅延の捨て時間と長遅延停止は従来の防護に従う。

入力は順序付き`place/move/release`として蓄積。1/120秒の区間が完了可能になると、その**未確定区間だけ**入力時刻で分割する。通常の適用待ちは次の固定境界まで0〜8.333ms（最大1刻み、浮動小数誤差を除く）。その結果を次の描画機会に表示する。30/60Hzでは別途次のRAFまで待つ。描画だけ先行せず、描画と当たり判定は同一snapshot。過去の確定区間は巻き戻さない。

各入力時刻tでは、tより前の球接触/バウンド/失球等を処理し、tのバウンドを先に確定する。その後、同時刻の入力を到着順に扱う。

1. place: 旧位置からのsweepを作らず新位置へ代入し、その位置の正当な重なり、未接触球の失球を評価する。
2. move: t以後、次の入力時刻または元の固定区間終端までの未確定区間を通常のsweepとして移動し、終端でclamp済みtargetへ一致する。同時刻move→upもsweepを失わない。
3. release: 先行moveの終端の接触/失球を確定してから保持する。後続の同時刻placeで直前の接触を消さない。

複数球の競合は時刻順、同時刻ではbounceを先に、同種はball id順。ワンバウンド前/lost/outgoingを拒否し、返球は一度だけ。現行の可視投影sweepを維持し、球のpaddleZ通過だけには限定しない。ゼロ時間sweepでも接触fractionを保持して発光位置を計算する（過去PRの未再現発光症状の解決を意味しない）。飛行速度更新は分割ごとでなく元の固定区間終端に一度だけ行う。

## 停止・復旧

二本指タップ: 二本目downが最初から100ms以内、両upが最初から250ms以内、両指の移動が各10 CSS px以下。一般的な短いtapと指の置き時間差を許し、ドラッグを除外するための基準。二本目downだけでは停止しない。最初のplace/moveを判定待ちにしない。第三指、時間/移動超過、中断で候補失効。単体検査は境界・追加指・キャンセル、ブラウザは両release成立とdrag不成立を確認する。実機による誤発火率/操作感は未確認。

Escapeはrunningからのみ停止（キーrepeat無効）。停止メニューの明示resume/retry/homeで遷移する。canvasは停止中inert、メニューはTabで音量まで巡回し、start/resumeはcanvas、pauseはresume（無効なら利用可能なhome）、結果はretryへfocus。音/mute/retryは設定または停止メニュー。ゲーム中の音失敗通知にもこの復旧方法を明記する。

resize/orientationは直ちに停止し、100ms通知が落ち着くまで描画再構成をまとめる。停止済みならsilence/save/renderを繰り返さない。同じ矩形/DPR/品質の追加resizeは再fitしない。resumeは必要なfitを即実行し、残ったdebounceは同じkeyで無処理。hidden/blur/pagehide/freeze/WebGL喪失復旧/1.50秒超遅延も明示再開を待つ。
