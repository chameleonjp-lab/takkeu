import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

const [baseArg,headArg,outArg,quality='standard']=process.argv.slice(2);
if(!baseArg||!headArg||!outArg||!['standard','low'].includes(quality))throw Error('BASE HEAD OUT standard|low');
const roots={base:resolve(baseArg),head:resolve(headArg)},out=resolve(outArg),runner=join(roots.head,'tests/helpers/captureRallyFlashFrames.mjs'),analyzer=join(roots.head,'tests/helpers/rallyFlashAnalysis.py');
mkdirSync(out,{recursive:true});
function command(file,args,options={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(file,args,{stdio:'inherit',...options});
  child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error(file+' failed: '+code+' '+signal)));
 });
}
await command('python3',[analyzer,'--self-test']);
const summaries={};
for(const side of ['base','head']){
 const server=await createServer({root:roots[side],configFile:false,server:{host:'127.0.0.1',port:4173,strictPort:true,fs:{allow:Object.values(roots)},watch:{ignored:['**/docs/**','**/artifacts/**']}}});
 const dest=join(out,side);mkdirSync(dest,{recursive:true});
 try{
  await server.listen();
  await command(process.execPath,[runner],{cwd:roots[side],env:{...process.env,RALLY_FLASH_BASE_URL:'http://127.0.0.1:4173',RALLY_FLASH_SOURCE_ROOT:roots[side],RALLY_FLASH_OUTPUT:dest,RALLY_FLASH_QUALITY:quality,RALLY_FLASH_MODE:'scores-only',RALLY_FLASH_SCORES:'1500,2600,3000,4000'}});
 }finally{await server.close();}
 await command('python3',[analyzer,dest]);
 summaries[side]=JSON.parse(readFileSync(join(dest,'summary.json'),'utf8'));
}
const comparisons=summaries.base.map(a=>{
 const b=summaries.head.find(r=>r.sequence===a.sequence);
 if(!b)throw Error('Missing matching flash sequence');
 return {sequence:a.sequence,baseFlagged:a.flagged,headFlagged:b.flagged,base:a,head:b};
});
writeFileSync(join(out,'comparison.json'),JSON.stringify({quality,comparisons,limitations:['Unchanged conservative SDR canvas analyzer; not normative certification.','Explicit60Hz content clock, synthetic overlap, not performance or physical replay.','Old warnings elsewhere are not resolved by a clean result in this corpus.']},null,2));
console.log('FLASH COMPARISON '+JSON.stringify(comparisons.map(({sequence,baseFlagged,headFlagged})=>({sequence,baseFlagged,headFlagged}))));
if(comparisons.some(r=>r.headFlagged&&!r.baseFlagged))throw Error('New primary flash warning; keep Draft and investigate');
