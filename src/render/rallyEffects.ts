import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, Group, Mesh, MeshBasicMaterial } from 'three';
import type { GameConfig, GameSnapshot } from '../game/types';
import type { RallyEffectsState } from '../game/rallyEffects';
import type { Quality } from '../storage/preferences';
import { sampleRainbow } from './rainbow';

/** Four reused batches. Draw ranges and upload ranges contain only this frame's vertices. */
function createBatch(capacity:number,name:string) {
  const geometry=new BufferGeometry();
  const position=new BufferAttribute(new Float32Array(capacity*18),3).setUsage(DynamicDrawUsage);
  const color=new BufferAttribute(new Float32Array(capacity*24),4).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position',position);geometry.setAttribute('color',color);geometry.setDrawRange(0,0);
  const material=new MeshBasicMaterial({vertexColors:true,transparent:true,depthTest:true,depthWrite:false,
    side:DoubleSide,blending:AdditiveBlending,toneMapped:false});
  const mesh=new Mesh(geometry,material);mesh.name=name;mesh.frustumCulled=false;mesh.renderOrder=2;
  let count=0;
  return {mesh,capacity,get count(){return count;},clear(){count=0;},
    line(ax:number,ay:number,az:number,bx:number,by:number,bz:number,width:number,r:number,g:number,b:number,a:number){
      if(count>=capacity||a<=0)return;
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
const fraction=(n:number)=>n-Math.floor(n);
function envelope(age:number,duration:number){return Math.min(1,Math.max(0,age)*8,Math.max(0,duration-age)*3);}
function ring(target:Batch,x:number,y:number,z:number,radius:number,segments:number,width:number,alpha:number,time:number,
  r=0,g=0,b=0,rainbow=false,horizontal=false,phase=0,aspect=1){
  for(let i=0;i<segments;i++){
    const a=i/segments*TAU+phase,c=(i+1)/segments*TAU+phase;
    const rgb=rainbow?sampleRainbow(time,i/segments):null;
    target.line(x+Math.cos(a)*radius,y+(horizontal?0:Math.sin(a)*radius*aspect),z+(horizontal?Math.sin(a)*radius*aspect:0),
      x+Math.cos(c)*radius,y+(horizontal?0:Math.sin(c)*radius*aspect),z+(horizontal?Math.sin(c)*radius*aspect:0),width,rgb?.r??r,rgb?.g??g,rgb?.b??b,alpha);
  }
}

export function createRallyEffectView(config:GameConfig,tableRig:Group) {
  const tableRoot=new Group(),worldRoot=new Group();tableRoot.name='rally-table';worldRoot.name='rally-world';tableRig.add(tableRoot);
  const table=createBatch(4096,'rally-table-lines'),tableGlow=createBatch(1024,'rally-table-glow');
  const world=createBatch(4096,'rally-world-lines'),worldGlow=createBatch(1024,'rally-world-glow');
  tableRoot.add(tableGlow.mesh,table.mesh);worldRoot.add(worldGlow.mesh,world.mesh);
  const batches=[table,tableGlow,world,worldGlow];
  const activeEffects:string[]=[];
  let disposed=false,particleCount=0,density=1,now=0,score=0,reduced=false;
  const active=(name:string)=>{if(!activeEffects.includes(name))activeEffects.push(name);};
  function line(target:Batch,ax:number,ay:number,az:number,bx:number,by:number,bz:number,width:number,r:number,g:number,b:number,a:number){
    target.line(ax,ay,az,bx,by,bz,width,r,g,b,a);
  }
  function perimeter(time:number,opacity:number,lap=false){
    const segments=64*density,w=config.tableHalfWidth,l=config.tableHalfLength,y=config.tableY+.027;
    const length=4*(w+l),head=fraction(time)*length;
    for(let i=0;i<segments;i++){
      const at=i/segments*length,next=(i+1)/segments*length;
      let ax=0,az=0,bx=0,bz=0;
      if(at<2*w){ax=-w+at;az=l;}else if(at<2*w+2*l){ax=w;az=l-(at-2*w);}else if(at<4*w+2*l){ax=w-(at-2*w-2*l);az=-l;}else{ax=-w;az=-l+(at-4*w-2*l);}
      if(next<=2*w){bx=-w+next;bz=l;}else if(next<=2*w+2*l){bx=w;bz=l-(next-2*w);}else if(next<=4*w+2*l){bx=w-(next-2*w-2*l);bz=-l;}else{bx=-w;bz=-l+(next-4*w-2*l);}
      const behind=fraction((head-at)/length),strength=lap?clamp(1-behind/.32):.45+.55*Math.pow(Math.max(0,Math.cos((at/length-time)*TAU)),6);
      if(strength<=0)continue;
      const rgb=lap?sampleRainbow(now,i/segments):null;
      line(table,ax,y,az,bx,y,bz,.011,rgb?.r??.08,rgb?.g??.9,rgb?.b??.22,opacity*strength);
      if(i%2===0)line(tableGlow,ax,y,az,bx,y,bz,.036,.07,.8,.2,opacity*strength*.13);
    }
  }
  function netCross(time:number,opacity:number,r=.05,g=.9,b=.2){
    const count=24*density;
    for(let side=0;side<2;side++)for(let i=0;i<count;i++){
      const t=i/count,next=(i+1)/count,phase=side===0?time:1-time;
      const x=(t*2-1)*config.tableHalfWidth,nx=(next*2-1)*config.tableHalfWidth;
      const y=config.tableY+.18+Math.sin(t*TAU*4-time*3+side)*.026,ny=config.tableY+.18+Math.sin(next*TAU*4-time*3+side)*.026;
      const fade=.24+.76*Math.pow(Math.max(0,Math.cos((t-phase)*TAU)),4);
      line(table,x,y,.012,nx,ny,.012,.009,r,g,b,opacity*fade);
    }
  }
  function threads(){
    const count=12*density;
    for(let i=0;i<count;i++){
      const base=-2.8+i/count*5.6,phase=now*.18+i*.71;
      for(let j=0;j<10;j++){
        const a=j/10,b=(j+1)/10;
        line(world,base+Math.sin(phase+a*5)*.22,-.45+a*.85,-4.85,
          base+Math.sin(phase+b*5)*.22,-.45+b*.85,-4.85,.006,.06,.65,.3,.15);
      }
    }
  }
  function crossing(colors:number){
    const trails=colors===2?4:6;
    for(let k=0;k<trails*density;k++){
      const color=k%colors,period=color===0?3.7:color===1?4.9:6.1;
      const phase=fraction(now/period+k*.23),head=-3.2+phase*6.4;
      const r=color===2?.85:.06,g=color===0?.9:color===1?.32:.07,b=color===1?1:color===0?.2:.13;
      const width=color===0?.011:color===1?.016:.021,tail=color===0?1.15:color===1?.86:.63;
      for(let j=0;j<18;j++){
        const u=j/18,v=(j+1)/18,x=head-u*tail,nx=head-v*tail;
        const wave=(q:number)=>-.15+Math.sin(q*(color+2)+k*.8+now*.38)*.23+Math.sin(q*7+k)*.025;
        line(world,x,wave(x),-4.25-color*.11,nx,wave(nx),-4.25-color*.11,width,r,g,b,(1-u)*.55);
      }
    }
  }
  function cornerGather(){
    const progress=(score-900)/100;
    for(let corner=0;corner<4;corner++){
      const x=(corner%2?1:-1)*config.tableHalfWidth,z=(corner<2?-1:1)*config.tableHalfLength;
      ring(table,x,config.tableY+.04,z,.07+progress*.07,16*density,.009,.15+progress*.4,.1,.08,.9,.3,false,true,now*.3);
      for(let j=0;j<5*density;j++){
        const a=now*.8+j*TAU/(5*density),radius=.08+progress*.15;
        line(table,x+Math.cos(a)*radius,config.tableY+.035,z+Math.sin(a)*radius,x+Math.cos(a)*radius*.7,config.tableY+.06,z+Math.sin(a)*radius*.7,.007,.1,.9,.28,.18+progress*.45);
      }
    }
  }
  function arrival(threshold:number,age:number,duration:number){
    const fade=envelope(age,duration),t=reduced?.45:age/duration;
    if(threshold===100){active('perimeter-lap');perimeter(t,fade*.8,true);}
    else if(threshold===200){active('net-crossing');netCross(t,fade*.65,.12,.7,1);}
    else if(threshold===800){
      active('edge-sparks');const count=48*density;
      for(let i=0;i<count;i++){
        const side=i%2?1:-1,origin=(hash(i+9)*2-1)*config.tableHalfLength,vx=side*(.2+hash(i+2)*.5),vy=.3+hash(i+17)*.5;
        const x=side*config.tableHalfWidth+vx*t,y=config.tableY+.035+vy*t-.3*t*t,z=origin+Math.sin(i)*t*.16;
        const rgb=i%3?sampleRainbow(now,i/count):null;
        line(table,x,y,z,x-vx*.04,y-.035,z,.012,rgb?.r??.04,rgb?.g??1,rgb?.b??.15,fade*(1-t)*.7);particleCount++;
      }
    }else if(threshold===1000){
      active('thousand-shockwave');
      ring(world,0,-.15,-4.65,.18+t*4.5,96*density,.032,fade*.58,now,0,0,0,true,false,0,.26);
      ring(worldGlow,0,-.15,-4.66,.18+t*4.5,48*density,.11,fade*.09,now,0,0,0,true,false,0,.26);
      // The two opposing arcs share the final green/blue crossing language.
      for(let k=0;k<2;k++)ring(world,0,-.15,-4.6,.25+t*3.3,40*density,.012,fade*.35,now,.04,k===0?.9:.28,k===0?.2:1,false,false,k*1.4,.28);
    }
  }
  return {worldRoot,
    clear(){
      if(disposed)return;
      activeEffects.length=0;particleCount=0;
      for(const target of batches){target.clear();target.finish();}
    },
    prepare(){
      if(disposed)return;
      // Degenerate triangles warm every owned GPU buffer and RGBA shader without visible pixels.
      for(const target of batches){target.clear();target.line(0,0,0,0,0,0,.001,0,0,0,1);target.finish();}
    },
    update(snapshot:GameSnapshot,state?:RallyEffectsState,quality:Quality='standard',reducedMotion=false){
      if(disposed)return;
      for(const target of batches)target.clear();activeEffects.length=0;particleCount=0;
      density=quality==='low'?.5:1;now=reducedMotion?0:snapshot.simTime;reduced=reducedMotion;score=snapshot.score;
      if(score>=400){active('background-threads');threads();}
      if(score>=500){active('green-perimeter');perimeter(now*.21,.52);}
      if(score>=600){active('green-net');netCross(now*.25,.46);}
      if(score>=700){active('single-halo');ring(world,0,-.1,-4.9,1.55*(1+Math.sin(now*.22)*.08),80*density,.014,.27,now,.06,.8,.35,false,false,now*.08,.33);}
      if(score>=900&&score<1000){active('corner-gather');cornerGather();}
      if(score>=1000){active('green-blue-crossing');crossing(2);}
      if(state?.runId===snapshot.runId){
        for(const hit of state.hits){
          const age=snapshot.simTime-hit.at;
          if(hit.score<50||age<0||snapshot.simTime>=hit.at+.3||!hit.position)continue;
          active('hit-ring');const t=reduced?.35:age/.3;
          ring(table,hit.position.x,hit.position.y,hit.position.z+.01,.075+t*.13,32*density,.009,(1-t)*.55,now,.18,.9,.55);
        }
        for(const cue of state.arrivals){
          const duration=cue.config.duration;
          if(duration===null)continue;
          const age=snapshot.simTime-cue.at;
          if(age>=0&&snapshot.simTime<cue.at+duration)arrival(cue.threshold,age,duration);
        }
      }
      for(const target of batches)target.finish();
    },
    stats:()=>({activeEffects:[...activeEffects],tableQuads:table.count+tableGlow.count,worldQuads:world.count+worldGlow.count,
      particleCount,capacity:10240,geometries:disposed?0:4,materials:disposed?0:4,nodes:disposed?0:6,
      drawCalls:disposed?0:batches.reduce((sum,b)=>sum+Number(b.count>0),0),disposed}),
    dispose(){if(disposed)return;disposed=true;for(const target of batches)target.dispose();tableRoot.removeFromParent();worldRoot.removeFromParent();},
  };
}
