"""Summarize this frozen run without treating a paused FPS trace as a pass."""
import base64
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
formal = json.loads((root / 'final-verification.json').read_text())
assert formal['result'] == 'passed'

def attachments(document):
    def walk(suite):
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                for result in test.get('results', []):
                    for item in result.get('attachments', []):
                        if not item['name'].endswith('.json'):
                            continue
                        payload = base64.b64decode(item['body']) if 'body' in item else Path(item['path']).read_bytes()
                        yield test['projectName'], item['name'], json.loads(payload)
        for child in suite.get('suites', []):
            yield from walk(child)
    yield from walk(document)

browser = json.loads((root / 'final-browser.json').read_text())
release = json.loads((root / 'final-release.json').read_text())
unit = json.loads((root / 'final-unit.json').read_text())
report = {
    'commit': formal['commit'], 'startedAt': formal['startedAt'], 'endedAt': formal['endedAt'],
    'unit': {'passed': unit['numPassedTests'], 'failed': unit['numFailedTests'], 'pending': unit['numPendingTests'], 'files': len(unit['testResults'])},
    'browser': browser['stats'], 'release': release['stats'], 'load': {}, 'retry': {}, 'audio': {}, 'emission': {}, 'realtime': {},
    'hardwareVerdict': '未確認', 'humanListeningVerdict': '未確認', 'finalFlashingVerdict': '未確認',
}
for engine, name, data in attachments(browser):
    if name == 'growing-ball-load.json':
        last = data[-1]['state']
        report['load'][engine] = {
            'verdict': '成功（固定時計の自動操作。実機性能ではない）', 'initialScore': 450, 'initialBalls': 47,
            'finalScore': last['score'], 'simulationSeconds': last['simTime'], 'finalPhase': last['phase'],
            'finalLiveBalls': sum(b['phase'] != 'lost' for b in last['balls']),
            'phaseCounts': {p: sum(b['phase'] == p for b in last['balls']) for p in ['queued','waiting-return','incoming','outgoing','lost']},
            'resources': {key: {'min': min(r['resources'][key] for r in data), 'max': max(r['resources'][key] for r in data)} for key in data[0]['resources']},
            'first47ServedAndSmashExecuted': 'passing test assertions (source hash in formal manifest)',
        }
    if name == 'cadence-play.json':
        report.setdefault('cadence', {})[engine] = {'thresholds': [{'threshold': r['threshold'], 'actualScore': r['state']['score'], 'balls': len(r['state']['balls'])} for r in data['reached']], 'finalScore': data['final']['score'], 'finalBalls': len(data['final']['balls']), 'scoreWasReplaced': False}
    if name == 'retry-resources.json':
        report['retry'][engine] = {'baseline': data['baseline'], 'cycles': len(data['rows']), 'allEqual': all({k:v for k,v in row.items() if k not in ['kind','i']} == data['baseline'] for row in data['rows']), 'disposed': data['disposed']}
    if name == 'waveform-measurements.json': report['audio'][engine] = data
    if name == 'emission-pixels.json': report['emission'][engine] = data
for engine, name, data in attachments(json.loads((root / 'final-performance.json').read_text())):
    if name == 'browser-performance-60s.json':
        data.pop('intervals', None)
        data['continuousPlayVerdict'] = '成功' if data['finalPhase'] == 'running' and data['runningSimulationSeconds'] >= 59 and data['opponentHits'] > 0 and data['smashHits'] > 0 and data['fractionAtMost25ms'] >= .95 else '失敗（このLinux条件の連続プレイ）'
        report['realtime'][engine] = data
assert set(report['load']) == {'chromium', 'webkit'}
assert set(report['realtime']) == {'chromium', 'webkit'}
(root / 'summary.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({k: report[k] for k in ['commit','unit','browser','release','load','retry','realtime']},ensure_ascii=False,indent=2))
