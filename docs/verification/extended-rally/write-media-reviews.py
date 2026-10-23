import json
from pathlib import Path
root=Path(__file__).parent
formal=json.loads((root/'final-verification.json').read_text());summary=json.loads((root/'summary.json').read_text());media=json.loads((root/'media-manifest.json').read_text())
assert formal['result']=='passed';sha=formal['commit']
counts={folder:sum(path.startswith(folder+'/') for path in media['files'])for folder in ['screenshots','videos','audio','data']}
audio=f'''# 音声処理と人による試聴

対象：`{sha}`。Chromium156 / Linux WebKit27.2（iPhone13プロファイル）。iPhone17Pro実機ではない。

**ブラウザの音声処理は成功、人による試聴は未確認。** この環境では実機スピーカー/イヤホンを人の耳で聴く検証を行っていない。数値検査を「聞き分けられた・快適だった」と扱わない。

[正式画面検査](final-browser.log)・[波形集計](summary.json)・[WAV](audio/)・[ハッシュ](media-manifest.json)。自分音・相手音・予告音・4音・16音のWAVを各エンジン5本、計10本保存した。波形は実OfflineAudioContextで生成し、無音でないこと・自他の差・最大ピークの余裕を検査した。

| エンジン | 波形 | peak | RMS | 処理 | 試聴 |
|---|---|---|---|---|---|
'''
for engine,rows in summary['audio'].items():
 for r in rows:audio+=f"| {engine} | [{r['mode']}](audio/{engine}-{r['mode']}.wav) | {r['peak']:.6f} | {r['rms']:.6f} | 成功 | 未確認 |\n"
