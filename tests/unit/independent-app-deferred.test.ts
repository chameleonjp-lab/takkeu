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
  const store=new Map<string,string>();
  const app=createApp(root,{createSession:()=>session,createView:()=>view,createAudio:()=>audio,storage:{getItem:k=>store.get(k)??null,setItem(k,v){store.set(k,v)}},
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

it('real game-over before start ACK keeps named result and late ACK never reruns game',async()=>{const t=setup({named:true,rankControlled:true});t.click('[data-action="start"]');await vi.advanceTimersByTimeAsync(200);expect(t.requests).toHaveLength(1);expect(t.session.snapshot().phase).toBe('running');for(let i=0;i<5000&&t.session.snapshot().phase==='running';i++)t.session.step(DEFAULT_CONFIG.fixedDt,{target:{x:1,y:.1}});await vi.advanceTimersByTimeAsync(20);const final=t.session.snapshot();expect(final.phase).toBe('gameover');expect(t.results).toHaveLength(0);t.requests[0]!.resolve();await vi.advanceTimersByTimeAsync(0);expect(t.results).toHaveLength(1);expect(t.results[0]).toMatchObject({score:final.score,lostBalls:final.lostBallCount,resultType:'game_over',play:{displayName:'テスト',startId:t.requests[0]!.startId}});expect(t.session.snapshot()).toEqual(final);});
