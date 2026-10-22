"""Check links and all evidence hashes without rerunning unchanged game tests."""
import hashlib,json,re,zipfile
from pathlib import Path
root=Path(__file__).parent
formal=json.loads((root/'final-verification.json').read_text())
assert formal['result']=='passed'
assert all(s['exitCode']==0 for s in formal['steps'])
for path,expected in formal['sourceSha256'].items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==expected,path
for path,expected in formal['distributionSha256'].items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==expected,path
for step in formal['steps']:assert hashlib.sha256(Path(step['log']).read_bytes()).hexdigest()==step['logSha256']
media=json.loads((root/'media-manifest.json').read_text())
assert media['commit']==formal['commit']
for path,v in media['files'].items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==v['sha256'],path
candidate=json.loads((root/'release-candidate.json').read_text())
assert candidate['commit']==formal['commit']
assert hashlib.sha256((root/candidate['archive']).read_bytes()).hexdigest()==candidate['sha256']
with zipfile.ZipFile(root/candidate['archive'])as z:
 assert set(z.namelist())==set(candidate['files'])
 for name,value in candidate['files'].items():assert hashlib.sha256(z.read(name)).hexdigest()==value
preview=json.loads((root/'preview-generation.json').read_text())
for path,value in preview['sourceSha256'].items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==value,path
readme=(root/'README.md').read_text()
expected={'R':list(range(1,13)),'A':list(range(1,9)),'Q':list(range(1,18)),'M':[1,10,30,40,70,100,130,150,160,190,210,240,270,300,330,360,380,390,410,420,450]}
for prefix,values in expected.items():
 rows=[m.group(0) for m in re.finditer(r'^\| ('+prefix+r'\d+) \|.*$',readme,re.M)]
 assert [int(re.search(r'\d+',row).group())for row in rows]==values,(prefix,rows)
 assert all(any(status in row for status in ['成功','失敗','未確認'])for row in rows)
assert not re.search(r'作成中|正式検査中|結果は検査終了後に確定',readme)
links=[]
for md in [*root.glob('*.md'),Path('README.md'),Path('docs/progress.md'),Path('docs/superpowers/specs/2026-10-22-takkeu-design.md'),Path('docs/superpowers/plans/2026-10-22-rally-revision.md')]:
 for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)',md.read_text()):
  if re.match(r'https?://|#',target):continue
  path=(md.parent/target.split('#')[0]).resolve()
  assert path.exists(),(str(md),target)
  links.append([str(md),target])
summary=json.loads((root/'summary.json').read_text())
assert summary['unit']=={'passed':113,'failed':0,'pending':0,'files':25}
assert summary['browser']['expected']==62 and summary['release']['expected']==4
for item in ['browser','release']:assert all(summary[item][k]==0 for k in ['skipped','unexpected','flaky'])
report={'commit':formal['commit'],'result':'passed','sourceFiles':len(formal['sourceSha256']),'distributionFiles':len(formal['distributionSha256']),'mediaFiles':len(media['files']),'localLinksChecked':len(links),'requirementCounts':{k:len(v)for k,v in expected.items()},'performanceAcceptance':'Linux連続負荷は失敗。実機目標は未確認。ファイルの検証成功とは区別する。'}
(root/'document-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
