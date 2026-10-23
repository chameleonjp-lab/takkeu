# 画像・映像の確認範囲

対象：`45106aace7340820da8b5eaafba8efc1d0ea7af1`。画像191、動画12、WAV10、データ30。すべて[媒体ハッシュ](media-manifest.json)へ記録。

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
