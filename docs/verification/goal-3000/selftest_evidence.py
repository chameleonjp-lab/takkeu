"""Exercise exact ZIP restoration, deduplication and corrupted-input rejection."""
import hashlib, importlib.util, json, random, tempfile, zipfile
from pathlib import Path

def load(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def main():
    pack=load('pack_evidence').pack;restore=load('restore_evidence').restore
    with tempfile.TemporaryDirectory(prefix='takkeu-evidence-selftest-') as temporary:
        base=Path(temporary);source=base/'source';source.mkdir()
        payload=random.Random(27).randbytes(1024*1024)
        (source/'empty').write_bytes(b'');(source/'first').write_bytes(payload);(source/'duplicate').write_bytes(payload)
        provider=source/'ci'/'fixture'/'provider-artifacts';provider.mkdir(parents=True)
        official=[]
        for index in (1,2):
            path=provider/f'{index}.zip'
            with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr('different-'+str(index)+'/payload.bin',payload)
                archive.writestr('commit.txt','fixture-'+str(index))
            official.append({'artifactId':index,'officialDigest':'sha256:'+hashlib.sha256(path.read_bytes()).hexdigest()})
        (provider.parent/'official-digest-validation.json').write_text(json.dumps(official))
        packed=base/'packed';pack(source,packed);manifest=packed/'manifest.json';restored=base/'restored'
        restore(manifest,restored)
        originals={p.relative_to(source).as_posix():p.read_bytes() for p in source.rglob('*') if p.is_file()}
        copies={p.relative_to(restored).as_posix():p.read_bytes() for p in restored.rglob('*') if p.is_file()}
        assert originals==copies
        data=json.loads(manifest.read_text());rows={row['path']:row for row in data['files']}
        assert rows['first']['objects']==rows['duplicate']['objects']
        one=set(rows['ci/fixture/provider-artifacts/1.zip']['objects'])
        two=set(rows['ci/fixture/provider-artifacts/2.zip']['objects'])
        shared=one&two;object_sizes={row['sha256']:row['bytes'] for row in data['objects']}
        assert max(object_sizes[key] for key in shared)>1024*1024
        part=packed/data['parts'][0]['file'];good=part.read_bytes();corrupt=bytearray(good);corrupt[len(corrupt)//2]^=1;part.write_bytes(corrupt)
        try: restore(manifest,None,True)
        except ValueError as error: assert 'Part hash mismatch' in str(error)
        else: raise AssertionError('Corrupt part was accepted')
        part.write_bytes(good)
        data['files'][0]['path']='../outside';manifest.write_text(json.dumps(data))
        try: restore(manifest,None,True)
        except ValueError as error: assert 'Unsafe/duplicate evidence path' in str(error)
        else: raise AssertionError('Parent traversal was accepted')
        print(json.dumps({'exactOriginalFiles':len(originals),'originalZIPs':2,'duplicateFilesDeduplicated':True,
            'compressedZIPPayloadDeduplicated':True,'corruptPartRejected':True,'parentTraversalRejected':True,'result':'passed'}))

if __name__=='__main__': main()