audio+='''
不可視の相手の打球イベント、別球の個別発音、同一イベントの重複防止、8アクティブ音+短いフェード尾部の上限、停止/終了/リトライ時の破棄、音量・ミュート、音声再開拒否・復帰中断の処理を単体と画面で検査した。新しいtable-bounceは返球音を鳴らさない。450以後の全スマッシュでも古い音を再生しない。

残る確認：iPhone17Pro Safariの開始/復帰制限、実プレイの自他の識別・予告とのバランス・多球の快適さ・スピーカー/イヤホンでの音割れ。OS/Safari版・音量・品質・出力装置・対象SHAを記録して試聴する。
'''
(root/'audio-review.md').write_text(audio)
visual=f'''# 画像・映像の確認範囲

対象：`{sha}`。画像{counts['screenshots']}、動画{counts['videos']}、WAV{counts['audio']}、データ{counts['data']}。すべて[媒体ハッシュ](media-manifest.json)へ記録。

**実際に開いた画像と、動画から抽出した時系列フレームを確認した。連続動画を実機で再生して見たという結果ではない。** 高得点の一覧は専用状態の表示検査、555継続はテスト内の自動入力で、手動到達の証拠ではない。

| 対象 | 観察した範囲 | 結果 |
|---|---|---|
| 460 | [足の発光](screenshots/extended-460-chromium.png)、459/460の一覧 | 自側の台裏・足・支えの通常色から虹色への変化を確認。 |
| 470/480/490 | [WebKit境界一覧](screenshots/extended-webkit-grid.png) | 470/472の球数、480の相手球の再可視、490の相手側の物体の輪郭が消えた連続模様を確認。 |
| 500/510 | [時系列](screenshots/extended-stages-webkit-filmstrip.png)、[510](screenshots/extended-510-chromium.png) | 相手の共通模様と自側の部品の色/向きの変化。ゲームとHUDの境界は保持。 |
| 520/530 | [返球の花火](screenshots/racket-firework-chromium.png)、[WebKit時系列](screenshots/fireworks-webkit-filmstrip.png) | 中心付近からの粒子、停止保持、再開後の消滅と初期状態へのreset。正確な原点・発生時刻・一回性は位置付きイベントの検査で確認。 |
| 555からの継続 | [Chromium](screenshots/555-play-chromium-filmstrip.png)・[WebKit](screenshots/555-play-webkit-filmstrip.png) | 左右へ動くラケット、増える球、花火、予告と668/148球までの進行を確認。多くは返球待ちで、148球が全て同時飛行したという意味ではない。 |
| 390 | [Chromium](screenshots/pulse-390-chromium-filmstrip.png)・[WebKit](screenshots/pulse-390-webkit-filmstrip.png) | 強弱を繰り返しても台・ラケット・白い球とHUDが残る。自側床と脚はまだ通常色。専用状態では球位置は固定。 |

390の動画から6fpsで18フレーム、その他の動画から全体を通じて24フレームを抽出。起動直後の白/灰のフレームや初期レイアウトはゲーム中の点滅評価と分けた。動画は[videos/](videos/)に保存し、再評価できるようにした。

停止・回転・実ドラッグ、初期の暗闇と貫通の回帰は正式画面検査で確認。球本体・虹色外周のラケット前後、白い中心、混在球とネットの透明描画、無照明の発光は実GPUピクセルの検査も成功。

**未確認：iPhone17Pro実機での球の追いやすさ、連続再生による体感、390以降（ランダムな光を含む）の最終点滅安全性。** 抽出フレームだけでWCAG2.3.1の輝度・面積・赤色条件の合格を断定しない。今回の390は強→弱/弱→強を各0.3秒、周期0.6秒、明るさ0.65〜1で滑らかに変化させ、瞬間的な全暗転にしない。試聴の結果も別記録。
'''
(root/'visual-review.md').write_text(visual)
perf=f'''# 実時間60秒の性能記録

対象：`{sha}`。全4条件を標準品質で各60秒。ChromeはSwiftShader、WebKitはLinux上のiPhone13エミュレーション。iPhone17ProのGPU・OS・Safari実機の測定ではない。

**4条件すべて停止せず進行したが、性能基準は未達。実機の合否は未確認。** 計測コマンドの成功と、60秒の実進行59秒以上/95%以上25ms以下の合格を区別する。

| 条件 | 進行秒 | ラリー | 生存球 | 相手打球=スマッシュ | p95 | 25ms以下 | 状態 |
|---|---|---|---|---|---|---|---|
'''
for engine,cases in summary['realtime'].items():
 for score,r in cases.items():perf+=f"| {engine}/{score} | {r['runningSimulationSeconds']:.3f} | {score}→{r['score']} | {r['initialBalls']}→{r['remaining']} | {r['smashHits']} | {r['p95Ms']:.1f}ms | {r['fractionAtMost25ms']*100:.1f}% | {r['finalPhase']}, pauseなし |\n"
perf+='''
生データは[data/](data/)、[全文](final-performance.log)、[集計](summary.json)を参照。UA、viewport、DPR、描画ピクセル数、各フレームの全間隔を記録した。Chromiumは1280×720/DPR1・描画599×414、WebKitは390×664/DPR3・描画534×372。

前回は0.10秒の閾値で停止し、ゲーム内進行は0.15秒/0秒だった。今回は新しい段階条件のまま全測定でrunningを維持し、41.6〜56.5ゲーム秒進んだ。描画間隔が長いフレームでは0.10秒を超える余剰を破棄するため、壁時計より遅くなる。停止していた間の良好なp95を性能合格へ使う問題は避けた。

描画負荷の改善では、球数に比例する呼び出しを3バッチ化し、555からの30ゲーム秒は91→148球でも30drawsを保持した。物理・入力17ファイルは[速度調整コミットと最適化後で同一](physics-preserved-by-optimization.json)。450からのgeometry46→48/program13→14は初めての段階解放で読み込む資源であり、20回反復の増殖とは分ける。

残る課題はiPhone17Proの実測、低品質を含む実機での調整、描画・GPU・フレーム遅延の内訳の計測。現時点で目標達成・実機で快適とは主張しない。
'''
(root/'performance.md').write_text(perf)
print(counts)
