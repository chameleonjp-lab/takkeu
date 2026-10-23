"""Write the current acceptance matrix only after the frozen run succeeds."""
import json
from pathlib import Path

root = Path(__file__).parent
formal = json.loads((root / 'final-verification.json').read_text())
report = json.loads((root / 'summary.json').read_text())
assert formal['result'] == 'passed'
assert report['unit'] == {'passed': 136, 'failed': 0, 'pending': 0, 'files': 25}
assert report['browser']['expected'] == 64 and report['release']['expected'] == 4
for key in ['browser', 'release']:
    assert all(report[key][k] == 0 for k in ['skipped', 'unexpected', 'flaky'])
sha = formal['commit']

# The unchanged requirements retain their wording, with the new cadence and
# larger workload explicitly replacing the prior counts and reward conditions.
prior = (root.parent / 'rally-revision' / 'README.md').read_text()
matrix = '## R01〜R12\n' + prior.split('## R01〜R12\n', 1)[1].split('## 媒体・性能・公開', 1)[0]
matrix = matrix.replace('34', '47').replace('最新21行', '最新22行')
matrix = matrix.replace('30/40/150/160…', '5/10/20/30…').replace('30/40/150以降の累計増球', '5/10/20と以後10ごとの累計増球')
matrix = matrix.replace('39→41、149→171、159→161等', '4→6、9→11、19→21、149→171、159→161等')
matrix = matrix.replace('| A01 | 成功 |', '| A01 | 未確認（音声処理は成功、聞き分けの試聴は未確認） |')
matrix = matrix.replace('| A02 | 成功 |', '| A02 | 未確認（音声処理は成功、試聴は未確認） |')
matrix = matrix.replace('| M10 |', '| M05 | 5で計2球、10で計3球、20で計4球、以後10ごとに追加。0→21の実セッションと境界・重複・落球を検査。 | 成功 |\n| M10 |', 1)
matrix = matrix.replace('| M30 | 常時虹色と2球目。', '| M30 | 常時虹色。定期増球も同時に成立し無落球なら計5球。')
matrix = matrix.replace('| M40 | 3球目（旧50を廃止）。', '| M40 | 最新の定期増球に従い無落球なら計6球。旧3球目条件を置換。')
matrix = matrix.replace('| M150 | 4球目、以後10ラリーごとに1球。450で47球、継続時も増球。', '| M150 | 定期増球で無落球なら計17球。以後も10ごとに追加し450で47球。旧4球目条件を置換。')
matrix = matrix.replace('任意の色解釈の質問は未回答。', '色が未指定のため赤を初期調整色とする。')

load = report['load']
perf_rows = '\n'.join(f"| {engine} | {d['continuousPlayVerdict']} | {d['runningSimulationSeconds']:.6f}秒 | {d['finalPhase']} / {d['pauseReason']} | {d['smashHits']} | {d['p95Ms']:.2f}ms |" for engine, d in report['realtime'].items())
load_rows = '\n'.join(f"| {engine} | 450 → {d['finalScore']} | 47 → {d['finalLiveBalls']} | {d['simulationSeconds']:.6f}秒 | geometry {d['resources']['geometries']['min']}〜{d['resources']['geometries']['max']}、texture {d['resources']['textures']['min']}〜{d['resources']['textures']['max']} |" for engine, d in load.items())

