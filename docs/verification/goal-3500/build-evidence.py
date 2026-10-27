"""Pack generated local verification artifacts; preserve exact decoded RGB evidence."""
from pathlib import Path
import hashlib,json,tarfile,gzip,subprocess,datetime
root=Path(__file__).resolve().parents[3]
source=root/'artifacts/goal-3500';dest=Path(__file__).resolve().parent/'evidence';dest.mkdir(parents=True,exist_ok=True)
def digest(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
# Correct only a default description label; preserve the original observations.
p=source/'memory-100/memory.json';r=json.loads(p.read_text())
if 'then20' in r['method']:
 (p.parent/'memory.raw.json').write_bytes(p.read_bytes());r['originalMethodLabel']=r['method'];r['method']='Chromium CDP fullGC, one warm clear/retry then100 equivalent running states; virtual clock, not performance evidence';r['metadataCorrection']='Default20 label corrected; repeats=100 and all100 measured rows unchanged.';p.write_text(json.dumps(r,indent=2)+'\n')
primary=['before','after','visual-before','visual-after','memory','memory-100','validation','preliminary']
paths=[]
for folder in primary:
 for p in (source/folder).rglob('*'):
  if p.is_file() and p.suffix not in ('.webm','.zip'):paths.append(p)
for name in ['source-freeze.json','postgres-concurrency.json']:
 p=source/name
 if p.exists():paths.append(p)
for p in (source/'intermediate').rglob('*.json'):
 if 'captures' not in p.parts:paths.append(p)
for side in ['visual-before','visual-after']:
 dirs=list((source/side/'captures').glob('*/analysis.json'));assert len(dirs)==8
 for p in dirs:
  a=json.loads(p.read_text());v=json.loads((p.parent/'lossless-verification.json').read_text());assert not a['flagged'];assert v['losslessRGBBytesMatch']and v['sourceRGB24SHA256']==v['decodedRGB24SHA256']==a['sourcePixelRGB24SHA256'];assert v['sourceFrames']==192
paths=sorted(set(paths));entries=[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':digest(p)}for p in paths]
archive=source/'goal-3500-evidence.tar.gz'
with archive.open('wb')as out,gzip.GzipFile(filename='',mode='wb',fileobj=out,mtime=0)as compressed,tarfile.open(fileobj=compressed,mode='w|')as tar:
 for p in paths:
  info=tar.gettarinfo(str(p),arcname=str(p.relative_to(root)));info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0
  with p.open('rb')as f:tar.addfile(info,f)
parts=[]
with archive.open('rb')as f:
 for i in range(10000):
  b=f.read(8*1024*1024)
  if not b:break
  p=dest/f'objects.tar.gz.part-{i:03d}';p.write_bytes(b);parts.append({'file':p.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
manifest={'schema':'takkeu-goal-3500-evidence-v1','productHead':subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip(),'archiveSHA256':digest(archive),'archiveBytes':archive.stat().st_size,'parts':parts,'entries':entries,'losslessSequences':16,'framesPerSequence':192,'decodedRGBVerified':True,'notes':['Final artifacts and explicitly marked preliminary/intermediate performance data are separate.','Full RGB frames are lossless MP4; re-decode and compare sourcePixelRGB24SHA256.','CI evidence is linked separately in ci-summary.json.']}
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'files':len(paths),'archiveBytes':manifest['archiveBytes'],'parts':len(parts),'sha256':manifest['archiveSHA256']}))
