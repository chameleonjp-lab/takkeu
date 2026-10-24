import { chromium, webkit } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const dir=new URL('.',import.meta.url).pathname;
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'ignore',detached:true});
const rows=[];
try {
  let ready=false;
  for(let i=0;i<100;i++){try{ready=(await fetch('http://127.0.0.1:4173/')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  if(!ready)throw new Error('Local Vite did not start');
  for(const [engine,type] of Object.entries({chromium,webkit})){
    const browser=await type.launch();
    try{
      const context=await browser.newContext();await context.route('https://*.supabase.co/**',r=>r.abort());
      const page=await context.newPage();await page.goto('http://127.0.0.1:4173/');
      const data=await page.evaluate(async()=>{
        const fixture='/tests/helpers/remainingBall.ts',config='/src/game/config.ts';
        const {remainingScenario,missPaddle}=await import(fixture),{DEFAULT_CONFIG}=await import(config);const rows=[];
        for(const score of [99,100,101,450,539,540,555])for(const count of [1,2,3,4,5,8]){
          const s=remainingScenario(score,count);let departed,net,bounce,arrived;
          let previous={time:s.state.simTime,z:-1.95};
          for(let tick=0;tick<500&&arrived===undefined;tick++){
            const result=s.step(missPaddle),ball=s.state.balls.find(b=>b.id===1);
            if(!ball)throw new Error('Lost before paddle-plane arrival');
            departed??=result.events.find(e=>e.kind==='opponent-hit'&&e.ballId===1)?.time;
            bounce??=result.events.find(e=>e.kind==='table-bounce'&&e.ballId===1)?.time;
            const current={time:s.state.simTime,z:ball.position.z};
            const crossing=z=>previous.time+(current.time-previous.time)*(z-previous.z)/(current.z-previous.z);
            if(previous.z<0&&current.z>=0)net=crossing(0);
            if(previous.z<1.95&&current.z>=1.95)arrived=crossing(1.95);
            previous=current;
          }
          rows.push({score,count,departed,net,bounce,arrived});
        }
        return rows;
      });
      for(const row of data){if(![row.departed,row.net,row.bounce,row.arrived].every(Number.isFinite)||!(row.departed<row.net&&row.net<row.bounce&&row.bounce<row.arrived))throw new Error(JSON.stringify({engine,...row}));rows.push({engine,...row});}
      await context.close();
    }finally{await browser.close();}
  }
  const result={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),method:'Actual simulation events plus interpolated z crossings; depart < net < table-bounce < paddle-plane arrival',rows};
  writeFileSync(dir+'flight-order.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sha:result.sha,rows:rows.length,passed:true}));
}finally{try{process.kill(-server.pid,'SIGTERM');}catch{}}
