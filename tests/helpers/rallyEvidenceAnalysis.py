"""Create review contact sheets and sparse-frame diagnostics, never a WCAG certificate.

Full-resolution originals are retained; the contact sheets help a reviewer inspect
the place, foreground visibility and visible shapes in every captured milestone.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw
import numpy as np

ROOT = Path('docs/verification/rally-4000/evidence')
THRESHOLDS = [50,100,200,300,400,500,600,700,800,900,1000,1250,1500,1750,2000,2250,2500,2750,3000,3250,3500,3750,4000]
PHASES = ['before','arrival','during','after']
rows=[]
for engine in ['chromium','webkit']:
    source=ROOT/engine/'thresholds'
    target=ROOT/engine/'review'
    target.mkdir(parents=True, exist_ok=True)
    for batch in range(0,len(THRESHOLDS),4):
        selected=THRESHOLDS[batch:batch+4]
        sheet=Image.new('RGB',(800,len(selected)*454),'#111827')
        draw=ImageDraw.Draw(sheet)
        for row,threshold in enumerate(selected):
            for col,phase in enumerate(PHASES):
                path=source/f'{threshold}-{phase}.png'
                if not path.exists():
                    continue
                frame=Image.open(path).convert('RGB')
                thumb=frame.resize((195,422))
                x=col*200;y=row*454
                draw.text((x+3,y+3),f'{threshold} / {phase}',fill='white')
                sheet.paste(thumb,(x,y+24))
                rgb=np.asarray(frame,dtype=np.float32)/255
                linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
                luminance=linear[:,:,0]*.2126+linear[:,:,1]*.7152+linear[:,:,2]*.0722
                red_ratio=rgb[:,:,0]/np.maximum(.001,rgb.sum(axis=2))
                rows.append({'engine':engine,'threshold':threshold,'phase':phase,
                    'file':str(path),'size':list(frame.size),
                    'mean_linear_luminance':float(luminance.mean()),
                    'p99_linear_luminance':float(np.quantile(luminance,.99)),
                    'fraction_luminance_above_0_8':float((luminance>.8).mean()),
                    'fraction_saturated_red_above_0_2_luminance':float(((red_ratio>=.8)&(luminance>.2)).mean())})
        sheet.save(target/f'thresholds-{batch//4+1}.jpg',quality=92)

(ROOT/'sparse-frame-diagnostics.json').write_text(json.dumps({
    'scope':'Sparse milestone frames, diagnostic only. Cannot count flashes or establish WCAG 2.3.1 compliance. Human visual review and dense temporal analysis are separate.',
    'rows':rows},ensure_ascii=False,indent=2))
print(f'Analyzed {len(rows)} full-resolution sparse frames; originals retained.')
