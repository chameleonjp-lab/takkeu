"""Reproducible conservative SDR/sRGB temporal screening for WCAG 2.3.1.

Run --self-test first. Then pass the capture directory created by
captureRallyFlashFrames.mjs. No claim of device/HDR or accredited certification.
"""
from pathlib import Path
import argparse, hashlib, json, math, subprocess, unittest
import numpy as np
from PIL import Image

LUMA_THRESHOLD=.1
RED_DISTANCE=.2

def channels(rgb):
    srgb=rgb.astype(np.float32)/255
    linear=np.where(srgb<=.04045,srgb/12.92,((srgb+.055)/1.055)**2.4)
    r,g,b=linear[:,:,0],linear[:,:,1],linear[:,:,2]
    y=.2126*r+.7152*g+.0722*b
    x=.4124564*r+.3575761*g+.1804375*b
    z=.0193339*r+.1191920*g+.9503041*b
    denominator=np.maximum(1e-9,x+15*y+3*z)
    u=4*x/denominator;v=9*y/denominator
    saturated=r/np.maximum(1e-9,r+g+b)>=.8
    return y,u,v,saturated

class TurningDetector:
    """Peak/valley transitions with hysteresis, pairing without double counting.

    General extrema reverse after .1 luminance. Red uses both UCS axes with
    .005 hysteresis, full two-dimensional >.2 chroma distance and saturated red.
    Their union is intentionally conservative when axes turn at different times.
    """
    def __init__(self,initial,red=False,axis=0):
        y,u,v,saturated=initial
        self.red=red;self.axis=axis
        scalar=(u if axis==0 else v) if red else y
        self.last=scalar.copy();self.extreme=scalar.copy()
        self.direction=np.zeros(scalar.shape,dtype=np.int8)
        self.pending=np.zeros(scalar.shape,dtype=np.int8)
        if red:
            self.last_u=u.copy();self.last_v=v.copy();self.last_sat=saturated.copy()
            self.extreme_u=u.copy();self.extreme_v=v.copy();self.extreme_sat=saturated.copy()

    def advance(self,data):
        y,u,v,saturated=data
        scalar=(u if self.axis==0 else v) if self.red else y
        hysteresis=.005 if self.red else LUMA_THRESHOLD
        start=(self.direction==0)&(np.abs(scalar-self.last)>=hysteresis)
        self.direction[start]=np.sign(scalar[start]-self.last[start]).astype(np.int8)
        update=start|((self.direction>0)&(scalar>self.extreme))|((self.direction<0)&(scalar<self.extreme))
        self.extreme[update]=scalar[update]
        if self.red:
            self.extreme_u[update]=u[update];self.extreme_v[update]=v[update];self.extreme_sat[update]=saturated[update]
        turn=((self.direction>0)&(scalar<=self.extreme-hysteresis))|((self.direction<0)&(scalar>=self.extreme+hysteresis))
        if self.red:
            contrast=np.sqrt((self.extreme_u-self.last_u)**2+(self.extreme_v-self.last_v)**2)
            qualifying=turn&(contrast>RED_DISTANCE)&(self.extreme_sat|self.last_sat)
        else:
            contrast=np.abs(self.extreme-self.last)
            qualifying=turn&(contrast>=LUMA_THRESHOLD-1e-7)&(np.minimum(self.extreme,self.last)<.8)
        closing=qualifying&(self.pending==-self.direction)
        waiting=qualifying&~closing
        self.pending[waiting]=self.direction[waiting];self.pending[closing]=0
        self.last[turn]=self.extreme[turn]
        self.extreme[turn]=scalar[turn];self.direction[turn]*=-1
        if self.red:
            self.last_u[turn]=self.extreme_u[turn];self.last_v[turn]=self.extreme_v[turn];self.last_sat[turn]=self.extreme_sat[turn]
            self.extreme_u[turn]=u[turn];self.extreme_v[turn]=v[turn];self.extreme_sat[turn]=saturated[turn]
        return closing

