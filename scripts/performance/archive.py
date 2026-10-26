"""Deterministic evidence archive, lossless, size bounded, independently verifiable."""
from pathlib import Path
import json,hashlib,tarfile,gzip,io,sys
source=Path(sys.argv[1]);dest=Path(sys.argv[2]);dest.mkdir(parents=True,exist_ok=True)
files=[p for p in sorted(source.rglob('*'))if p.is_file()]
manifest=[dict(path=str(p.relative_to(source)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())for p in files]
buffer=io.BytesIO()
with tarfile.open(fileobj=buffer,mode='w',format=tarfile.PAX_FORMAT) as tar:
 for p in files:
  info=tar.gettarinfo(str(p),arcname=str(p.relative_to(source)));info.uid=0;info.gid=0;info.uname='';info.gname='';info.mtime=0
  with p.open('rb')as f:tar.addfile(info,f)
packed=gzip.compress(buffer.getvalue(),compresslevel=9,mtime=0)
name='evidence.tar.gz';partsize=8*1024*1024;parts=[]
for offset in range(0,len(packed),partsize):
 chunk=packed[offset:offset+partsize];part=f'{name}.part-{len(parts):03d}';(dest/part).write_bytes(chunk);parts.append(dict(path=part,bytes=len(chunk),sha256=hashlib.sha256(chunk).hexdigest()))
record=dict(format='tar+gzip',restore='cat evidence.tar.gz.part-* > /tmp/evidence.tar.gz; gzip -t /tmp/evidence.tar.gz; tar -xzf /tmp/evidence.tar.gz -C DEST; verify each sha256 in manifest.json',archiveSHA256=hashlib.sha256(packed).hexdigest(),archiveBytes=len(packed),parts=parts,files=manifest)
(dest/'manifest.json').write_text(json.dumps(record,indent=2));print(json.dumps(dict(files=len(files),bytes=len(packed),parts=len(parts))))
# Re-open, decompress and verify every archived member before treating it as retained.
rejoined=b''.join((dest/p['path']).read_bytes()for p in parts)
assert hashlib.sha256(rejoined).hexdigest()==record['archiveSHA256']
with tarfile.open(fileobj=io.BytesIO(rejoined),mode='r:gz')as tar:
 assert set(tar.getnames())=={f['path']for f in manifest}
 for f in manifest:assert hashlib.sha256(tar.extractfile(f['path']).read()).hexdigest()==f['sha256']
print('restore+all member SHA256 verified')
