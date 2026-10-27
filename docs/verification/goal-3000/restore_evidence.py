"""Verify all parts/objects/files and restore exact original bytes, including ZIPs."""
import argparse, hashlib, json, re, shutil, tarfile, tempfile
from pathlib import Path, PurePosixPath

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
    return h.hexdigest()

def restore(manifest_path,destination,verify_only=False):
    manifest=json.loads(manifest_path.read_text());base=manifest_path.parent
    if manifest.get('schema')!='takkeu-evidence-cas-v1': raise ValueError('Unknown manifest schema')
    expected={row['sha256']:row['bytes'] for row in manifest['objects']}
    if len(expected)!=len(manifest['objects']): raise ValueError('Duplicate object')
    for key in expected:
        if re.fullmatch('[0-9a-f]{64}',key) is None: raise ValueError('Invalid object name')
    seen_paths=set()
    for row in manifest['files']:
        path=PurePosixPath(row['path'])
        if path.is_absolute() or '..' in path.parts or not path.parts or row['path'] in seen_paths: raise ValueError('Unsafe/duplicate evidence path')
        seen_paths.add(row['path'])
        if any(key not in expected for key in row['objects']): raise ValueError('Unknown file object')
        if sum(expected[key] for key in row['objects'])!=row['bytes']: raise ValueError('File length mismatch')
    if not verify_only:
        if destination is None: raise ValueError('Destination is required')
        destination.mkdir(parents=True,exist_ok=True)
        if any(destination.iterdir()): raise ValueError('Destination must be empty')
    with tempfile.TemporaryFile() as archive, tempfile.TemporaryDirectory(prefix='takkeu-evidence-objects-') as cache_name:
        cache=Path(cache_name);whole=hashlib.sha256();archive_bytes=0
        for part in manifest['parts']:
            if re.fullmatch(r'part-[0-9]{4}\.bin',part['file']) is None: raise ValueError('Unsafe part filename')
            path=base/part['file']
            if path.stat().st_size!=part['bytes'] or sha(path)!=part['sha256']: raise ValueError('Part hash mismatch: '+part['file'])
            with path.open('rb') as stream:
                for block in iter(lambda:stream.read(1024*1024),b''): archive.write(block);whole.update(block);archive_bytes+=len(block)
        if whole.hexdigest()!=manifest['archive']['sha256'] or archive_bytes!=manifest['archive']['bytes']: raise ValueError('Archive hash mismatch')
        archive.seek(0);observed=set()
        with tarfile.open(fileobj=archive,mode='r|gz') as tar:
            for member in tar:
                match=re.fullmatch('objects/([0-9a-f]{64})',member.name)
                if not member.isfile() or not match: raise ValueError('Unsafe archive member')
                key=match.group(1)
                if key not in expected or key in observed or member.size!=expected[key]: raise ValueError('Unexpected archive object')
                observed.add(key)
                with tar.extractfile(member) as stream,(cache/key).open('wb') as out: shutil.copyfileobj(stream,out)
                if sha(cache/key)!=key: raise ValueError('Object hash mismatch')
        if observed!=set(expected): raise ValueError('Missing objects')
        file_bytes=0
        for row in manifest['files']:
            target=None
            if not verify_only:
                target=destination.joinpath(*PurePosixPath(row['path']).parts);target.parent.mkdir(parents=True,exist_ok=True)
                out=target.open('wb')
            h=hashlib.sha256();size=0
            try:
                for key in row['objects']:
                    with (cache/key).open('rb') as stream:
                        for block in iter(lambda:stream.read(1024*1024),b''):
                            h.update(block);size+=len(block)
                            if target is not None: out.write(block)
            finally:
                if target is not None: out.close()
            if size!=row['bytes'] or h.hexdigest()!=row['sha256']: raise ValueError('Restored file hash mismatch: '+row['path'])
            file_bytes+=size
    result={'files':len(manifest['files']),'fileBytes':file_bytes,'objects':len(expected),'parts':len(manifest['parts']),
        'providerZIPs':len(manifest['providerArchives']),'archiveSHA256':whole.hexdigest(),'verification':'all parts, archive, objects and exact files passed',
        'restored':not verify_only}
    print(json.dumps(result));return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('manifest',type=Path);parser.add_argument('destination',nargs='?',type=Path);parser.add_argument('--verify-only',action='store_true')
    args=parser.parse_args();restore(args.manifest,args.destination,args.verify_only)
