"""Process completed explicit-clock capture scenes while later scenes render.

Only complete capture.json scenes enter analysis. Flagged scenes retain PNGs for
diagnosis. Passing scenes are packed only after decoded RGB verification.
"""
from pathlib import Path
import json,subprocess,sys,time
from rallyFlashAnalysis import analyze_directory

root=Path(sys.argv[1]);expected=int(sys.argv[2]);started=time.monotonic();processed={}
while len(processed)<expected:
    if time.monotonic()-started>2400:raise RuntimeError('Capture batch did not finish within40minutes; retain partial artifacts')
    directories=sorted(path for path in root.iterdir() if path.is_dir() and (path/'capture.json').exists()) if root.exists() else []
    for directory in directories:
        if directory.name in processed:continue
        paths=list(directory.glob('[0-9][0-9][0-9][0-9].png'))
        metadata=json.loads((directory/'capture.json').read_text())
        if len(paths)!=metadata['frames']:raise RuntimeError(f'Frame count mismatch {directory}')
        result=analyze_directory(directory)
        processed[directory.name]={key:value for key,value in result.items() if key not in ('rows','method')}
        print('RESULT',directory.name,processed[directory.name],flush=True)
        if not result['flagged']:
            with (directory/'packing.log').open('wb') as log:
                subprocess.run([sys.executable,'tests/helpers/packRallyFlashEvidence.py',str(directory)],stdout=log,stderr=subprocess.STDOUT,check=True)
                video=directory/'capture-lossless.mp4'
                if video.stat().st_size>32*1024*1024:
                    subprocess.run([sys.executable,'tests/helpers/splitRallyArtifact.py',str(video)],stdout=log,stderr=subprocess.STDOUT,check=True)
        (root/'processing-summary.json').write_text(json.dumps(processed,indent=2))
    if len(processed)<expected:time.sleep(1)
print(f'Batch complete:{len(processed)} scenes;flagged:{sum(scene["flagged"] for scene in processed.values())}',flush=True)
