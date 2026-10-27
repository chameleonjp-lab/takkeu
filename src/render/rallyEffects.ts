import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, Group, Mesh, MeshBasicMaterial, NormalBlending } from 'three';
import type { GameConfig, GameSnapshot } from '../game/types';
import type { RallyEffectsState } from '../game/rallyEffects';
import type { Quality } from '../storage/preferences';

/** Two reused feedback batches. Draw ranges and upload ranges contain only this frame's vertices. */
function createBatch(capacity:number,name:string,additive=true) {
  const geometry=new BufferGeometry();
  const position=new BufferAttribute(new Float32Array(capacity*18),3).setUsage(DynamicDrawUsage);
  const color=new BufferAttribute(new Float32Array(capacity*24),4).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position',position);geometry.setAttribute('color',color);geometry.setDrawRange(0,0);
  const material=new MeshBasicMaterial({vertexColors:true,transparent:true,depthTest:true,depthWrite:false,
    side:DoubleSide,forceSinglePass:true,blending:additive?AdditiveBlending:NormalBlending,toneMapped:false});
  const mesh=new Mesh(geometry,material);mesh.name=name;mesh.frustumCulled=false;mesh.renderOrder=2;
  let count=0,opacity=1;
  return {mesh,capacity,get count(){return count;},clear(){count=0;opacity=1;},setOpacity(value:number){opacity=value;},
    rect(left:number,bottom:number,right:number,top:number,z:number,r:number,g:number,b:number,a:number,bottomAlpha=a){
      a*=opacity;bottomAlpha*=opacity;if(count>=capacity||a<=0)return;let v=count++*6;
      position.setXYZ(v,left,bottom,z);position.setXYZ(v+1,right,bottom,z);position.setXYZ(v+2,left,top,z);
      position.setXYZ(v+3,right,bottom,z);position.setXYZ(v+4,right,top,z);position.setXYZ(v+5,left,top,z);
      for(let i=0;i<6;i++)color.setXYZW(v++,r,g,b,i===0||i===1||i===3?bottomAlpha:a);
    },
    line(ax:number,ay:number,az:number,bx:number,by:number,bz:number,width:number,r:number,g:number,b:number,a:number){
      a*=opacity;if(count>=capacity||a<=0)return;
      // Billboard the ribbon toward the fixed player viewpoint, without Three allocations.
      const dx=bx-ax,dy=by-ay,dz=bz-az,sx=dy*3.4-dz*1.3,sy=-dx*3.4,sz=dx*1.3;
      const half=width/(Math.hypot(sx,sy,sz)||1)/2,x=sx*half,y=sy*half,z=sz*half;
      let v=count++*6;
      position.setXYZ(v,ax-x,ay-y,az-z);position.setXYZ(v+1,ax+x,ay+y,az+z);position.setXYZ(v+2,bx-x,by-y,bz-z);
      position.setXYZ(v+3,ax+x,ay+y,az+z);position.setXYZ(v+4,bx+x,by+y,bz+z);position.setXYZ(v+5,bx-x,by-y,bz-z);
      for(let i=0;i<6;i++)color.setXYZW(v++,r,g,b,a);
    },
    finish(){geometry.setDrawRange(0,count*6);mesh.visible=count>0;
      position.clearUpdateRanges();color.clearUpdateRanges();
      if(count){position.addUpdateRange(0,count*18);color.addUpdateRange(0,count*24);position.needsUpdate=true;color.needsUpdate=true;}
    },
    dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();},
  };
}
type Batch=ReturnType<typeof createBatch>;
const TAU=Math.PI*2;
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
function envelope(age:number,duration:number){return Math.min(1,Math.max(0,age)*8,Math.max(0,duration-age)*3);}
/** Shared low-tier budget for both new overlays and legacy celebrations. It only
 * reads confirmed presentation facts; it never changes an event or its lifetime. */
export function presentationPriority(snapshot:Pick<GameSnapshot,'runId'|'simTime'>,state?:RallyEffectsState):number {
  if(!state||state.runId!==snapshot.runId)return 1;
  const time=snapshot.simTime,smooth=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};
  const confirmedMajor=state.score >= 3500 ? 3500 : Math.floor(state.score/1000)*1000;
  let majorAt=-Infinity,majorDuration=0,majorScore=0,finalAt=-Infinity;
  for(const cue of state.arrivals){
    if(cue.threshold<1000||cue.threshold>3500||(cue.threshold%1000!==0&&cue.threshold!==3500)||cue.at>time||cue.threshold<confirmedMajor)continue;
    if(cue.at>majorAt||cue.at===majorAt&&cue.threshold>majorScore){majorAt=cue.at;majorDuration=cue.config.duration??0;majorScore=cue.threshold;}
  }
  let pressure=0;
  if(majorDuration>0&&time<majorAt+majorDuration)pressure=Math.min(smooth((time-majorAt)/.2),smooth((majorAt+majorDuration-time)/.3));
  for(const cue of state.cues)if(cue.kind==='loss-final'&&cue.at<=time)finalAt=Math.max(finalAt,cue.at);
  if(finalAt!==-Infinity)pressure=Math.max(pressure,smooth((time-finalAt)/.2));
  else if(state.lostBallCount>=100)pressure=1;
  return 1-pressure*.55;
}

