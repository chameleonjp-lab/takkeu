import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const repeats=Number(process.env.TAKKEU_MEMORY_REPEATS??20);if(!Number.isSafeInteger(repeats)||repeats<1||repeats>100)throw Error('Expected1-100 repeats');
const [rootArg,outArg]=process.argv.slice(2),root=resolve(rootArg),out=resolve(outArg);mkdirSync(out,{recursive:true});
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:4191,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});const page=await context.newPage();
await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4191'?r.continue():r.abort());await page.routeWebSocket('**/*',s=>s.close());
const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function ready(){const deadline=Date.now()+30000;for(;;){if(await page.locator('[data-action="start"]').getAttribute('aria-busy')!=='true'&&!await page.locator('[data-loading-screen]').isVisible())return;if(Date.now()>deadline)throw Error('Startup timeout');await page.clock.runFor(5);await new Promise(r=>setTimeout(r,5));}}
async function measure(){await cdp.send('HeapProfiler.collectGarbage');const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));return {heapBytes:metrics.JSHeapUsedSize,domNodes:metrics.Nodes,documents:metrics.Documents,listeners:metrics.JSEventListeners,resources:await page.evaluate(()=>window.stage3.resources())};}
async function retry(){await page.evaluate(()=>window.stage3.goal());await page.clock.runFor(200);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(32);await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}));await page.getByRole('button',{name:'もう一度',exact:true}).click();await ready();await page.clock.runFor(32);}
try{
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('http://127.0.0.1:4191/tests/fixtures/stage3.html');await page.getByRole('button',{name:'はじめる',exact:true}).click();await ready();
 await retry();const baseline=await measure(),rows=[];for(let i=0;i<repeats;i++){await retry();rows.push(await measure());}
 const result={repeats,method:'Chromium CDP fullGC, one warm clear/retry then the configured number of equivalent running states; virtual clock, not performance evidence',baseline,rows,heapDeltaBytes:rows.at(-1).heapBytes-baseline.heapBytes,errors,userAgent:await page.evaluate(()=>navigator.userAgent)};
 writeFileSync(`${out}/memory.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({heapDeltaBytes:result.heapDeltaBytes,baseline,final:rows.at(-1),errors}));
 await page.evaluate(()=>window.stage3.dispose());
 await page.goto('http://127.0.0.1:4191/tests/fixtures/rally.html');await page.waitForFunction(()=>!!window.rally);
 for(const score of [1500,3000]){await page.evaluate(score=>{window.rally.show(score);window.rally.legacyFireworks();window.rally.time(score===1500?26:20.75);},score);await page.screenshot({path:`${out}/visibility-${score}-30balls.png`,fullPage:true});}
}finally{await context.close();await browser.close();await server.close();}
