import { expect, test } from '../helpers/browserTest';
import type { CDPSession } from '@playwright/test';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/languages';
import type {} from '../helpers/i18nHarness';

test('i18n repeated language batches retain bounded DOM, listeners and collected JavaScript heap', async ({ page, browserName }, info) => {
  await page.goto('/tests/fixtures/i18n.html');
  const ids=SUPPORTED_LANGUAGES.map(({id})=>id);
  const switchBatch=async(count:number)=>page.evaluate(({ids,count})=>{
    for(let i=0;i<count;i++) window.i18nHarness.language(ids[i%ids.length]!);
    return {elements:document.querySelectorAll('*').length,state:window.i18nHarness.state()};
  },{ids,count});
  await switchBatch(30); // Warm every bounded locale/format cache before measuring.
  let cdp:CDPSession|undefined;
  if(browserName==='chromium') cdp=await page.context().newCDPSession(page);
  const measure=async()=>{
    if(!cdp) return {heapBytes:null,counters:null,method:'WebKit: DOM and resource ownership; no exposed heap API'};
    await cdp.send('HeapProfiler.collectGarbage');
    const heap=await cdp.send('Runtime.getHeapUsage'), counters=await cdp.send('Memory.getDOMCounters');
    return {heapBytes:heap.usedSize as number,counters,method:'Chromium CDP after explicit collection'};
  };
  try {
    const beforeState=await switchBatch(15),before=await measure();
    const firstState=await switchBatch(150),first=await measure();
    const secondState=await switchBatch(150),second=await measure();
    expect(firstState).toEqual(beforeState);expect(secondState).toEqual(beforeState);
    if(before.heapBytes!==null&&first.heapBytes!==null&&second.heapBytes!==null){
      // Allow bounded engine/Intl bookkeeping; catch retained per-switch allocations.
      expect(second.heapBytes-before.heapBytes).toBeLessThan(2*1024*1024);
      expect(second.heapBytes-first.heapBytes).toBeLessThan(1024*1024);
      expect(first.counters).toEqual(before.counters);expect(second.counters).toEqual(before.counters);
    }
    await info.attach('i18n-memory-batches.json',{body:JSON.stringify({browserName,warmSwitches:45,batchSize:150,before,first,second,domElements:beforeState.elements},null,2),contentType:'application/json'});
  } finally {await cdp?.detach();}
});
