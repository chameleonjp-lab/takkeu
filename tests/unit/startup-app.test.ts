// @vitest-environment jsdom
import { afterEach,expect,it,vi } from 'vitest';
import { createApp } from '../../src/app/createApp';
import { createSession } from '../../src/game/session';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { GameView } from '../../src/render/createView';
import type { PendingResult,Play } from '../../src/ranking/client';

const cleanup:(()=>void)[]=[];
afterEach(()=>{for(const dispose of cleanup.splice(0))dispose();vi.unstubAllGlobals();vi.useRealTimers();});
function setup({validLayout=true,silent=false,named=false,rankControlled=false}:{validLayout?:boolean;silent?:boolean;named?:boolean;rankControlled?:boolean}={}){
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>setTimeout(()=>cb(performance.now()),16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));
  const root=document.createElement('div');document.body.append(root);
  const session=createSession(DEFAULT_CONFIG,7),results:PendingResult[]=[];
  const play:Play={startId:'11111111-1111-4111-8111-111111111111',playId:'22222222-2222-4222-8222-222222222222',displayName:'テスト',normalizedName:'テスト'};
  const requests:{startId:string;play:Play;resolve():void}[]=[],accepted=new Map<string,Play>();
  const mapping={screen:{left:0,top:0,width:390,height:844},isCurrent:()=>true,toWorld:()=>({x:0,y:.5})};
  const view:GameView={prepare:async()=>{},render(){},resize(){},inputMapping:()=>mapping,setQuality(){},resources:()=>({geometries:0,textures:0,programs:0,drawCalls:0,particles:0,particleCapacity:1536}),dispose(){}};
  const audio={prepare:()=>silent?new Promise<boolean>(()=>{}):Promise.resolve(true),unlock:async()=>true,consume(){},setVolume(){},setMuted(){},suspend(){},reset(){},dispose:async()=>{}};
  const app=createApp(root,{createSession:()=>session,createView:()=>view,createAudio:()=>audio,storage:{getItem:()=>null,setItem(){}},
    rankingApi:{position:async()=>null,start:async startId=>{
      if(!rankControlled)return play;
      let record=accepted.get(startId);
      if(!record){record={...play,startId,playId:`22222222-2222-4222-8222-${String(accepted.size+1).padStart(12,'0')}`};accepted.set(startId,record);}
      const value=record;
      return new Promise<Play>(resolve=>{requests.push({startId,play:value,resolve:()=>resolve(value)});});
    },startGuest:async()=>{},finish:async result=>{results.push(result);},submit:async()=>{},top:async()=>[]}});
  root.querySelector('.canvas-wrap')!.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:validLayout?390:0,height:validLayout?844:0,right:390,bottom:844,toJSON(){return{};}});
  if(named)root.querySelector<HTMLInputElement>('[data-player-name]')!.value='テスト';
  const click=(selector:string)=>root.querySelector<HTMLButtonElement>(selector)!.click();
  cleanup.push(()=>{app.dispose();root.remove();});
  return{root,session,results,requests,click,setLayout(value:boolean){validLayout=value;}};
}

it.each(['pause','result','home'])('準備済みなら%sから案内を出さず次の描画フレームを待たず開始する',async(from)=>{
  const t=setup();t.click('[data-action="start"]');await vi.advanceTimersByTimeAsync(200);
  const previousRun=t.session.snapshot().runId;
  if(from==='result'){
    // The real session ends when every ball is missed.
    for(let i=0;i<3000&&t.session.snapshot().phase==='running';i++)t.session.step(DEFAULT_CONFIG.fixedDt,{target:{x:1,y:.1}});
    await vi.advanceTimersByTimeAsync(3000);
    expect(t.session.snapshot().phase).toBe('gameover');
    expect(t.root.querySelector<HTMLElement>('[data-result]')!.hidden).toBe(false);
  }else{
    t.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    if(from==='home')t.click('[data-action="home"]');
  }
  t.click(from==='home'?'[data-action="start"]':from==='result'?'[data-result] [data-action="retry"]':'[data-action="retry"]');
  expect(t.root.querySelector<HTMLElement>('[data-loading-screen]')!.hidden).toBe(true);
  await vi.advanceTimersByTimeAsync(0);
  const next=t.session.snapshot();
  expect(next.phase).toBe('running');expect(next.simTime).toBe(0);expect(next.score).toBe(0);expect(next.lostBallCount).toBe(0);
  expect(next.balls).toHaveLength(1);expect(next.runId).not.toBe(previousRun);
  expect(t.root.querySelector<HTMLElement>('[data-loading-screen]')!.hidden).toBe(true);
});

