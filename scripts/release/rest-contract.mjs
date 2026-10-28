import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PROJECT, digest } from './guards.mjs';
import { INSPECTOR, inspectorMetadata } from './prepare-rest-inspector.mjs';

const fields=['migrations','game','tables','functions','readonly_routines','event_triggers'];
// Match PostgreSQL jsonb::text (key UTF8 byte length, then unsigned byte order).
// Reviewed catalog contains strings, booleans, null and safe integers only.
export function pgJsonbText(value) {
  if(Array.isArray(value))return `[${value.map(pgJsonbText).join(', ')}]`;
  if(value!==null&&typeof value==='object')return `{${Object.keys(value).sort((a,b)=>Buffer.byteLength(a)-Buffer.byteLength(b)||Buffer.compare(Buffer.from(a),Buffer.from(b))).map(k=>`${JSON.stringify(k)}: ${pgJsonbText(value[k])}`).join(', ')}}`;
  if(typeof value==='number'&&!Number.isSafeInteger(value))throw Error('Unsupported catalog number');
  const encoded=JSON.stringify(value);if(encoded===undefined)throw Error('Missing catalog value');return encoded;
}
export function fingerprintContract(contract) {
  return Object.fromEntries(fields.map(field=>[field,digest(pgJsonbText(contract[field]))]));
}
export const expectedInspectorHash=()=>digest(pgJsonbText(inspectorMetadata()));
export async function verifyRpcRoutes(contract,{fetcher=fetch,url,key}) {
  // Public-key OpenAPI is blocked by the Supabase gateway. HEAD still resolves
  // exact schema-cache argument names in a server-enforced READ ONLY transaction,
  // returns no player data, and uses intentionally invalid play/name/version values.
  const routines=contract.functions.filter(f=>f.schema==='public'&&/^(start_takkeu_clear_play|finish_takkeu_clear_play|register_takkeu_hall|get_takkeu_hall)_v[12]$/.test(f.name));
  if(routines.length!==8)throw Error('Expected eight reviewed hall RPCs');
  const request=target=>fetcher(target,{method:'HEAD',redirect:'error',headers:{apikey:key,'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
  if((await request(`${url}/rest/v1/rpc/takkeu_release_missing_v1`)).status!==404)throw Error('Unexpected PostgREST missing-route response');
  for(const fn of routines){
    const args=fn.args.split(', ').map(arg=>{
      const [name,type]=arg.split(' ');
      if(!/^p_[a-z_]+$/.test(name)||!['uuid','integer','text'].includes(type))throw Error('Unreviewed RPC argument');
      return [name,type==='uuid'?'00000000-0000-4000-8000-000000000000':type==='integer'?'0':''];
    });
    const r=await request(`${url}/rest/v1/rpc/${fn.name}?${new URLSearchParams(args)}`);
    // Some PostgREST versions reject volatile functions before execution (405).
    // Others execute them READ ONLY; invalid sentinel inputs return 200 without
    // writing. Missing functions/arguments (404), auth failures and timeouts fail.
    if(r.status!==200&&!(fn.volatility==='v'&&r.status===405))throw Error(`PostgREST hall RPC route/signature unavailable: ${fn.name} HTTP ${r.status}`);
  }
}
export function publicDatabaseConfiguration() {
  const src=readFileSync('src/ranking/config.ts','utf8');
  const url=/supabaseUrl: '([^']+)'/.exec(src)?.[1];
  const key=/publishableKey: "(sb_publishable_[A-Za-z0-9_-]+)"/.exec(src)?.[1];
  if(url!==`https://${PROJECT}.supabase.co`||!key)throw Error('Unexpected public production configuration');
  return {url,key};
}
export async function readPublicJson(url,{fetcher=fetch,headers={},maxBytes=16384}={}) {
  const response=await fetcher(url,{method:'GET',redirect:'error',headers:{...headers,'Cache-Control':'no-cache',Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`Public API HTTP ${response.status}`);
  if(!/^application\/(?:json|openapi\+json)(?:;|$)/i.test(response.headers.get('content-type')??''))throw Error('Public API returned non-JSON');
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes)throw Error('Public API response too large');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function checkDatabaseRest({fetcher=fetch,nonce=randomUUID(),now,contract=JSON.parse(readFileSync('scripts/release/expected-contract.json','utf8'))}={}) {
  if(digest(readFileSync(contract.migration_file,'utf8'))!==contract.migration_sha256)throw Error('Original migration contract hash mismatch');
  const {url,key}=publicDatabaseConfiguration();
  const snapshot=await readPublicJson(`${url}/rest/v1/rpc/${INSPECTOR}`,{fetcher,headers:{apikey:key,'x-takkeu-probe':nonce}});
  const observed=Date.parse(snapshot?.observed_at);const timestamp=now??Date.now();
  if(!isDeepStrictEqual(Object.keys(snapshot??{}).sort(),['format','project','read_only','nonce','observed_at','fingerprints','inspector_sha256'].sort())
    ||snapshot.format!==2||snapshot.project!==PROJECT||snapshot.read_only!==true||snapshot.nonce!==nonce||!Number.isFinite(observed)||Math.abs(timestamp-observed)>30000)
    throw Error('DB response identity, read-only mode or freshness mismatch');
  if(snapshot.inspector_sha256!==expectedInspectorHash())throw Error('DB inspector source/security contract mismatch');
  const expected=fingerprintContract(contract);
  for(const field of fields)if(snapshot.fingerprints?.[field]!==expected[field])throw Error(`DB contract mismatch: ${field}`);
  if(!isDeepStrictEqual(Object.keys(snapshot.fingerprints).sort(),fields.toSorted()))throw Error('DB fingerprint response schema mismatch');
  await verifyRpcRoutes(contract,{fetcher,url,key});
  return {observed_at:snapshot.observed_at,project:PROJECT,read_only:true,result:'matched',fingerprints:expected,inspector_sha256:snapshot.inspector_sha256};
}
