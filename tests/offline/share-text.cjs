const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const config=fs.readFileSync(path.join(root,'src/ranking/config.ts'),'utf8');
let source=config.slice(config.indexOf('function validShareScore('));
source=source.replace(/export function /g,'function ').replace(/hallNumber\?: number/g,'hallNumber').replace(/url\?: string/g,'url').replace(/: (?:number|string|boolean)(?: \| null)?/g,'').replace(/hallNumber!/g,'hallNumber');
const canonical='https://chameleonjp-lab.github.io/takkeu/';
const weighted=value=>[...value.replace(/https?:\/\/\S+/gu,'x'.repeat(23))].reduce((n,c)=>{const p=c.codePointAt(0);return n+(p<=0x10ff||(p>=0x2000&&p<=0x200d)||(p>=0x2010&&p<=0x201f)||(p>=0x2032&&p<=0x2037)?1:2)},0);
const results=[];
for(const file of fs.readdirSync(path.join(root,'src/i18n/locales')).filter(n=>n.endsWith('.ts'))){
 const raw=fs.readFileSync(path.join(root,'src/i18n/locales',file),'utf8');const catalog=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
 const sandbox={URLSearchParams,RANKING_CONFIG:{canonicalUrl:canonical},t:(key,params={})=>(catalog[key]||key).replace(/\{([a-zA-Z0-9_]+)\}/gu,(_,k)=>Object.hasOwn(params,k)?String(params[k]):'—')};
 vm.createContext(sandbox,{codeGeneration:{strings:false,wasm:false}});vm.runInContext(source+';this.api={homeShareUrl,scoreShareUrl}',sandbox,{timeout:1000});
 let passed=0;for(const url of [sandbox.api.homeShareUrl(0),sandbox.api.scoreShareUrl(0),sandbox.api.scoreShareUrl(37),sandbox.api.scoreShareUrl(Number.MAX_SAFE_INTEGER),sandbox.api.scoreShareUrl(3500,true,Number.MAX_SAFE_INTEGER)]){
  const parsed=new URL(url),text=parsed.searchParams.get('text');assert.equal(parsed.origin+parsed.pathname,'https://twitter.com/intent/tweet');assert.ok(text.endsWith('\n#タッケウ #ゲーム制作'));assert.deepEqual(text.match(/#[^\s]+/gu),['#タッケウ','#ゲーム制作']);assert.ok(weighted(text)+(parsed.searchParams.has('url')?24:0)<=280);passed++;
 }
 for(const bad of [-1,NaN,Infinity,0.5])assert.equal(sandbox.api.scoreShareUrl(bad),null);
 assert.equal(sandbox.api.scoreShareUrl(3000,true,35),null);
 results.push({locale:file.slice(0,-3),passed});
}
console.log(JSON.stringify({scope:'exact share function body with TypeScript annotations removed; real locale JSON, VM has no network or filesystem bindings',locales:results.length,cases:results.reduce((n,r)=>n+r.passed,0),results},null,2));
