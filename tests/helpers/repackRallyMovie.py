"""Replace FFV1 with smaller lossless RGB interframe coding, retaining byte proof."""
from pathlib import Path
import hashlib,json,subprocess,sys,shutil

directory=Path(sys.argv[1]);old=directory/'capture-lossless.mkv';new=directory/'capture-lossless.mp4'
verification=json.loads((directory/'lossless-verification.json').read_text())
old_hash=hashlib.sha256(old.read_bytes()).hexdigest();assert old_hash==verification['videoSHA256']
command=['ffmpeg','-y','-i',str(old),'-c:v','libx264rgb','-crf','0','-preset','medium','-pix_fmt','rgb24',str(new)]
if len(sys.argv)>2:
    shutil.copyfile(sys.argv[2],new)
else:
    with (directory/'ffmpeg-rgb-encode.log').open('wb') as log:subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,check=True)
digest=hashlib.sha256();count=0
with (directory/'ffmpeg-rgb-decode.log').open('wb') as log:
    process=subprocess.Popen(['ffmpeg','-v','error','-i',str(new),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE,stderr=log)
    while True:
        data=process.stdout.read(1024*1024)
        if not data:break
        digest.update(data);count+=len(data)
    status=process.wait()
assert status==0 and digest.hexdigest()==verification['sourceRGB24SHA256'] and count==verification['expectedBytes']
verification['formerFFV1']={'file':old.name,'sha256':old_hash,'bytes':old.stat().st_size,'decodedRGB24SHA256':verification['decodedRGB24SHA256']}
verification['videoSHA256']=hashlib.sha256(new.read_bytes()).hexdigest();verification['videoBytes']=new.stat().st_size
verification['videoFile']=new.name;verification['codec']='libx264rgb CRF0 medium; exact decoded RGB24 verified';verification['repackCommand']=command
verification['decodedRGB24SHA256']=digest.hexdigest()
(directory/'lossless-verification.json').write_text(json.dumps(verification,indent=2))
outside=Path('/workspace/rally-large-originals')/directory.name;outside.mkdir(parents=True,exist_ok=True);old.replace(outside/old.name)
print(directory.name,verification['formerFFV1']['bytes'],'→',verification['videoBytes'],'decoded RGB exact',digest.hexdigest())
