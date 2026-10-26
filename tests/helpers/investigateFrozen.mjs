import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const [root,output]=process.argv.slice(2);mkdirSync(output,{recursive:true});
const fixture=`
import {Scene} from 'three';
import {createView} from '../../src/render/createView';
import {DEFAULT_CONFIG} from '../../src/game/config';
import {rallyPerformanceReplay} from './rallyPerformanceReplay';
const scenes=[],add=Scene.prototype.add;
Scene.prototype.add=function(...objects){if(!scenes.includes(this))scenes.push(this);return add.apply(this,objects);};
const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2',{antialias:true,alpha:false});
const view=createView(canvas,DEFAULT_CONFIG);Scene.prototype.add=add;
const scene=scenes[0],roots=['rally-table','rally-world'].map(n=>scene.getObjectByName(n));
const p=window.__frozen={mode:'normal',cost:0,upload:0,renderer:null};
const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
for(const name of ['bufferData','bufferSubData']){const orig=gl[name].bind(gl);gl[name]=(...a)=>{const d=a[name==='bufferData'?1:2];p.upload+=typeof d==='number'?d:a[4]===undefined?d.byteLength-(a[3]??0)*(d.BYTES_PER_ELEMENT??1):a[4]*(d.BYTES_PER_ELEMENT??1);return orig(...a);};}
view.resize(1280,720);await view.prepare(()=>{});
const frames=rallyPerformanceReplay(4000,2,2);
const frozen=frames.reduce((a,b)=>b.state.hits.length>a.state.hits.length?b:a);
const wait=()=>new Promise(r=>setTimeout(r,10));
async function render(mode){
 p.mode=mode;for(const r of roots)r.visible=mode!=='hidden';
 if(mode==='freeze')for(const r of roots)r.traverse(n=>{if(!n.geometry)return;const g=n.geometry,vertices=g.drawRange.count/(g.index?6:6)*(g.index?4:6);
 for(const name of ['position','color']){const a=g.getAttribute(name);a.clearUpdateRanges();a.addUpdateRange(0,vertices*a.itemSize);a.needsUpdate=true;}});
 p.cost=0;p.upload=0;const q=timer?gl.createQuery():null;if(q)gl.beginQuery(timer.TIME_ELAPSED_EXT,q);
 const start=performance.now();view.render(frozen.snapshot,frozen.events,frozen.state);const submitMs=performance.now()-start;if(p.capture){const a=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,a);p.pixels=a;}
 if(q)gl.endQuery(timer.TIME_ELAPSED_EXT);
 const result={mode,updateMs:p.cost,submitMs,uploadBytes:p.upload,drawCalls:p.renderer.info.render.calls,triangles:p.renderer.info.render.triangles,gpuMs:null,available:false,disjoint:null};
 if(q){const until=performance.now()+10000;while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&performance.now()<until)await wait();
 result.available=!!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE);result.disjoint=!!gl.getParameter(timer.GPU_DISJOINT_EXT);if(result.available&&!result.disjoint)result.gpuMs=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);}
 return result;
}
window.frozenProbe={async run(quality){view.setQuality(quality);const rows=[];for(let i=0;i<8;i++)await render('normal');
 const pixels=()=>{const a=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
 p.capture=true;await render('normal');const before=p.pixels;await render('freeze');const after=p.pixels;p.capture=false;let changed=0;for(let i=0;i<before.length;i++)if(before[i]!==after[i])changed++;
 for(const mode of ['normal','freeze','freeze','normal','hidden','normal'])for(let i=0;i<8;i++)rows.push(await render(mode));
 return {quality,snapshot:frozen.snapshot,state:frozen.state,rows,timerAvailable:!!timer,changedChannels:changed};}};
`;
const server=await createServer({root,configFile:false,plugins:[{name:'frozen-diagnostic',enforce:'pre',transform(s,id){
 if(id.endsWith('/tests/helpers/rallyGlHarness.ts'))return {code:fixture,map:null};
 if(id.endsWith('/src/render/createView.ts')){
  s=s.replace('rallyEffects.update(snapshot,effects,quality,reducedMotion);',`if(window.__frozen?.mode!=='freeze'){const t=performance.now();rallyEffects.update(snapshot,effects,quality,reducedMotion);if(window.__frozen)window.__frozen.cost=performance.now()-t;}`);
  s=s.replace('renderer.render(scene, camera);','if(window.__frozen)window.__frozen.renderer=renderer;renderer.render(scene, camera);');return {code:s,map:null};}
 }}],server:{host:'127.0.0.1',port:4176,strictPort:true}});
let browser;try{await server.listen();browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[],blocked=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',async r=>{if(new URL(r.request().url()).origin==='http://127.0.0.1:4176')await r.continue();else{blocked.push(r.request().url());await r.abort();}});
await page.goto('http://127.0.0.1:4176/tests/fixtures/rally-gl.html');await page.waitForFunction(()=>!!window.frozenProbe,null,{timeout:60000});
for(const quality of ['standard','low']){const data=await page.evaluate(q=>window.frozenProbe.run(q),quality);writeFileSync(output+'/'+quality+'.json.gz',gzipSync(JSON.stringify({data,errors,blocked,browser:browser.version()})));console.log(quality,JSON.stringify(data.rows),data.changedChannels);}
if(errors.length||blocked.length)throw Error(JSON.stringify({errors,blocked}));
}finally{await browser?.close();await server.close();}
