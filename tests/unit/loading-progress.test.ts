import { expect,it,vi,afterEach } from 'vitest';
import { createLoadingProgress, waitForPreparation, nextPaint } from '../../src/app/loadingProgress';
afterEach(()=>vi.useRealTimers());

it('実作業の完了率で進み、残り時間は目安として計算し、長引いたら経過時間へ切り替える',()=>{
  let now=0;const p=createLoadingProgress(()=>now);
  expect(p.state()).toMatchObject({percent:0,elapsedSeconds:0,error:null});
  p.report('court',.5);now=2000;
  expect(p.state().percent).toBe(30);expect(p.state().remainingSeconds).toBeGreaterThan(0);
  p.report('court',.2);expect(p.state().percent).toBe(30);
  p.report('court',1);p.report('sound',1);p.report('ranking',1);p.report('controls',.5);
  expect(p.state().percent).toBe(90);
  now=15000;expect(p.state()).toMatchObject({elapsedSeconds:15,remainingSeconds:null});
  p.finish();expect(p.state()).toMatchObject({percent:100,remainingSeconds:0});
});

it('準備の完了・失敗・キャンセル・期限で待機を解放し、タイマーと購読を回収する',async()=>{
  vi.useFakeTimers();const abort=new AbortController();
  expect(await waitForPreparation(Promise.resolve(7),1000,abort.signal)).toBe(7);
  expect(vi.getTimerCount()).toBe(0);
  await expect(waitForPreparation(Promise.reject(new Error('gpu')),1000,abort.signal)).rejects.toThrow('gpu');
  await expect(waitForPreparation(Promise.reject(undefined),1000,abort.signal)).rejects.toBeUndefined();
  const pending=waitForPreparation(new Promise(()=>{}),1000,abort.signal);
  const canceled=expect(pending).rejects.toMatchObject({name:'AbortError'});abort.abort();await canceled;
  expect(vi.getTimerCount()).toBe(0);
  const timeout=waitForPreparation(new Promise(()=>{}),1000,new AbortController().signal);
  const rejected=expect(timeout).rejects.toThrow('準備に時間がかかっています');
  await vi.advanceTimersByTimeAsync(1000);await rejected;expect(vi.getTimerCount()).toBe(0);
});

it('画面を一度描いてから重い準備へ進み、キャンセルでRAFを回収する',async()=>{
  const callbacks=new Map<number,FrameRequestCallback>();let id=0;
  const raf=(cb:FrameRequestCallback)=>{callbacks.set(++id,cb);return id;};
  const cancel=(token:number)=>{callbacks.delete(token);};
  const signal=new AbortController();let ready=false;
  const painted=nextPaint(signal.signal,raf,cancel).then(()=>{ready=true;});
  callbacks.get(1)!(0);expect(ready).toBe(false);callbacks.get(2)!(16);await painted;expect(ready).toBe(true);
  const pending=nextPaint(signal.signal,raf,cancel);const canceled=expect(pending).rejects.toMatchObject({name:'AbortError'});
  signal.abort();await canceled;expect(callbacks.has(3)).toBe(false);
});
