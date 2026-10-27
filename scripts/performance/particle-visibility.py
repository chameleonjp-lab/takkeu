"""Native CSS-aspect comparison of the existing firework layer's RGB contribution."""
from pathlib import Path
from PIL import Image
import numpy as np,json,gzip,sys
root=Path(sys.argv[1]);rows=json.load(open(root/'summary.json'))
def pixels(row,hidden=False):
 stem=row['label'] if hidden else row['pixelReference']
 path=root/(stem+('.hidden.rgba.gz' if hidden else '.rgba.gz'))
 image=Image.frombytes('RGBA',(row['width'],row['height']),gzip.decompress(path.read_bytes())).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
 # Same CSS rectangle and aspect. Never stretch landscape into portrait.
 size=(row['configuration']['width'],row['configuration']['height'])
 return np.asarray(image.resize(size,Image.Resampling.BILINEAR),dtype=np.int16)[:,:,:3]
base=rows[0];a=np.abs(pixels(base)-pixels(base,True)).sum(axis=(0,1));results=[]
for row in rows:
 assert row['snapshot']==base['snapshot'], 'Game snapshots differ: '+row['label']
 assert row['state']==base['state'], 'Effect states differ: '+row['label']
 b=np.abs(pixels(row)-pixels(row,True)).sum(axis=(0,1));ratio=b/np.maximum(a,1)
 results.append(dict(label=row['label'],baselineEnergy=a.tolist(),energy=b.tolist(),ratios=ratio.tolist(),accepted=bool(np.all(ratio>=.85)&np.all(ratio<=1.15)),buffer=[row['width'],row['height']],viewport=row['viewport'],glUniformResolutions=row['glUniformResolutions']))
(root/'particle-visibility.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
if not all(r['accepted']for r in results):sys.exit(1)
