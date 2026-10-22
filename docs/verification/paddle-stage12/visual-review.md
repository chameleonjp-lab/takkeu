# 画像・動画から確認した範囲

対象：`77f21a5f213d2f3d848a81fc743fcad890c77d6c`。Linux Chromium156とWebKit27.2。実iPhoneや人の試遊ではない。原画像・原動画とSHA-256は[media-manifest.json](media-manifest.json)へ保存した。

実際に開いて確認したもの：

- 開始＋19行の[PC一覧](screenshots/milestones-chromium-grid.png)・[縦一覧](screenshots/milestones-webkit-grid.png)。通常の緑／赤青、70の縁、100の自ラケット縁、130のネット、160/190/210/240の左右面、270/300/330のラケット、360の人物の違いを確認。420では相手側2球が消え、自側2球と解放済み部位が残る。
- [修正前の奥の球](before/chromium-behind-0.png)と[修正後](screenshots/behind-0-chromium.png)、[手前の白い球](screenshots/front-390-chromium.png)。奥の球がラバー上へ描かれず、柄も打球面へ出ていない。手前の球は白い中心と細い虹色の外周を持つ。実画素の前後比較はGPU検査でも確認した。
- [390の縦原寸](screenshots/milestone-390-webkit.png)、[横画面](screenshots/game-874x402.png)、修正後のホーム用描画。台の低い画角、白線、ネット、赤いラケット、操作領域とHUDを確認。ホーム画像は描画を置いた比較用ポーズで、実入力の証拠ではない。
- 390元動画の末尾3秒を6fpsで抽出した[PC](screenshots/pulse-390-chromium-filmstrip.png)・[縦](screenshots/pulse-390-webkit-filmstrip.png)。台とラケットの形が保たれ、色・強弱が変化する。白い球とHUDは保たれる。全画面の表示／非表示を切り替える暗転は抽出範囲で見られない。周期自体は単体の0.3/0.6秒検査を根拠にする。
- ドラッグ動画全体から24点を抽出した[PC](screenshots/three-returns-chromium-filmstrip.png)・[縦](screenshots/three-returns-webkit-filmstrip.png)。ラケットの移動、0→1→2→3、球の往復を確認。末尾だけでは静止保持へ偏るため、全体から時系列で抽出した。得点を変える機能や予約位置への自動操作は本体へ追加していない。
- 450元動画全体から24点を抽出した[PC](screenshots/smash-450-chromium-filmstrip.png)・[縦](screenshots/smash-450-webkit-filmstrip.png)と[ミュート時の予告原寸](screenshots/smash-warning-muted-chromium.png)。構え・文字予告、停止ダイアログ、復帰、隠れた相手側と自側への球の出現、1球を失っても残球3で続く状態を確認。予告・打球の正確な時刻と回数はdataのsmash-stateと単体検査を根拠にする。

ドラッグ動画はテスト時計で駆動したアプリ、390/450動画は専用状態を用いた描画検査である。エンコードされた映像の時間を実ゲームの描画間隔・60秒負荷の合格に使わない。全体抽出には開始時の空白やホーム、終了後の保持も含む。空白の初期フレームを390演出の暗転と扱わない。

白い球の中心は確認できるが、遠い球の虹色の外周は小さい。実機の視認性と、390の明るさ・面積・赤色・表示機器条件を含む最終的な点滅安全性は**未確認**。抽出フレームの目視だけで一般的な安全性を合格にしない。OS／Safari版・明るさ・端末の向き等を記録したiPhone 17 Proでの確認を残す。
