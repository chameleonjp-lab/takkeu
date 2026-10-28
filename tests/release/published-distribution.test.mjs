import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildManifest, matchManifest, verifyTar, verifyPublished } from '../../scripts/release/distribution.mjs';
const sha='a'.repeat(40);
test('every file, release SHA/base and 3500 client version are bound to manifest and tar',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'takkeu-dist-'));
  try {
    mkdirSync(join(dir,'assets'));
    writeFileSync(join(dir,'release.json'),JSON.stringify({commit:sha,base:'/takkeu/'}));
    writeFileSync(join(dir,'index.html'),'<script type="module" src="/takkeu/assets/main.js"></script>');
    writeFileSync(join(dir,'assets/main.js'),'const version="takkeu-web-clear-3500-1";');
    const manifest=buildManifest(dir,sha);matchManifest(manifest,buildManifest(dir,sha));
    const tar=join(dir,'..',`takkeu-${process.pid}.tar`);execFileSync('tar',['-cf',tar,'-C',dir,'.']);
    try{verifyTar(tar,manifest);}finally{rmSync(tar);}
    const files=new Map(Object.keys(manifest.files).map(f=>[f,new Uint8Array(execFileSync('cat',[join(dir,f)]))]));
    const fetcher=async(url,options)=>{
      assert.equal(options.redirect,'error');assert.equal(options.method,'GET');assert.equal(options.headers['Cache-Control'],'no-cache');
      const u=new URL(url);assert.equal(u.searchParams.get('release'),sha);assert.ok(u.searchParams.get('probe'));
      return new Response(files.get(u.pathname.replace('/takkeu/','')));
    };
    await verifyPublished(manifest,'https://chameleonjp-lab.github.io/takkeu/',{fetcher});
    await assert.rejects(verifyPublished(manifest,'https://elsewhere.invalid/',{fetcher}));
    await assert.rejects(verifyPublished(manifest,'https://chameleonjp-lab.github.io/takkeu/',{fetcher:async()=>new Response('old cache')}));
    await assert.rejects(verifyPublished(manifest,'https://chameleonjp-lab.github.io/takkeu/',{fetcher:async()=>new Response('',{status:404})}));
    writeFileSync(join(dir,'assets/main.js'),'changed');assert.throws(()=>matchManifest(manifest,buildManifest(dir,sha)));assert.throws(()=>buildManifest(dir,'b'.repeat(40)));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
