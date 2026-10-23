"""Validate frozen evidence, acceptance rows and local links without rerunning games."""
import hashlib,json,re,subprocess,zipfile
from pathlib import Path
root=Path(__file__).parent
formal=json.loads((root/'final-verification.json').read_text());assert formal['result']=='passed'
assert all(s['exitCode']==0 for s in formal['steps'])
hashfile=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
supplement=json.loads((root/'supplemental-verification.json').read_text())
assert supplement['baseFormalCommit']==formal['commit'] and supplement['result']=='passed'
assert supplement['changedFiles']==['tests/browser/audio.spec.ts']
assert set(supplement['sourceSha256'])==set(formal['sourceSha256'])
changed=[]
for path,value in formal['sourceSha256'].items():
 current=hashfile(path);assert current==supplement['sourceSha256'][path],path
 if current!=value:
  changed.append(path)
  frozen=subprocess.check_output(['git','show',formal['commit']+':'+path])
  assert hashlib.sha256(frozen).hexdigest()==value,path
assert changed==supplement['changedFiles'],changed
for check in supplement['checks']:
 assert check['exitCode']==0 and hashfile(root/check['log'])==check['logSha256']
assert supplement['checks'][1]['passed']==8 and supplement['checks'][1]['failed']==0
red=supplement['failureReproduced'];assert hashfile(root/red['log'])==red['logSha256']
for ci in supplement['ciBeforeFix'].values():assert hashfile(root/ci['log'])==ci['logSha256']
for path,value in formal['distributionSha256'].items():assert hashfile(path)==value,path
for step in formal['steps']:assert hashfile(step['log'])==step['logSha256']
media=json.loads((root/'media-manifest.json').read_text());assert media['commit']==formal['commit']
for path,value in media['files'].items():assert hashfile(root/path)==value['sha256'],path
candidate=json.loads((root/'release-candidate.json').read_text());assert candidate['commit']==formal['commit']
assert hashfile(root/candidate['archive'])==candidate['sha256']
with zipfile.ZipFile(root/candidate['archive'])as z:
 assert set(z.namelist())==set(candidate['files'])
 for name,value in candidate['files'].items():assert hashlib.sha256(z.read(name)).hexdigest()==value
readme=(root/'README.md').read_text()
expected={'R':list(range(1,13)),'A':list(range(1,9)),'Q':list(range(1,18)),'M':[1,5,10,30,40,70,100,130,150,160,190,210,240,270,300,330,360,380,390,410,420,450,460,470,480,490,500,510,520,530,540,555]}
for prefix,values in expected.items():
 rows=re.findall(r'^\| '+prefix+r'(\d+) \|.*$',readme,re.M);assert list(map(int,rows))==values,(prefix,rows)
 for row in re.findall(r'^\| '+prefix+r'\d+ \|.*$',readme,re.M):assert any(s in row for s in ['成功','失敗','未確認'])
assert '正式検査中' not in readme
links=[]
paths=[*root.glob('*.md'),Path('README.md'),Path('docs/progress.md'),Path('docs/release.md'),Path('docs/superpowers/specs/2026-10-22-takkeu-design.md'),Path('docs/superpowers/specs/2026-10-23-extended-rally-design.md'),Path('docs/superpowers/plans/2026-10-23-extended-rally.md')]
for md in paths:
 for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)',md.read_text()):
  if re.match(r'https?://|#',target):continue
  path=(md.parent/target.split('#')[0]).resolve();assert path.exists(),(str(md),target);links.append([str(md),target])
preserved=json.loads((root/'preserved-production.json').read_text());assert preserved['product']==formal['commit']
for path,value in preserved['unchangedSourceSha256'].items():assert hashfile(path)==value,path
summary=json.loads((root/'summary.json').read_text());assert summary['unit']['failed']==summary['unit']['pending']==0
assert summary['browser']['expected']==74 and summary['release']['expected']==4
for item in ['browser','release']:assert all(summary[item][k]==0 for k in ['skipped','unexpected','flaky'])
report={'commit':formal['commit'],'result':'passed','sourceFiles':len(formal['sourceSha256']),'supplementalChangedFiles':changed,'productCodeChangedSinceFormal':False,'supplementalAudioBrowserPassed':8,'distributionFiles':len(formal['distributionSha256']),'mediaFiles':len(media['files']),'localLinksChecked':len(links),'requirementCounts':{k:len(v)for k,v in expected.items()},'performanceAcceptance':{engine:{score:v['continuousPlayVerdict']for score,v in cases.items()}for engine,cases in summary['realtime'].items()},'targetHardwareAcceptance':'未確認'}
(root/'document-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
