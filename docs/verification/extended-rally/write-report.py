"""Write an acceptance matrix from the current formal spec and frozen evidence."""
import hashlib,json,re,zipfile
from pathlib import Path
root=Path(__file__).parent
formal=json.loads((root/'final-verification.json').read_text());report=json.loads((root/'summary.json').read_text())
assert formal['result']=='passed'
assert report['unit']['failed']==report['unit']['pending']==0
assert report['browser']['expected']==74 and report['release']['expected']==4
for key in ['browser','release']:assert all(report[key][k]==0 for k in ['skipped','unexpected','flaky'])
sha=formal['commit'];spec=Path('docs/superpowers/specs/2026-10-22-takkeu-design.md').read_text()
archive=root/'takkeu-pages-candidate.zip'
files={str(p.relative_to('dist')):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path('dist').rglob('*')) if p.is_file()}
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for path in files:z.write(Path('dist')/path,path)
(root/'release-candidate.json').write_text(json.dumps({'commit':sha,'base':'/takkeu/','archive':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':files,'published':False},indent=2)+'\n')
rows=[]
for engine,d in report['load'].items():rows.append(f"| {engine} / 450 | 47 → {d['finalLiveBalls']} | 450 → {d['finalScore']} | {d['simulationSeconds']:.6f}秒 | {d['resources']['drawCalls']['min']}〜{d['resources']['drawCalls']['max']} |")
for engine,d in report['extendedLoad'].items():rows.append(f"| {engine} / 555 | 91 → {d['finalBalls']} | 555 → {d['finalScore']} | {d['simulationSeconds']:.6f}秒 | {d['resources']['drawCalls']['min']}〜{d['resources']['drawCalls']['max']} |")
perf=[]
for engine,conditions in report['realtime'].items():
 for start,d in conditions.items():perf.append(f"| {engine} / {start} | {d['continuousPlayVerdict']} | {d['runningSimulationSeconds']:.3f}秒 | {d['finalPhase']} / {d['pauseReason']} | {d['smashHits']} | {d['p95Ms']:.2f}ms |")
text=f'''# 加速・配球・後半段階の受入記録

正式製品コミット：`{sha}`。基準main・調査時の公開：`0082ce8b877bc93a1e4969110543c8c3ab5b6f75`（PR #11マージ済み）。正式実行：{formal['startedAt']}〜{formal['endedAt']}。

**型・単体{report['unit']['passed']}件/{report['unit']['files']}ファイル・画面{report['browser']['expected']}件・配布4件は成功。iPhone 17 Pro実機、試聴、390以降の最終点滅安全性は未確認。実時間性能の合否は別表へ記録する。今回の変更はPR提出時点では未公開。**

## 実装と旧仕様との差異

- 初速は視認時間1.25→1.00秒、加速はgain1.2/decay200→gain1.6/decay90。毎ラリー全球へ反映し、飛行中も位置を保って往復を加速。待機球を再予約し、予告済みの球は早出ししない。
- 1球目だけ中央で導入し、その後は左右3帯の候補を直前とは別の帯から生成し、広く乱数配球。相手へ戻す地点も左右に変わり、相手ラケットを実打球点へ合わせる。
- 停止閾値0.10→1.50秒超。短い遅延では入力flushと描画が12刻み/0.10秒の予算を共有し、余った負債を捨てる。低FPSでは壁時計より遅くなる。非表示・ロック等の手動再開は維持。
- 450以後の全相手打球・追加球・待機球をスマッシュにし、20%と2秒除外を撤去。540で係数1.25→1.60。予告実時刻から0.40秒以上を保持。
- 460の足、470以後2ごとに1球、480の既存・新規球の発光、490の継ぎ目のない相手側、500/510のランダムな光、520/530の花火、555の曲がるバウンドを追加。無落球なら555で91球。落球補充・球数上限なし。
- 未回答の任意確認は設計の既定で実装：480で相手球を再可視、490で相手の台・床・壁・ラケット・人型を同じ画面座標の連続模様へ置換する。ネット・球は残す。
- 花火は1536粒子上限、標準24/低12粒子、0.7ゲーム秒で消滅。球は共有形状・材質を3つのInstancedMeshへまとめ、球数に比例する描画呼び出しを削減。深度・球色・影を保持し、CPUのゲーム計算は変えない。

## 正式な検査

[final-verification.json](final-verification.json)は完全SHA、ソース{len(formal['sourceSha256'])}ファイル・配布{len(formal['distributionSha256'])}ファイルのSHA-256、コマンド・時刻・終了コード・全文ログのハッシュを含む。[summary.json](summary.json)は集計。

| 検査 | 結果・範囲 | 証拠 |
|---|---|---|
| 導入・型 | 成功 | [導入](final-install.log)・[型](final-typecheck.log) |
| 単体 | {report['unit']['passed']}件成功、失敗/skip 0 | [全文](final-unit.log)・[JSON](final-unit.json) |
| 画面 | {report['browser']['expected']}件、失敗/skip/flaky 0 | [全文](final-browser.log)・[JSON](final-browser.json) |
| 配布 | ルートと/takkeu/の4件・ビルド成功 | [全文](final-distribution.log)・[JSON](final-release.json) |
| 開発補助の隔離 | 得点URL無効、fixture/src経路404、JSへ非混入 | [追加検査](fixture-isolation.json) |
| 実時間60秒 | 計測処理の成功と性能の合否は区別 | [全文](final-performance.log)・[JSON](final-performance.json) |
| レビュー・修正 | 入力負債、Home粒子、run乱数、球の描画負荷を修正・再確認 | [失敗/修正/レビュー](review.md) |
| 映像・音 | 画像・映像の確認範囲と、音声処理/試聴を区別 | [映像](visual-review.md)・[音](audio-review.md)・[媒体ハッシュ](media-manifest.json) |

高得点の静止画像はテスト専用状態からの表示検査。450・555からの継続はテスト内自動入力で、到達まで人が実操作した証拠ではない。開始から21への検査は得点・球を置換せず5/10/20の増球を実際に通過する。

## 継続・資源・性能

| ブラウザ / 初期ラリー | 生存球 | ラリー | ゲーム内進行 | 描画呼び出し |
|---|---|---|---|---|
{chr(10).join(rows)}

固定時計の継続・資源検査であり実時間性能ではない。再挑戦20回/ホーム20回、124球の20回再利用、イベント/音/描画資源の解放を検査。描画前の球数に比例する呼び出し増加（555→668で34→228回）は3バッチ化で改善。比較は[変更前Chromium](pre-instancing-chromium.json)・[変更前WebKit](pre-instancing-webkit.json)と正式な集計を参照。

| Linux実時間60秒 / 初期ラリー | 連続プレイの合否 | ゲーム内進行 | 最終状態 | 実スマッシュ | 描画間隔p95 |
|---|---|---|---|---|---|
{chr(10).join(perf)}

性能は「60秒間running・実進行59秒以上・打球とスマッシュ実行・描画間隔の95%以上が25ms以下」を満たすかで判定し、停止中の良好なp95を合格へ使わない。生の全間隔・viewport・描画サイズ・UAは[データ](data/)へ保存。ブラウザ測定処理の終了コード0と性能の合格は別。

対象環境：Linux、Playwright Chromium156/WebKit27.2、WebKitはiPhone13プロファイルによるエミュレーション。標準品質、iPhone 17 Pro実機ではない。OS/Safari版・縦横・実ロック/復帰・ホーム操作領域・VoiceOver・60秒性能は実機で未確認。

'''
for prefix,title in [('R','R01〜R12'),('A','A01〜A08'),('Q','Q01〜Q17'),('M','全32行の段階表')]:
 text+=f'## {title}\n\n| ID | 結果 | 照合した要件・確認範囲 |\n|---|---|---|\n'
 for line in spec.splitlines():
  if not re.match(r'^\| '+prefix+r'\d+ \|',line):continue
  cells=[c.strip() for c in line.split('|')[1:-1]];ident=cells[0]
  status='未確認（ブラウザ処理は成功）' if ident in ['A01','A02','Q07','Q12','Q16','M390'] else '成功（自動検査）'
  detail=' / '.join(cells[1:])
  if ident in ['A01','A02','Q07']:detail+=' 試聴・実機での聞き分けは未確認。'
  if ident in ['Q12','M390']:detail+=' 映像の形・球と滑らかな強弱を確認、明るさ・面積・赤色を含む最終安全性は未確認。'
  if ident=='Q16':detail+=' Linuxの縦横/文字拡大は成功。iPhone17Pro実機とVoiceOverは未確認。'
  text+=f'| {ident} | {status} | {detail} |\n'
 text+='\n'
latest=[
 ('X01','左右へランダムに散る返球','配球候補を直前とは別の帯から生成し、往復の到着点を乱数化。extended-core/safetyと実ドラッグ。'),
 ('X02','加速の間隔を早める','gain1.6/decay90、毎ラリー更新。extended-core/progression。'),
 ('X03','1球目の初速を上げる','初期視認時間1.00秒。session/bounce-contact/contact。'),
 ('X04','重い判定を寛容に','1.50秒超の中断で停止。短い遅延の合計計算上限0.10秒。入力flush回帰と実時間4条件の停止なしを確認。Linux性能基準は未達。'),
 ('X05','450からスマッシュだけ','実際の全相手打球、追加・待機球の変換、同一刻みの450到達を検査。'),
 ('X06','460から足なども虹色','台底・脚・支えの発光。459/460の表示と画像。'),
 ('X07','470から2ごとに増球','469/470/471/472の境界、重複・複数到達・落球補充なし。'),
 ('X08','480から新規も全球虹色','既存球・新IDを含む発光と相手側再可視。479/480の表示。'),
 ('X09','490から相手側を一続きの虹色','台・床・壁・人・ラケットの輪郭を非表示、同じ画面座標の場へ置換。'),
 ('X10','500から相手側の動きがランダム','runIdとゲーム時計による滑らかな乱数。499/500・動画・停止の同一性。'),
 ('X11','510から自側の光もランダム','台・縁・床・構造・自ラケット・ネット・球の光。509/510の画像・動画。'),
 ('X12','520から返球時ラケット中心に花火','有効な接触時の補間中心、イベント重複防止、519/520境界。'),
 ('X13','530から自台のバウンドにも花火','実台面の位置・発生時刻・1飛行1回・停止・同時到達の処理。'),
 ('X14','540からスマッシュ増速','係数1.25→1.60、飛行中も位置を保つ。混在到着間隔と予告猶予。'),
 ('X15','555からバウンドで方向が変わる','新しく生成する往復軌道が台内で連続して横方向を変える。555高負荷を継続。'),
 ('X16','全球が毎ラリー徐々に加速','飛行中の往復・待機球へ同じ得点の倍率を適用。位置の連続性と入力再現。'),
]
text+='## 今回の依頼16項目\n\n| ID | 指定 | 結果・確認範囲 |\n|---|---|---|\n'
for ident,title,evidence in latest:text+=f'| {ident} | {title} | 成功（実装・自動検査）。{evidence} |\n'
text+='\n具体的な速度値は未指定のため上記の初期調整値を採用。555はこの段階以後に新しく作る軌道から適用し、既に飛行中の位置を突然変更しない。480/490の解釈は前記の既定を使用。実機の操作感・音・最終点滅判定はこれらの自動検査の成功へ読み替えない。\n\n'
text+='''## 公開判断とユーザー操作

実装・自動検証・実機の受入・公開を区別する。実機/試聴/最終点滅判定は未確認で、上記のLinux性能の結果も残る。[提出前のmain・公開SHA照合](public-state.json)では双方0082ce8で、今回の変更は未公開。

配布候補は[ZIP](takkeu-pages-candidate.zip)・[ハッシュと対象SHA](release-candidate.json)。これは未公開の検証済み候補。PR headの文書追加と製品のソースハッシュ一致は文書検証へ記録し、CIはPR最終headを別途検査する。

1. Draft PRの差異・失敗・未確認事項をレビューし、Readyへ変更してmainへマージする。
2. 既存のPages releaseが対象mainの同じ完全SHAで型・単体・画面・配布検査とビルドを行い、その成果物を再ビルドせず配布する。成功まで直前の公開版が残る。
3. 公開後の`/takkeu/release.json`が対象mainの完全SHAと一致すること、開始・保存・停止/再開・再挑戦・暗闇・増球・縦横操作を確認する。
4. 手動実行はmainの完全SHAを`expected_sha`へ指定。問題があれば[公開・復旧手順](../../release.md)に従いrevert PRを作る。

今回の変更を担当がマージ・手動公開することはない。既存の自動Pagesを維持し、自動マージ・課金変更・オンラインランキング追加はしない。
'''
(root/'README.md').write_text(text)
print(sha,'acceptance report written')
