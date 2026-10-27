"""Pack exact file bytes; deduplicate ZIP payloads without losing ZIP containers."""
import argparse, gzip, hashlib, io, json, os, struct, tarfile, tempfile, zipfile
from pathlib import Path

def digest(path, offset=0, size=None):
    h=hashlib.sha256()
    with path.open('rb') as f:
        f.seek(offset)
        while size is None or size:
            block=f.read(1024*1024 if size is None else min(size,1024*1024))
            if not block: break
            h.update(block)
            if size is not None: size-=len(block)
    if size not in (None,0): raise ValueError('Truncated source')
    return h.hexdigest()

class Slice:
    def __init__(self,path,offset,size):
        self.f=path.open('rb');self.f.seek(offset);self.left=size
    def read(self,size=-1):
        block=self.f.read(self.left if size<0 else min(self.left,size));self.left-=len(block);return block
    def close(self): self.f.close()

def pack(source,destination):
    source=source.resolve();destination.mkdir(parents=True,exist_ok=True)
    if any(destination.iterdir()): raise ValueError('Output directory must be empty')
    objects={};files=[];archives=[];official={}
    for p in source.glob('ci/*/official-digest-validation.json'):
        for row in json.loads(p.read_text()): official[str(row['artifactId'])]=row['officialDigest']
    def object_for(path,start,size):
        sha=digest(path,start,size)
        if sha not in objects: objects[sha]=(path,start,size)
        elif objects[sha][2]!=size: raise ValueError('Object length collision')
        return sha
    for path in sorted(source.rglob('*')):
        if path.is_symlink(): raise ValueError('Symlinks are not evidence files')
        if not path.is_file(): continue
        relative=path.relative_to(source).as_posix();size=path.stat().st_size;sha=digest(path)
        recipe=[]
        if path.parent.name=='provider-artifacts' and path.suffix=='.zip':
            if official.get(path.stem)!='sha256:'+sha: raise ValueError('Missing/mismatched GitHub digest: '+relative)
            cuts={0,size}
            with zipfile.ZipFile(path) as z, path.open('rb') as raw:
                if z.testzip() is not None: raise ValueError('ZIP CRC mismatch')
                cuts.add(z.start_dir)
                for member in z.infolist():
                    start=member.header_offset;raw.seek(start);header=raw.read(30)
                    if header[:4]!=b'PK\x03\x04': raise ValueError('Invalid local ZIP header')
                    name_size,extra_size=struct.unpack_from('<HH',header,26)
                    payload=start+30+name_size+extra_size;end=payload+member.compress_size
                    if not 0<=start<=payload<=end<=size: raise ValueError('Invalid ZIP boundaries')
                    cuts.update((start,payload,end))
                archives.append({'path':relative,'bytes':size,'sha256':sha,'officialDigest':official[path.stem],
                    'members':len(z.infolist()),'allCRC':'passed','originalZIPBytesPreserved':True})
            ordered=sorted(cuts)
            recipe=[object_for(path,a,b-a) for a,b in zip(ordered,ordered[1:]) if b>a]
        else: recipe=[object_for(path,0,size)]
        files.append({'path':relative,'bytes':size,'sha256':sha,'objects':recipe})
    with tempfile.TemporaryFile() as archive:
        with gzip.GzipFile(fileobj=archive,mode='wb',filename='',compresslevel=1,mtime=0) as compressed:
            with tarfile.open(fileobj=compressed,mode='w|',format=tarfile.USTAR_FORMAT) as tar:
                for sha,(path,offset,size) in sorted(objects.items()):
                    info=tarfile.TarInfo('objects/'+sha);info.size=size;info.mode=0o644;info.mtime=0
                    reader=Slice(path,offset,size)
                    try: tar.addfile(info,reader)
                    finally: reader.close()
        archive.seek(0);parts=[];whole=hashlib.sha256();index=0
        while True:
            block=archive.read(32*1024*1024)
            if not block: break
            name=f'part-{index:04d}.bin';(destination/name).write_bytes(block);whole.update(block)
            parts.append({'file':name,'bytes':len(block),'sha256':hashlib.sha256(block).hexdigest()});index+=1
    result={'schema':'takkeu-evidence-cas-v1','sourceCommit':'720c06357beff5e7bdfe0073fb35293c7f45b372',
        'archive':{'format':'gzip tar of content-addressed objects','bytes':sum(p['bytes'] for p in parts),'sha256':whole.hexdigest()},
        'parts':parts,'files':files,'objects':[{'sha256':sha,'bytes':p[2]} for sha,p in sorted(objects.items())],
        'providerArchives':archives,'summary':{'files':len(files),'fileBytes':sum(f['bytes'] for f in files),
            'objects':len(objects),'uniqueObjectBytes':sum(p[2] for p in objects.values()),'providerZIPs':len(archives)},
        'priorEvidence':{'manifestSHA256':'b7be8ecae0d850e4af0e27c12085a8593f1c8c5e99a6dd138e857d2442c6c5a6',
            'archiveSHA256':'b345e28c6bf7f9ab11371e83a5cbe60258788d80123ac65f7dac504af3f7c9c0',
            'note':'Referenced old evidence is not recopied or needed to restore this standalone package.'}}
    (destination/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'summary':result['summary'],'archive':result['archive'],'parts':len(parts)}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('destination',type=Path)
    args=parser.parse_args();pack(args.source,args.destination)
