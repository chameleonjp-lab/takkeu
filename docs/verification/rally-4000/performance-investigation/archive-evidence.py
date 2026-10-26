"""Archive only this investigation's owned evidence; run after measurements.

No production/test edits. Existing RGB-identical flash sequences are referenced,
not duplicated. New movies are decoded and compared by the existing packer.
Every copied/split byte and every tar member is checked before acceptance.
"""
from pathlib import Path
import hashlib, json, shutil, subprocess, tarfile, sys

REPO=Path('/workspace/takkeu')
RAW=Path('/workspace/investigation')
OUT=REPO/'docs/verification/rally-4000/performance-investigation'
PACK=REPO/'tests/helpers/packRallyFlashEvidence.py'
SPLIT=REPO/'tests/helpers/splitRallyArtifact.py'

def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
 return h.hexdigest()

def save(p,o):
 p.parent.mkdir(parents=True,exist_ok=True)
 p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')

def copy(p,q):
 q.parent.mkdir(parents=True,exist_ok=True)
 shutil.copy2(p,q)
 assert sha(p)==sha(q),(p,q)

def split(p):
 subprocess.run([sys.executable,str(SPLIT),str(p)],check=True)

def verified_parts(directory):
 p=directory/'capture-lossless.mp4.parts.json'
 if not p.exists(): raise RuntimeError('Missing retained movie parts: '+str(directory))
 m=json.loads(p.read_text());h=hashlib.sha256();n=0
 for part in m['parts']:
  f=directory/part['file'];assert sha(f)==part['sha256']
  with f.open('rb') as stream:
   for b in iter(lambda:stream.read(1024*1024),b''):h.update(b);n+=len(b)
 assert h.hexdigest()==m['originalSHA256'] and n==m['originalBytes']

def archive_native():
 for name in ['native-visual','native-visual-v2']:
  for p in sorted((RAW/name).rglob('*')):
   if not p.is_file():continue
   q=OUT/name/p.relative_to(RAW/name)
   copy(p,q)
   if q.suffix=='.mp4':split(q)
  print('native copied and verified',name,flush=True)

def archive_static():
 objects={};rows=[];archive=RAW/'resolution-visuals.tar.gz'
 with tarfile.open(archive,'w:gz',compresslevel=6) as tar:
  for name in ['resolution-visual','resolution-phone-visual']:
   for p in sorted((RAW/name).rglob('*')):
    if not p.is_file():continue
    rel=str(p.relative_to(RAW));digest=sha(p);info=tar.gettarinfo(str(p),arcname=rel)
    if digest in objects:
     info.type=tarfile.LNKTYPE;info.linkname=objects[digest];info.size=0;tar.addfile(info)
    else:
     with p.open('rb') as f:tar.addfile(info,f)
     objects[digest]=rel
    rows.append({'file':rel,'bytes':p.stat().st_size,'sha256':digest})
 with tarfile.open(archive,'r:gz') as tar:
  for row in rows:
   data=tar.extractfile(row['file']).read()
   assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
 save(OUT/'resolution-visuals-members.json',{'files':rows,'allMembersVerified':True,'uniqueByteObjects':len(objects),'dedup':'tar hardlinks for byte-identical files'})
 q=OUT/archive.name;copy(archive,q);split(q)
 print('static archive verified',len(rows),'members',flush=True)

def archive_flash():
 old=json.loads((REPO/'docs/verification/rally-4000/safety/final-primary-index.json').read_text())
 known={r['sourcePixelRGB24SHA256']:REPO/r['directory'] for r in old['scenes']}
 rows=[];checked=set()
 for group in ['regular','legacy-standard','legacy-low','fireworks','extra','extra-before']:
  src=RAW/'flash'/group;dst=OUT/'flash'/group
  for p in sorted(src.iterdir()):
   if p.is_file():copy(p,dst/p.name)
  for directory in sorted(src.iterdir()):
   if not directory.is_dir() or not (directory/'analysis.json').exists():continue
   a=json.loads((directory/'analysis.json').read_text());digest=a['sourcePixelRGB24SHA256'];q=dst/directory.name
   reference=known.get(digest)
   if reference:
    original=json.loads((reference/'analysis.json').read_text())
    for k in ['frames','fps','width','height','sourcePixelRGB24SHA256']:assert a[k]==original[k]
    if reference not in checked:verified_parts(reference);checked.add(reference)
    for p in directory.iterdir():
     if p.is_file() and not (p.name[:4].isdigit() or p.name.startswith('capture-lossless.mp4')):copy(p,q/p.name)
    save(q/'raw-reference.json',{'referenceDirectory':str(reference.relative_to(REPO)),'sourcePixelRGB24SHA256':digest,'frames':a['frames'],'fps':a['fps'],'width':a['width'],'height':a['height'],'reason':'All decoded RGB frames exactly match the referenced retained sequence; source metadata and current analyses remain separate.','referencedPartsVerified':True})
   else:
    if any(directory.glob('[0-9][0-9][0-9][0-9].png')):
     subprocess.run([sys.executable,str(PACK),str(directory)],check=True)
    for p in directory.iterdir():
     if p.is_file():copy(p,q/p.name)
    video=q/'capture-lossless.mp4'
    if video.exists():split(video)
    verified_parts(q);known[digest]=q;checked.add(q)
   rows.append({'group':group,'scene':directory.name,'directory':str(q.relative_to(OUT)),'reference':str(reference.relative_to(REPO)) if reference else None,'sourcePixelRGB24SHA256':digest,'flagged':a['flagged'],'maxGeneralHighFrequencyArea':a['maxGeneralHighFrequencyArea'],'maxRedHighFrequencyArea':a['maxRedHighFrequencyArea']})
   print('flash retained',group,directory.name,'reference' if reference else 'new',flush=True)
 for sub in ['fixed-fields-current','fixed-fields-before']:
  for p in (RAW/'flash'/sub).glob('*'):
   if p.is_file():copy(p,OUT/'flash'/sub/p.name)
 copy(RAW/'flash/before-after-primary.json',OUT/'flash/before-after-primary.json')
 save(OUT/'flash/index.json',{'scenes':rows,'allReferencedPartsVerified':True,'currentScenes':18,'baselineSupplementScenes':4,'currentPrimaryWarnings':7,'formalWCAG':'unconfirmed'})

def archive_ci():
 for name in ['b697','a180']:
  src=RAW/'ci'/name;dst=OUT/'ci'/name
  for p in src.iterdir():
   if not p.is_file():continue
   copy(p,dst/p.name)
   if p.suffix=='.zip':split(dst/p.name)
  print('CI copied and verified',name,flush=True)

if __name__=='__main__':
 {'native':archive_native,'static':archive_static,'flash':archive_flash,'ci':archive_ci}[sys.argv[1]]()
