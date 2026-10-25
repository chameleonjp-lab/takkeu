# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rally-effects.spec.ts >> major labels fit at their largest initial scale with 200% text on 320px screens
- Location: tests/browser/rally-effects.spec.ts:127:1

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 320
Received:    649.6000366210938
```

# Page snapshot

```yaml
- main [ref=e1]:
  - generic [ref=e2]:
    - generic "卓球ゲームの描画領域" [active] [ref=e5]
    - generic:
      - generic:
        - generic: RALLY
        - status "ラリー数": "1000"
      - generic:
        - generic: 残球数
        - status "残球数": "2"
      - generic:
        - generic: 落球数
        - status "落球数": 0 / 100
      - paragraph [aria-hidden]: 1000 RALLY
      - status: 1000 RALLY
    - generic:
      - generic:
        - status: プレイ中。残球数2。
```

# Test source

```ts
  39  |       rows.push({threshold,phase,offset,screenshot:filename,...record});
  40  |     }
  41  |   }
  42  |   writeFileSync(resolve(directory,'frames.json'),JSON.stringify(rows,null,2));
  43  |   await info.attach('all-threshold-camera-metadata',{body:JSON.stringify(rows),contentType:'application/json'});
  44  |   expect(errors).toEqual([]);
  45  | });
  46  | 
  47  | test('moving background/electricity/rings: time sequences, deterministic restore and reduced motion',async({page},info)=>{
  48  |   test.setTimeout(180_000);
  49  |   const directory=resolve(evidenceRoot,info.project.name,'motion');mkdirSync(directory,{recursive:true});
  50  |   const rows:object[]=[];
  51  |   for(const score of [500,700,1000,1250,1500,1750,2000,2250,2500,2750,3000,3250,3500,3750,4000]){
  52  |     await page.evaluate(score=>window.rally.show(score),score);
  53  |     const shapes:unknown[]=[];
  54  |     for(const offset of [.1,.35,.8,1.4]){
  55  |       await page.evaluate(offset=>window.rally.time(20+offset),offset);
  56  |       const geometry=await page.evaluate(()=>window.rally.geometry());shapes.push(geometry);
  57  |       await page.screenshot({path:resolve(directory,`${score}-${offset.toFixed(2)}.png`)});
  58  |       rows.push({score,offset,geometry,stats:await page.evaluate(()=>window.rally.stats())});
  59  |     }
  60  |     expect(JSON.stringify(shapes[0]),`${score} geometry changes over simulation time`).not.toBe(JSON.stringify(shapes[2]));
  61  |   }
  62  |   await page.evaluate(()=>{window.rally.show(4000,20.7);window.rally.pause();});
  63  |   const paused=await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),geometry:window.rally.geometry()}));
  64  |   await page.evaluate(()=>{window.rally.advance(10);window.rally.redraw();window.rally.replayHit();window.rally.restore();});
  65  |   expect(await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),geometry:window.rally.geometry()}))).toEqual(paused);
  66  |   await page.emulateMedia({reducedMotion:'reduce'});
  67  |   await page.evaluate(()=>{window.rally.resume();window.rally.reset(4001);window.rally.time(26);});
  68  |   const reduced=await page.evaluate(()=>window.rally.geometry());
  69  |   await page.evaluate(()=>window.rally.time(27));
  70  |   expect(await page.evaluate(()=>window.rally.geometry())).toEqual(reduced);
  71  |   await page.screenshot({path:resolve(directory,'4001-reduced-motion.png')});
  72  |   writeFileSync(resolve(directory,'geometry-sequence.json'),JSON.stringify(rows,null,2));
  73  |   await info.attach('target-geometry-sequences',{body:JSON.stringify(rows),contentType:'application/json'});
  74  | });
  75  | 
  76  | test('losses keep actual distinct positions, number lifetimes and final drawing without advancing balls',async({page},info)=>{
  77  |   test.setTimeout(180_000);
  78  |   const directory=resolve(evidenceRoot,info.project.name,'losses');mkdirSync(directory,{recursive:true});
  79  |   const rows:object[]=[];
  80  |   for(const count of [1,4,10,20,30,40,50,55,77,88,90,99,100]){
  81  |     await page.evaluate(count=>window.rally.loss(count,count===4||count===100?4:1,count===4),count);
  82  |     const initial=await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),stats:window.rally.stats(),geometry:window.rally.geometry()}));
  83  |     expect(initial.state.losses.at(-1)?.count).toBe(count);
  84  |     expect(initial.state.cues.some(c=>c.kind==='loss-spark')).toBe(true);
  85  |     if(count===4){
  86  |       expect(new Set(initial.state.losses.map(loss=>JSON.stringify(loss.position))).size).toBeGreaterThan(1);
  87  |       expect(new Set(initial.state.losses.map(loss=>loss.at)).size).toBe(1);
  88  |       expect(initial.state.cues.some(c=>c.kind==='loss-impact')).toBe(true);
  89  |     }
  90  |     for(const offset of [.05,.25,.65]){
  91  |       await page.evaluate(offset=>window.rally.time(window.rally.state().losses.at(-1)!.at+offset),offset);
  92  |       await page.screenshot({path:resolve(directory,`${count}-${offset.toFixed(2)}.png`)});
  93  |       rows.push({count,offset,state:await page.evaluate(()=>window.rally.state()),stats:await page.evaluate(()=>window.rally.stats())});
  94  |     }
  95  |     if(count===100){
  96  |       await page.evaluate(()=>window.rally.finish());
  97  |       const final=await page.evaluate(()=>window.rally.snapshot());expect(await page.evaluate(()=>window.rally.finishing())).toBe(true);
  98  |       await page.evaluate(()=>window.rally.advance(.5));
  99  |       expect(await page.evaluate(()=>window.rally.snapshot())).toEqual(final);
  100 |       await page.screenshot({path:resolve(directory,'100-finishing.png')});
  101 |       await page.evaluate(()=>window.rally.advance(5));expect(await page.evaluate(()=>window.rally.finishing())).toBe(false);
  102 |     }
  103 |   }
  104 |   writeFileSync(resolve(directory,'loss-frames.json'),JSON.stringify(rows,null,2));
  105 | });
  106 | 
  107 | test('mobile, landscape, 200% text, best and smash warning keep controls and readable four-digit scores',async({page},info)=>{
  108 |   test.setTimeout(120_000);
  109 |   const directory=resolve(evidenceRoot,info.project.name,'layout');mkdirSync(directory,{recursive:true});
  110 |   for(const [width,height,fontPercent] of [[320,568,100],[390,844,100],[844,390,100],[390,844,200]]){
  111 |     await page.setViewportSize({width:width!,height:height!});
  112 |     await page.evaluate(percent=>document.documentElement.style.fontSize=`${percent}%`,fontPercent);
  113 |     await page.evaluate(()=>{window.rally.reset(3999,3999);window.rally.arrive(4000);window.rally.time(20.65);window.rally.warning();});
  114 |     const bounds=await page.evaluate(()=>{
  115 |       const rect=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  116 |       return {score:rect('[data-score]'),toast:rect('[data-rally-notice]'),warning:rect('[data-smash-warning]'),
  117 |         pointer:getComputedStyle(document.querySelector('[data-rally-notice]')!).pointerEvents,
  118 |         scroll:document.documentElement.scrollWidth,width:innerWidth,live:document.querySelector('[data-rally-live]')!.textContent};
  119 |     });
  120 |     expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);expect(bounds.score.right).toBeLessThanOrEqual(bounds.width);
  121 |     expect(bounds.pointer).toBe('none');expect(bounds.live).toBe('4000 RALLY');
  122 |     expect(bounds.toast.y>=bounds.warning.bottom||bounds.toast.right<=bounds.warning.x||bounds.toast.bottom<=bounds.warning.y).toBe(true);
  123 |     await page.screenshot({path:resolve(directory,`${width}x${height}-text${fontPercent}.png`)});
  124 |   }
  125 | });
  126 | 
  127 | test('major labels fit at their largest initial scale with 200% text on 320px screens',async({page},info)=>{
  128 |   await page.setViewportSize({width:320,height:568});
  129 |   await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  130 |   const directory=resolve(evidenceRoot,info.project.name,'layout');mkdirSync(directory,{recursive:true});
  131 |   for(const score of [1000,2000,3000,4000]){
  132 |     await page.evaluate(score=>window.rally.show(score),score);
  133 |     const bounds=await page.evaluate(()=>{
  134 |       const game=document.querySelector('[data-game]')!.getBoundingClientRect();
  135 |       const label=document.querySelector('[data-rally-notice]')!.getBoundingClientRect();
  136 |       return {game:{left:game.left,right:game.right,top:game.top,bottom:game.bottom},label:{left:label.left,right:label.right,top:label.top,bottom:label.bottom}};
  137 |     });
  138 |     await page.screenshot({path:resolve(directory,`${score}-320x568-text200-age0.png`)});
> 139 |     expect(bounds.label.left).toBeGreaterThanOrEqual(bounds.game.left);expect(bounds.label.right).toBeLessThanOrEqual(bounds.game.right);
      |                                                                                                   ^ Error: expect(received).toBeLessThanOrEqual(expected)
  140 |     expect(bounds.label.top).toBeGreaterThanOrEqual(bounds.game.top);expect(bounds.label.bottom).toBeLessThanOrEqual(bounds.game.bottom);
  141 |   }
  142 | });
  143 | 
```