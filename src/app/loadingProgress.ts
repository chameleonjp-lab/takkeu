export type LoadingState = Readonly<{percent:number;stage:string;remainingSeconds:number|null;elapsedSeconds:number;error:string|null}>;
type Stage='court'|'sound'|'ranking'|'controls';
const stages:Record<Stage,{weight:number;label:string}>={
  court:{weight:60,label:'コートとラケットを準備しています'},sound:{weight:10,label:'効果音を準備しています'},
  ranking:{weight:10,label:'ランキングを確認しています'},controls:{weight:20,label:'スタート位置を合わせています'},
};
export function createLoadingProgress(now:()=>number=()=>performance.now()){
  const startedAt=now(),completed:Record<Stage,number>={court:0,sound:0,ranking:0,controls:0};
  let stage:Stage='court',done=false;
  return{
    report(next:Stage,fraction:number){stage=next;completed[next]=Math.max(completed[next],Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:0)));},
    finish(){done=true;},
    state(error:string|null=null):LoadingState{
      const percent=done?100:Math.min(99,Math.floor(Object.entries(completed).reduce((sum,[key,value])=>sum+stages[key as Stage].weight*value,0)));
      const elapsedSeconds=Math.max(0,(now()-startedAt)/1000);
      const remainingSeconds=done?0:elapsedSeconds>=10?null:Math.max(1,Math.ceil(percent>=10?elapsedSeconds*(100-percent)/percent:4-elapsedSeconds));
      return{percent,stage:stages[stage].label,remainingSeconds,elapsedSeconds,error};
    },
  };
}
const aborted=()=>new DOMException('準備を中断しました','AbortError');
/** Bound each dependency and remove timers/listeners even after cancellation. */
export function waitForPreparation<T>(work:Promise<T>,timeoutMs:number,signal:AbortSignal):Promise<T>{
  return new Promise((resolve,reject)=>{
    let timer:ReturnType<typeof setTimeout>|undefined,settled=false;
    const finish=(success:boolean,value:unknown)=>{
      if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);
      if(success)resolve(value as T);else reject(value);
    };
    const cancel=()=>finish(false,aborted());
    signal.addEventListener('abort',cancel,{once:true});
    // Attach both handlers even when already aborted, so a late rejection is owned.
    work.then(value=>finish(true,value),error=>finish(false,error));
    if(signal.aborted){cancel();return;}
    timer=setTimeout(()=>finish(false,new Error('準備に時間がかかっています。もう一度お試しください。')),timeoutMs);
  });
}
/** The first frame paints the loading screen; heavy work starts after it. */
export function nextPaint(signal:AbortSignal,raf:typeof requestAnimationFrame=requestAnimationFrame,cancelRaf:typeof cancelAnimationFrame=cancelAnimationFrame):Promise<void>{
  return new Promise((resolve,reject)=>{
    let frame=0,settled=false;
    const cleanup=()=>{signal.removeEventListener('abort',cancel);};
    const cancel=()=>{if(settled)return;settled=true;cancelRaf(frame);cleanup();reject(aborted());};
    signal.addEventListener('abort',cancel,{once:true});
    if(signal.aborted){cancel();return;}
    frame=raf(()=>{if(settled)return;frame=raf(()=>{if(settled)return;settled=true;cleanup();resolve();});});
  });
}
