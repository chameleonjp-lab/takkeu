"""Read-only audit of this no-input autoplay runner's unchanged frame budget.
Not a general replay of manual input: pointer flushes use remaining budget.
"""
import gzip,hashlib,json,math,sys
from pathlib import Path
repo=Path('/workspace/takkeu')
source={p:hashlib.sha256((repo/p).read_bytes()).hexdigest()for p in ['src/app/loop.ts','src/game/config.ts']}
rows=[]
for directory in sys.argv[1:]:
 for p in sorted(Path(directory).glob('*.json.gz')):
  raw=json.loads(gzip.decompress(p.read_bytes()));s,d=raw['summary'],raw['data'];samples=d['samples'];reasons=[]
  if s['configuration']['collector']!='full' or s['configuration']['mode']!='normal':reasons.append('unsupported collector/mode')
  if not s['sourceStable'] or any(s['sourceSHA256'][f]!=h for f,h in source.items()):reasons.append('source provenance mismatch')
  if not samples or len(samples)!=len(d['intervals']):reasons.append('missing/misaligned samples')
  if any(x['phase']!='running' or x['activeBalls']!=30 for x in samples):reasons.append('not continuously running30')
  if any(not math.isfinite(x['intervalMs']) or not 0<=x['intervalMs']<=1500 for x in samples):reasons.append('unsupported interval/slow guard')
  if any(abs(x['intervalMs']-dt)>1e-6 for x,dt in zip(samples,d['intervals'])):reasons.append('interval-array mismatch')
  if any(abs(b['wallMs']-a['wallMs']-b['intervalMs'])>1e-6 for a,b in zip(samples,samples[1:])):reasons.append('wall-interval mismatch')
  accumulator=0.;known=False;checked=0;mismatches=[];clipped=0;clippedms=0.;max_delta=0.;covered_wall=covered_actual=covered_expected=0.;covered=0;anchor_row=None
  if not reasons:
   for previous,current in zip(samples,samples[1:]):
    interval=current['intervalMs'];actual=(current['simTime']-previous['simTime'])*1000;max_delta=max(max_delta,actual)
    if not known and interval<100-1e-7:continue
    anchor=not known;known=True;available=accumulator+interval
    if not anchor and available>100:clipped+=1;clippedms+=available-100
    accumulator=min(100,available);steps=min(12,math.floor((accumulator+1e-7)/(1000/120)));expected=steps*(1000/120)
    accumulator=max(0,accumulator-expected);checked+=1
    if abs(actual-expected)>.001:mismatches.append({'wallMs':current['wallMs'],'intervalMs':interval,'actualSimulationMs':actual,'expectedSimulationMs':expected})
    if anchor:
     anchor_row={'wallMs':current['wallMs'],'simulationMsFromMeasurementStart':(current['simTime']-d['initial']['simTime'])*1000,'intervalMs':interval,'actualSimulationMs':actual,'expectedSimulationMs':expected,'incomingRemainderUnknown':True}
     accumulator=0.
    else:
     covered+=1;covered_wall+=interval;covered_actual+=actual;covered_expected+=expected
  if not known or not covered:reasons.append('no non-vacuous covered interval after anchor')
  identity_error=covered_wall-covered_actual-clippedms-accumulator
  rows.append({'series':Path(directory).name,'file':p.name,'supported':not reasons,'unsupportedReasons':reasons,'sourceHashes':source,'anchorAndExcludedPrefix':anchor_row,'checkedFrameDeltasIncludingAnchor':checked,'coveredFrameDeltas':covered,'mismatchCount':len(mismatches),'mismatches':mismatches,'coveredWallMs':covered_wall,'coveredActualSimulationMs':covered_actual,'coveredExpectedSimulationMs':covered_expected,'clippedFramesAfterAnchor':clipped,'clippedMsAfterAnchor':clippedms,'finalRemainderMs':accumulator,'conservationErrorMs':identity_error,'maxObservedSimulationAdvanceMs':max_delta,'passed':not reasons and not mismatches and abs(identity_error)<.001})
result={'fixedDt':1/120,'maxStepsPerFrame':12,'frameCatchupBudgetMs':100,'source':'unchanged src/app/loop.ts and src/game/config.ts','scope':'Only full normal no-input autoplay from investigatePerformance.mjs. Samples are post-app RAF snapshots. Exclude initial partial/unknown remainder and anchor loss. No manual-input/pointer-flush/reset/pause traces. This corroborates simulation slowdown over the reported covered interval, not rendering-cost attribution or the entire60-second prefix.','rows':rows}
Path('/workspace/investigation/frame-budget-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(len(rows),'runs',sum(r['checkedFrameDeltasIncludingAnchor']for r in rows),'checked deltas',sum(r['mismatchCount']for r in rows),'mismatches',sum(r['passed']for r in rows),'passed')
