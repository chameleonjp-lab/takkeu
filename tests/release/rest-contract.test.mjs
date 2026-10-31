import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fingerprintContract, pgJsonbText, checkDatabaseRest } from '../../scripts/release/rest-contract.mjs';
import { digest } from '../../scripts/release/guards.mjs';
import { inspectorMetadata, prepareInspectorSql, inspectorMigrationFile } from '../../scripts/release/prepare-rest-inspector.mjs';
import { currentDatabaseContract } from '../../scripts/release/current-database-contract.mjs';
const contract=currentDatabaseContract();
const nonce='40bf07e9-f27f-4717-b336-39ff1965241c';
const now=Date.now();
test('reviewable API migration equals deterministic catalog-only generator',()=>{
  assert.equal(readFileSync(inspectorMigrationFile,'utf8'),prepareInspectorSql());
});
const valid=()=>({format:2,project:'mlpnjgezrnhdxsxolyzj',read_only:true,nonce,observed_at:new Date(now).toISOString(),fingerprints:fingerprintContract(contract),inspector_sha256:digest(pgJsonbText(inspectorMetadata()))});
function transport(body=valid(),{status=200,fail=false}={}) {
  return async(url,options)=>{
    if(options.method==='HEAD')return new Response(null,{status:url.includes('takkeu_release_missing_v1')?404:200});
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers['x-takkeu-probe'],nonce);
    assert.ok(options.signal instanceof AbortSignal);assert.match(url,/^https:\/\/mlpnjgezrnhdxsxolyzj\.supabase\.co\/rest\/v1\//);
    assert.ok(!url.includes('?'));assert.ok(!options.headers.Authorization);
    if(fail)throw Error('network timeout');
    const response=new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    return response;
  };
}
test('Postgres jsonb serialization is canonical including Unicode key byte length',()=>{
  assert.equal(pgJsonbText({aa:1,b:'x',あ:true,a:null,list:[{z:2,a:1}]}),'{'+'"a": null, "b": "x", "aa": 1, "あ": true, "list": [{"a": 1, "z": 2}]'+'}');
});
test('fixed GET request checks real contract digests, owner metadata, freshness and response schema',async()=>{
  assert.equal((await checkDatabaseRest({fetcher:transport(),nonce,now})).result,'matched');
  const mutations=[x=>x.format=1,x=>x.project='wrong',x=>x.read_only=false,x=>x.nonce='replayed',x=>x.observed_at=new Date(now-60000).toISOString(),x=>x.observed_at=new Date(now+60000).toISOString(),x=>x.fingerprints.migrations='0'.repeat(64),x=>delete x.fingerprints.functions,x=>x.fingerprints.extra='data',x=>x.inspector_sha256='0'.repeat(64),x=>x.inspector={owner:'postgres'},x=>x.internal_rows=['secret']];
  for(const mutate of mutations){const body=valid();mutate(body);await assert.rejects(checkDatabaseRest({fetcher:transport(body),nonce,now}));}
});
test('the older statistics definition is rejected after its explicit reviewed update',async()=>{
  const body=valid();
  body.fingerprints=fingerprintContract(JSON.parse(readFileSync('scripts/release/expected-contract.json')));
  await assert.rejects(checkDatabaseRest({fetcher:transport(body),nonce,now}),/readonly_routines/);
});
test('auth/timeout/malformed/non-json/oversized errors never become ready',async()=>{
  for(const status of [401,403,404,429,500])await assert.rejects(checkDatabaseRest({fetcher:transport({}, {status}),nonce,now}));
  await assert.rejects(checkDatabaseRest({fetcher:transport({}, {fail:true}),nonce,now}));
  for(const response of [new Response('garbled',{headers:{'content-type':'application/json'}}),new Response('{}'),new Response('x'.repeat(17000),{headers:{'content-type':'application/json'}})])await assert.rejects(checkDatabaseRest({fetcher:async()=>response,nonce,now}));
});
test('missing or stale PostgREST RPC cache and unexpected gateway responses fail closed',async()=>{
  for(const status of [401,403,404,500])await assert.rejects(checkDatabaseRest({nonce,now,fetcher:async(u,o)=>o.method==='HEAD'?new Response(null,{status}):transport()(u,o)}));
  await assert.rejects(checkDatabaseRest({nonce,now,fetcher:async(u,o)=>o.method==='HEAD'?new Response(null,{status:200}):transport()(u,o)}));
});
test('all six exact contract classes and every RPC body/ACL/constraint change alter fingerprints',()=>{
  const original=fingerprintContract(contract);
  for(const field of ['migrations','game','tables','functions','readonly_routines','event_triggers']){
    const altered=structuredClone(contract);altered[field]=null;assert.notEqual(fingerprintContract(altered)[field],original[field]);
  }
  for(const field of ['body','args','result','owner','config','privileges','public_execute']){const c=structuredClone(contract);c.functions[0][field]='drift';assert.notEqual(fingerprintContract(c).functions,original.functions);}
});
