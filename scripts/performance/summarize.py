"""Recompute all runs from retained frame samples, never accept runner summaries blindly."""
import sys,json,gzip,statistics,hashlib
from pathlib import Path
root=Path(sys.argv[1]);rows=[]
def percentile(a,p):
 import math
 return sorted(a)[max(0,math.ceil(len(a)*p)-1)] if a else None
for path in sorted(root.glob('*.json.gz')):
 x=json.loads(gzip.decompress(path.read_bytes()));s=x['summary'];d=x['data'];intervals=d['intervals'][1:]
 dur=d['durationMs'];sim=(d['final']['simTime']-d['initial']['simTime'])*60000/dur
 samples=d['samples'];all30=bool(samples) and all(f['phase']=='running' and f['activeBalls']==30 for f in samples)
 drawing=[]
 for f in samples:
  size=f.get('drawingSize',s['drawingSize'])
  if not drawing or size!=drawing[-1]['size']:drawing.append(dict(wallMs=f['wallMs'],size=size,intervalMs=f['intervalMs']))
 stays=[]
 for i,item in enumerate(drawing):stays.append(dict(size=item['size'],startWallMs=item['wallMs'],durationMs=(drawing[i+1]['wallMs'] if i+1<len(drawing) else dur)-item['wallMs']))
 heaps=[f['heapBytes'] for f in samples if f.get('heapBytes') is not None]
 row=dict(label=s['label'],configuration=s['configuration'],durationMs=dur,p50=percentile(intervals,.5),p95=percentile(intervals,.95),p99=percentile(intervals,.99),fraction25=sum(t<=25 for t in intervals)/len(intervals),simulationSecondsPer60=sim,allRunning30=all30,errors=s['errors'],blocked=s['blocked'],sourceStable=s.get('sourceStable'),commit=s['commit'],drawing=s['drawingSize'],changes=drawing,residence=stays,heapInitial=heaps[0] if heaps else None,heapFinal=heaps[-1] if heaps else None,heapPeak=max(heaps) if heaps else None,resources=d['finalResources'],costs=s['costs'],gpu=s['gpu'],rawFile=path.name,rawSHA256=hashlib.sha256(path.read_bytes()).hexdigest())
 row['absoluteTarget']=dur>=60000 and row['p95']<=25 and row['fraction25']>=.95 and sim>=59 and all30 and not row['errors']
 rows.append(row)
(root/'recomputed.json').write_text(json.dumps(rows,indent=2))
print(json.dumps([dict(label=r['label'],p50=r['p50'],p95=r['p95'],p99=r['p99'],sim60=r['simulationSecondsPer60'],absolute=r['absoluteTarget'],changes=len(r['changes'])-1)for r in rows],indent=2))