def maximum_window_area(mask,width,height):
    """Exact maximum summed area over every valid placement of reference window."""
    # Exact zero fast path: every possible spatial window has sum0. Most late
    # frames/red-frequency masks are empty; no threshold or output is changed.
    if not np.any(mask):return 0,[0,0]
    integral=np.pad(mask.astype(np.int32),((1,0),(1,0))).cumsum(0,dtype=np.int32).cumsum(1,dtype=np.int32)
    sums=integral[height:,width:]-integral[:-height,width:]-integral[height:,:-width]+integral[:-height,:-width]
    index=int(np.argmax(sums));row,col=np.unravel_index(index,sums.shape)
    return int(sums[row,col]),[int(col),int(row)]

def screen(frames,fps=60):
    iterator=iter(frames);first=next(iterator);height,width=first.shape[:2]
    block_width=min(width,math.ceil(width*341/1024));block_height=min(height,math.ceil(height*256/768))
    block_area=block_width*block_height;area_limit=block_area*.25
    initial=channels(first);general=TurningDetector(initial)
    red_u=TurningDetector(initial,True,0);red_v=TurningDetector(initial,True,1)
    window=fps+1 # inclusive sampled endpoints span exactly one second
    gen_ring=np.zeros((window,height,width),dtype=np.uint8);red_ring=np.zeros_like(gen_ring)
    gen_sum=np.zeros((height,width),dtype=np.uint16);red_sum=np.zeros_like(gen_sum)
    rows=[];area_events_gen=[];area_events_red=[]
    peak_general=peak_red=0;max_general_count=max_red_count=0;general_area_event_frames=red_area_event_frames=0
    for index,rgb in enumerate(_prepend(first,iterator)):
        data=initial if index==0 else channels(rgb)
        gen=np.zeros((height,width),dtype=bool) if index==0 else general.advance(data)
        red=np.zeros_like(gen) if index==0 else red_u.advance(data)|red_v.advance(data)
        slot=index%window
        gen_sum-=gen_ring[slot];red_sum-=red_ring[slot]
        gen_ring[slot]=gen;red_ring[slot]=red;gen_sum+=gen;red_sum+=red
        g_area,g_where=maximum_window_area(gen,block_width,block_height)
        r_area,r_where=maximum_window_area(red,block_width,block_height)
        g_high,g_high_where=maximum_window_area(gen_sum>3,block_width,block_height)
        r_high,r_high_where=maximum_window_area(red_sum>3,block_width,block_height)
        area_events_gen.append(g_area>area_limit);area_events_red.append(r_area>area_limit)
        g_events=sum(area_events_gen[max(0,index-fps):index+1]);r_events=sum(area_events_red[max(0,index-fps):index+1])
        max_general_count=max(max_general_count,int(gen_sum.max()));max_red_count=max(max_red_count,int(red_sum.max()))
        peak_general=max(peak_general,g_high);peak_red=max(peak_red,r_high)
        general_area_event_frames=max(general_area_event_frames,g_events);red_area_event_frames=max(red_area_event_frames,r_events)
        rows.append({'frame':index,'simTimeOffset':index/fps,'meanLuminance':float(data[0].mean()),'minLuminance':float(data[0].min()),'maxLuminance':float(data[0].max()),
            'saturatedRedPixels':int(data[3].sum()),'generalFlashClosingArea':g_area,'generalClosingWindowXY':g_where,
            'redFlashClosingArea':r_area,'redClosingWindowXY':r_where,
            'generalPixelsAboveThreeFlashesArea':g_high,'generalFrequencyWindowXY':g_high_where,
            'redPixelsAboveThreeFlashesArea':r_high,'redFrequencyWindowXY':r_high_where,
            'maxGeneralFlashCountInInclusiveOneSecond':int(gen_sum.max()),'maxRedFlashCountInInclusiveOneSecond':int(red_sum.max()),
            'generalLargeClosingFramesInOneSecond':g_events,'redLargeClosingFramesInOneSecond':r_events})
    flagged=peak_general>area_limit or peak_red>area_limit or general_area_event_frames>3 or red_area_event_frames>3
    return {'fps':fps,'frames':len(rows),'width':width,'height':height,'referenceWindow':[block_width,block_height],'areaThreshold25Percent':area_limit,
        'maxGeneralPixelFlashCount':max_general_count,'maxRedPixelFlashCount':max_red_count,'maxGeneralHighFrequencyArea':peak_general,'maxRedHighFrequencyArea':peak_red,
        'maxGeneralLargeClosingFramesPerSecond':general_area_event_frames,'maxRedLargeClosingFramesPerSecond':red_area_event_frames,
        'screeningVerdict':'flagged; investigate and fix before acceptance' if flagged else 'no threshold exceedance detected in sampled SDR canvas; limitations apply',
        'flagged':flagged,'rows':rows}

