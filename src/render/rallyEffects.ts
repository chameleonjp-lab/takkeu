import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, Group, Mesh, MeshBasicMaterial, NormalBlending } from 'three';
import type { GameConfig, GameSnapshot } from '../game/types';
import type { RallyEffectsState } from '../game/rallyEffects';
import type { Quality } from '../storage/preferences';
import { sampleRainbow } from './rainbow';

/** Four reused batches. Draw ranges and upload ranges contain only this frame's vertices. */
function createBatch(capacity:number,name:string,additive=true) {
  const geometry=new BufferGeometry();
  const position=new BufferAttribute(new Float32Array(capacity*18),3).setUsage(DynamicDrawUsage);
  const color=new BufferAttribute(new Float32Array(capacity*24),4).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position',position);geometry.setAttribute('color',color);geometry.setDrawRange(0,0);
  const material=new MeshBasicMaterial({vertexColors:true,transparent:true,depthTest:true,depthWrite:false,
    side:DoubleSide,blending:additive?AdditiveBlending:NormalBlending,toneMapped:false});
  const mesh=new Mesh(geometry,material);mesh.name=name;mesh.frustumCulled=false;mesh.renderOrder=2;
  let count=0,opacity=1;
  return {mesh,capacity,get count(){return count;},clear(){count=0;opacity=1;},setOpacity(value:number){opacity=value;},
    rect(left:number,bottom:number,right:number,top:number,z:number,r:number,g:number,b:number,a:number){
      a*=opacity;if(count>=capacity||a<=0)return;let v=count++*6;
      position.setXYZ(v,left,bottom,z);position.setXYZ(v+1,right,bottom,z);position.setXYZ(v+2,left,top,z);
      position.setXYZ(v+3,right,bottom,z);position.setXYZ(v+4,right,top,z);position.setXYZ(v+5,left,top,z);
      for(let i=0;i<6;i++)color.setXYZW(v++,r,g,b,a);
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
  const world=createBatch(4096,'rally-world-lines'),worldGlow=createBatch(1024,'rally-world-glow',false);
  worldGlow.mesh.renderOrder=1.5;
  tableRoot.add(tableGlow.mesh,table.mesh);worldRoot.add(worldGlow.mesh,world.mesh);
  const batches=[table,tableGlow,world,worldGlow];
  const activeEffects:string[]=[];
  let disposed=false,particleCount=0,density=1,now=0,score=0,reduced=false;
  let finalPhase:'converge'|'assemble'|'expand'|'overlap-fade'|null=null;
  const active=(name:string)=>{if(!activeEffects.includes(name))activeEffects.push(name);};
  function line(target:Batch,ax:number,ay:number,az:number,bx:number,by:number,bz:number,width:number,r:number,g:number,b:number,a:number){
    target.line(ax,ay,az,bx,by,bz,width,r,g,b,a);
  }
  function perimeter(time:number,opacity:number,lap=false,channel=-1,width=.011,tail=.32){
    const segments=64*density,w=config.tableHalfWidth,l=config.tableHalfLength,y=config.tableY+.027;
    const length=4*(w+l),head=fraction(time)*length;
    for(let i=0;i<segments;i++){
      const at=i/segments*length,next=(i+1)/segments*length;
      let ax=0,az=0,bx=0,bz=0;
      if(at<2*w){ax=-w+at;az=l;}else if(at<2*w+2*l){ax=w;az=l-(at-2*w);}else if(at<4*w+2*l){ax=w-(at-2*w-2*l);az=-l;}else{ax=-w;az=-l+(at-4*w-2*l);}
      if(next<=2*w){bx=-w+next;bz=l;}else if(next<=2*w+2*l){bx=w;bz=l-(next-2*w);}else if(next<=4*w+2*l){bx=w-(next-2*w-2*l);bz=-l;}else{bx=-w;bz=-l+(next-4*w-2*l);}
      const behind=fraction((head-at)/length),strength=lap?clamp(1-behind/tail):.45+.55*Math.pow(Math.max(0,Math.cos((at/length-time)*TAU)),6);
      if(strength<=0)continue;
      const rgb=lap&&channel<0?sampleRainbow(now,i/segments):null;
      const r=rgb?.r??(channel===2?.85:.08),g=rgb?.g??(channel===2?.07:channel===1?.3:.9),b=rgb?.b??(channel===1?1:channel===2?.13:.22);
      line(table,ax,y,az,bx,y,bz,width,r,g,b,opacity*strength);
      if(i%2===0)line(tableGlow,ax,y,az,bx,y,bz,width*3.2,r,g,b,opacity*strength*.13);
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
    const trails=score>=4000?9:colors===2?4:6;
    for(let k=0;k<trails*density;k++){
      const color=k%colors,period=color===0?3.7:color===1?4.9:6.1;
      const phase=fraction(now/period+k*.23),head=-3.2+phase*6.4;
      const r=color===2?.85:.06,g=color===0?.9:color===1?.32:.07,b=color===1?1:color===0?.2:.13;
      const width=color===0?.011:color===1?.016:.021,tail=color===0?1.15:color===1?.86:.63;
      for(let j=0;j<18;j++){
        const u=j/18,v=(j+1)/18,x=head-u*tail,nx=head-v*tail;
        const wave=(q:number)=>-.15+Math.sin(q*(color+2)+k*.8+now*.38)*.23+Math.sin(q*7+k)*.025;
        const y=wave(x),ny=wave(nx),z=-4.25-color*.11;
        line(world,x,y,z,nx,ny,z,width,r,g,b,(1-u)*.55);
        if(score>=3250&&j%6===0){
          const direction=(j+k)%2?1:-1,bx=x-.13,by=y+direction*.09;
          line(world,x,y,z,bx,by,z-.035,width*.6,r,g,b,(1-u)*.3);
          line(world,bx,by,z-.035,bx-.18,by+direction*.045,z-.06,width*.4,r,g,b,(1-u)*.16);
        }
      }
    }
  }
  function tricolorTable(){
    for(let color=0;color<3;color++){
      const period=color===0?3.7:color===1?4.9:6.1,phase=now/period+color*.33;
      const width=color===0?.011:color===1?.016:.021,tail=color===0?.3:color===1?.22:.15;
      perimeter(phase,.36,true,color,width,tail);
      const r=color===2?.85:.06,g=color===0?.9:color===1?.32:.07,b=color===1?1:color===0?.2:.13;
      const segments=24*density,head=fraction(phase)*2-1;
      for(let i=0;i<segments;i++){
        const x=(i/segments*2-1)*config.tableHalfWidth,nx=((i+1)/segments*2-1)*config.tableHalfWidth;
        const wave=(q:number)=>config.tableY+.17+Math.sin(q*(8+color*2)-now/period*TAU)*(.012+color*.004);
        const alpha=(.16+.84*Math.pow(Math.max(0,1-Math.abs(x-head)/(.65-color*.12)),2))*.3;
        line(table,x,wave(x),.004,nx,wave(nx),.004,width,r,g,b,alpha);
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
  function meteors(swarm:boolean){
    const count=swarm?8*density:1;
    for(let i=0;i<count;i++){
      const phase=reduced?.42:fraction(now/4+i*.137),head=3.4-phase*7;
      const height=-.1+(swarm?hash(i+17)*.3:0),z=-4.75-hash(i+8)*.3-phase*.18;
      const r=i%3===2?.75:.14,g=i%3===0?.85:.4,b=i%3===1?1:.45;
      for(let j=0;j<16*density;j++){
        const a=j/(16*density),next=(j+1)/(16*density),length=swarm?.6:.9;
        line(world,head+a*length,height+Math.sin(a*24+now)*.012,z,head+next*length,height+Math.sin(next*24+now)*.012,z,.01*(1-a)+.003,r,g,b,(1-a)*.46);
      }
      ring(world,head,height,z,.018,8,.01,.5,now,r,g,b);particleCount++;
    }
  }
  function floorWave(){
    const phase=reduced?.45:fraction(now/4),fade=Math.sin(phase*Math.PI)*.25;
    for(let i=0;i<3;i++)ring(world,0,config.tableY-.786,0,.3+phase*5+i*.16,64*density,.016,fade*(1-i*.2),now,
      i===2?.8:.08,i===0?.8:.3,i===1?1:.25,false,true,0,1.25);
    for(let i=0;i<48*density;i++){
      const x=-5+i/(48*density)*10,nx=-5+(i+1)/(48*density)*10,z=3-phase*9;
      line(world,x,config.tableY-.785,z+Math.sin(x)*.18,nx,config.tableY-.785,z+Math.sin(nx)*.18,.018,.1,.65,.8,fade);
    }
  }
  function stars(transition:number){
    // This shallow backdrop sits IN FRONT of the opaque far wall. The court's
    // ordinary depth buffer still covers it. No camera or court material changes.
    worldGlow.rect(-6,-1.2,6,.9,-5.93,.002,.006,.022,.94*transition);
    const count=Math.floor((score>=4000?240:160)*density);
    for(let i=0;i<count;i++){
      const x=(hash(i+401)*2-1)*3.6,y=-.45+hash(i+809)*.75,z=-5.1+hash(i+1123)*.22;
      const size=.008+hash(i+719)*.012,light=.58+hash(i+157)*.28;
      const alpha=(.24+hash(i+167)*.3)*transition;
      line(world,x-size,y,z,x+size,y,z,.004,light,light+.1,1,alpha);
      line(world,x,y-size*.72,z,x,y+size*.72,z,.003,light,light+.1,1,alpha);
      particleCount++;
    }
    ring(world,0,-.2,-5.35,2.45*(1+Math.sin(now*.12)*.04),96*density,.018,.2*transition,now,.12,.3,.7,false,false,now*.035,.23);
  }
  function sideHalos(){
    const phase=reduced?.5:fraction(now/3);
    for(let side=-1;side<=1;side+=2){
      const radius=.32+phase*.36,alpha=.22*Math.sin(phase*Math.PI);
      ring(world,side*1.75,-.22,-3.65,radius,48*density,.015,alpha,now,.08,side<0?.85:.3,side<0?.25:1,false,false,side*now*.1,.65);
    }
  }
  function orbitRibbon(){
    ring(table,0,config.tableY-.075,0,1.3,96*density,.016,.27,now,0,0,0,true,true,now*.12,1.65);
    for(let i=0;i<3;i++){
      const angle=now*(.4+i*.06)+i*TAU/3,x=Math.cos(angle)*1.3,z=Math.sin(angle)*2.145;
      ring(table,x,config.tableY-.07,z,.055,16*density,.01,.4,now,i===2?.8:.06,i===0?.85:.3,i===1?1:.2,false,true);
    }
    const segments=96*density;
    for(let i=0;i<segments;i++){
      const a=i/segments*TAU,b=(i+1)/segments*TAU,phase=now*.45;
      const ra=1.3+Math.sin(a*19-phase*3)*.018,rb=1.3+Math.sin(b*19-phase*3)*.018;
      const ya=config.tableY-.064+Math.sin(a*13-phase*4)*.022,yb=config.tableY-.064+Math.sin(b*13-phase*4)*.022;
      const color=Math.floor(fraction(i/segments-now*.12)*3),alpha=.15+.18*Math.pow(Math.max(0,Math.cos(a-phase)),4);
      line(table,Math.cos(a)*ra,ya,Math.sin(a)*ra*1.65,Math.cos(b)*rb,yb,Math.sin(b)*rb*1.65,
        .009,color===2?.8:.08,color===0?.85:.3,color===1?1:.2,alpha);
    }
  }
  function multiHalos(){
    for(let i=0;i<3;i++)ring(world,0,-.2,-4.8-i*.15,(1.22+i*.49)*(1+Math.sin(now*.16+i)*.045),64*density,
      .013,.18,now,i===2?.7:.08,i===0?.8:.28,i===1?1:.3,false,false,now*(i%2?-.055:.055)+i*.4,.23+i*.035);
  }
  function tableHalos(){
    for(let i=0;i<2;i++)ring(table,0,config.tableY-.085-i*.07,0,1.3+i*.2,96*density,.016,.25,now,
      i?.12:.04,i?.35:.85,i?1:.25,false,true,now*(i?-.11:.09),1.6);
    const segments=96*density;
    for(let strand=0;strand<2;strand++)for(let i=0;i<segments;i++){
      const a=i/segments*TAU,b=(i+1)/segments*TAU,phase=now*.4+strand*Math.PI;
      const twistA=a*3+phase,twistB=b*3+phase,ra=1.42+Math.cos(twistA)*.08,rb=1.42+Math.cos(twistB)*.08;
      const ya=config.tableY-.045+Math.sin(twistA)*.15,yb=config.tableY-.045+Math.sin(twistB)*.15;
      const color=(Math.floor(i/(segments/3))+strand)%3;
      line(table,Math.cos(a)*ra,ya,Math.sin(a)*ra*1.6,Math.cos(b)*rb,yb,Math.sin(b)*rb*1.6,
        .012,color===2?.8:.08,color===0?.85:.3,color===1?1:.2,.26);
    }
  }
  function centerDensity(){
    const progress=clamp((score-3750)/250),count=Math.floor((32+progress*48)*density);
    for(let i=0;i<count;i++){
      const a=i*2.399963+now*.04,radial=(.6+hash(i+99)*2)*(1-progress*.65),x=Math.cos(a)*radial,y=-.2+Math.sin(a)*radial*.24;
      const color=i%3;
      line(world,x,y,-4.55,x*.93,-.2+(y+.2)*.93,-4.55,.006,color===2?.7:.08,color===0?.9:.3,color===1?1:.2,.12+progress*.25);
    }
  }
  function electricOpening(age:number,duration:number){
    const t=reduced?.5:age/duration,fade=envelope(age,duration),radius=.12+(1-Math.pow(1-t,2))*3.6;
    const segments=96*density;
    for(let i=0;i<segments;i++){
      const a=i/segments*TAU,b=(i+1)/segments*TAU,wave=.035*Math.sin(i*2.1+now*1.8);
      const r=radius+wave,nr=radius+.035*Math.sin((i+1)*2.1+now*1.8),color=i%3;
      line(world,Math.cos(a)*r,-.16+Math.sin(a)*r*.28,-4.5,Math.cos(b)*nr,-.16+Math.sin(b)*nr*.28,-4.5,
        .026,color===2?.8:.08,color===0?.85:.3,color===1?1:.2,fade*.48);
    }
    for(let i=0;i<2;i++)ring(world,0,-.16,-4.7,radius*(.65+i*.18),64*density,.018,fade*(.24-i*.05),now,0,0,0,true,false,0,.28);
    ring(worldGlow,0,-.16,-4.52,radius,48*density,.13,fade*.08,now,0,0,0,true,false,0,.28);
  }
  function finalAssembly(age:number,duration:number){
    const t=reduced?1.5:age,fade=envelope(age,duration);
    if(t<1){
      finalPhase='converge';
      for(let i=0;i<36*density;i++){
        const a=i/(36*density)*TAU,r=3.8*(1-t)+.12,tail=r+.65,color=i%3;
        line(world,Math.cos(a)*r,-.18+Math.sin(a)*r*.26,-4.45,Math.cos(a)*tail,-.18+Math.sin(a)*tail*.26,-4.45,.017,
          color===2?.8:.08,color===0?.85:.3,color===1?1:.2,fade*.55);
      }
    }else if(t<2){
      finalPhase='assemble';const u=t-1,segments=Math.max(1,Math.floor(96*density*u));
      for(let i=0;i<segments;i++){
        const a=i/(96*density)*TAU,b=(i+1)/(96*density)*TAU,r=.95+Math.sin(now*.4)*.015,rgb=sampleRainbow(now,i/(96*density));
        line(world,Math.cos(a)*r,-.18+Math.sin(a)*r*.28,-4.4,Math.cos(b)*r,-.18+Math.sin(b)*r*.28,-4.4,.035,rgb.r,rgb.g,rgb.b,fade*.65);
      }
      ring(worldGlow,0,-.18,-4.42,.95,48*density,.12,fade*.08*u,now,0,0,0,true,false,0,.28);
    }else if(t<3){
      finalPhase='expand';const u=t-2,radius=.95+u*u*2.25;
      ring(world,0,-.18,-4.4,radius,96*density,.035,fade*.6,now,0,0,0,true,false,0,.28);
      ring(worldGlow,0,-.18,-4.42,radius,48*density,.14,fade*.08,now,0,0,0,true,false,0,.28);
    }else{
      finalPhase='overlap-fade';const u=t-3;
      for(let i=0;i<4;i++)ring(world,0,-.18,-4.4-i*.045,3.2+u*.4-i*.35,96*density,.028,
        fade*(1-u)*(.4-i*.065),now,0,0,0,true,false,i*.12,.28);
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
    }else if(threshold===2000){active('star-transition');}
    else if(threshold===3000){active('electric-opening');electricOpening(age,duration);}
    else if(threshold===4000){active('final-assembly');finalAssembly(age,duration);}
  }
  return {worldRoot,
    clear(){
      if(disposed)return;
      activeEffects.length=0;particleCount=0;finalPhase=null;
      for(const target of batches){target.clear();target.finish();}
    },
    prepare(){
      if(disposed)return;
      // Degenerate triangles warm every owned GPU buffer and RGBA shader without visible pixels.
      for(const target of batches){target.clear();target.line(0,0,0,0,0,0,.001,0,0,0,1);target.finish();}
    },
    update(snapshot:GameSnapshot,state?:RallyEffectsState,quality:Quality='standard',reducedMotion=false){
      if(disposed)return;
      for(const target of batches)target.clear();activeEffects.length=0;particleCount=0;finalPhase=null;
      density=quality==='low'?.5:1;now=reducedMotion?0:snapshot.simTime;reduced=reducedMotion;score=snapshot.score;
      if(score>=400&&score<2000){active('background-threads');threads();}
      if(score>=500&&score<1500){active('green-perimeter');perimeter(now*.21,.52);}
      if(score>=600&&score<1500){active('green-net');netCross(now*.25,.46);}
      if(score>=700&&score<2750){active('single-halo');ring(world,0,-.1,-4.9,1.55*(1+Math.sin(now*.22)*.08),80*density,.014,.27,now,.06,.8,.35,false,false,now*.08,.33);}
      if(score>=900&&score<1000){active('corner-gather');cornerGather();}
      if(score>=1000&&score<1500){active('green-blue-crossing');crossing(2);}
      if(score>=1250&&score<3250){active('meteor');meteors(false);}
      if(score>=1500){active('tricolor-crossing');crossing(3);tricolorTable();}
      if(score>=1750&&score<2500){active('floor-wave');floorWave();}
      if(score>=2000){
        let transition=1;
        if(!reduced&&state?.runId===snapshot.runId)for(const cue of state.arrivals)if(cue.threshold===2000&&snapshot.simTime>=cue.at)transition=clamp((snapshot.simTime-cue.at)/2.5);
        active('star-world');stars(transition);
      }
      if(score>=2250&&score<3500){active('side-halos');sideHalos();}
      if(score>=2500){active('orbit-ribbon');orbitRibbon();}
      if(score>=2750){active('multi-halos');multiHalos();}
      if(score>=3250){active('meteor-swarm');meteors(true);}
      if(score>=3500){active('double-table-halos');tableHalos();}
      if(score>=3750&&score<4000){active('center-density');centerDensity();}
      if(score>=4000){active('final-world');ring(world,0,-.2,-4.65,2.05,96*density,.012,.16,now,0,0,0,true,false,now*.035,.27);}
      if(state?.runId===snapshot.runId){
        for(const hit of state.hits){
          const age=snapshot.simTime-hit.at;
          if(hit.score<50||age<0||snapshot.simTime>=hit.at+.3||!hit.position)continue;
          active('hit-ring');const t=reduced?.35:age/.3;
          ring(table,hit.position.x,hit.position.y,hit.position.z+.01,.075+t*.13,32*density,.009,(1-t)*.55,now,.18,.9,.55);
        }
        let newestMajor=-Infinity;
        for(const cue of state.arrivals)if(cue.threshold%1000===0&&cue.at<=snapshot.simTime)newestMajor=Math.max(newestMajor,cue.at);
        const newestMajorScore=Math.min(4000,Math.floor(state.score/1000)*1000);
        const newestMajorPresent=state.arrivals.some(cue=>cue.threshold===newestMajorScore&&cue.at<=snapshot.simTime);
        for(const cue of state.arrivals){
          const duration=cue.config.duration;
          if(duration===null)continue;
          const age=snapshot.simTime-cue.at;
          if(age<0||snapshot.simTime>=cue.at+duration)continue;
          // A newer shorter arrival may already have expired/pruned. Its confirmed
          // score still prevents an older long arrival replay after restoration.
          if(cue.threshold<newestMajorScore&&!newestMajorPresent)continue;
          const priorityFade=cue.at<newestMajor?clamp(1-(snapshot.simTime-newestMajor)/.35):1;
          if(priorityFade<=0)continue;
          for(const target of batches)target.setOpacity(priorityFade);
          arrival(cue.threshold,age,duration);
        }
        for(const target of batches)target.setOpacity(1);
      }
      for(const target of batches)target.finish();
    },
    stats:()=>({activeEffects:[...activeEffects],tableQuads:table.count+tableGlow.count,worldQuads:world.count+worldGlow.count,
      particleCount,finalPhase,capacity:10240,geometries:disposed?0:4,materials:disposed?0:4,nodes:disposed?0:6,
      drawCalls:disposed?0:batches.reduce((sum,b)=>sum+Number(b.count>0),0),disposed}),
    dispose(){if(disposed)return;disposed=true;for(const target of batches)target.dispose();tableRoot.removeFromParent();worldRoot.removeFromParent();},
  };
}
