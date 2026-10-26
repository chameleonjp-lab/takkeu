import { createServer } from 'vite';
import { chromium, webkit } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Diagnostic scenes and synchronous readbacks are explicitly separate from RAF performance.
const [planPath,out]=process.argv.slice(2),plan=JSON.parse(readFileSync(planPath,'utf8'));
mkdirSync(out,{recursive:true});
const transforms={name:'render-audit-test-only',enforce:'pre',transform(code,id){
  if(!id.endsWith('/src/render/createView.ts'))return;
  let result=code.replace('  return {\n    prepare',`  window.__audit={renderer,scene,camera,objects,rallyEffects,fireworks,celebrations,cost:{},time(name,fn){const t=performance.now();const value=fn();this.cost[name]=performance.now()-t;return value;}};
  return {\n    prepare`);
  for(const call of ['applyPresentation(objects, snapshot,reducedMotion);','fireworks.update(snapshot,events,quality,reducedMotion,lowPriorityOpacity);','celebrations.update(snapshot,reducedMotion,lowPriorityOpacity);','rallyEffects.update(snapshot,effects,quality,reducedMotion);']){if(!result.includes(call))throw Error('Audit anchor missing '+call);result=result.replace(call,`window.__audit.time('${call.split('(')[0]}',()=>${call.slice(0,-1)});`);}
  return result;
}};
const results=[],pixelArtifacts=new Map();
for(const c of plan){
 const errors=[],blocked=[];let server,browser;
 try{
  server=await createServer({root:c.root,configFile:false,plugins:[transforms],server:{host:'127.0.0.1',port:4182,strictPort:true,watch:{ignored:['**/docs/**','**/artifacts/**']}}});await server.listen();
  browser=await (c.engine==='webkit'?webkit:chromium).launch({headless:true,...(c.engine==='webkit'?{}:{args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']})});
  const context=await browser.newContext({viewport:{width:c.width??402,height:c.height??874},deviceScaleFactor:c.dpr??2});
  await context.route('**/*',r=>{if(new URL(r.request().url()).origin==='http://127.0.0.1:4182')return r.continue();blocked.push(r.request().url());return r.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4182/tests/fixtures/rally.html');await page.waitForFunction(()=>window.rally);
  await page.evaluate(()=>{
   const a=window.__audit,gl=a.renderer.getContext();a.bytes=0;a.draws=0;a.vertices=0;
   for(const name of ['bufferData','bufferSubData']){const native=gl[name].bind(gl);gl[name]=(...args)=>{const data=args[name==='bufferData'?1:2],offset=args[3]??0,length=args[4];a.bytes+=typeof data==='number'?data:(length===undefined?data.byteLength-offset*(data.BYTES_PER_ELEMENT??1):length*(data.BYTES_PER_ELEMENT??1));return native(...args);};}
   for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const native=gl[name].bind(gl);gl[name]=(...args)=>{a.draws++;a.vertices+=args[name.startsWith('drawArrays')?2:1]*(name.endsWith('Instanced')?args.at(-1):1);return native(...args);};}
  });
  for(const scene of c.scenes){
   const data=await page.evaluate(async({scene,quality})=>{
    const a=window.__audit,r=window.rally,gl=a.renderer.getContext();
    r.setQuality(quality??'standard');r.show(scene.score);
    if(scene.loss)r.loss(scene.loss,scene.streak??4,true);
    if(scene.overlap)r.overlap(scene.score,99,4);
    if(scene.fireworks)r.legacyFireworks();
    r.time(20+(scene.age??.65));r.redraw();
    const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),query=ext?gl.createQuery():null;
    a.bytes=0;a.draws=0;a.vertices=0;
    if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    const start=performance.now();r.redraw();const cpuMs=performance.now()-start;
    if(query)gl.endQuery(ext.TIME_ELAPSED_EXT);
    const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
    gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const png=gl.canvas.toDataURL('image/png');
    const encode=bytes=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
    const geometry=[];a.scene.traverse(node=>{if(!node.geometry)return;const g=node.geometry,n=g.drawRange.count;geometry.push({name:node.name,type:node.type,visible:node.visible,drawRange:n===Infinity?null:n,vertices:g.attributes.position?.count,transparent:Array.isArray(node.material)?node.material.some(m=>m.transparent):node.material?.transparent});});
    const {Vector3,Matrix4}=await import('/node_modules/three/build/three.module.js');
    const projection=new Matrix4().multiplyMatrices(a.camera.projectionMatrix,a.camera.matrixWorldInverse);
    const culling=[];
    for(const name of ['rally-table-lines','rally-table-glow','rally-world-lines','rally-world-glow']){
      const mesh=a.scene.getObjectByName(name),g=mesh.geometry,count=g.drawRange.count;
      const matrix=new Matrix4().multiplyMatrices(projection,mesh.matrixWorld),p=g.attributes.position;
      let outside=0,partlyOutside=0;
      for(let start=0;start<count;start+=6){
        const points=Array.from({length:6},(_,i)=>new Vector3(p.getX(start+i),p.getY(start+i),p.getZ(start+i)).applyMatrix4(matrix));
        const out=[q=>q.x< -1,q=>q.x>1,q=>q.y< -1,q=>q.y>1,q=>q.z< -1,q=>q.z>1];
        if(out.some(plane=>points.every(plane)))outside++;else if(points.some(q=>out.some(plane=>plane(q))))partlyOutside++;
      }
      culling.push({name,quads:count/6,fullyOutside:outside,partlyOutside,method:'all six actual ribbon vertices; transformed table shake/camera; conservative clip-plane reject, never center-only'});
    }
    const geometryHashes=[];
    const meshes=[];a.scene.traverse(node=>{if(node.geometry)meshes.push(node);});
    for(const mesh of meshes){const g=mesh.geometry,count=Number.isFinite(g.drawRange.count)?g.drawRange.count:g.attributes.position.count;const row={name:mesh.name,type:mesh.type,count,attributes:{}};
      for(const [key,attribute] of Object.entries(g.attributes)){if(attribute.array){const bytes=new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,Math.min(attribute.count,count)*attribute.itemSize*attribute.array.BYTES_PER_ELEMENT);const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));row.attributes[key]=Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('');}}
      geometryHashes.push(row);
    }
    const result={width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,cpuMs,cpuCosts:{...a.cost},bytes:a.bytes,draws:a.draws,drawVertices:a.vertices,triangles:a.renderer.info.render.triangles,points:a.renderer.info.render.points,
     culling,geometryHashes,resources:r.resources(),snapshot:r.snapshot(),state:r.state(),geometry,pixels:encode(pixels),png,gpuMs:null,gpuDisjoint:null};
    if(query){for(let i=0;i<500&&!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE);i++)await new Promise(res=>setTimeout(res,5));result.gpuDisjoint=!!gl.getParameter(ext.GPU_DISJOINT_EXT);if(gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)&&!result.gpuDisjoint)result.gpuMs=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);}
    // Count transparent fragment invocations (including alpha=0) with the same
    // primitives, depth occlusion, side/pass ordering and projection. This is a
    // diagnostic override, not a change to production blending. Saturates at255.
    if(scene.overdraw){
     const {MeshBasicMaterial,AdditiveBlending,Color,NoToneMapping,LinearSRGBColorSpace}=await import('/node_modules/three/build/three.module.js');
     const saved=[];a.scene.traverse(node=>{if(!node.material)return;const original=node.material;
      const replace=m=>{const transparent=m.transparent;const copy=new MeshBasicMaterial({color:transparent?0xffffff:0,transparent,opacity:transparent?1/255:1,depthTest:m.depthTest,depthWrite:m.depthWrite,side:m.side,forceSinglePass:m.forceSinglePass,blending:transparent?AdditiveBlending:m.blending,toneMapped:false});return copy;};
      if(node.isPoints)return; // point-sprite fragment mask retained only in real capture, excluded from mesh counter
      saved.push([node,original,node.instanceColor]);node.material=Array.isArray(original)?original.map(replace):replace(original);if(node.instanceColor)node.instanceColor=null;
     });
     const background=a.scene.background,mapping=a.renderer.toneMapping,space=a.renderer.outputColorSpace;
     const points=[];a.scene.traverse(n=>{if(n.isPoints){points.push([n,n.visible]);n.visible=false;}});
     a.scene.background=new Color(0);a.renderer.toneMapping=NoToneMapping;a.renderer.outputColorSpace=LinearSRGBColorSpace;a.renderer.render(a.scene,a.camera);
     const heat=new Uint8Array(result.width*result.height*4);gl.readPixels(0,0,result.width,result.height,gl.RGBA,gl.UNSIGNED_BYTE,heat);
     const histogram=Array(256).fill(0);for(let i=0;i<heat.length;i+=4)histogram[heat[i]]++;
     result.overdraw={scope:'mesh transparent fragments; points excluded; includes zero-alpha fragments; MSAA edge coverage approximate; saturates at255',histogram,max:histogram.findLastIndex(x=>x>0),coveredPixels:histogram.slice(1).reduce((a,b)=>a+b,0),fragmentPixels:histogram.reduce((s,n,i)=>s+n*i,0)};
     for(const [node,original,instance] of saved){const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(m=>m.dispose());node.material=original;node.instanceColor=instance;}
     for(const [n,visible]of points)n.visible=visible;
     a.scene.background=background;a.renderer.toneMapping=mapping;a.renderer.outputColorSpace=space;r.redraw();
    }
    return result;
   },{scene,quality:c.quality});
   const prefix=`${c.label}-${scene.label??scene.score}`;
   const pixels=Buffer.from(data.pixels,'base64');delete data.pixels;
   const pixelSHA256=createHash('sha256').update(pixels).digest('hex');
   const pixelReference=pixelArtifacts.get(pixelSHA256)??prefix;
   if(!pixelArtifacts.has(pixelSHA256)){writeFileSync(`${out}/${prefix}.rgba.gz`,gzipSync(pixels));writeFileSync(`${out}/${prefix}.png`,Buffer.from(data.png.split(',')[1],'base64'));pixelArtifacts.set(pixelSHA256,prefix);}
   delete data.png;
   const row={configuration:c,scene,errors,blocked,browser:browser.version(),commit:execFileSync('git',['-C',c.root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pixelSHA256,pixelReference,...data};
   writeFileSync(`${out}/${prefix}.json`,JSON.stringify(row));results.push({label:prefix,...row,pixels:undefined});
   console.log(prefix,JSON.stringify({cpuMs:data.cpuMs,gpuMs:data.gpuMs,bytes:data.bytes,draws:data.draws,pixels:row.pixelSHA256,overdraw:data.overdraw}));
  }
 }finally{await browser?.close();await server?.close();}
}
writeFileSync(`${out}/summary.json`,JSON.stringify(results));
