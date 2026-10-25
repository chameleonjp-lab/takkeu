"""Losslessly pack dense PNG frames, verifying decoded RGB bytes before cleanup."""
from pathlib import Path
import hashlib,json,shutil,subprocess,sys
from PIL import Image

root=Path(sys.argv[1])
for directory in sorted(path for path in root.iterdir() if path.is_dir() and (path/'analysis.json').exists()):
    paths=sorted(directory.glob('[0-9][0-9][0-9][0-9].png'))
    if not paths:continue
    capture=json.loads((directory/'capture.json').read_text());analysis=json.loads((directory/'analysis.json').read_text())
    source=hashlib.sha256();manifest=[]
    for path in paths:
        rgb=Image.open(path).convert('RGB');source.update(rgb.tobytes())
        manifest.append({'frame':int(path.stem),'pngSHA256':hashlib.sha256(path.read_bytes()).hexdigest()})
    if source.hexdigest()!=analysis['sourcePixelRGB24SHA256']:raise RuntimeError(f'Analyzer source mismatch {directory}')
    video=directory/'capture-lossless.mkv'
    command=['ffmpeg','-y','-framerate',str(capture['fps']),'-i',str(directory/'%04d.png'),'-c:v','ffv1','-level','3','-pix_fmt','bgr0',str(video)]
    with (directory/'ffmpeg-encode.log').open('wb') as log:subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,check=True)
    digest=hashlib.sha256();count=0
    with (directory/'ffmpeg-decode.log').open('wb') as log:
        process=subprocess.Popen(['ffmpeg','-v','error','-i',str(video),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE,stderr=log)
        while True:
            chunk=process.stdout.read(1024*1024)
            if not chunk:break
            digest.update(chunk);count+=len(chunk)
        status=process.wait()
    expected=capture['width']*capture['height']*3*len(paths)
    if status or digest.hexdigest()!=source.hexdigest() or count!=expected:raise RuntimeError(f'Lossless decoded byte verification failed {directory}')
    verification={'sourceFrames':len(paths),'fps':capture['fps'],'width':capture['width'],'height':capture['height'],
        'sourceRGB24SHA256':source.hexdigest(),'decodedRGB24SHA256':digest.hexdigest(),'decodedBytes':count,'expectedBytes':expected,
        'videoSHA256':hashlib.sha256(video.read_bytes()).hexdigest(),'videoBytes':video.stat().st_size,
        'losslessRGBBytesMatch':True,'originalPNGs':manifest,'command':command}
    (directory/'lossless-verification.json').write_text(json.dumps(verification,indent=2))
    for index in [0,15,30,60,120,180,240,300,359]:
        if index<len(paths):shutil.copyfile(paths[index],directory/f'sample-{index:04d}.png')
    for path in paths:path.unlink()
    print(directory.name,'verified lossless RGB',source.hexdigest(),video.stat().st_size,flush=True)
