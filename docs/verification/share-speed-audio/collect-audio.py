"""Keep compact, stable review links for actually rendered WAVs (no editing)."""
from pathlib import Path
import json,shutil,wave,math
root=Path(__file__).parent
sources=[root/'verified-browser-artifacts',root/'warning-green-artifacts',root/'c-offline-artifacts']
selected=[]
for engine in ['chromium','webkit']:
    for source in sources:
        matches=[p for p in source.rglob('waveform-measurements.json') if p.parent.name.endswith('-'+engine)]
        if matches: selected.append(matches[0]);break
rows=[]
for measurements in selected:
    engine='chromium' if measurements.parent.name.endswith('-chromium') else 'webkit'
    dest=root/'audio'/engine;dest.mkdir(parents=True,exist_ok=True)
    shutil.copy2(measurements,dest/'measurements.json')
    for audio in measurements.parent.glob('*.wav'):
        shutil.copy2(audio,dest/audio.name)
    for row in json.loads(measurements.read_text()):
        row.update(engine=engine,provenance=str(measurements.relative_to(root)),rawWav=f'audio/{engine}/{row["rate"]}-{row["mode"]}.wav')
        rows.append(row)
(root/'audio-measurements.json').write_text(json.dumps(rows,indent=2)+'\n')
for engine in ['chromium','webkit']:
    folder=root/'audio'/engine
    if not folder.exists():continue
    (folder/'README.md').write_text(f'''# {engine}: Web Audio比較用WAV

原寸（既定音量0.65）: [旧自分](48000-old-player.wav) / [新自分1](48000-player1.wav) / [新自分5](48000-player5.wav) / [新自分10](48000-player10.wav) / [スマッシュ成功](48000-success10.wav) / [相手](48000-opponent.wav) / [警告](48000-warning.wav)。

RMS0.025整合（0.5秒全体）: [旧自分](48000-old-player-rms-matched.wav) / [新自分](48000-player1-rms-matched.wav)、[旧相手](48000-old-opponent-rms-matched.wav) / [新相手](48000-opponent-rms-matched.wav)、[旧警告](48000-old-warning-rms-matched.wav) / [新警告](48000-warning-rms-matched.wav)、[旧重なり](48000-old-sixteen-rms-matched.wav) / [新重なり](48000-sixteen-rms-matched.wav)。

[新重なり・最終音量1](48000-sixteen.wav)と[16voice全標準品質・既定音量](48000-full-quality-sixteen.wav)は負荷/出力検査。通常プレイは混雑時に装飾を減らすため、後者は保守的な上限構成。44.1kHz版も同フォルダ。指標は[measurements.json](measurements.json)。

人による試聴は未実施。RMSを揃えたことや波形測定は快適さ・実端末の識別性の保証ではない。
''')
print({'engines':sorted(set(r['engine'] for r in rows)),'measurements':len(rows),'maxPeak':max((r['peak'] for r in rows),default=None)})
