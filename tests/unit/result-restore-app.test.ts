// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {createApp} from '../../src/app/createApp';
import {createSession} from '../../src/game/session';
import {DEFAULT_CONFIG} from '../../src/game/config';
import {createResultSnapshot} from '../../src/storage/resultSnapshot';
const cleanup:(()=>void)[]=[];afterEach(()=>{cleanup.splice(0).forEach(f=>f());vi.unstubAllGlobals();vi.useRealTimers()});
it('restored guest result is display-only; explicit home closes it across reload without score submission',async()=>{
 vi.useFakeTimers();vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>setTimeout(()=>cb(performance.now()),16));vi.stubGlobal('cancelAnimationFrame',(n:number)=>clearTimeout(n));
 const m=new Map<string,string>(),storage={getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v)}};
 const result=createResultSnapshot(storage);result.capture({...createSession(DEFAULT_CONFIG,7).snapshot(),phase:'gameover',score:17,lostBallCount:100,simTime:20,endReason:'loss'},false);result.save();
 const root=document.createElement('div');document.body.append(root);const session=createSession(DEFAULT_CONFIG,7),start=vi.spyOn(session,'start'),step=vi.spyOn(session,'step'),submit=vi.fn(async()=>{}),api={start:vi.fn(),startGuest:vi.fn(async()=>{}),finish:vi.fn(async()=>{}),submit,top:vi.fn(async()=>[]),position:async()=>null};
 const app=createApp(root,{storage,createSession:()=>session,rankingApi:api});cleanup.push(()=>{app.dispose();root.remove()});
 await vi.advanceTimersByTimeAsync(100);expect(root.querySelector<HTMLElement>('[data-result]')!.hidden).toBe(false);expect(root.querySelector('[data-result-score]')!.textContent).toBe('17');expect(start).not.toHaveBeenCalled();expect(step).not.toHaveBeenCalled();expect(submit).not.toHaveBeenCalled();expect(api.startGuest).not.toHaveBeenCalled();
 root.querySelector<HTMLButtonElement>('[data-result] [data-action="home"]')!.click();expect(createResultSnapshot(storage).load(createSession(DEFAULT_CONFIG,7).snapshot())).toBeNull();expect(m.has('takkeu.result.v1')).toBe(true);
});
