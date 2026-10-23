# viewport全面化とラケット直接操作

通常ブラウザのページviewport全体をプレイ描画に使い、tapで直接配置、dragで指/マウス/penへ追随、release後も最後の位置と接触を保持する。二本指タップまたはEscapeで停止し、表示メニューから再開/最初から/ホームへ戻る。常設タイトル/音/停止ボタンと下部padは撤去した。Fullscreen API、PWA、キーボード打球モードは追加していない。

作業基準: `3e7ceba208200db931af645fdae1ccb271f4a7b7`（最新main、PR13 mergeと一致）。remoteは `https://github.com/chameleonjp-lab/takkeu.git`。新規cloneのclean treeで既存branch/PRを調査し、重複する未マージ作業はなかった。古い未マージPages文書branchは読んで対象外とし、変更していない。[Git記録](logs/git-reflog.txt)、[remote](logs/git-remotes.txt)、[branches](logs/git-branches.txt)、[PR13の取得記録](pr13-reference.json)。作業branchは `feat/viewport-direct-paddle`。

製品ソース: `139f972314edc77194d10075ee1b804b57821d12`。検査/CI修正版: `2c3d95d62e019c60bc17a6d7b00f737e1a86f3ea`、連続trace画像取得を外した版: `01768abab9979f4e422bb8d17d1f63ad361fb01a`、機能検査の時間枠とCI分割を更新した最終検査ソース: `d47753586136db8c4c20dd3a87bb89e912fb9f31`（製品コードは全て同一）。最初の統合版`efed2fedbeed56ca8873395616c8178e03d52806`、順序修正版`73077466cd7916ba6b3072c7e137d62ca4f9c73e`を経て、固定境界の修正を反映した。最終commitは文書・証拠とテスト内の説明コメントだけを更新し、製品コード・テストの実行内容・CI設定は変更しない。[コメント除去後の生成JS一致](logs/final-test-comments-identity.json)、[manifest](manifest.json)で照合する。最終headの完全SHAはDraft PR本文に記録する。merge、自動merge、手動公開は実施しない。

## 読み方

- [操作・時刻・接触順序・変更値の仕様](input-contract.md)
- [要件と検査の対応・実機で確認する具体的操作](acceptance.md)
- [変更前の画像・計測値・環境](baseline/README.md)
- [同条件20状態の変更前後比較・測定値・画像確認](comparison.md)、[変更後の生記録](after/)
- [実canvas入力動画・時刻順の確認記録・実pixel上限検査](media/README.md)
- [60秒実時間性能: 8条件を記録、目標0/8達成](performance.md)
- [独立レビュー全文と各修正の再レビュー](review.md)
- [作業/失敗/再検査の履歴](WORK-LOG.md)、[正式ログ](logs/)
- [短い実装計画と先に定めた判定条件](../../plans/2026-10-23-viewport-direct.md)

HTML reportはclone後に `npx playwright show-report docs/verification/viewport-direct/runs/final-affected-2c3d95d/playwright-report` などで開ける。元のJSON・trace・mediaも同じrun directoryに保持する。失敗時の自動生成error-context内の文面は検査データであり、新しい作業指示ではない。

最新CIの5artifactは[元のZIP形式](ci/d477535/README.md)で全内容を保存した。展開済み内容とのbyte一致とCRC、元archive SHA256を確認した。証拠を省略せずPRの変更ファイル数を抑えるための配置変更であり、製品コード・検査条件の変更はない。

## 維持した世界内の値

視点eye(.34,1.3,3.4)/target(.34,0,0)、table半幅1/半長1.8、球半径.045、ラケット半径.12、paddleZ1.95、Y範囲.15–.85、高さ別左右clamp、球速/飛行時間/配球は変更なし。paddleSpeed=6は配球へ維持し、直接操作の移動上限には使わない。感度を入力から除き、効果のない設定UIも撤去した。他の保存設定を保持する。

