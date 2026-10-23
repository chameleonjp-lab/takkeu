# 音声処理と人による試聴

対象：`45106aace7340820da8b5eaafba8efc1d0ea7af1`。Chromium156 / Linux WebKit27.2（iPhone13プロファイル）。iPhone17Pro実機ではない。

**ブラウザの音声処理は成功、人による試聴は未確認。** この環境では実機スピーカー/イヤホンを人の耳で聴く検証を行っていない。数値検査を「聞き分けられた・快適だった」と扱わない。

[正式画面検査](final-browser.log)・[波形集計](summary.json)・[WAV](audio/)・[ハッシュ](media-manifest.json)。自分音・相手音・予告音・4音・16音のWAVを各エンジン5本、計10本保存した。波形は実OfflineAudioContextで生成し、無音でないこと・自他の差・最大ピークの余裕を検査した。

| エンジン | 波形 | peak | RMS | 処理 | 試聴 |
|---|---|---|---|---|---|
| chromium | [player](audio/chromium-player.wav) | 0.049510 | 0.004126 | 成功 | 未確認 |
| chromium | [opponent](audio/chromium-opponent.wav) | 0.051308 | 0.006094 | 成功 | 未確認 |
| chromium | [warning](audio/chromium-warning.wav) | 0.035145 | 0.004077 | 成功 | 未確認 |
| chromium | [four](audio/chromium-four.wav) | 0.142369 | 0.010900 | 成功 | 未確認 |
| chromium | [sixteen](audio/chromium-sixteen.wav) | 0.592818 | 0.043915 | 成功 | 未確認 |
| webkit | [player](audio/webkit-player.wav) | 0.049510 | 0.004126 | 成功 | 未確認 |
| webkit | [opponent](audio/webkit-opponent.wav) | 0.051308 | 0.006094 | 成功 | 未確認 |
| webkit | [warning](audio/webkit-warning.wav) | 0.035145 | 0.004077 | 成功 | 未確認 |
| webkit | [four](audio/webkit-four.wav) | 0.142369 | 0.010900 | 成功 | 未確認 |
| webkit | [sixteen](audio/webkit-sixteen.wav) | 0.592818 | 0.043915 | 成功 | 未確認 |

不可視の相手の打球イベント、別球の個別発音、同一イベントの重複防止、8アクティブ音+短いフェード尾部の上限、停止/終了/リトライ時の破棄、音量・ミュート、音声再開拒否・復帰中断の処理を単体と画面で検査した。新しいtable-bounceは返球音を鳴らさない。450以後の全スマッシュでも古い音を再生しない。

提出後CIの音声復旧2件の失敗は、ランダム配球で正常な次の自返球が起きた音も旧テストの観測範囲へ入ることが原因。固定seed7で両エンジンの失敗を再現し、復旧直後の無音・次の相手音1回・その後の自返球音1回を個別に検査するよう修正。製品・音声コードは変更せず、[音声関連8件の成功](audio-observation-green.log)と[補足記録](supplemental-verification.json)を保存した。これは試聴の結果を変えない。

残る確認：iPhone17Pro Safariの開始/復帰制限、実プレイの自他の識別・予告とのバランス・多球の快適さ・スピーカー/イヤホンでの音割れ。OS/Safari版・音量・品質・出力装置・対象SHAを記録して試聴する。
