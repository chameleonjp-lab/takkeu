"""Recompute summaries from preserved raw measurements; no data exclusions."""
import gzip,json,math,statistics,sys
from pathlib import Path

def percentile(values,p):
    return sorted(values)[math.ceil(len(values)*p)-1] if values else None

def counters(text):
    return {k:int(v) for k,v in (line.split() for line in text.splitlines())}

def summarize(directory):
    rows=[]
    for path in sorted(directory.glob('*.json.gz')):
        raw=json.loads(gzip.decompress(path.read_bytes()));s,d=raw['summary'],raw['data']
        intervals=d['intervals'];complete=intervals[1:] # first interval begins inside a frame
        samples=d['samples'];before=counters(s['measurementCPUStart']);after=counters(s['measurementCPUEnd'])
        gpu=[x['ms'] for x in d['gpu'] if x['ms'] is not None and not x['disjoint']]
        heap=[x['heapBytes'] for x in samples if x.get('heapBytes') is not None]
        generated=d['finalAudio']['sourceCreated']-d['initialAudio']['sourceCreated']
        continuous=bool(samples) and all(x['phase']=='running' and x['activeBalls']==30 for x in samples)
        sim=d['final']['simTime']-d['initial']['simTime'];normalized=60_000*sim/d['durationMs']
        row={'file':path.name,'label':s['label'],'configuration':s['configuration'],'commit':s['commit'],'sourceStable':s['sourceStable'],
            'durationMs':d['durationMs'],'frames':len(intervals),'p50Ms':percentile(intervals,.5),'p95Ms':percentile(intervals,.95),'p99Ms':percentile(intervals,.99),
            'fraction25':sum(x<=25 for x in intervals)/len(intervals),'completeIntervalP50Ms':percentile(complete,.5),'completeIntervalP95Ms':percentile(complete,.95),'completeIntervalP99Ms':percentile(complete,.99),
            'completeIntervalFraction25':sum(x<=25 for x in complete)/len(complete),'simulationSeconds':sim,'simulationSecondsPer60Wall':normalized,
            'initialPartialMs':intervals[0],'completeIntervalsValid':bool(complete) and all(math.isfinite(x) and x>=0 for x in complete),
            'initialScore':d['initial']['score'],'finalScore':d['final']['score'],'initialBalls':len(d['initial']['balls']),'remainingBalls':s['remainingBalls'],
            'continuousRunning30':continuous,'generatedAudioSources':generated,'sampledPeakLiveAudioSources':max(x['audio']['liveSources']for x in samples),
            'sampledPeakLiveAudioNodes':max(x['audio']['liveNodes']for x in samples),
            'nativeLifetimePeakAudioSourcesIncludingWarmup':d['finalAudio']['peakSources'],'nativeLifetimePeakAudioNodesIncludingWarmup':d['finalAudio']['peakNodes'],
            'initialAudio':d['initialAudio'],'finalAudio':d['finalAudio'],
            'heapBytesMin':min(heap) if heap else None,'heapBytesMax':max(heap) if heap else None,
            'drawingSize':d['drawingSize'],'gpuValidQueries':len(gpu),'gpuPendingQueries':d['pendingGPU'],'gpuMedianMs':statistics.median(gpu) if gpu else None,
            'cpuUsageSeconds':(after['usage_usec']-before['usage_usec'])/1e6,'cpuThrottledSeconds':(after['throttled_usec']-before['throttled_usec'])/1e6,
            'cpuThrottledPeriods':after['nr_throttled']-before['nr_throttled'],'cpuPeriods':after['nr_periods']-before['nr_periods'],
            'errors':s['errors'],'blocked':s['blocked']}
        row['validComparison']=s['sourceStable'] and not s['errors'] and not s['blocked'] and continuous and generated>0 and d['durationMs']>=60000
        row['absoluteTarget']=row['validComparison'] and row['p95Ms']<=25 and row['fraction25']>=.95 and sim>=59 and normalized>=59
        row['completeIntervalAbsoluteTarget']=row['validComparison'] and row['completeIntervalsValid'] and row['completeIntervalP95Ms']<=25 and row['completeIntervalFraction25']>=.95 and sim>=59 and normalized>=59
        # Preserve summary discrepancies rather than silently correcting source logs.
        row['recordedSummaryMatches']=all(abs(row[k]-s[k])<1e-8 for k in ['p50Ms','p95Ms','p99Ms','fraction25','simulationSeconds'])
        rows.append(row)
    return rows

if __name__=='__main__':
    directory=Path(sys.argv[1]);rows=summarize(directory)
    result={'rows':rows,'absolutePassed':sum(r['absoluteTarget']for r in rows),'validComparisons':sum(r['validComparison']for r in rows),
      'method':'Nearest-rank percentiles match runner. Also show full inter-frame intervals without initial partial interval, and simulation normalized to60wallSeconds. No run or failed target is excluded. CPU throttling is summed cgroup accounting, not a direct frame-delay explanation. Frames are not independent repetitions.'}
    if all(any(r['label']==label for r in rows)for label in ['standard-2-before','standard-3-quality','low-3-before','low-2-quality']):
        by={r['label']:r for r in rows};pairs=[]
        for quality,ids in [('standard',[(2,3),(5,4),(7,8)]),('low',[(3,2),(4,5),(8,7)])]:
            for b,c in ids:
                x,y=by[f'{quality}-{b}-before'],by[f'{quality}-{c}-quality']
                pairs.append({'quality':quality,'before':x['label'],'after':y['label'],'p95ReductionPercent':100*(x['p95Ms']-y['p95Ms'])/x['p95Ms'],
                    'simulationGainSecondsPer60Wall':y['simulationSecondsPer60Wall']-x['simulationSecondsPer60Wall']})
        result['preassignedPairs']=pairs
        result['groups']={}
        for quality in ['standard','low']:
            for version in ['main','before','quality']:
                group=[r for r in rows if r['label'].startswith(quality+'-') and r['label'].endswith('-'+version)]
                result['groups'][f'{quality}-{version}']={key:{'median':statistics.median(r[key]for r in group),'min':min(r[key]for r in group),'max':max(r[key]for r in group)}for key in ['p50Ms','p95Ms','p99Ms','fraction25','simulationSeconds','simulationSecondsPer60Wall']}
        result['uncertainty']='Report all3 preassigned pairs and observed run ranges. These are not a population confidence interval or a guarantee on other devices; no best-run selection and no frame-level pseudo-replication.'
    Path(sys.argv[2]).write_text(json.dumps(result,indent=2)+'\n')
    print(len(rows),'runs,',result['validComparisons'],'valid,',result['absolutePassed'],'absolute passes')
