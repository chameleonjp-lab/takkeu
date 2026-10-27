"""Restore canonical original GitHub ZIP bytes; source archives are never recompressed."""
import argparse,hashlib,json,zipfile
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--archive',help='Exact original fileName, or omit for all archives')
parser.add_argument('--output',type=Path,default=Path('/workspace/rally-ci-restored/40235973827'))
parser.add_argument('--verify-only',action='store_true')
parser.add_argument('--extract',action='store_true')
args=parser.parse_args();root=Path(__file__).resolve().parent
manifest=json.loads((root/'archive-manifest.json').read_text())
archives=[row for row in manifest['archives']if args.archive is None or row['fileName']==args.archive]
if not archives:raise SystemExit('Unknown archive')
for row in archives:
 digest=hashlib.sha256();size=0
 output=None
 if not args.verify_only:
  args.output.mkdir(parents=True,exist_ok=True);output=(args.output/row['fileName']).open('wb')
 try:
  for chunk in row['chunks']:
   data=(root/chunk['path']).read_bytes()
   assert len(data)==chunk['bytes']and hashlib.sha256(data).hexdigest()==chunk['sha256']
   digest.update(data);size+=len(data)
   if output:output.write(data)
 finally:
  if output:output.close()
 assert size==row['bytes']and digest.hexdigest()==row['sha256']
 print(row['fileName'],size,digest.hexdigest(),'exact original reconstructed')
 if args.extract:
  assert not args.verify_only,'--extract requires ZIP reconstruction'
  with zipfile.ZipFile(args.output/row['fileName'])as archive:
   assert archive.testzip()is None
   target=args.output/row['fileName'].removesuffix('.zip');archive.extractall(target)
   for entry in row['members']:
    data=(target/entry['path']).read_bytes()
    assert len(data)==entry['bytes']and hashlib.sha256(data).hexdigest()==entry['sha256']
  print('All',len(row['members']),'members restored and verified')
