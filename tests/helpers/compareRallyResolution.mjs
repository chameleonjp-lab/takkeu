import { createServer } from 'vite';
import { chromium,webkit } from 'playwright';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const [before,after,output]=process.argv.slice(2);mkdirSync(output,{recursive:true});
const viewport=process.env.RALLY_VISUAL_PHONE?{width:402,height:874}:{width:1280,height:720};
const scores=process.env.RALLY_VISUAL_PHONE?[4000]:[500,1000,1500,2000,2500,2750,3000,3500,4000];
const rows=[],errors=[],blocked=[];
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true,...(engine==='chromium'?{args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}: {})});
 try{for(const [side,root] of [['before',before],['after',after]]){
  const server=await createServer({root,configFile:false,plugins:[{name:'test-only-batch-visibility',enforce:'pre',transform(code,id){if(id.endsWith('/src/render/createView.ts'))return {code:code.replace('renderer.render(scene, camera);',"scene.traverse(node=>{if(node.name===window.__visualHidden)node.visible=false;});renderer.render(scene, camera);"),map:null};}}],server:{host:'127.0.0.1',port:4176,strictPort:true,watch:{ignored:['**/docs/**','**/artifacts/**']}}});await server.listen();
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  await context.route('**/*',async r=>{if(new URL(r.request().url()).origin==='http://127.0.0.1:4176')await r.continue();else{blocked.push(r.request().url());await r.abort();}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto('http://127.0.0.1:4176/tests/fixtures/rally.html');await page.waitForFunction(()=>!!window.rally);
   for(const quality of ['standard','low'])for(const score of scores)for(const age of [.1,1.5,3.2]){
    const key=`${engine}-${quality}-${score}-${age.toFixed(1)}`,dir=path.join(output,side);mkdirSync(dir,{recursive:true});
    const captured=await page.evaluate(({quality,score,age})=>{window.rally.setQuality(quality);window.rally.reset(0);window.rally.arrive(score);const take=hidden=>{window.__visualHidden=hidden;return window.rally.capture(20+age);};const png=take(null);
    const hidden=Object.fromEntries(['rally-table-lines','rally-table-glow','rally-world-lines'].map(name=>[name,take(name)]));window.__visualHidden=null;
    const snapshot=window.rally.snapshot(),rect=document.querySelector('canvas').getBoundingClientRect();
    return {png,hidden,snapshot,state:window.rally.state(),stats:window.rally.stats(),centers:snapshot.balls.map(b=>window.rally.project(b.position)),css:{width:rect.width,height:rect.height},drawingSize:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height}};},{quality,score,age});
    const bytes=Buffer.from(captured.png.split(',')[1],'base64');writeFileSync(path.join(dir,key+'.png'),bytes);
    for(const [name,png] of Object.entries(captured.hidden))writeFileSync(path.join(dir,key+'-'+name+'.png'),Buffer.from(png.split(',')[1],'base64'));
    writeFileSync(path.join(dir,key+'.json'),JSON.stringify({...captured,png:undefined,hidden:undefined}));
    if(side==='after') {
     const oldPNG='data:image/png;base64,'+readFileSync(path.join(output,'before',key+'.png')).toString('base64');
     const diff=await page.evaluate(async({a,b})=>{const load=async s=>{const image=new Image();image.src=s;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return {width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data};};
      const x=await load(a),y=await load(b);let changed=0,max=0,total=0;for(let i=0;i<x.data.length;i++){const delta=Math.abs(x.data[i]-y.data[i]);if(delta)changed++;max=Math.max(max,delta);total+=delta;}
      return {sameSize:x.width===y.width&&x.height===y.height,changedChannels:changed,maxChannelDifference:max,meanAbsoluteDifference:total/x.data.length};},{a:oldPNG,b:captured.png});
     const old=JSON.parse(readFileSync(path.join(output,'before',key+'.json'),'utf8'));
     rows.push({key,...diff,sameSnapshot:JSON.stringify(old.snapshot)===JSON.stringify(captured.snapshot),sameState:JSON.stringify(old.state)===JSON.stringify(captured.state),sameStats:JSON.stringify(old.stats)===JSON.stringify(captured.stats),afterPNG_SHA256:createHash('sha256').update(bytes).digest('hex')});
     writeFileSync(path.join(output,'summary.json'),JSON.stringify({rows,errors,blocked},null,2));
     const energies=[];
     for(const name of Object.keys(captured.hidden)){
       const oldHidden='data:image/png;base64,'+readFileSync(path.join(output,'before',key+'-'+name+'.png')).toString('base64');
       const energy=await page.evaluate(async({fullA,hiddenA,fullB,hiddenB,centers,css})=>{
         const pixels=async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {w:c.width,h:c.height,data:ctx.getImageData(0,0,c.width,c.height).data};};
         const a=await pixels(fullA),ah=await pixels(hiddenA),b=await pixels(fullB),bh=await pixels(hiddenB);
         const ea=[0,0,0],eb=[0,0,0];for(let i=0;i<a.data.length;i+=4)for(let k=0;k<3;k++){ea[k]+=Math.abs(a.data[i+k]-ah.data[i+k]);eb[k]+=Math.abs(b.data[i+k]-bh.data[i+k]);}
         const cores=centers.filter(p=>p.inView).map(p=>{let white=0;const x=Math.round(p.x/css.width*b.w),y=Math.round(p.y/css.height*b.h);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const i=((y+dy)*b.w+x+dx)*4;white=Math.max(white,Math.min(b.data[i],b.data[i+1],b.data[i+2]));}return white;});
         return {before:ea,after:eb,ratios:ea.map((v,i)=>v?eb[i]/v:eb[i]===0?1:null),cores};
       },{fullA:oldPNG,hiddenA:oldHidden,fullB:captured.png,hiddenB:captured.hidden[name],centers:captured.centers,css:captured.css});energies.push({name,...energy});
     }
     const row=rows.at(-1);row.energies=energies;row.accepted=diff.sameSize&&row.sameSnapshot&&row.sameState&&row.sameStats&&(quality==='standard'||process.env.RALLY_VISUAL_PHONE?diff.changedChannels===0:energies.every(e=>e.ratios.every(r=>r!==null&&r>=.85&&r<=1.15)&&e.cores.every(v=>v>=200)));
     writeFileSync(path.join(output,'summary.json'),JSON.stringify({rows,errors,blocked},null,2));
    }
   }
   console.log(engine,side,`${scores.length*6} captures complete`);
  }finally{await context.close();await server.close();}
 }}finally{await browser.close();}
}
if(errors.length||blocked.length)throw Error(JSON.stringify({errors,blocked}));
console.log('visual comparisons',rows.length,'accepted',rows.filter(r=>r.accepted).length);if(rows.some(r=>!r.accepted))process.exitCode=1;
