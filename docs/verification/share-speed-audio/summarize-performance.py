from pathlib import Path
import json
root=Path(__file__).parent; rows=json.loads((root/'performance-summary.json').read_text())
after_sha=(root/'performance-after.sha').read_text().strip()
lines=['# 450/555・実時間60秒の比較','', f'正式対象: before=27ebee8fb5fa0d29f7f82e15244dd1fbd1a88de1、after={after_sha}。Linuxの同一Playwright版・viewport/品質・fixture・乱数・実時計。ソフトウェアWebGL。GPUを使う他のブラウザ検査とは直列実行。描画pixel上限・固定計算回数・slow-frame停止を変更していない。', '', 'fixtureは450で47球、555で91球を生成しautoPlayする。人による到達ではない。page.clockを使わず、各ケース実経過60秒をrequestAnimationFrameで測る。初期state差し替えとループ開始の境界によりsimTimeに数十msの差があり、実経過と同一視しない。旧音響と今回の音響を両方有効にし、mute比較ではない。', '', '| Engine / 品質 / 開始score | wall秒 before→after | sim秒 before→after | 描画p95 ms before→after | after voice / 音源 / node peak | after相手打球 |', '| --- | --- | --- | --- | --- | --- |']
after_rows=[]
for engine in ['chromium','webkit']:
 for quality in ['standard','low']:
  for score in [450,555]:
   before=next(r for r in rows if r['label'].startswith('before-') and r['project']==engine and r['quality']==quality and r['initialScore']==score)
   after=next(r for r in rows if r['label']=='after' and r['project']==engine and r['quality']==quality and r['initialScore']==score);after_rows.append(after)
   a=after['audioResources']
   lines.append(f"| {engine} / {quality} / {score} | {before['durationMs']/1000:.3f}→{after['durationMs']/1000:.3f} | {before['runningSimulationSeconds']:.3f}→{after['runningSimulationSeconds']:.3f} | {before['p95Ms']:.1f}→{after['p95Ms']:.1f} | {a['peakVoices']} / {a['peakSources']} / {a['peakNodes']} | {after['opponentHits']} |")
lines+=['', '全8条件とも参照目標「描画間隔の95%以上が25ms以下」は変更前後とも未達。変更後p95はChromium166.6–183.5ms、WebKit50–58ms。改善した行と悪化した行があり、単回のLinux測定から音質や実機性能向上を主張しない。', '', '実負荷の音源peakは標準23–27、低負荷14–19。最終pauseReasonは全条件null。continuousRunと全frame phaseは生データを正とする。baseは単音なのでlegacy oscillator数（3–4）と今回の音源数を区別する。layeredVoicesはvoice毎のWaveShaperを数え、fade尾を含む。created/sourceCreatedの累計とframe毎のlive推移を保存し、割り当てゼロとはしない。', '', 'コマンド終了0は「記録・JS例外検査が完了」を意味し、性能目標達成ではない。正式比較はbase Chromium4 / WebKit再検査4 / after8の計16条件（各60秒）。調整前a380a43の追加8条件はperformance-before-warning-tune.*に履歴として保持。base初回WebKitの依存不足4失敗はperformance-before-chromium-and-deps.*とperformance-before-deps-traces/。', '', '実機iPhone性能、操作、実点滅、試聴の過去の未確認は維持する。機械可読：[performance-summary.json](performance-summary.json)、生frame：[performance-data/](performance-data/)。再集計はcollect-performance.mjsと本script。']
(root/'performance-results.md').write_text('\n'.join(lines)+'\n')
print({'after':after_sha,'cases':len(after_rows),'allReferenceTargetsMet':all(r['fractionAtMost25ms']>=.95 for r in after_rows)})
