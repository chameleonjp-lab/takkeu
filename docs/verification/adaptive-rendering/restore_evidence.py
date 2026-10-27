"""Lossless member/file CAS. Existing evidence is reused only by SHA256.

CI ZIP container SHA is verified at ingestion. Exact member bytes are retained;
the provider's ZIP timestamps/compression container need not be re-created.
"""
from pathlib import Path,PurePosixPath
import argparse,hashlib,json,tarfile,gzip,tempfile,zipfile,shutil,urllib.request,os
BASE='docs/verification/rally-4000/performance-investigation/'
COMMIT='6ec38720b4f720c71bf48c5aef3cdc5732fdd578'
RAW='https://raw.githubusercontent.com/chameleonjp-lab/takkeu/'+COMMIT+'/'
def digest_file(p):
 h=hashlib.sha256()
 with Path(p).open('rb')as f:
  while b:=f.read(1024*1024):h.update(b)
 return h.hexdigest()
def safe(name):
 p=PurePosixPath(name)
 if p.is_absolute()or'..'in p.parts or not p.parts:raise ValueError('Unsafe archive path '+name)
 return Path(*p.parts)
def build(source,dest,oldFiles,oldCI):
 source,dest=Path(source),Path(dest);dest.mkdir(parents=True,exist_ok=True)
 old=json.loads(Path(oldFiles).read_text());previous=json.loads(Path(oldCI).read_text())
 oldByHash={f['sha256']:f for f in old['files']};oldMembers={}
 for a in previous:
  for m in a['members']:oldMembers.setdefault(m['sha256'],(a,m))
 record=dict(format='sha256-CAS tar+gzip split v1',originalZIPContainersRetained=False,oldCommit=COMMIT,files=[],ciArchives=[],externalOldArchives={},objects={})
 with tempfile.TemporaryDirectory(prefix='takkeu-cas-',dir='/workspace')as temp:
  temp=Path(temp)
  def obj(data,h):
   p=temp/h
   if not p.exists():p.write_bytes(data)
   record['objects'][h]=len(data);return {'object':h}
  def retain(data,h,allowOldFile=True,allowOldMember=False):
   if allowOldFile and h in oldByHash:
    p=oldByHash[h];return {'oldFile':BASE+p['file'],'bytes':p['bytes'],'sha256':h}
   if allowOldMember and h in oldMembers:
    a,m=oldMembers[h];key=str(a['artifactId'])
    parts=[{'path':BASE+f['file'],'bytes':f['bytes'],'sha256':f['sha256']}for f in old['files']if f['file'].startswith('ci/006b/'+a['file']+'.part-')]
    if not parts:raise ValueError('Missing old ZIP parts '+key)
    record['externalOldArchives'][key]={'bytes':a['bytes'],'sha256':a['sha256'],'parts':sorted(parts,key=lambda x:x['path'])}
    return {'oldMember':{'artifactId':key,'path':m['path']}}
   return obj(data,h)
  for p in sorted(source.rglob('*')):
   if not p.is_file()or'__pycache__'in p.parts:continue
   name=p.relative_to(source).as_posix();safe(name)
   if p.suffix=='.zip'and name.startswith('ci/'):
    # Download metadata contains the independently obtained GitHub digest.
    provider=p.with_suffix('.download.json')
    if not provider.exists():raise ValueError('Missing provider digest metadata '+str(p))
    meta=json.loads(provider.read_text());zipHash=digest_file(p)
    if meta['sha256']!=zipHash or meta['providerDigest']!='sha256:'+zipHash:raise ValueError('Provider ZIP digest mismatch '+name)
    archive={'path':name,'bytes':p.stat().st_size,'sha256':zipHash,'provider':meta,'members':[]}
    with zipfile.ZipFile(p)as z:
     for info in z.infolist():
      if info.is_dir():continue
      safe(info.filename);data=z.read(info);h=hashlib.sha256(data).hexdigest()
      archive['members'].append(dict(path=info.filename,bytes=len(data),sha256=h,crc32=info.CRC,ref=retain(data,h,True,True)))
    record['ciArchives'].append(archive)
   else:
    data=p.read_bytes();h=hashlib.sha256(data).hexdigest();record['files'].append(dict(path=name,bytes=len(data),sha256=h,ref=retain(data,h)))
  packed=dest/'objects.tar.gz'
  with packed.open('wb')as raw,gzip.GzipFile(filename='',mode='wb',fileobj=raw,compresslevel=6,mtime=0)as gz,tarfile.open(fileobj=gz,mode='w|',format=tarfile.USTAR_FORMAT)as tar:
   for h in sorted(record['objects']):
    p=temp/h;info=tarfile.TarInfo(h);info.size=p.stat().st_size;info.mode=0o644;info.mtime=0
    with p.open('rb')as f:tar.addfile(info,f)
  record['archiveSHA256']=digest_file(packed);record['archiveBytes']=packed.stat().st_size;record['parts']=[]
  with packed.open('rb')as f:
   while b:=f.read(8*1024*1024):
    name=f'objects.tar.gz.part-{len(record["parts"]):03d}';(dest/name).write_bytes(b);record['parts'].append(dict(path=name,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
  packed.unlink();(dest/'manifest.json').write_text(json.dumps(record,indent=2))
  print(json.dumps({'ordinaryFiles':len(record['files']),'ciArchives':len(record['ciArchives']),'ciMembers':sum(len(a['members'])for a in record['ciArchives']),'objects':len(record['objects']),'externalArchives':len(record['externalOldArchives']),'packedBytes':record['archiveBytes'],'parts':len(record['parts'])}),flush=True)
def verify(bundle,cache,destination=None):
 bundle,cache=Path(bundle),Path(cache);cache.mkdir(parents=True,exist_ok=True);r=json.loads((bundle/'manifest.json').read_text());oldZip={}
 def external(p):
  local=cache/safe(p['path']);local.parent.mkdir(parents=True,exist_ok=True)
  if not local.exists():
   with urllib.request.urlopen(RAW+p['path'],timeout=120)as response,local.open('wb')as f:shutil.copyfileobj(response,f)
  if local.stat().st_size!=p['bytes']or digest_file(local)!=p['sha256']:raise ValueError('External hash mismatch '+p['path'])
  return local
 with tempfile.TemporaryDirectory(prefix='takkeu-restore-',dir='/workspace')as temp:
  temp=Path(temp);packed=temp/'objects.tar.gz';h=hashlib.sha256()
  with packed.open('wb')as f:
   for part in r['parts']:
    p=bundle/safe(part['path']);data=p.read_bytes()
    if len(data)!=part['bytes']or hashlib.sha256(data).hexdigest()!=part['sha256']:raise ValueError('Part hash mismatch '+str(p))
    f.write(data);h.update(data)
  if h.hexdigest()!=r['archiveSHA256']:raise ValueError('Archive hash mismatch')
  with tarfile.open(packed,'r:gz')as tar:
   names=tar.getnames()
   if set(names)!=set(r['objects'])or len(names)!=len(set(names)):raise ValueError('Unexpected/duplicate CAS members')
   for member in tar:
    if not member.isfile()or'/'in member.name:raise ValueError('Unsafe CAS member')
    data=tar.extractfile(member).read()
    if len(data)!=r['objects'][member.name]or hashlib.sha256(data).hexdigest()!=member.name:raise ValueError('CAS object hash mismatch')
    (temp/member.name).write_bytes(data)
  def resolve(ref):
   if 'object'in ref:return(temp/ref['object']).read_bytes()
   if 'oldFile'in ref:return external(dict(path=ref['oldFile'],bytes=ref['bytes'],sha256=ref['sha256'])).read_bytes()
   m=ref['oldMember'];key=m['artifactId']
   if key not in oldZip:
    a=r['externalOldArchives'][key];p=temp/(key+'.zip')
    with p.open('wb')as f:
     for part in a['parts']:
      with external(part).open('rb')as src:shutil.copyfileobj(src,f)
    if p.stat().st_size!=a['bytes']or digest_file(p)!=a['sha256']:raise ValueError('Old ZIP hash mismatch')
    oldZip[key]=zipfile.ZipFile(p)
   return oldZip[key].read(m['path'])
  ordinary=members=0
  for group,items,prefix in [('files',r['files'],''),*[(a['path'],a['members'],a['path']+'.members/')for a in r['ciArchives']]]:
   for item in items:
    data=resolve(item['ref'])
    if len(data)!=item['bytes']or hashlib.sha256(data).hexdigest()!=item['sha256']:raise ValueError('Restored byte mismatch '+item['path'])
    if group=='files':ordinary+=1
    else:members+=1
    if destination:
     p=Path(destination)/safe(prefix+item['path']);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
  for z in oldZip.values():z.close()
  print(json.dumps({'verifiedOrdinaryFiles':ordinary,'verifiedCIMembers':members,'verifiedExternalArchives':len(oldZip),'allRestoredSHA256Match':True}),flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();s=p.add_subparsers(dest='action',required=True);b=s.add_parser('build');b.add_argument('source');b.add_argument('destination');b.add_argument('oldFiles');b.add_argument('oldCI');v=s.add_parser('verify');v.add_argument('bundle');v.add_argument('cache');v.add_argument('--restore');a=p.parse_args()
 if a.action=='build':build(a.source,a.destination,a.oldFiles,a.oldCI)
 else:verify(a.bundle,a.cache,a.restore)
