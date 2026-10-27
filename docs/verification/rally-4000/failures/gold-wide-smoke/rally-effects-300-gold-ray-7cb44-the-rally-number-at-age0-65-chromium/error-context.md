# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rally-effects.spec.ts >> 300 gold rays visibly radiate behind the rally number at age0.65
- Location: tests/browser/rally-effects.spec.ts:147:1

# Error details

```
Error: at least80pixels show >=15%red/+10%green/-5%blue gold contribution

expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 80
Received:    0
```

# Page snapshot

```yaml
- main [ref=e1]:
  - generic [ref=e2]:
    - generic "卓球ゲームの描画領域" [active] [ref=e5]
    - generic:
      - generic:
        - generic: RALLY
        - status "ラリー数": "300"
      - generic:
        - generic: 残球数
        - status "残球数": "2"
      - generic:
        - generic: 落球数
        - status "落球数": 0 / 100
      - paragraph [aria-hidden]:
        - generic: 300 RALLY · ラリーの猛者、現る！
      - status
    - generic:
      - generic:
        - status: プレイ中。残球数2。
```

# Test source

```ts
  60  |     }
  61  |     expect(JSON.stringify(shapes[0]),`${score} geometry changes over simulation time`).not.toBe(JSON.stringify(shapes[2]));
  62  |   }
  63  |   await page.evaluate(()=>{window.rally.show(4000,20.7);window.rally.pause();});
  64  |   const paused=await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),geometry:window.rally.geometry()}));
  65  |   await page.evaluate(()=>{window.rally.advance(10);window.rally.redraw();window.rally.replayHit();window.rally.restore();});
  66  |   expect(await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),geometry:window.rally.geometry()}))).toEqual(paused);
  67  |   await page.emulateMedia({reducedMotion:'reduce'});
  68  |   await page.evaluate(()=>{window.rally.resume();window.rally.reset(4001);window.rally.time(26);});
  69  |   const reduced=await page.evaluate(()=>window.rally.geometry());
  70  |   await page.evaluate(()=>window.rally.time(27));
  71  |   expect(await page.evaluate(()=>window.rally.geometry())).toEqual(reduced);
  72  |   await page.screenshot({path:resolve(directory,'4001-reduced-motion.png')});
  73  |   writeFileSync(resolve(directory,'geometry-sequence.json'),JSON.stringify(rows,null,2));
  74  |   await info.attach('target-geometry-sequences',{body:JSON.stringify(rows),contentType:'application/json'});
  75  | });
  76  | 
  77  | test('losses keep actual distinct positions, number lifetimes and final drawing without advancing balls',async({page},info)=>{
  78  |   test.setTimeout(180_000);
  79  |   const directory=resolve(evidenceRoot,info.project.name,'losses');mkdirSync(directory,{recursive:true});
  80  |   const rows:object[]=[];
  81  |   for(const count of [1,4,10,20,30,40,50,55,77,88,90,99,100]){
  82  |     await page.evaluate(count=>window.rally.loss(count,count===4||count===100?4:1,count===4),count);
  83  |     const initial=await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),stats:window.rally.stats(),geometry:window.rally.geometry()}));
  84  |     expect(initial.state.losses.at(-1)?.count).toBe(count);
  85  |     expect(initial.state.cues.some(c=>c.kind==='loss-spark')).toBe(true);
  86  |     if(count===4){
  87  |       expect(new Set(initial.state.losses.map(loss=>JSON.stringify(loss.position))).size).toBeGreaterThan(1);
  88  |       expect(new Set(initial.state.losses.map(loss=>loss.at)).size).toBe(1);
  89  |       expect(initial.state.cues.some(c=>c.kind==='loss-impact')).toBe(true);
  90  |     }
  91  |     for(const offset of [.05,.25,.65]){
  92  |       await page.evaluate(offset=>window.rally.time(window.rally.state().losses.at(-1)!.at+offset),offset);
  93  |       await page.screenshot({path:resolve(directory,`${count}-${offset.toFixed(2)}.png`)});
  94  |       rows.push({count,offset,state:await page.evaluate(()=>window.rally.state()),stats:await page.evaluate(()=>window.rally.stats())});
  95  |     }
  96  |     if(count===100){
  97  |       await page.evaluate(()=>window.rally.finish());
  98  |       const final=await page.evaluate(()=>window.rally.snapshot());expect(await page.evaluate(()=>window.rally.finishing())).toBe(true);
  99  |       await page.evaluate(()=>window.rally.advance(.5));
  100 |       expect(await page.evaluate(()=>window.rally.snapshot())).toEqual(final);
  101 |       await page.screenshot({path:resolve(directory,'100-finishing.png')});
  102 |       await page.evaluate(()=>window.rally.advance(5));expect(await page.evaluate(()=>window.rally.finishing())).toBe(false);
  103 |     }
  104 |   }
  105 |   writeFileSync(resolve(directory,'loss-frames.json'),JSON.stringify(rows,null,2));
  106 | });
  107 | 
  108 | test('mobile, landscape, 200% text, best and smash warning keep controls and readable four-digit scores',async({page},info)=>{
  109 |   test.setTimeout(120_000);
  110 |   const directory=resolve(evidenceRoot,info.project.name,'layout');mkdirSync(directory,{recursive:true});
  111 |   for(const [width,height,fontPercent] of [[320,568,100],[390,844,100],[844,390,100],[390,844,200]]){
  112 |     await page.setViewportSize({width:width!,height:height!});
  113 |     await page.evaluate(percent=>document.documentElement.style.fontSize=`${percent}%`,fontPercent);
  114 |     await page.evaluate(()=>{window.rally.reset(3999,3999);window.rally.arrive(4000);window.rally.time(20.65);window.rally.warning();});
  115 |     const bounds=await page.evaluate(()=>{
  116 |       const rect=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  117 |       return {score:rect('[data-score]'),toast:rect('[data-rally-notice]'),warning:rect('[data-smash-warning]'),
  118 |         pointer:getComputedStyle(document.querySelector('[data-rally-notice]')!).pointerEvents,
  119 |         scroll:document.documentElement.scrollWidth,width:innerWidth,live:document.querySelector('[data-rally-live]')!.textContent};
  120 |     });
  121 |     expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);expect(bounds.score.right).toBeLessThanOrEqual(bounds.width);
  122 |     expect(bounds.pointer).toBe('none');expect(bounds.live).toBe('4000 RALLY');
  123 |     expect(bounds.toast.y>=bounds.warning.bottom||bounds.toast.right<=bounds.warning.x||bounds.toast.bottom<=bounds.warning.y).toBe(true);
  124 |     await page.screenshot({path:resolve(directory,`${width}x${height}-text${fontPercent}.png`)});
  125 |   }
  126 | });
  127 | 
  128 | test('major labels fit at their largest initial scale with 200% text on 320px screens',async({page},info)=>{
  129 |   await page.setViewportSize({width:320,height:568});
  130 |   await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  131 |   const directory=resolve(evidenceRoot,info.project.name,'layout');mkdirSync(directory,{recursive:true});
  132 |   for(const score of [1000,2000,3000,4000]){
  133 |     await page.evaluate(score=>window.rally.show(score),score);
  134 |     const bounds=await page.evaluate(()=>{
  135 |       const game=document.querySelector('[data-game]')!.getBoundingClientRect();
  136 |       const wrapper=document.querySelector('[data-rally-notice]')!.getBoundingClientRect();
  137 |       const label=document.querySelector('.rally-toast-label')!.getBoundingClientRect();
  138 |       return {game:{left:game.left,right:game.right,top:game.top,bottom:game.bottom},wrapper:{left:wrapper.left,right:wrapper.right,top:wrapper.top,bottom:wrapper.bottom},label:{left:label.left,right:label.right,top:label.top,bottom:label.bottom}};
  139 |     });
  140 |     await page.screenshot({path:resolve(directory,`${score}-320x568-text200-age0.png`)});
  141 |     expect(bounds.label.left).toBeGreaterThanOrEqual(bounds.game.left);expect(bounds.label.right).toBeLessThanOrEqual(bounds.game.right);
  142 |     expect(bounds.label.top).toBeGreaterThanOrEqual(bounds.game.top);expect(bounds.label.bottom).toBeLessThanOrEqual(bounds.game.bottom);
  143 |     expect(bounds.wrapper.left).toBeGreaterThanOrEqual(bounds.game.left);expect(bounds.wrapper.right).toBeLessThanOrEqual(bounds.game.right);
  144 |   }
  145 | });
  146 | 
  147 | test('300 gold rays visibly radiate behind the rally number at age0.65',async({page},info)=>{
  148 |   await page.evaluate(()=>window.rally.show(300,20.65));
  149 |   const host=await page.locator('.rally-score-host').boundingBox();
  150 |   if(!host)throw new Error('Missing score host');
  151 |   const clip={x:Math.max(0,Math.floor(host.x-12)),y:Math.max(0,Math.floor(host.y-12)),width:Math.ceil(host.width+24),height:Math.ceil(host.height+24)};
  152 |   const withAura=await page.screenshot({clip});
  153 |   await page.locator('.rally-score-aura').evaluate(element=>(element as HTMLElement).style.visibility='hidden');
  154 |   const withoutAura=await page.screenshot({clip});
  155 |   await page.locator('.rally-score-aura').evaluate(element=>(element as HTMLElement).style.visibility='visible');
  156 |   const measured=goldContribution(withAura,withoutAura);
  157 |   await info.attach('gold-ray-with-aura',{body:withAura,contentType:'image/png'});
  158 |   await info.attach('gold-ray-without-aura',{body:withoutAura,contentType:'image/png'});
  159 |   await info.attach('gold-ray-pixel-measurement',{body:JSON.stringify(measured),contentType:'application/json'});
> 160 |   expect(measured.count,'at least80pixels show >=15%red/+10%green/-5%blue gold contribution').toBeGreaterThanOrEqual(80);
      |                                                                                               ^ Error: at least80pixels show >=15%red/+10%green/-5%blue gold contribution
  161 |   expect(measured.quadrants.filter(count=>count>=10).length,'gold spokes radiate across at least3 quadrants').toBeGreaterThanOrEqual(3);
  162 | });
  163 | 
```