it.each([0,180])('準備済みのランキング応答が%s msなら必要な間だけ案内し、応答後は描画フレームを待たない',async(delay)=>{
  const t=setup({named:true,rankControlled:true});t.click('[data-action="start"]');await vi.advanceTimersByTimeAsync(100);
  t.requests[0]!.resolve();await vi.advanceTimersByTimeAsync(100);
  t.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  const before=t.session.snapshot();t.click('[data-action="retry"]');await vi.advanceTimersByTimeAsync(0);
  expect(t.requests).toHaveLength(2);expect(t.session.snapshot()).toEqual(before);
  expect(t.root.querySelector<HTMLElement>('[data-loading-screen]')!.hidden).toBe(true);
  if(delay){
    await vi.advanceTimersByTimeAsync(100);
    expect(t.root.querySelector<HTMLElement>('[data-loading-screen]')!.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(80);
    expect(t.session.snapshot()).toEqual(before);
    expect(t.root.querySelector<HTMLElement>('[data-loading-screen]')!.hidden).toBe(false);
    expect(t.root.querySelector('[data-loading-stage]')!.textContent).toContain('ランキング');
  }
  t.requests[1]!.resolve();await vi.advanceTimersByTimeAsync(0);
  expect(t.session.snapshot().phase).toBe('running');expect(t.session.snapshot().simTime).toBe(0);
  expect(t.root.querySelector<HTMLElement>('[data-loading-screen]')!.hidden).toBe(true);
});

it.each([false,true])('準備済み開始の案内表示前の中断・表示後のキャンセルで遅い応答から開始しない（表示済み%s）',async(shown)=>{
  const t=setup({named:true,rankControlled:true});t.click('[data-action="start"]');await vi.advanceTimersByTimeAsync(100);
  t.requests[0]!.resolve();await vi.advanceTimersByTimeAsync(100);
  t.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  t.click('[data-action="retry"]');await vi.advanceTimersByTimeAsync(0);expect(t.requests).toHaveLength(2);
  if(shown){await vi.advanceTimersByTimeAsync(180);t.click('[data-loading-action="cancel"]');}
  else window.dispatchEvent(new Event('blur'));
  t.requests[1]!.resolve();await vi.advanceTimersByTimeAsync(1000);
  expect(t.session.snapshot().phase).toBe(shown?'ready':'paused');
  expect(t.results.filter(row=>row.play.playId===t.requests[1]!.play.playId)).toHaveLength(1);
  if(shown)expect(t.root.querySelector<HTMLElement>('[data-loading-screen]')!.hidden).toBe(true);
  else expect(t.root.querySelector('[data-loading-screen] [role="alert"]')!.textContent).toContain('中断');
});

it('準備済みでも現在のコート寸法が0なら古い有効な操作座標で開始しない',async()=>{
  const t=setup();t.click('[data-action="start"]');await vi.advanceTimersByTimeAsync(200);
  t.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));t.click('[data-action="home"]');
  t.setLayout(false);t.click('[data-action="start"]');await vi.advanceTimersByTimeAsync(200);
  expect(t.session.snapshot().phase).toBe('ready');
  expect(t.root.querySelector<HTMLElement>('[data-loading-screen]')!.hidden).toBe(false);
  expect(t.root.querySelector('[data-loading-stage]')!.textContent).toContain('スタート位置');
  t.setLayout(true);await vi.advanceTimersByTimeAsync(100);
  expect(t.session.snapshot().phase).toBe('running');
});

it('音声の準備が返らなくても期限後は無音で開始し、操作の準備を完了する',async()=>{
  const t=setup({silent:true});t.click('[data-action="start"]');
  await vi.advanceTimersByTimeAsync(1500);expect(t.session.snapshot().phase).toBe('ready');
  await vi.advanceTimersByTimeAsync(650);expect(t.session.snapshot().phase).toBe('running');
  expect(t.root.querySelector<HTMLElement>('[data-loading-screen]')!.hidden).toBe(true);
  expect(t.root.querySelector<HTMLElement>('[data-audio-notice]')!.hidden).toBe(false);
});

it.each([false,true])('キャンセル後の同名開始で古い応答が新しいプレイの得点を終了させない（旧応答先行%s）',async(oldFirst)=>{
  const t=setup({named:true,rankControlled:true});t.click('[data-action="start"]');await vi.advanceTimersByTimeAsync(100);
  expect(t.requests).toHaveLength(1);t.click('[data-loading-action="cancel"]');
  t.click('[data-action="start"]');await vi.advanceTimersByTimeAsync(100);expect(t.requests).toHaveLength(2);
  if(oldFirst){t.requests[0]!.resolve();await vi.advanceTimersByTimeAsync(10);}
  t.requests[1]!.resolve();await vi.advanceTimersByTimeAsync(3000);
  expect(t.session.snapshot().phase).toBe('running');expect(t.session.snapshot().score).toBeGreaterThan(0);
  if(!oldFirst){t.requests[0]!.resolve();await vi.advanceTimersByTimeAsync(10);}
  t.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));t.click('[data-action="home"]');
  await vi.advanceTimersByTimeAsync(10);
  expect(t.results.find(row=>row.play.playId===t.requests[1]!.play.playId)?.score).toBeGreaterThan(0);
  expect(new Set(t.results.map(row=>row.play.playId)).size).toBe(2);
});

it('ランキング開始後に操作座標の準備をキャンセルしても開始済み記録を一度だけ閉じる',async()=>{
  const t=setup({validLayout:false,named:true});t.click('[data-action="start"]');
  await vi.advanceTimersByTimeAsync(100);
  expect(t.root.querySelector('[data-loading-stage]')!.textContent).toContain('スタート位置');
  t.click('[data-loading-action="cancel"]');await vi.advanceTimersByTimeAsync(100);
  expect(t.session.snapshot().phase).toBe('ready');
  expect(t.results).toHaveLength(1);expect(t.results[0]).toMatchObject({resultType:'retire',score:0});
  await vi.advanceTimersByTimeAsync(5000);expect(t.results).toHaveLength(1);expect(t.session.snapshot().phase).toBe('ready');
});

it('表示サイズが確定しない場合は期限で再試行へ進み、開始済み記録と準備用RAFを回収する',async()=>{
  const t=setup({validLayout:false,named:true});t.click('[data-action="start"]');
  await vi.advanceTimersByTimeAsync(5200);
  expect(t.session.snapshot().phase).toBe('ready');
  expect(t.root.querySelector('[data-loading-screen] [role="alert"]')!.textContent).toContain('準備に時間がかかっています');
  expect(t.results).toHaveLength(1);expect(t.results[0]!.resultType).toBe('retire');
  expect(vi.getTimerCount()).toBe(1);
});
