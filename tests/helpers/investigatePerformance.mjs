import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Standalone, test-owned runner: no diagnostic path is imported by production.
const [planPath, output] = process.argv.slice(2);
const plan=JSON.parse(readFileSync(planPath,'utf8'));
mkdirSync(output,{recursive:true});
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const cpu=()=>readFileSync('/sys/fs/cgroup/cpu.stat','utf8');
const percentile=(a,p)=>a.length?[...a].sort((a,b)=>a-b)[Math.ceil(a.length*p)-1]:null;
function transforms(profile) { return {name:'test-only-performance',enforce:'pre',transform(code,id) {
  if(!id.endsWith('.ts'))return;
  let s=code;
  const replace=(from,to)=>{if(!s.includes(from))throw Error(`Instrumentation anchor missing ${id}: ${from}`);s=s.replace(from,to);};
  if(id.endsWith('/tests/helpers/appHarness.ts')) {
    s+='\nObject.assign(window.__perf,{unlockAudio:()=>currentAudio?.unlock()});\n';
    if(profile) {
      replace('const result = stepSimulation(state, DEFAULT_CONFIG, dt, autoPlay ? { target } : input);',"const result = window.__perf.time('simulation',()=>stepSimulation(state, DEFAULT_CONFIG, dt, autoPlay ? { target } : input));");
    }
  }
  if(id.endsWith('/src/app/createApp.ts')) {
    replace('  frameId = requestAnimationFrame(frame);\n  return {', `  frameId = requestAnimationFrame(frame);
  window.__perf.resetMeasurement=score=>{preferences={...preferences,bestScore:score};loop.resetClock(performance.now());};
  window.__perf.appState=()=>({bestScore:preferences.bestScore,effectBestAtStart:typeof effects==='undefined'?null:effects.state().bestAtStart});
  return {`);
  }
  if(profile && id.endsWith('/src/render/createView.ts')) {
    const presentationCall=s.match(/applyPresentation\(objects, snapshot[^;]*;/)?.[0];
    if(!presentationCall)throw Error('Missing presentation call');
    replace(presentationCall,`window.__perf.time('presentation',()=>${presentationCall.slice(0,-1)});`);
    if(s.includes('rallyEffects.update(snapshot,effects,quality,reducedMotion);'))
      replace('rallyEffects.update(snapshot,effects,quality,reducedMotion);',"if(!window.__perf.freezeReady || window.__perf.mode!=='freeze-effects') window.__perf.time('effects',()=>rallyEffects.update(snapshot,effects,quality,reducedMotion)); window.__perf.freezeReady=true;");
    replace('renderer.render(scene, camera);',`window.__perf.beforeGL(renderer,scene);const __submitStart=performance.now();renderer.render(scene,camera);window.__perf.cost.submit=performance.now()-__submitStart;window.__perf.afterGL(renderer);`);
  }
  if(profile && id.endsWith('/src/render/presentation.ts')) {
    replace('const points = geometry.attributes.position!;',"if(window.__perf.mode==='freeze-rainbow' && geometry.attributes.color)return; const points = geometry.attributes.position!;");
    const colorCall=s.includes('colorVertices(child.geometry, motionTime')?'colorVertices(child.geometry, motionTime,state.ownRandom':'colorVertices(child.geometry, snapshot.simTime,state.ownRandom';
    replace(colorCall,"window.__perf.time('rainbow',()=>"+colorCall);
    replace('?runSeed+partIndex*31:undefined);','?runSeed+partIndex*31:undefined));');
  }
  if(profile && id.endsWith('/src/render/balls.ts')) {
    replace('if (rainbow && visible.size) {',"if (rainbow && visible.size && !(window.__perf.mode==='freeze-rainbow' && window.__perf.ballColorReady)) { window.__perf.ballColorReady=true;");
  }
  if(profile && id.endsWith('/src/audio/audio.ts')) {
    replace("const startVoice = (play: typeof playPlayerHit, priority: VoicePriority, score: number) => {", "const startVoice = (play: typeof playPlayerHit, priority: VoicePriority, score: number) => { if(window.__perf.mode==='no-audio')return;");
  }
  if(profile && id.endsWith('/src/render/rallyEffects.ts')) {
    // Freeze background generation via cached batch commands. Uploads/draws remain.
    // This control isolates repeated maths, NOT the cost of copying data or drawing it.
    replace('const batches=[table,tableGlow,world,worldGlow];',`const batches=[table,tableGlow,world,worldGlow];
    const backgroundCache=new Map();
    function background(name,work){return window.__perf.time('background',()=>backgroundWork(name,work));}
    function backgroundWork(name,work){
      if(window.__perf.mode!=='static-background'){work();return;}
      const key=name+':'+density+':'+(score>=4000?4000:score>=3500?3500:score>=2750?2750:score>=2500?2500:2000);
      if(backgroundCache.has(key)){const entry=backgroundCache.get(key);for(const [batch,method,args] of entry.commands)batch[method](...args);particleCount+=entry.particles;return;}
      const commands=[],restores=[],particlesBefore=particleCount;
      for(const batch of batches)for(const method of ['line','rect','setOpacity']){const original=batch[method];restores.push(()=>batch[method]=original);batch[method]=(...args)=>{commands.push([batch,method,args]);return original(...args);};}
      try{work();}finally{for(const restore of restores)restore();}backgroundCache.set(key,{commands,particles:particleCount-particlesBefore});
    }`);
    replace('stars(transition);',"background('stars',()=>stars(transition));");
    replace('orbitRibbon();',"background('orbit',()=>orbitRibbon());");
    replace('multiHalos();',"background('multi',()=>multiHalos());");
    replace('tableHalos();',"background('table',()=>tableHalos());");
  }
  return s===code?null:{code:s,map:null};
}};}
function install({mode,profile}) {
  const p=window.__perf={mode,active:false,cost:{},frames:[],gpu:[],pending:[],freezeReady:false,ballColorReady:false,
    time(name,fn){const t=performance.now();try{return fn();}finally{if(this.active)this.cost[name]=(this.cost[name]??0)+performance.now()-t;}},
    beforeGL(renderer,scene){
      const gl=renderer.getContext();
      if(!this.gl){this.gl=gl;this.ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'); const dbg=gl.getExtension('WEBGL_debug_renderer_info');
        this.glInfo={version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),unmaskedRenderer:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):null,extensions:gl.getSupportedExtensions()};
        this.roots=['rally-table','rally-world'].map(name=>scene.getObjectByName(name)).filter(Boolean);
        this.uploadBytes=0;
        for(const name of ['bufferData','bufferSubData']){const original=gl[name].bind(gl);gl[name]=(...args)=>{const data=args[name==='bufferData'?1:2],offset=Number(args[3]??0),length=args[4];
          if(this.active)this.uploadBytes+=typeof data==='number'?data:data?.byteLength===undefined?0:length===undefined?data.byteLength-offset*(data.BYTES_PER_ELEMENT??1):length*(data.BYTES_PER_ELEMENT??1);
          return original(...args);};}
      }
      for(const root of this.roots)root.visible=mode!=='hide-effects';
      for(const item of [...this.pending]){if(gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE)){
        const disjoint=!!gl.getParameter(this.ext.GPU_DISJOINT_EXT);
        this.gpu.push({frame:item.frame,disjoint,ms:disjoint?null:gl.getQueryParameter(item.query,gl.QUERY_RESULT)/1e6});gl.deleteQuery(item.query);this.pending.splice(this.pending.indexOf(item),1);
      }}
      if(this.active && this.ext && this.pending.length<512){this.query=gl.createQuery();gl.beginQuery(this.ext.TIME_ELAPSED_EXT,this.query);}
    },
    afterGL(renderer){const gl=renderer.getContext();if(this.query){gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.pending.push({query:this.query,frame:this.frames.length});this.query=null;}
      if(this.active){this.frames.push({at:performance.now(),...this.cost,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,lines:renderer.info.render.lines,uploadBytes:this.uploadBytes});this.cost={};this.uploadBytes=0;}}
  };
  // Same native graph counter as the existing probe, installed before app creation.
  const live=new Set(),sources=new Set(),voices=new Set();let created=0,sourceCreated=0,peakNodes=0,peakSources=0,peakVoices=0;
  const Native=window.AudioContext;
  const instrument=(node,source=false,voice=false)=>{live.add(node);if(source){sources.add(node);sourceCreated++;}if(voice)voices.add(node);created++;
    peakNodes=Math.max(peakNodes,live.size);peakSources=Math.max(peakSources,sources.size);peakVoices=Math.max(peakVoices,voices.size);
    const disconnect=node.disconnect.bind(node);node.disconnect=()=>{live.delete(node);sources.delete(node);voices.delete(node);disconnect();};return node;};
  window.AudioContext=class extends Native {
    createOscillator(){return instrument(super.createOscillator(),true);}createBufferSource(){return instrument(super.createBufferSource(),true);}
    createGain(){return instrument(super.createGain());}createWaveShaper(){return instrument(super.createWaveShaper(),false,true);}
    createBiquadFilter(){return instrument(super.createBiquadFilter());}createDynamicsCompressor(){return instrument(super.createDynamicsCompressor());}
  };
  window.audioResources=()=>({created,sourceCreated,liveNodes:live.size,liveSources:sources.size,layeredVoices:voices.size,peakNodes,peakSources,peakVoices});
}
const summaries=[];
for(let n=0;n<plan.length;n++){
  const c={seconds:12,warmSeconds:3,score:4000,quality:'standard',dpr:1,mode:'normal',collector:'full',profile:true,audible:false,...plan[n]};
  const dest=path.join(output,`${String(n+1).padStart(3,'0')}-${c.label}`);
  console.log('START',n+1,JSON.stringify(c));
  let server,browser;
  const beforeCPU=cpu(), startedAt=new Date().toISOString();
  const sourceManifest=()=>Object.fromEntries(execFileSync('git',['-C',c.root,'ls-files','src'],{encoding:'utf8'}).trim().split('\n').map(f=>[f,sha(path.join(c.root,f))]));
  const initialSourceSHA256=sourceManifest();
  const errors=[],blocked=[];
  try {
    server=await createServer({root:c.root,configFile:false,plugins:[transforms(c.profile)],server:{host:'127.0.0.1',port:4176,strictPort:true,watch:{ignored:['**/docs/**','**/artifacts/**']}}});await server.listen();
    browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:c.dpr});
    await context.route('**/*',async route=>{if(new URL(route.request().url()).origin==='http://127.0.0.1:4176')await route.continue();else{blocked.push(route.request().url());await route.abort();}});
    await context.addInitScript(install,{mode:c.mode,profile:c.profile});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4176/tests/fixtures/stage3.html');
    await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByLabel('描画品質',{exact:true}).selectOption(c.quality);await page.getByRole('button',{name:'戻る',exact:true}).click();
    await page.getByRole('button',{name:'はじめる',exact:true}).click();
    await page.waitForFunction(()=>window.stage3?.snapshot().phase==='running',null,{timeout:60000});
    await page.evaluate(async ({score,audible})=>{window.stage3.show(score);window.__perf.freezeReady=false;window.stage3.autoPlay(true);if(audible)await window.__perf.unlockAudio();},c);
    await page.waitForTimeout(c.warmSeconds*1000);
    // Identical resource preparation, then reset only the test-owned initial scenario.
    await page.evaluate(async({score,audible})=>{window.stage3.show(score);window.__perf.resetMeasurement(score);window.__perf.freezeReady=false;window.stage3.autoPlay(true);if(audible)await window.__perf.unlockAudio();},c);
    const measurementCPUStart=cpu();
    const data=await page.evaluate(c=>new Promise(resolve=>{
      const heap=()=>performance.memory?.usedJSHeapSize??null;
      const initialApp=window.__perf.appState(),initial=window.stage3.snapshot(),initialResources=window.stage3.resources(),initialAudio=window.audioResources();
      const start=performance.now();let previous=start,previousPhase=initial.phase;
      const samples=[],intervals=[],runningIntervals=[],collectorCosts=[];
      window.__perf.active=true;window.__perf.frames=[];window.__perf.cost={};window.__perf.uploadBytes=0;
      function frame(now){
        const t=performance.now(),interval=now-previous;previous=now;intervals.push(interval);
        const snapshot=c.collector==='off'?null:window.stage3.snapshot();
        if(snapshot){if(previousPhase==='running'&&snapshot.phase==='running')runningIntervals.push(interval);previousPhase=snapshot.phase;}
        if(snapshot)samples.push({wallMs:now-start,intervalMs:interval,simTime:snapshot.simTime,phase:snapshot.phase,pauseReason:snapshot.pauseReason,
          ballCount:snapshot.balls.length,activeBalls:snapshot.balls.filter(b=>b.phase!=='lost').length,score:snapshot.score,
          ...(c.collector==='full'?{resources:window.stage3.resources(),audio:window.audioResources(),heapBytes:heap()}:{} )});
        collectorCosts.push(performance.now()-t);
        if(now-start<c.seconds*1000){requestAnimationFrame(frame);return;}
        window.__perf.active=false;
        const final=window.stage3.snapshot();
        resolve({durationMs:now-start,initialApp,finalApp:window.__perf.appState(),initial,final,initialResources,finalResources:window.stage3.resources(),initialAudio,finalAudio:window.audioResources(),
          heapBytes:heap(),intervals,runningIntervals,samples,collectorCosts,cpuFrames:window.__perf.frames,gpu:window.__perf.gpu,pendingGPU:window.__perf.pending.length,
          glInfo:window.__perf.glInfo??null,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},drawingSize:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height}});
      }requestAnimationFrame(frame);
    }),c);
    const measurementCPUEnd=cpu();
    const drained=await page.evaluate(async()=>{
      const p=window.__perf,until=performance.now()+10000;
      // No new measured queries are issued; app guards remain active. Read pending measured work asynchronously.
      while(p.pending.length&&performance.now()<until){
        const gl=p.gl;
        for(const item of [...p.pending])if(gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE)){
          const disjoint=!!gl.getParameter(p.ext.GPU_DISJOINT_EXT);p.gpu.push({frame:item.frame,disjoint,ms:disjoint?null:gl.getQueryParameter(item.query,gl.QUERY_RESULT)/1e6});gl.deleteQuery(item.query);p.pending.splice(p.pending.indexOf(item),1);
        }
        if(p.pending.length)await new Promise(r=>setTimeout(r,10));
      }
      return {gpu:p.gpu,pending:p.pending.length};
    });data.gpu=drained.gpu;data.pendingGPU=drained.pending;
    const sourceFiles=execFileSync('git',['-C',c.root,'ls-files','src'],{encoding:'utf8'}).trim().split('\n');
    const sourceSHA256=Object.fromEntries(sourceFiles.map(f=>[f,sha(path.join(c.root,f))]));
    const summary={initialSourceSHA256,sourceStable:JSON.stringify(initialSourceSHA256)===JSON.stringify(sourceSHA256),measurementCPUStart,measurementCPUEnd,sourceSHA256,label:c.label,configuration:c,startedAt,finishedAt:new Date().toISOString(),commit:execFileSync('git',['-C',c.root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),
      sourceTree:execFileSync('git',['-C',c.root,'rev-parse','HEAD:src'],{encoding:'utf8'}).trim(),runnerSHA256:sha(import.meta.filename),browser:browser.version(),
      errors,blocked,beforeCPU,afterCPU:cpu(),durationMs:data.durationMs,frames:data.intervals.length,p50Ms:percentile(data.intervals,.5),p95Ms:percentile(data.intervals,.95),p99Ms:percentile(data.intervals,.99),
      fraction25:data.intervals.filter(n=>n<=25).length/data.intervals.length,simulationSeconds:data.final.simTime-data.initial.simTime,
      finalPhase:data.final.phase,initialBalls:data.initial.balls.length,remainingBalls:data.final.balls.filter(b=>b.phase!=='lost').length,
      everySampleRunning30:c.collector==='off'?null:data.samples.every(s=>s.phase==='running'&&s.activeBalls===30),
      initialAudio:data.initialAudio,finalAudio:data.finalAudio,drawingSize:data.drawingSize,glInfo:data.glInfo,
      collectorP50Ms:percentile(data.collectorCosts,.5),collectorP95Ms:percentile(data.collectorCosts,.95),
      costs:Object.fromEntries(['simulation','presentation','rainbow','effects','background','submit','uploadBytes','drawCalls','triangles'].map(k=>[k,{p50:percentile(data.cpuFrames.map(f=>f[k]??0),.5),p95:percentile(data.cpuFrames.map(f=>f[k]??0),.95)}])),
      gpu:{frames:data.cpuFrames.length,issued:data.gpu.length+data.pendingGPU,valid:data.gpu.filter(g=>g.ms!==null).length,invalid:data.gpu.filter(g=>g.ms===null).length,pending:data.pendingGPU,p50Ms:percentile(data.gpu.filter(g=>g.ms!==null).map(g=>g.ms),.5)},
      absoluteTarget:data.initial.phase==='running'&&data.initial.balls.filter(b=>b.phase!=='lost').length===30&&data.durationMs>=60000&&data.final.simTime-data.initial.simTime>=59&&data.samples.length>0&&data.samples.every(s=>s.phase==='running'&&s.activeBalls===30)&&percentile(data.intervals,.95)<=25&&data.intervals.filter(n=>n<=25).length/data.intervals.length>=.95};
    writeFileSync(dest+'.json.gz',gzipSync(JSON.stringify({summary,data})));summaries.push(summary);writeFileSync(path.join(output,'summary.json'),JSON.stringify(summaries,null,2));
    console.log('RESULT',c.label,summary.p50Ms,summary.p95Ms,summary.simulationSeconds,'audioSources',data.finalAudio.sourceCreated-data.initialAudio.sourceCreated,JSON.stringify(summary.costs));
    if(errors.length||blocked.length)throw Error('page errors or unexpected requests');
  }catch(error){writeFileSync(dest+'-failure.json',JSON.stringify({configuration:c,startedAt,error:String(error),errors,blocked,beforeCPU,afterCPU:cpu()},null,2));console.error(error);throw error;}
  finally{await browser?.close();await server?.close();}
}