header = f'''# 最新の増球指定・公開画面の受入記録

正式対象製品：`{sha}`。基準main：`df6eb63da25cc3c88f0d3b5669a81530bbf37a95`（PR #10マージ済み）。正式実行：{formal['startedAt']}〜{formal['endedAt']}。

**型・単体136件・画面64件・配布4件は成功。実機・試聴・390の最終点滅安全性は未確認。実時間性能の合否は下表のとおり。** 実装済み・自動検証済み・実機等の最終受入・公開済みを区別する。

## 公開画面が旧版だった原因と現在の公開

添付は21ラリー・残球1、相手台・床・壁・青ラケットが見える状態だった。調査開始時も公開SHAは旧`01ef27f`で、PR #10をマージしたmain `df6eb63`のPagesは検証中だった。

[Pages 39889118163](https://github.com/chameleonjp-lab/takkeu/actions/runs/39889118163)は02:40:51 UTCまでに成功。`release.json`はmainの完全SHAと一致し、実公開のWebKit縦横で開始・設定保存・停止/再開・リトライ・ホーム、得点URL無効、開発経路404を確認した。縦画面の画像を実際に開き、相手側の台・床・壁・ラケットが隠れることを確認した。Chromiumの公開URL検査は環境のプロキシCAで失敗し、TLS検査を無効にせず未確認とした。

[照合の時系列](public-investigation.json)・[公開run](public-run.json)・[検証ジョブ全文](public-verify-build.log)・[配備ジョブ全文](public-deploy.log)・[実公開の検査結果](public/merged-pr10-webkit/live-check.json)・[縦画面](public/merged-pr10-webkit/webkit-portrait-playing.png)。Linux WebKitのエミュレーションでありiPhone実機の証拠ではない。

**この公開成功は前回の暗闇・発光の修正について。今回の増球変更 `{sha[:7]}` は別の変更で、PR提出時点では未公開。** 自動マージは実施せず、レビュー後にmainへマージすると既存Pagesが確定mainの同じSHAを検査・ビルド・自動配布する。

## 今回の変更

- 開始1球、5で計2球、10で計3球、20で計4球。以後10ごとに1球追加し、無落球なら450で47球。「10で2球目追加」は2回目の追加という解釈。落球補充・上限なし。
- 変更した製品ファイルは`src/game/milestones.ts`だけ。[preserved-production.json](preserved-production.json)で他35ファイルがmainと同一と確認。毎ラリー加速、暗闇、全演出、投影接触、深度、画角、予約時刻、保存・入力・中断復帰・音声を保持。
- テスト専用の自動入力で、得点・球を置換せず開始から21へ進め、5/10/20の2/3/4球と増球イベント各1回・落球なしを両エンジンで検査。高得点画像は専用状態による表示検査で、450まで実操作した証拠ではない。
- 47球から30ゲーム秒の配球・継続・増球・スマッシュ・高速接触、同一入力の30/60/120Hz一致、47音イベントの個別発音と重複防止、共有描画資源、再挑戦20回/ホーム20回を検査した。

## 正式な検査

[final-verification.json](final-verification.json)に完全SHA、ソース105ファイル・配布10ファイルのSHA-256、各コマンド・時刻・終了コード・全文ログのハッシュを保存。[summary.json](summary.json)は結果の集計。

| 検査 | 結果 | 記録 |
|---|---|---|
| 導入・型 | 成功 | [導入](final-install.log)・[型](final-typecheck.log) |
| 単体 | 136件/25ファイル成功、失敗/skip 0 | [全文](final-unit.log)・[JSON](final-unit.json) |
| 画面 | 64件（Chromium32/WebKit32）成功、失敗/skip/flaky 0 | [全文](final-browser.log)・[JSON](final-browser.json) |
| ルート/Pages配布 | 4件成功、配布ビルド成功 | [全文](final-distribution.log)・[JSON](final-release.json) |
| 開発補助の隔離 | 得点URL無効、fixtureの404、JSへ非混入、配布ハッシュ一致 | [追加検査](fixture-isolation.json) |
| Linux実時間60秒 | 記録処理は成功、連続プレイの合否は下表 | [全文](final-performance.log)・[JSON](final-performance.json) |

中間の失敗・修正・再確認と別担当レビューは[review.md](review.md)へ保存。正式な録画・画像・WAVと[媒体ハッシュ](media-manifest.json)、[映像の確認範囲](visual-review.md)、[音声確認](audio-review.md)も参照する。

## 47球からの継続と性能

| 条件 | ラリー | 生存球 | ゲーム内進行 | 描画資源 |
|---|---|---|---|---|
{load_rows}

上表は固定時計・テスト内の自動入力であり、実時間の性能合格ではない。初期47球が全て配球されること、スマッシュ実行、到着間隔・最低視認時間を検査した。再挑戦20回/ホーム20回も資源・rAF・購読・AudioContextが増えないことを確認。

| Linux実時間60秒 | 連続プレイ | ゲーム内進行 | 最終状態 | 実スマッシュ | 描画間隔p95 |
|---|---|---|---|---|---|
{perf_rows}

停止中を含む良好なp95を合格に使わない。実時間で進まない場合、描画遅延の内訳とiPhoneでの再現性は未解決。前回の準備後にも停止した記録は[前回の性能記録](../rally-revision/performance.md)に残す。

**iPhone 17 Pro Safariの実機操作・画面ロック・ホーム操作領域・VoiceOver・60秒性能は未確認。** 目標は60秒・描画間隔の95%以上が25ms以下のまま、450の47球以上の条件へ更新。描画負荷対策として球速・接触・加速・表示解放を変更していない。

'''
footer = '''## 公開判断と操作

実機・人の試聴・390の最終点滅安全性は未確認で、Linux連続負荷の結果も残る。待機球だけ残る状態の独立回帰ケース追加はレビューのMinor改善案として未実施（製品の不具合指摘はなし）。

今回の`/takkeu/`配布候補ZIPと各ファイルのハッシュは[release-candidate.json](release-candidate.json)に記録する。候補は未公開で、配備時は確定mainのSHAで全検査とビルドを行う。

1. Draft PRの未確認事項と差異を判断し、Readyへ変更してmainへマージする。
2. 対象mainのPages releaseが配備まで成功し、公開`/takkeu/release.json`がその完全SHAと一致することを確認する。マージ直後の旧版表示と配備完了を区別する。
3. 公開ページで5/10/20の増球、暗闇、縦横操作・停止/再開・再挑戦・保存と演出を確認する。
4. 手動公開はmainの完全SHAをexpected_shaへ入力。同じコミットで検査・ビルドした成果物を再ビルドせず配布する。問題があれば[公開・復旧手順](../../release.md)に従い、revert PRから以前の承認済み内容へ戻す。

実装担当によるマージ・手動公開・自動マージ・料金変更・オンラインランキング追加は実施していない。前回PR #10の公開は、ユーザーのマージを契機とする既存自動Pagesの結果を照合した。
'''
(root / 'README.md').write_text(header + matrix + footer)
print(sha, 'acceptance report written')