def _prepend(first,iterator):
    yield first
    yield from iterator

class AnalyzerTests(unittest.TestCase):
    @staticmethod
    def sequence(hz,red=False,patch=False):
        for index in range(180):
            image=np.zeros((48,64,3),dtype=np.uint8)
            if (index//(60//(hz*2)))%2:
                if patch:image[10:12,10:12]=[255,255,255]
                else:image[:]=[255,0,0] if red else [255,255,255]
            elif red:image[:]=[0,255,255]
            yield image
    def test_known_unsafe_six_hz_full_white_is_flagged(self):
        result=screen(self.sequence(6));self.assertTrue(result['flagged']);self.assertGreater(result['maxGeneralPixelFlashCount'],3)
    def test_known_unsafe_saturated_red_cyan_is_flagged(self):
        result=screen(self.sequence(6,red=True));self.assertTrue(result['flagged']);self.assertGreater(result['maxRedPixelFlashCount'],3)
    def test_two_hz_full_white_stays_under_frequency_threshold(self):
        result=screen(self.sequence(2));self.assertFalse(result['flagged']);self.assertLessEqual(result['maxGeneralPixelFlashCount'],3)
    def test_small_six_hz_patch_stays_below_area_threshold(self):
        result=screen(self.sequence(6,patch=True));self.assertFalse(result['flagged']);self.assertGreater(result['maxGeneralPixelFlashCount'],3)
    def test_spatial_max_matches_independent_brute_force_including_empty(self):
        for mask in [np.zeros((6,8),dtype=bool),np.random.default_rng(7).random((6,8))>.6]:
            candidates=[(int(mask[y:y+2,x:x+3].sum()),[x,y]) for y in range(5) for x in range(6)]
            expected=max(candidates,key=lambda row:row[0]);self.assertEqual(maximum_window_area(mask,3,2),(expected[0],expected[1]))

def analyze_directory(directory):
    paths=sorted(directory.glob('[0-9][0-9][0-9][0-9].png'))
    if not paths:raise RuntimeError(f'No full frames in {directory}')
    metadata=json.loads((directory/'capture.json').read_text())
    source_hash=hashlib.sha256()
    def frames():
        for path in paths:
            rgb=np.asarray(Image.open(path).convert('RGB'));source_hash.update(rgb.tobytes());yield rgb
    result=screen(frames(),metadata['fps']);result['sourcePixelRGB24SHA256']=source_hash.hexdigest()
    result['method']={'general':'Opposing .1 luminance peak/valley transitions, darker<.8, non-overlapping transition pairs.',
        'red':'Linear-sRGB R/(R+G+B)>=.8 and CIE1976 UCS distance>.2; two axis extrema union conservatively screens opposing color transitions.',
        'spatial':'Exact max-area integral over every341x256 window at1024x768. >3 per-pixel flashes and conservative large-closing-frame count in inclusive1second windows.',
        'limitations':['60Hz content-clock SDR/sRGB capture, not HDR or hardware artifacts.','Canvas only; CSS HUD/layout assessed separately.','Hysteresis/axis-union screening is reproducible, not accredited PEAT/Harding certification.','Closing-frame aggregate can overcount a spatially staggered flash; flagged cases require frame/region review.','Synthetic overlap stress is deliberately conservative and not physical progression.']}
    (directory/'analysis.json').write_text(json.dumps(result,indent=2));print(directory.name,result['screeningVerdict'],flush=True)
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('directory',nargs='?');parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
    if args.self_test:unittest.main(argv=['rallyFlashAnalysis'],exit=True)
    elif args.directory:
        root=Path(args.directory);summaries=[]
        for directory in sorted(path for path in root.iterdir() if path.is_dir() and (path/'capture.json').exists()):
            result=analyze_directory(directory);summaries.append({'sequence':directory.name,**{key:value for key,value in result.items() if key not in ('rows','method')}})
        (root/'summary.json').write_text(json.dumps(summaries,indent=2))
    else:parser.error('directory or --self-test required')
