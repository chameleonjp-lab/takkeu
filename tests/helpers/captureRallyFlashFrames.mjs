import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Start the normal Vite dev server separately. No production test URL is used.
const baseURL=process.env.RALLY_FLASH_BASE_URL??'http://127.0.0.1:4173';
const output=resolve(process.env.RALLY_FLASH_OUTPUT??'docs/verification/rally-4000/safety/captures');
const files=['tests/helpers/rallyHarness.ts','src/render/createView.ts','src/render/rallyEffects.ts','src/render/celebrations.ts','src/render/presentation.ts','src/render/field.ts','src/render/rainbow.ts','src/game/rallyEffects.ts','src/game/celebrations.ts'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
const sourceHashes=hashes();
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1024,height:768},deviceScaleFactor:1});
await context.routeWebSocket('**/*',socket=>socket.close());
const unexpected=[];
await context.route('**/*',route=>{
  if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();
  unexpected.push(route.request().url());return route.abort();
});
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(`${baseURL}/tests/fixtures/rally.html`);await page.waitForFunction(()=>!!window.rally);
const fps=60,seconds=6,sequences=[];
try{
  if(process.env.RALLY_FLASH_MODE!=='worst-only')for(const quality of ['standard','low'])for(const score of [1500,2000,3000,4000]){
    const name=`${score}-${quality}`,directory=resolve(output,name);mkdirSync(directory,{recursive:true});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(({score,quality})=>{window.rally.setQuality(quality);window.rally.overlap(score,99);},{score,quality});
    await page.screenshot({path:resolve(directory,'page-context.png')});
    for(let frame=0;frame<fps*seconds;frame++){
      const png=await page.evaluate(time=>window.rally.capture(time),20+frame/fps);
      writeFileSync(resolve(directory,`${String(frame).padStart(4,'0')}.png`),Buffer.from(png.split(',')[1],'base64'));
    }
    const metadata=await page.evaluate(()=>({snapshot:window.rally.snapshot(),state:window.rally.state(),resources:window.rally.resources(),stats:window.rally.stats(),userAgent:navigator.userAgent,drawingSize:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height}}));
    const sequence={name,score,quality,reducedMotion:false,fps,seconds,width:1024,height:768,frames:fps*seconds,source:'actual unchanged camera canvas drawn at explicit simTime increments; synthetic stress stacking of legacy and new effects',...metadata};
    writeFileSync(resolve(directory,'capture.json'),JSON.stringify(sequence,null,2));sequences.push(sequence);
    process.stdout.write(`${name}: ${fps*seconds} frames captured\n`);
  }
  if(process.env.RALLY_FLASH_MODE!=='worst-only')for(const quality of ['standard','low']){
    const name=`4000-${quality}-reduced`,directory=resolve(output,name);mkdirSync(directory,{recursive:true});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(quality=>{window.rally.setQuality(quality);window.rally.overlap(4000,99);},quality);
    for(let frame=0;frame<fps*seconds;frame++){
      const png=await page.evaluate(time=>window.rally.capture(time),20+frame/fps);
      writeFileSync(resolve(directory,`${String(frame).padStart(4,'0')}.png`),Buffer.from(png.split(',')[1],'base64'));
    }
    const sequence={name,score:4000,quality,reducedMotion:true,fps,seconds,width:1024,height:768,frames:fps*seconds};
    writeFileSync(resolve(directory,'capture.json'),JSON.stringify(sequence,null,2));sequences.push(sequence);
    process.stdout.write(`${name}: ${fps*seconds} frames captured\n`);
  }
  for(const quality of ['standard','low']){
    const name=`4000-${quality}-legacy100`,directory=resolve(output,name);mkdirSync(directory,{recursive:true});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(quality=>{window.rally.setQuality(quality);window.rally.overlap(4000,100,100);},quality);
    for(let frame=0;frame<fps*seconds;frame++){
      const png=await page.evaluate(time=>window.rally.capture(time),20+frame/fps);
      writeFileSync(resolve(directory,`${String(frame).padStart(4,'0')}.png`),Buffer.from(png.split(',')[1],'base64'));
    }
    const sequence={name,score:4000,loss:100,legacyLossStreak:100,quality,reducedMotion:false,fps,seconds,width:1024,height:768,frames:fps*seconds,syntheticStress:true};
    writeFileSync(resolve(directory,'capture.json'),JSON.stringify(sequence,null,2));sequences.push(sequence);
    process.stdout.write(`${name}: ${fps*seconds} frames captured\n`);
  }
  const endSourceHashes=hashes(),sourceStable=JSON.stringify(sourceHashes)===JSON.stringify(endSourceHashes);
  writeFileSync(resolve(output,'capture-run.json'),JSON.stringify({sequences,errors,unexpected,sourceHashes,endSourceHashes,sourceStable,limitations:['Canvas analysis excludes CSS HUD; its labels have single-arrival transitions, assessed separately.','Sampling at60Hz measures content clock, not monitor hardware artifacts.','Linux software rendering does not certify device/HDR behavior.']},null,2));
  if(errors.length||unexpected.length||!sourceStable)throw new Error(JSON.stringify({errors,unexpected,sourceStable}));
}finally{await browser.close();}