const HIT_SEGMENTS=12, LOSS_RAYS=6, TABLE_CAPACITY=512*HIT_SEGMENTS+128, WORLD_CAPACITY=100*LOSS_RAYS;
// Immutable unit-circle data is shared; event positions and times remain independent.
const circle=Float64Array.from({length:(HIT_SEGMENTS+1)*2},(_,i)=>
  i%2?Math.sin(Math.floor(i/2)/HIT_SEGMENTS*TAU):Math.cos(Math.floor(i/2)/HIT_SEGMENTS*TAU));
function hitRing(target:Batch,x:number,y:number,z:number,radius:number,alpha:number){
  for(let i=0;i<HIT_SEGMENTS;i++)target.line(
    x+circle[i*2]!*radius,y+circle[i*2+1]!*radius,z+.01,
    x+circle[(i+1)*2]!*radius,y+circle[(i+1)*2+1]!*radius,z+.01,.009,.18,.9,.55,alpha);
}
export function createRallyEffectView(config:GameConfig,tableRig:Group){
  const tableRoot=new Group(),worldRoot=new Group();tableRoot.name='rally-table';worldRoot.name='rally-world';tableRig.add(tableRoot);
  const table=createBatch(TABLE_CAPACITY,'rally-table-lines'),world=createBatch(WORLD_CAPACITY,'rally-world-lines');
  tableRoot.add(table.mesh);worldRoot.add(world.mesh);
  const batches=[table,world],activeEffects:string[]=[];
  // Reference immutable facts through open addressing, avoiding per-frame string keys.
  const slots=new Int16Array(1024);
  let disposed=false,particleCount=0;
  const active=(name:string)=>{if(!activeEffects.includes(name))activeEffects.push(name);};
  const begin=()=>{for(const b of batches)b.clear();activeEffects.length=0;particleCount=0;};
  function unique(facts:readonly {at:number;position?:{x:number;y:number;z:number}}[],index:number):boolean{
    const fact=facts[index]!,p=fact.position!;
    let slot=(Math.floor(fact.at*1000)^Math.imul(Math.floor(p.x*1e5),31)^Math.imul(Math.floor(p.y*1e5),131)^Math.imul(Math.floor(p.z*1e5),521))&1023;
    for(let probes=0;probes<slots.length;probes++,slot=(slot+1)&1023){
      const previous=slots[slot]!;
      if(previous<0){slots[slot]=index;return true;}
      const other=facts[previous]!,q=other.position!;
      if(other.at===fact.at&&q.x===p.x&&q.y===p.y&&q.z===p.z)return false;
    }
    return false;
  }
  return {worldRoot,
    clear(){if(disposed)return;begin();for(const b of batches)b.finish();},
    prepare(){if(disposed)return;begin();for(const b of batches){b.line(0,0,0,0,0,0,.001,0,0,0,1);b.finish();}},
    update(snapshot:GameSnapshot,state?:RallyEffectsState,_quality:Quality='standard',reducedMotion=false){
      if(disposed)return;begin();
      if(state?.runId===snapshot.runId&&snapshot.phase!=='ready'){
        const time=snapshot.simTime,opacity=presentationPriority(snapshot,state);
        slots.fill(-1);
        for(let i=0;i<state.hits.length;i++){
          const hit=state.hits[i]!,age=time-hit.at;
          if(snapshot.score>=1500||hit.score>=1500||hit.score<50||!hit.position||age<0||age>=.3||!unique(state.hits,i))continue;
          active('hit-ring');
          hitRing(table,hit.position.x,hit.position.y,hit.position.z,.075+(reducedMotion?.35:age/.3)*.13,(1-age/.3)*.55*opacity);
        }
        slots.fill(-1);
        for(let i=0;i<state.losses.length;i++){
          const loss=state.losses[i]!,age=time-loss.at;
          if(snapshot.score>=1500||!loss.position||age<0||age>=.5||!unique(state.losses,i))continue;
          active('loss-sparks');
          const t=reducedMotion?.35:age/.5,p=loss.position;
          for(let ray=0;ray<LOSS_RAYS;ray++){
            const angle=hash(loss.count*31+ray+3)*TAU,distance=(.16+hash(loss.count*13+ray+91)*.12)*t;
            const x=p.x+Math.cos(angle)*distance,y=p.y+distance*.6-t*t*.045,z=p.z+Math.sin(angle)*distance*.4;
            world.line(x,y,z,x-Math.cos(angle)*.025,y-.014,z-Math.sin(angle)*.01,.008,.6,.95,.8,(1-age/.5)*.55*opacity);
          }
          particleCount+=LOSS_RAYS;
        }
        // Bounded arrival and loss arcs coexist in the same fixed batch. No background layers.
        const arrival = state.arrivals.filter(a => a.threshold >= 500 && time >= a.at && time < a.at + (a.config.duration ?? 0))
          .sort((a,b) => b.config.priority-a.config.priority || b.at-a.at)[0];
        const lossCue = state.cues.filter(c => ['loss-wave','loss-net','loss-number','loss-warning','loss-gold','loss-final'].includes(c.kind) && time >= c.at && time < c.at+c.duration)
          .sort((a,b) => b.priority-a.priority || b.value-a.value || b.at-a.at)[0];
        for(const cue of [arrival,lossCue]){
          if(!cue)continue;
          const useLoss='value' in cue;
          const duration = 'threshold' in cue ? cue.config.duration! : cue.duration;
          const age = time-cue.at, threshold = 'threshold' in cue ? cue.threshold : 0;
          const lossValue = 'value' in cue ? cue.value : 0;
          const final = threshold===3500, gold = lossValue===99||lossValue===100;
          const net = lossValue===50;
          active(final?'clear-electric':useLoss?'loss-electric':'rally-electric');
          const alpha=envelope(age,duration)*(reducedMotion?.24:final?.6:.46);
          const arcs=reducedMotion||useLoss&&arrival?4:final||net||threshold===2000||threshold===3000?12:8,segments=reducedMotion?1:6;
          // Smoothly interpolated shape, no strobe or random frame-to-frame replacement.
          const motion=reducedMotion?0:age;
          for(let i=0;i<arcs;i++){
            const side=(i+(threshold===2750?1:0))%4,t=(Math.floor(i/4)+.5)/Math.ceil(arcs/4);
            const w=config.tableHalfWidth+.035,l=config.tableHalfLength+.035;
            const ox=side<2?(side===0?-w:w):(t*2-1)*w;
            const oz=side<2?(t*2-1)*l:(side===2?-l:l);
            const tricolor=threshold>=1500&&!final;
            const c=gold||final&&i%3===2?[1,.7,.12]:tricolor&&i%3===2?[.9,.15,.1]:i%2&&threshold>=1000||lossValue===77?[.15,.5,1]:[.08,.9,.35];
            let x=ox,y=config.tableY+.025,z=oz;
            for(let j=1;j<=segments;j++){
              const u=j/segments,jitter=Math.sin(i*2.3+j*2.1+motion*2+(threshold===2750?2.4:0))*.035;
              const nx=ox+(side<2?(side===0?-1:1)*u*.11:u*.22)+jitter;
              const ny=config.tableY+.025+Math.sin(u*Math.PI)*.12;
              const nz=oz+(side<2?u*.22:(side===2?-1:1)*u*.11)+jitter;
              table.line(x,y,z,nx,ny,nz,.01,c[0]!,c[1]!,c[2]!,alpha);x=nx;y=ny;z=nz;
            }
          }
          if(net)table.line(-config.tableHalfWidth,config.tableY+.19,0,config.tableHalfWidth,config.tableY+.19,0,.012,.1,.7,1,alpha);
        }
        // The last actual loss keeps a short outline. Simulation and ending
        // clocks, score facts and audio events are not consumed by drawing.
        const final=state.cues.find(cue=>cue.kind==='loss-final'&&time>=cue.at&&time<cue.at+cue.duration);
        if(final){
          active('loss-final');
          const age=time-final.at,progress=reducedMotion?.45:age/final.duration;
          const w=config.tableHalfWidth+.04+progress*.25,l=config.tableHalfLength+.04+progress*.35,y=config.tableY+.03;
          const alpha=envelope(age,final.duration)*(1-age/final.duration)*.32;
          table.line(-w,y,-l,w,y,-l,.016,1,.65,.08,alpha);table.line(w,y,-l,w,y,l,.016,1,.65,.08,alpha);
          table.line(w,y,l,-w,y,l,.016,1,.65,.08,alpha);table.line(-w,y,l,-w,y,-l,.016,1,.65,.08,alpha);
        }
      }
      for(const b of batches)b.finish();
    },
    stats:()=>({activeEffects:[...activeEffects],tableQuads:table.count,worldQuads:world.count,particleCount,finalPhase:null,
      capacity:TABLE_CAPACITY+WORLD_CAPACITY,geometries:disposed?0:2,materials:disposed?0:2,nodes:disposed?0:4,
      drawCalls:disposed?0:batches.reduce((n,b)=>n+Number(b.count>0),0),disposed}),
    dispose(){if(disposed)return;disposed=true;for(const b of batches)b.dispose();tableRoot.removeFromParent();worldRoot.removeFromParent();},
  };
}
