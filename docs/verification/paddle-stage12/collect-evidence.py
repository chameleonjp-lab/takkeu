"""Collect the completed, unchanged formal run; never edit product files."""
import base64
import hashlib
import json
from pathlib import Path
from shutil import copy2
from subprocess import check_output, run
from tempfile import TemporaryDirectory

root = Path(__file__).parent
formal = json.loads((root / 'final-verification.json').read_text())
if formal['result'] != 'passed':
    raise RuntimeError('Formal command suite has not finished successfully')
source = formal['commit']
for folder in ['screenshots', 'videos', 'audio', 'data']:
    (root / folder).mkdir(exist_ok=True)

def copy(pattern, target):
    matches = list(Path('test-results').glob(pattern))
    if len(matches) != 1:
        raise RuntimeError(f'{pattern}: expected one file, got {len(matches)}')
    copy2(matches[0], root / target)

for name in ['game-402x874.png', 'game-874x402.png', 'game-1280x720.png']:
    copy(f'quality-*-chromium/{name}', f'screenshots/{name}')
for engine in ['chromium', 'webkit']:
    for score in ['000', '005', '010', '030', '050', '070', '100', '130', '150', '160', '190', '210', '240', '270', '300', '330', '360', '390', '420', '450', '010-ended']:
        copy(f'milestones-専用*-{engine}/milestone-{score}.png', f'screenshots/milestone-{score}-{engine}.png')
    for score in [0, 10, 30, 390]:
        for depth in ['behind', 'front']:
            copy(f'occlusion-*-{engine}/{depth}-{score}.png', f'screenshots/{depth}-{score}-{engine}.png')
    copy(f'evidence-画面の証拠*-{engine}/home.png', f'screenshots/home-{engine}.png')
    copy(f'contact-*3ラリー*-{engine}/three-visible-returns.png', f'screenshots/three-returns-{engine}.png')
    copy(f'contact-ワンバウンド*-{engine}/returned.png', f'screenshots/returned-{engine}.png')
    for pattern, name in [('contact-*3ラリー*', 'three-returns'), ('milestones-390*', 'pulse-390'), ('smash-450*', 'smash-450')]:
        copy(f'{pattern}-{engine}/video.webm', f'videos/{name}-{engine}.webm')
    for state in ['warning-muted', 'warning-paused', 'departure-hidden', 'own-side']:
        copy(f'smash-450*-{engine}/smash-{state}.png', f'screenshots/smash-{state}-{engine}.png')

def suites(suite):
    for spec in suite.get('specs', []):
        for test in spec.get('tests', []):
            for result in test.get('results', []):
                for attachment in result.get('attachments', []):
                    name = attachment['name']
                    payload = base64.b64decode(attachment['body']) if 'body' in attachment else Path(attachment['path']).read_bytes() if 'path' in attachment else b''
                    if name.endswith('.json') or name == 'gpu-occlusion':
                        label = name if name.endswith('.json') else f'{name}.json'
                        (root / 'data' / f'{test["projectName"]}-{label}').write_text(json.dumps({'commit': source, 'data': json.loads(payload)}, indent=2) + '\n')
                    if name in ['player.wav', 'opponent.wav', 'warning.wav', 'four.wav', 'sixteen.wav']:
                        (root / 'audio' / f'{test["projectName"]}-{name}').write_bytes(payload)
                    if name in ['pulse-strong', 'pulse-weak']:
                        (root / 'screenshots' / f'{name}-{test["projectName"]}.png').write_bytes(payload)
    for child in suite.get('suites', []):
        suites(child)
suites(json.loads((root / 'final-browser.json').read_text()))
suites(json.loads((root / 'final-performance.json').read_text()))

for engine in ['chromium', 'webkit']:
    scale = 320 if engine == 'chromium' else 220
    run(['ffmpeg', '-v', 'error', '-sseof', '-3', '-i', str(root / 'videos' / f'pulse-390-{engine}.webm'), '-vf', f'fps=6,scale={scale}:-1,tile=6x3', '-frames:v', '1', '-y', str(root / 'screenshots' / f'pulse-390-{engine}-filmstrip.png')], check=True)
    # The end of the drag recording can be a long static hold. Sample the
    # entire file so the review includes score 0→1→2→3 and the smash warning.
    for name in ['three-returns', 'smash-450']:
        video = root / 'videos' / f'{name}-{engine}.webm'
        duration = float(check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(video)], text=True))
        run(['ffmpeg', '-v', 'error', '-i', str(video), '-vf', f'fps={24/duration:.8f},scale={426 if name == "three-returns" else scale}:-1,tile=6x4', '-frames:v', '1', '-y', str(root / 'screenshots' / f'{name}-{engine}-filmstrip.png')], check=True)
    with TemporaryDirectory(prefix='takkeu-milestones-') as directory:
        for index, score in enumerate(['000', '005', '010', '030', '050', '070', '100', '130', '150', '160', '190', '210', '240', '270', '300', '330', '360', '390', '420', '450']):
            copy2(root / 'screenshots' / f'milestone-{score}-{engine}.png', Path(directory) / f'{index:02d}.png')
        run(['ffmpeg', '-v', 'error', '-framerate', '1', '-i', f'{directory}/%02d.png', '-vf', 'scale=320:-1,tile=5x4', '-frames:v', '1', '-y', str(root / 'screenshots' / f'milestones-{engine}-grid.png')], check=True)

files = [p for folder in ['screenshots', 'videos', 'audio', 'data', 'before'] for p in (root / folder).rglob('*') if p.is_file()]
(root / 'media-manifest.json').write_text(json.dumps({'commit': source, 'beforeCommit': '01ef27f2f521a8a09a82da385c928ba47b2355f7',
    'files': {str(p.relative_to(root)): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)}}, indent=2) + '\n')
print(source, len(files), 'media and data files')
