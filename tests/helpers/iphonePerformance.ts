import { installAudioProbe } from './audioProbe';

const diagnosticErrors:{type:string;message:string}[]=[];
window.addEventListener('error',event=>diagnosticErrors.push({type:'error',message:event.message}));
window.addEventListener('unhandledrejection',event=>diagnosticErrors.push({type:'unhandledrejection',message:String(event.reason)}));
// LAN HTTP lacks the secure-context-only randomUUID API. Keep the compatibility
// shim in this test entrypoint; production ranking/identity code is unchanged.
if(typeof crypto.randomUUID!=='function')Object.defineProperty(crypto,'randomUUID',{value:()=>{
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]!&15)|64;bytes[8]=(bytes[8]!&63)|128;
  const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}});

// Test entrypoint only. No server/database writes, even if a URL contains ?ranking.
const originalFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  if(url.origin!==location.origin)return Promise.reject(new Error('実機診断: 外部通信を遮断しました'));
  return originalFetch(input,init);
};
installAudioProbe();
await import('./appHarness');
const panel=document.createElement('section');
panel.setAttribute('aria-label','実機診断専用');
panel.style.cssText='position:fixed;z-index:10000;inset:auto 8px 8px;background:#fff;color:#111;padding:12px;max-height:70vh;overflow:auto;font:16px system-ui;border:2px solid #222';
panel.innerHTML='<strong>実機診断専用・本番配布禁止</strong><p>ゲームを開始してから計測します。計測中はこのパネルを隠します。</p><label>開始ラリー <select data-score><option>1500</option><option>2600</option><option>3000</option><option>4000</option></select></label> <label><input type="checkbox" data-auto checked>30球自動返球（性能測定用）</label><p>画質・音量はゲームの設定で選択してください。</p><button data-measure>60秒計測</button> <button data-close>パネルを閉じる</button><pre data-result style="white-space:pre-wrap"></pre><a data-save hidden>測定JSONを保存</a>';
const toggle=document.createElement('button');toggle.textContent='診断';toggle.style.cssText='position:fixed;right:8px;bottom:8px;z-index:9999';
toggle.onclick=()=>{panel.hidden=false;};panel.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>{panel.hidden=true;};
document.body.append(toggle,panel);
let savedURL='';
panel.querySelector<HTMLButtonElement>('[data-measure]')!.onclick=()=>{
  const result=panel.querySelector<HTMLElement>('[data-result]')!;
  if(window.stage3.snapshot().phase!=='running'){result.textContent='先に「パネルを閉じる」→ゲームの「はじめる」で開始してください。';return;}
  const score=Number(panel.querySelector<HTMLSelectElement>('[data-score]')!.value),autoplay=panel.querySelector<HTMLInputElement>('[data-auto]')!.checked;
  window.stage3.show(score);window.stage3.autoPlay(autoplay);
  const initial=window.stage3.snapshot(),initialAudio=window.audioResources(),start=performance.now();let previous=start;
  const samples:{wallMs:number;intervalMs:number;simTime:number;phase:string;pauseReason:string|null;score:number;balls:number}[]=[];
  panel.hidden=true;toggle.hidden=true;
  function frame(now:number){
    const state=window.stage3.snapshot();samples.push({wallMs:now-start,intervalMs:now-previous,simTime:state.simTime,phase:state.phase,pauseReason:state.pauseReason,score:state.score,balls:state.balls.filter(b=>b.phase!=='lost').length});previous=now;
    if(now-start<60000){requestAnimationFrame(frame);return;}
    const sorted=samples.map(s=>s.intervalMs).sort((a,b)=>a-b),p=(fraction:number)=>sorted[Math.ceil(sorted.length*fraction)-1]!;
    const data={schema:'iphone-real-device-v1',time:new Date().toISOString(),userAgent:navigator.userAgent,secureContext:isSecureContext,errors:diagnosticErrors,devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},drawingSize:{width:document.querySelector('canvas')!.width,height:document.querySelector('canvas')!.height},
      initialScore:score,autoplay,durationMs:now-start,p50Ms:p(.5),p95Ms:p(.95),p99Ms:p(.99),fraction25:sorted.filter(x=>x<=25).length/sorted.length,simulationSeconds:state.simTime-initial.simTime,continuousRunning30:samples.every(s=>s.phase==='running'&&s.balls===30),finalPhase:state.phase,pauseReason:state.pauseReason,initialAudio,finalAudio:window.audioResources(),resources:window.stage3.resources(),samples,
      note:'実機で開いた場合のみ実機測定。入力遅延・視認性・音質・温度は人間の別記録が必要。Linux比較とは初期化/収集方式が異なる。'};
    result.textContent=JSON.stringify({...data,samples:`${samples.length}件（保存JSONに全件）`},null,2);
    if(savedURL)URL.revokeObjectURL(savedURL);savedURL=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const save=panel.querySelector<HTMLAnchorElement>('[data-save]')!;save.href=savedURL;save.download=`takkeu-iphone-${score}-${Date.now()}.json`;save.hidden=false;panel.hidden=false;toggle.hidden=false;
  }
  requestAnimationFrame(frame);
};
