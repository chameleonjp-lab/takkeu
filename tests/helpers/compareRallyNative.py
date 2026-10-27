"""Check the predeclared native-CSS replay contract, preserving all failures."""
from pathlib import Path
import gzip,hashlib,json,math,sys
import numpy as np
from PIL import Image

root=Path(sys.argv[1]);results=[];failures=[]
for engine in ['chromium','webkit']:
    coverage={'incoming':0,'outgoing':0};exclusions={};warning_frames=0;minimum_after=255
    for quality in ['low','standard']:
        before=root/f'{engine}-before-{quality}';after=root/f'{engine}-after-{quality}'
        a=json.loads(gzip.decompress((before/'capture.json.gz').read_bytes()))
        b=json.loads(gzip.decompress((after/'capture.json.gz').read_bytes()))
        assert len(a['records'])==len(b['records'])==375
        hashes={before:hashlib.sha256(),after:hashlib.sha256()}
        fields=['snapshot','effects','newEvents','resources','centers','css','warning','notice']
        for index,(x,y) in enumerate(zip(a['records'],b['records'])):
            different=[key for key in fields if x[key]!=y[key]]
            if x['drawingSize']!={'width':1280,'height':720}:different.append('beforeDrawingSize')
            expected={'width':960,'height':540} if quality=='low' else {'width':1280,'height':720}
            if y['drawingSize']!=expected:different.append('afterDrawingSize')
            if x.get('clock',{}).get('elapsedRAF')!=(index+1)*16 or y.get('clock',{}).get('elapsedRAF')!=(index+1)*16:different.append('alignedRAF')
            if different:failures.append({'engine':engine,'quality':quality,'frame':index,'differentStateFields':different})
            warning=x['warning']
            if quality=='low' and not warning['hidden'] and warning['width']>0 and warning['height']>0:warning_frames+=1
            if quality=='standard' and index!=150:continue
            pa=np.asarray(Image.open(before/f'{index:04d}.png').convert('RGB'))
            pb=np.asarray(Image.open(after/f'{index:04d}.png').convert('RGB'))
            if pa.shape!=(720,1280,3) or pb.shape!=pa.shape:raise ValueError('Native CSS screenshot size changed')
            hashes[before].update(pa.tobytes());hashes[after].update(pb.tobytes())
            changed=int(np.count_nonzero(pa!=pb));row={'engine':engine,'quality':quality,'frame':index,'changedChannels':changed,'differentStateFields':different,'whiteCores':[],'excludedCores':[]}
            if quality=='standard' and changed:failures.append({'engine':engine,'quality':quality,'frame':index,'standardChangedChannels':changed})
            if quality=='low':
                for center in x['centers']:
                    def exclude(reason):
                        exclusions[reason]=exclusions.get(reason,0)+1;row['excludedCores'].append({'id':center['id'],'phase':center['phase'],'reason':reason})
                    if not center['inView'] or center['phase'] not in coverage:exclude('outside-view-or-phase');continue
                    if center.get('nearPlaneIntersection') or center.get('exclusionRadius') is None:exclude('near-plane');continue
                    # Baseline geometry only. The 5x5 pixel centers extend2px
                    # from a rounded center (+/-0.5px), hence this fixed margin.
                    margin=math.ceil(2.5*math.sqrt(2))
                    if any(other['id']!=center['id'] and (other.get('exclusionRadius') is None or math.hypot(center['x']-other['x'],center['y']-other['y'])<=max(12,center['exclusionRadius']+other['exclusionRadius']+margin)) for other in x['centers']):exclude('projected-silhouettes-overlap');continue
                    px,py=round(center['x']),round(center['y'])
                    if px<2 or px>=1278 or py<2 or py>=718:exclude('neighborhood-outside-image');continue
                    white_before=int(pa[py-2:py+3,px-2:px+3].min(axis=2).max())
                    if white_before<220:exclude('baseline-not-white');continue
                    white_after=int(pb[py-2:py+3,px-2:px+3].min(axis=2).max())
                    coverage[center['phase']]+=1;minimum_after=min(minimum_after,white_after)
                    row['whiteCores'].append({'id':center['id'],'phase':center['phase'],'x':px,'y':py,'before':white_before,'after':white_after})
                    if white_after<200:failures.append({'engine':engine,'quality':quality,'frame':index,'ball':center['id'],'whiteBefore':white_before,'whiteAfter':white_after,'x':px,'y':py})
            results.append(row)
        if quality=='low':
            for directory,metadata in [(before,a),(after,b)]:
                # Generic pixel-integrity input for the existing lossless packer;
                # explicitly NOT a flash analysis or safety verdict.
                (directory/'capture.json').write_text(json.dumps({key:metadata[key]for key in ['fps','seconds','width','height','frames','engine','side','quality','source','performanceMeasurement']},indent=2))
                (directory/'analysis.json').write_text(json.dumps({'analysisKind':'RGB byte integrity for lossless storage; NOT flash safety','sourcePixelRGB24SHA256':hashes[directory].hexdigest()},indent=2))
    if not warning_frames or not all(coverage.values()):failures.append({'engine':engine,'nonVacuityFailure':True,'warningFrames':warning_frames,'coverage':coverage})
    print(engine,'visible warning frames',warning_frames,'white cores',coverage,'minimum after',minimum_after)
    (root/f'{engine}-coverage.json').write_text(json.dumps({'visibleWarningFrames':warning_frames,'whiteCoreCoverage':coverage,'exclusionCounts':exclusions,'minimumEligibleAfterWhiteCore':minimum_after},indent=2))
output={'analysisScriptSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'rows':results,'failures':failures,'accepted':not failures,
 'limitations':'Finite native-CSS content-clock replay. No real-time latency, human acuity/listening, VoiceOver, HDR, WCAG or physical-device certification.'}
(root/'comparison.json.gz').write_bytes(gzip.compress(json.dumps(output).encode()))
(root/'comparison-summary.json').write_text(json.dumps({k:v for k,v in output.items()if k!='rows'},indent=2))
print(len(results),'native image pairs;',len(failures),'failures')
if failures:sys.exit(1)
