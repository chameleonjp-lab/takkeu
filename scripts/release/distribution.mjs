import { readFileSync, readdirSync, lstatSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { checkDatabaseRest } from './rest-contract.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const allowed=/^(?:index\.html|release\.json|ranking-manifest\.json|og-takkeu-v1\.png|assets\/[\w.-]+\.(?:js|css|png))$/;
function validManifest(m) {
  if(m?.format!==1||!/^[0-9a-f]{40}$/.test(m.commit??'')||m.base!=='/takkeu/'||m.client_version!=='takkeu-web-clear-3500-1'
    ||!m.files||typeof m.files!=='object'||!m.files['index.html']||!m.files['release.json']||!Object.keys(m.files).some(p=>p.endsWith('.js')))
    throw Error('Invalid release manifest');
  for(const [path,value] of Object.entries(m.files))if(!allowed.test(path)||!/^[0-9a-f]{64}$/.test(value?.sha256??'')||!Number.isSafeInteger(value.bytes)||value.bytes<1)throw Error('Invalid release file contract');
}
export function buildManifest(dir,expected) {
  const release=JSON.parse(readFileSync(join(dir,'release.json'),'utf8'));
  if(release.commit!==expected||release.base!=='/takkeu/')throw Error('Release SHA/base mismatch');
  const files={};let version=false;
  function walk(prefix='') {
    for(const entry of readdirSync(join(dir,prefix),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const path=prefix+entry.name;
      if(lstatSync(join(dir,path)).isSymbolicLink())throw Error('Distribution symlink forbidden');
      if(entry.isDirectory()){if(path!=='assets')throw Error('Unexpected distribution directory');walk(path+'/');continue;}
      if(!entry.isFile()||!allowed.test(path))throw Error('Unexpected distribution file');
      const bytes=readFileSync(join(dir,path));files[path]={bytes:bytes.length,sha256:hash(bytes)};
      if(path.endsWith('.js')&&bytes.includes(Buffer.from('takkeu-web-clear-3500-1')))version=true;
    }
  }
  walk();if(!version)throw Error('3500 client version missing');
  const m={format:1,commit:expected,base:'/takkeu/',client_version:'takkeu-web-clear-3500-1',files};validManifest(m);return m;
}
export function matchManifest(a,b) {validManifest(a);validManifest(b);if(!isDeepStrictEqual(a,b))throw Error('CI/build distribution bytes differ');}
export function verifyTar(tar,manifest) {
  validManifest(manifest);
  const list=execFileSync('tar',['-tf',tar],{encoding:'utf8'}).trim().split('\n');
  const verbose=execFileSync('tar',['-tvf',tar],{encoding:'utf8'}).trim().split('\n');
  if(verbose.some(line=>!['-','d'].includes(line[0])))throw Error('Non-regular Pages artifact entry');
  const files=list.filter(p=>!p.endsWith('/'));
  if(files.length!==Object.keys(manifest.files).length||new Set(list).size!==list.length)throw Error('Pages tar file inventory differs');
  for(const path of files) {
    const relative=path.replace(/^\.\//,'');
    if(!allowed.test(relative)||!manifest.files[relative]||path!==`./${relative}`)throw Error('Unsafe/unexpected Pages tar path');
    const bytes=execFileSync('tar',['-xOf',tar,path],{maxBuffer:16*1024*1024});
    if(bytes.length!==manifest.files[relative].bytes||hash(bytes)!==manifest.files[relative].sha256)throw Error('Uploaded Pages artifact bytes differ');
  }
}
export async function verifyPublished(manifest,url,{fetcher=fetch}={}) {
  validManifest(manifest);
  if(url!=='https://chameleonjp-lab.github.io/takkeu/')throw Error('Published Pages URL mismatch');
  for(const [path,expected] of Object.entries(manifest.files)) {
    const target=new URL(path,url);target.searchParams.set('release',manifest.commit);target.searchParams.set('probe',randomUUID());
    const response=await fetcher(target.href,{method:'GET',redirect:'error',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`Published static file HTTP ${response.status}: ${path}`);
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>expected.bytes)throw Error(`Published file size mismatch: ${path}`);chunks.push(chunk);}
    const bytes=Buffer.concat(chunks);
    if(size!==expected.bytes||hash(bytes)!==expected.sha256)throw Error(`Published file SHA256 mismatch: ${path}`);
  }
  return {commit:manifest.commit,url,files:Object.keys(manifest.files).length,result:'matched'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [command,a,b]=process.argv.slice(2);
    if(command==='write') {
      const m=buildManifest(a,process.env.EXPECTED_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
      mkdirSync(dirname(b),{recursive:true});writeFileSync(b,JSON.stringify(m,null,2)+'\n');console.log(`Distribution bound to ${m.commit}, ${Object.keys(m.files).length} files`);
    }else if(command==='compare')matchManifest(JSON.parse(readFileSync(a)),JSON.parse(readFileSync(b)));
    else if(command==='tar')verifyTar(a,JSON.parse(readFileSync(b)));
    else if(command==='live') {
      const m=JSON.parse(readFileSync(a));let result;
      // Bounded CDN convergence only; no deployment/DB write or infinite rerun.
      for(let attempt=1;attempt<=3;attempt++) {
        try{result=await verifyPublished(m,process.env.PAGE_URL);break;}
        catch(error){if(attempt===3)throw error;console.error(`Published file verification attempt ${attempt}/3 failed; checking again in 5 seconds`);await new Promise(r=>setTimeout(r,5000));}
      }
      const db=await checkDatabaseRest();console.log(JSON.stringify({...result,database:db.result}));
    } else throw Error('Unknown distribution verification command');
  } catch(error) {console.error(`Release distribution verification failed: ${error.message}`);process.exitCode=1;}
}
