"""Collect the current formal browser run without modifying product sources."""
import base64
import hashlib
import json
from pathlib import Path
from shutil import copy2
from subprocess import run

root = Path(__file__).parent
source = json.loads((root / 'final-verification.json').read_text())['commit']
for folder in ['screenshots', 'videos', 'audio']:
    (root / folder).mkdir(exist_ok=True)

def copy(pattern, target):
    matches = list(Path('test-results').glob(pattern))
    if len(matches) != 1:
        raise RuntimeError(f'{pattern}: expected one file, got {len(matches)}')
    copy2(matches[0], root / target)

for name in ['game-402x874.png', 'game-874x402.png', 'game-1280x720.png']:
    copy(f'quality-*-chromium/{name}', f'screenshots/{name}')
for project, label in [('chromium', 'desktop'), ('webkit', 'phone')]:
    copy(f'contact-*3ラリー*-{project}/three-visible-returns.png', f'screenshots/three-returns-{label}.png')
    copy(f'contact-*3ラリー*-{project}/video.webm', f'videos/three-returns-{label}.webm')
    copy(f'milestones-390*-{project}/video.webm', f'videos/pulse-390-{label}.webm')
    copy(f'smash-450*-{project}/video.webm', f'videos/smash-450-{label}.webm')
    for score in ['000', '390', '420', '450']:
        copy(f'milestones-専用*-{project}/milestone-{score}.png', f'screenshots/milestone-{score}-{label}.png')
    copy(f'milestones-専用*-{project}/milestone-390.png', f'screenshots/pulse-390-{label}.png')

def suites(suite):
    for spec in suite.get('specs', []):
        for test in spec.get('tests', []):
            for result in test.get('results', []):
                for attachment in result.get('attachments', []):
                    name = attachment['name']
                    if name in ['player.wav', 'opponent.wav', 'warning.wav', 'four.wav', 'sixteen.wav']:
                        (root / 'audio' / f'{test["projectName"]}-{name}').write_bytes(base64.b64decode(attachment['body']))
    for child in suite.get('suites', []):
        suites(child)
suites(json.loads((root / 'final-browser.json').read_text()))

for video, output, seek, filter_ in [
    ('pulse-390-desktop', 'pulse-390-filmstrip', True, 'fps=6,scale=426:-1,tile=6x3'),
    ('pulse-390-phone', 'pulse-390-phone-filmstrip', True, 'fps=6,scale=220:-1,tile=6x3'),
    ('three-returns-desktop', 'three-returns-filmstrip', False, 'fps=1,scale=426:-1,tile=5x2'),
    ('smash-450-desktop', 'smash-450-filmstrip', True, 'fps=4,scale=426:-1,tile=4x3'),
]:
    run(['ffmpeg', '-v', 'error', *(['-sseof', '-3'] if seek else []), '-i', str(root / 'videos' / f'{video}.webm'), '-vf', filter_, '-frames:v', '1', '-y', str(root / 'screenshots' / f'{output}.png')], check=True)
files = [p for folder in ['screenshots', 'videos', 'audio'] for p in (root / folder).rglob('*') if p.is_file()]
(root / 'media-manifest.json').write_text(json.dumps({'commit': source, 'files': {str(p.relative_to(root)): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)}}, indent=2) + '\n')
print(source, len(files), 'media files')
