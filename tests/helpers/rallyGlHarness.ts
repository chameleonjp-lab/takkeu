import { Scene, Vector4 } from 'three';
import type { Mesh, MeshBasicMaterial, Object3D } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createView } from '../../src/render/createView';
import type { GameEvent } from '../../src/game/types';
import type { Quality } from '../../src/storage/preferences';
import { rallyPerformanceReplay } from './rallyPerformanceReplay';

// Diagnostic only: capture the real private scene without adding production APIs.
const canvas=document.querySelector<HTMLCanvasElement>('canvas')!;
const gl=canvas.getContext('webgl2',{antialias:true,alpha:false})!;
const scenes:Scene[]=[],add=Scene.prototype.add;
Scene.prototype.add=(function(this:Scene,...objects:Object3D[]){if(!scenes.includes(this))scenes.push(this);return add.apply(this,objects);}) as typeof add;
let view:ReturnType<typeof createView>;
try{view=createView(canvas,DEFAULT_CONFIG);}finally{Scene.prototype.add=add;}
const scene=scenes[0]!,roots=[scene.getObjectByName('rally-table')!,scene.getObjectByName('rally-world')!];
const meshes:Mesh[]=[];
for(const root of roots)root.traverse(object=>{if('isMesh' in object)meshes.push(object as Mesh);});
type Mode='normal'|'single-pass'|'hidden'|'scissor';
let mode:Mode='normal';
const scissor=new Vector4();
for(const mesh of meshes){
  mesh.onBeforeRender=renderer=>{if(mode==='scissor'){renderer.getScissor(scissor);renderer.setScissorTest(true);renderer.setScissor(0,0,0,0);}};
  mesh.onAfterRender=renderer=>{if(mode==='scissor'){renderer.setScissor(scissor);renderer.setScissorTest(false);}};
}
type Counters={drawCalls:number;drawVertices:number;drawMs:number;bufferDataCalls:number;bufferDataBytes:number;bufferSubDataCalls:number;bufferSubDataBytes:number;uploadMs:number;uploadsByCapacity:Record<string,number>};
const fresh=():Counters=>({drawCalls:0,drawVertices:0,drawMs:0,bufferDataCalls:0,bufferDataBytes:0,bufferSubDataCalls:0,bufferSubDataBytes:0,uploadMs:0,uploadsByCapacity:{}});
let counters=fresh();
const bound=new Map<number,WebGLBuffer|null>(),capacities=new Map<WebGLBuffer,number>();
const api=gl as unknown as Record<string,(...args:unknown[])=>unknown>;
function bytes(data:unknown,offset=0,length?:number){
  if(typeof data==='number')return data;
  if(data instanceof ArrayBuffer)return data.byteLength;
  if(ArrayBuffer.isView(data)){
    const perElement='BYTES_PER_ELEMENT' in data?Number(data.BYTES_PER_ELEMENT):1;
    return length===undefined?Math.max(0,data.byteLength-offset*perElement):length*perElement;
  }
  return 0;
}
const bind=api.bindBuffer!;api.bindBuffer=function(...args){bound.set(Number(args[0]),args[1] as WebGLBuffer|null);return bind.apply(gl,args);};
for(const name of ['bufferData','bufferSubData','drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
  const native=api[name]!;
  api[name]=function(...args){
    const start=performance.now();
    try{return native.apply(gl,args);}finally{
      const elapsed=performance.now()-start;
      if(name==='bufferData'){
        const amount=bytes(args[1],Number(args[3]??0),args[4]===undefined?undefined:Number(args[4]));
        const buffer=bound.get(Number(args[0]));if(buffer)capacities.set(buffer,amount);
        counters.bufferDataCalls++;counters.bufferDataBytes+=amount;counters.uploadMs+=elapsed;
      }else if(name==='bufferSubData'){
        const amount=bytes(args[2],Number(args[3]??0),args[4]===undefined?undefined:Number(args[4]));
        const buffer=bound.get(Number(args[0])),capacity=buffer?capacities.get(buffer):undefined;
        counters.bufferSubDataCalls++;counters.bufferSubDataBytes+=amount;counters.uploadMs+=elapsed;
        const key=String(capacity??'unknown');counters.uploadsByCapacity[key]=(counters.uploadsByCapacity[key]??0)+amount;
      }else{
        counters.drawCalls++;counters.drawMs+=elapsed;
        counters.drawVertices+=Number(args[name.startsWith('drawArrays')?2:1])*(name.endsWith('Instanced')?Number(args.at(-1)):1);
      }
    }
  };
}
const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
const frames=rallyPerformanceReplay(4000,30,2);
const activeHits=(frame:typeof frames[number])=>frame.state.hits.filter(hit=>frame.snapshot.simTime>=hit.at&&frame.snapshot.simTime<hit.at+.3).length;
let peakIndex=0;
for(let i=1;i<frames.length;i++)if(activeHits(frames[i]!)>activeHits(frames[peakIndex]!))peakIndex=i;
const inputs={peak:peakIndex,middle:Math.floor(frames.length/2)};
view.resize(1280,720);
await view.prepare!(()=>{});
function input(name:keyof typeof inputs,quality:Quality){
  const index=inputs[name],frame=frames[index]!,runId=`gl-profile-${name}-${quality}`;
  const events:GameEvent[]=frames.slice(0,index+1).flatMap(row=>row.events).filter(event=>frame.snapshot.simTime-event.time<.7)
    .map(event=>({...event,id:`${runId}:${event.id}`,runId}));
  return {snapshot:{...frame.snapshot,runId},state:{...frame.state,runId},events,index,activeHits:activeHits(frame)};
}
function configure(next:Mode){
  mode=next;
  for(const root of roots)root.visible=next!=='hidden';
  for(const mesh of meshes)(mesh.material as MeshBasicMaterial).forceSinglePass=next==='single-pass';
}
function pixels(){const data=new Uint8Array(1280*720*4);gl.readPixels(0,0,1280,720,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;}
const harness={
  defaultContribution(){
    // Do not configure material flags: this checks the actual production default.
    const frozen=input('middle','standard');view.setQuality('standard');
    for(const root of roots)root.visible=true;
    for(let warm=0;warm<2;warm++){view.render(frozen.snapshot,frozen.events,frozen.state);gl.finish();}
    counters=fresh();view.render(frozen.snapshot,frozen.events,frozen.state);gl.finish();
    const visible={...counters,rendererCalls:view.resources().drawCalls};
    for(const root of roots)root.visible=false;
    counters=fresh();view.render(frozen.snapshot,frozen.events,frozen.state);gl.finish();
    const hidden={...counters,rendererCalls:view.resources().drawCalls};
    for(const root of roots)root.visible=true;
    return {visible,hidden,contribution:visible.drawCalls-hidden.drawCalls,
      snapshot:{score:frozen.snapshot.score,simTime:frozen.snapshot.simTime,balls:frozen.snapshot.balls.length}};
  },
  async profile(name:keyof typeof inputs,quality:Quality,frameCount=8){
    const frozen=input(name,quality);view.setQuality(quality);
    const blocks:{mode:Mode;samples:object[];resources:ReturnType<typeof view.resources>}[]=[];
    let normalPixels:Uint8Array|null=null,singlePixels:Uint8Array|null=null;
    const captures:Record<string,string>={};
    for(const next of ['normal','single-pass','single-pass','normal','hidden','scissor'] as Mode[]){
      configure(next);
      for(let warm=0;warm<2;warm++){view.render(frozen.snapshot,frozen.events,frozen.state);gl.finish();}
      const samples:object[]=[];
      for(let frame=0;frame<frameCount;frame++){
        counters=fresh();const query=timer?gl.createQuery():null;
        if(query)gl.beginQuery(timer.TIME_ELAPSED_EXT,query);
        const start=performance.now();view.render(frozen.snapshot,frozen.events,frozen.state);const rendered=performance.now();
        if(query)gl.endQuery(timer.TIME_ELAPSED_EXT);
        gl.finish();const finished=performance.now();
        const gpuMs=query&&gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)&&!gl.getParameter(timer.GPU_DISJOINT_EXT)?Number(gl.getQueryParameter(query,gl.QUERY_RESULT))/1e6:null;
        if(query)gl.deleteQuery(query);
        samples.push({renderSubmitMs:rendered-start,finishWaitMs:finished-rendered,totalMs:finished-start,gpuMs,...counters});
      }
      blocks.push({mode:next,samples,resources:view.resources()});
      if(next==='normal'&&!normalPixels){normalPixels=pixels();captures.normal=canvas.toDataURL('image/png');}
      if(next==='single-pass'&&!singlePixels){singlePixels=pixels();captures.single=canvas.toDataURL('image/png');}
    }
    let changed=0,maxChannelDifference=0,totalDifference=0;
    for(let i=0;i<normalPixels!.length;i++){
      const difference=Math.abs(normalPixels![i]!-singlePixels![i]!);if(difference)changed++;maxChannelDifference=Math.max(maxChannelDifference,difference);totalDifference+=difference;
    }
    configure('normal');
    return {diagnosticOnly:true,canvas:{width:1280,height:720},timerQueryAvailable:Boolean(timer),quality,name,
      snapshot:{score:frozen.snapshot.score,simTime:frozen.snapshot.simTime,balls:frozen.snapshot.balls.length,phase:frozen.snapshot.phase,activeHits:frozen.activeHits,index:frozen.index},
      interpretation:'Synchronous frozen-frame GL finish measurements isolate render work; they are not the real-loop performance acceptance test.',blocks,
      pixelDifference:{changedChannels:changed,maxChannelDifference,meanAbsoluteDifference:totalDifference/normalPixels!.length},captures};
  },
};
declare global{interface Window{rallyGl:typeof harness}}
window.rallyGl=harness;
