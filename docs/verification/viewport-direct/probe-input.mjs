import {chromium} from '@playwright/test';
const b=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await b.newPage({viewport:{width:390,height:844}});
await page.clock.install({time:new Date('2026-10-23T14:00:00Z')});await page.clock.pauseAt(new Date('2026-10-23T14:00:01Z'));
await page.goto('http://127.0.0.1:4173/tests/fixtures/stage3.html');await page.getByRole('button',{name:'はじめる',exact:true}).click();
await page.evaluate(()=>{window.inputLog=[];for(const type of ['pointerdown','pointermove','pointerup','lostpointercapture'])document.addEventListener(type,e=>window.inputLog.push({type,at:e.timeStamp,now:performance.now(),buttons:e.buttons,primary:e.isPrimary,x:e.clientX,y:e.clientY,target:e.target.tagName,state:window.stage3.snapshot()}));});
await page.mouse.move(100,450);await page.clock.runFor(12);await page.mouse.down();await page.clock.runFor(12);
console.log(JSON.stringify(await page.evaluate(()=>({events:window.inputLog,state:window.stage3.snapshot(),now:performance.now()})),null,2));await b.close();