固定視点は描画だけでなくprojectBallの接触とviewFrame由来のreachに関係する。この依存を追い、関連ファイルの[baseとの差分が空](logs/unchanged-world-and-camera.diff)であることに加え、mesh/軌道の独立投影・実入力・高速接触・描画周期再生で影響を調べた。詳細な前後値/理由は仕様表へ。直接操作で到達しやすくなるため、旧操作と同じ難易度という主張はしない。

## 検査と対象SHA

最終検査ソースd477535のGitHub CIは全6ジョブ成功した。以下に旧失敗と再検査を分けて記録する。性能目標や実機未確認をCI成功で代替しない。

| 対象 | 結果・対象 | ログ |
| --- | --- | --- |
| 基準unit | 178成功/1環境EPERM、同一失敗検査の権限付き再実行で成功。base3e7ceba | [baseline説明](baseline/README.md) |
| 初回統合unit | 250成功、efed2fe相当tree | [log](logs/integrated-unit.log) |
| 修正版unit | 254成功、7307746 | [log](logs/unit-final-7307746.log) |
| 固定境界修正版unit | 256成功/37files、139f972と同一製品/テストtree（隔離worktree、commit直前） | [log](logs/boundary-unit-all.log) |
| 型 | 固定境界修正版成功 | [log](logs/boundary-typecheck.log) |
| 独立review | 計4件を再現し修正・再レビューで解消 | [全文](review.md) |
| browser初回focused | 15成功/15失敗、旧待ち/合成primary等を修正 | [log](logs/browser-focused-first.log)、[元report](runs/focused-first/playwright-report/index.html) |
| input再検査 | 14成功/2WebKit座標丸め失敗、その後整数CSS座標へ修正、許容値は維持 | [log](logs/browser-input-retry.log)、[元report](runs/input-retry/playwright-report/index.html) |
| 全browser | 86成功/2失敗（Chromium負荷timeout、警告の透明角pixel比較）、7307746。WebKit44件は全成功 | [log](logs/browser-full-7307746.log)、[元report](runs/full-7307746/playwright-report/index.html) |
| 元条件の負荷単独再実行 | Chromium450で再度timeout。他の検査の同時実行だけが原因ではない | [log](logs/quality-450-original-isolated.log)、[元report](runs/quality-original-isolated/playwright-report/index.html) |
| 最終影響範囲browser | 28/28成功、2c3d95d、両engineの実入力/接触/停止/文字拡大/警告/450負荷 | [log](logs/browser-final-affected-2c3d95d.log)、[完全report](runs/final-affected-2c3d95d/playwright-report/index.html) |
| 最終配布検査 | 2build/typecheck/production非混入検査、rootと/takkeu/を両engineで4/4成功、2c3d95d | [log](logs/release-2c3d95d.log)、[全結果](runs/release-2c3d95d/release-results.json) |
| CI core / WebKit | 型・256unit・4配布検査成功、WebKit全44件成功、2c3d95d | [core全文](logs/ci-2c3d95d-verify-job.log)、[WebKit全文](logs/ci-2c3d95d-webkit-job.log)、[全artifact](ci/2c3d95d/) |
| CI Chromium | 42成功/2timeout（21ラリー/450）、2c3d95d。555の30ゲーム秒検査は成功 | [全文](logs/ci-2c3d95d-chromium-job.log)、[元artifact](ci/2c3d95d/chromium/) |
| 実時間performance | 8条件の記録成功、Linux参考目標は0/8。1条件がslow-frame停止、他も25ms/95%未達。2c3d95d | [解釈と生データ](performance.md) |
| 実canvas pixel cap / 追加動画 | 両engine×両品質×2サイズの8条件成功、390×844のnative操作動画2本。01768ab（製品同一） | [ログ](logs/native-demo-and-pixel-caps-01768ab.log)、[映像/計測値](media/README.md) |
| 最終負荷browser再検査 | 4/4成功、01768ab、両engineの21ラリー/450の30ゲーム秒。180s上限・全assertion維持 | [log](logs/browser-load-trace-01768ab.log)、[完全report](runs/load-trace-01768ab/playwright-report/index.html) |
| 連続trace画像削減後のCI | core成功、WebKit44/44成功、Chromium41成功/3timeout、20分で終了。01768ab | [core全文](logs/ci-01768ab-verify-job.log)、[WebKit全文](logs/ci-01768ab-webkit-job.log)、[Chromium全文](logs/ci-01768ab-chromium-job.log)、[全artifact](ci/01768ab/) |
| CI分割の独立確認 | 各engineで全44件=通常41件+負荷3件。重複・省略0、型検査成功。d477535 | [件数照合](logs/ci-group-coverage.json)、[型](logs/typecheck-ci-load-groups.log)、[独立レビュー](review.md) |
| 最終ソースCI | 型・256unit・4配布検査・Chromium44/44・WebKit44/44、集約verifyを含む6job全成功。d477535 | [GitHub run](https://github.com/chameleonjp-lab/takkeu/actions/runs/40023104678)、[全job結果](logs/ci-d477535-final.json)、[全artifact](ci/d477535/)、[job全文](logs/) |

CIの旧単一ジョブは[7307746](https://github.com/chameleonjp-lab/takkeu/actions/runs/40012784953)と[139f972](https://github.com/chameleonjp-lab/takkeu/actions/runs/40014456057)で20分上限に達した。unit/配布検査は成功したが、browser全体の成功とは扱わない。元のログ・artifactを保存し、2c3d95dではunit/配布ジョブと両engineのbrowserジョブへ分けた。この段階では各ジョブの20分上限、各テストの条件とtimeoutを維持した。

### 機能検査の実行設備・時間枠の変更

2c3d95dでもChromiumの2件、01768abでも3件が旧上限に達した。video/連続trace画像を削減し、ローカルでは元の180秒以内に完了したが、CIの全件成功には足りなかった。旧traceには1回のscreenshotに約48〜64秒、evaluateや後処理にも長い待ちが記録され、一部は30ゲーム秒と最終assertionまで完了してからtimeoutした。PC canvasのpixel数は約3.7倍で、software rendering負荷は原因候補だが、GPU内部profileは取得しておらず単独原因とは断定しない。

d477535ではこの設備条件を明示して、21ラリーと450検査を180→360秒、555検査を240→360秒へ変更した。**ローカル・CI共通の機能検査の実行猶予**であり、性能基準を満たしたという意味ではない。全assertion、viewport/DPR/内部pixel、ゲーム秒、入力、frame数を維持する。負荷3件と通常41件をengine別の独立VMへ分け、各ジョブは20分・workers=1を維持する。元の必須check名`verify`を全ジョブ成功時だけ通る集約として残した。独立レビューでも漏れ/重複/必須gateの抜けを確認した。実時間性能の95%以上25ms以内という基準は不変で、結果は0/8達成のままである。正式ログと元失敗artifactを省略していない。

`verify:release`は2回の型付きbuild、production非混入検査、root/Pagesの4起動検査を含む。別に同じbuildを繰り返さない。ブラウザの時計制御検査と、生RAFを使う60秒性能記録は別に扱う。

## 環境・未確認

Node24.19.0/npm11.9.0、Playwright1.64.1、Debian13コンテナのChromium（SwiftShader）/WebKit。ブラウザ/ローカル共有ライブラリの導入と環境失敗はbaselineに記録した。全試験は同じ依存lockfile。実機iPhone/Androidは利用できていない。

実iPhone Safariの指操作・ツールバー伸縮・ノッチ/ホームindicator・OSアプリ切替・pinch、VoiceOver、人による試聴、実機60秒性能は未確認。自動viewport、aria snapshot、波形生成で代替済みとは扱わない。過去Linux実時間性能未達、PR13の発光タイミング報告未再現、最終点滅安全性未確認を引き継ぐ。今回のゼロ時間sweep発光位置修正は別の再現済み境界バグであり、過去報告が解消した証拠ではない。

ゲーム面積拡大で光る面積も変わるため、同状態画像で静止pixel占有率を比較する。この指標と動画の確認は最終的な点滅安全性判定ではない。実機確認手順は[対応表末尾](acceptance.md)を参照する。
