"""Split an owned evidence artifact into GitHub-sized, fully hashed pieces."""
from pathlib import Path
import hashlib,json,sys

source=Path(sys.argv[1]);chunk_size=32*1024*1024;pieces=[];combined=hashlib.sha256()
with source.open('rb') as reader:
    index=0
    while True:
        data=reader.read(chunk_size)
        if not data:break
        target=source.with_name(source.name+f'.part-{index:03d}');target.write_bytes(data)
        pieces.append({'file':target.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()});combined.update(data);index+=1
original=hashlib.sha256(source.read_bytes()).hexdigest()
assert combined.hexdigest()==original
verified=hashlib.sha256()
for piece in pieces:
    data=(source.parent/piece['file']).read_bytes();assert hashlib.sha256(data).hexdigest()==piece['sha256'];verified.update(data)
assert verified.hexdigest()==original
manifest={'original':source.name,'originalBytes':source.stat().st_size,'originalSHA256':original,'reconstructedSHA256':verified.hexdigest(),'allPartsVerified':True,'chunkBytes':chunk_size,'parts':pieces,
    'restoreCommand':f"cat {source.name}.part-* > {source.name}",'verifyCommand':f"sha256sum {source.name}"}
source.with_name(source.name+'.parts.json').write_text(json.dumps(manifest,indent=2))
# Keep an untracked external convenience copy, while the repository stores all
# original bytes via verified chunks (never omit formal evidence).
outside=Path('/workspace/rally-large-originals');outside.mkdir(exist_ok=True)
source.replace(outside/source.name)
print(source.name,len(pieces),'pieces; exact reconstruction verified',original)
