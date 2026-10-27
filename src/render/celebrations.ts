import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, Group, Mesh, MeshBasicMaterial, NormalBlending } from 'three';
import { celebrationFrame } from '../game/celebrations';
import type { CelebrationPalette } from '../game/celebrations';
import type { GameConfig, GameSnapshot, Point3 } from '../game/types';
import { sampleRainbow } from './rainbow';
import type { RGB } from './rainbow';

type RGBA = RGB & { a: number };
/** Fixed batches: no scene nodes, materials or GPU buffers allocated per effect. */
function batch(quadCapacity: number, additive = false) {
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(quadCapacity * 18), 3).setUsage(DynamicDrawUsage);
  const color = new BufferAttribute(new Float32Array(quadCapacity * 24), 4).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', position); geometry.setAttribute('color', color); geometry.setDrawRange(0, 0);
  const material = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false,
    side: DoubleSide, blending: additive ? AdditiveBlending : NormalBlending, toneMapped: false });
  const mesh = new Mesh(geometry, material); mesh.frustumCulled = false;
  let quads = 0;
  return { mesh,
    clear() { quads = 0; },
    quad(a: Point3,b: Point3,c: Point3,d: Point3, rgba: RGBA) {
      if (quads >= quadCapacity) return;
      let vertex = quads++ * 6;
      for (const p of [a,b,d,b,c,d]) { position.setXYZ(vertex,p.x,p.y,p.z); color.setXYZW(vertex++,rgba.r,rgba.g,rgba.b,rgba.a); }
    },
    finish() { geometry.setDrawRange(0,quads*6); position.clearUpdateRanges();color.clearUpdateRanges(); if(quads){position.addUpdateRange(0,quads*18);color.addUpdateRange(0,quads*24);position.needsUpdate=true;color.needsUpdate=true;}mesh.visible=quads>0; },
    dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
type Batch = ReturnType<typeof batch>;
const hash = (n: number): number => { const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value); };
const paletteColor = (palette: CelebrationPalette,time: number,offset: number): RGB => {
  if(palette==='rainbow')return sampleRainbow(time,offset);
  return {black:{r:0,g:0,b:0},blue:{r:.025,g:.16,b:1},green:{r:.025,g:1,b:.12},gold:{r:1,g:.66,b:.03},white:{r:1,g:.98,b:.72}}[palette];
};
function ribbon(target: Batch,a: Point3,b: Point3,width: number,color: RGBA): void {
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  // Face the fixed player camera; works for vertical and horizontal arcs.
  const sx=dy*6-dz*3,sy=-dx*6,sz=dx*3, length=Math.hypot(sx,sy,sz)||1;
  const x=sx/length*width/2,y=sy/length*width/2,z=sz/length*width/2;
  target.quad({x:a.x-x,y:a.y-y,z:a.z-z},{x:a.x+x,y:a.y+y,z:a.z+z},
    {x:b.x+x,y:b.y+y,z:b.z+z},{x:b.x-x,y:b.y-y,z:b.z-z},color);
}
const segments = ['abcedf','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
const bars: Record<string,readonly [number,number,number,number]> = {
  a:[.1,0,.8,.12],b:[.78,.06,.12,.44],c:[.78,.5,.12,.44],d:[.1,.88,.8,.12],
  e:[.1,.5,.12,.44],f:[.1,.06,.12,.44],g:[.1,.44,.8,.12],
};

export function createCelebrationView(config: GameConfig, tableRig: Group) {
  const tableRoot = new Group(), worldRoot = new Group();tableRig.add(tableRoot);
  const electric=batch(204*8+48*8),electricGlow=batch(204*8+48*8,true);
  const digits=batch(14*3*7),digitGlow=batch(14*3*7,true),environment=batch(48);
  tableRoot.add(electricGlow.mesh,electric.mesh,digitGlow.mesh,digits.mesh);worldRoot.add(environment.mesh);
  electric.mesh.renderOrder=5;electricGlow.mesh.renderOrder=4;
  digits.mesh.renderOrder=7;digitGlow.mesh.renderOrder=6;environment.mesh.renderOrder=1;
  let stats={netBolts:0,edgeBolts:0,numbers:[] as number[],environment:null as 'rainbow'|'gold'|null};
  let disposed=false;
  function bolt(origin: Point3,size: number,seed: number,time: number,color: RGB,opacity: number,width: number) {
    // Interpolate dedicated deterministic noise; hard 18 Hz shape replacements
    // combined with the large loss burst produced unsafe flashes in captured video.
    const step=time*1.2,flicker=Math.floor(step),fraction=step-flicker;
    const blend=fraction*fraction*(3-2*fraction),angle=hash(seed)*Math.PI*2;
    let previous=origin;
    for(let j=1;j<=8;j++){
      const t=j/8,jitter=((1-blend)*hash(seed+j*13+flicker*19)+blend*hash(seed+j*13+(flicker+1)*19)-.5)*size*.38;
      const point={x:origin.x+Math.cos(angle)*size*t+jitter,y:origin.y+size*(t*.8+Math.sin(t*Math.PI)*.25),z:origin.z+Math.sin(angle)*size*t+jitter*.4};
      ribbon(electricGlow,previous,point,width*5,{...color,a:opacity*.16});
      ribbon(electric,previous,point,width,{...color,a:opacity});previous=point;
    }
  }
  function drawNumber(value: number,index: number,total: number,time: number,age: number,duration: number,palette: CelebrationPalette,reducedMotion=false) {
    const columns=total===1?1:total<=4?2:3,rows=Math.ceil(total/columns);
    const cellWidth=1.88/columns,cellDepth=1.5/rows;
    const text=String(value),pulse=reducedMotion?1:1+.06*Math.sin(age*11),scale=Math.min(cellWidth/(text.length*.68),cellDepth)*pulse;
    const left=-.94+cellWidth*(index%columns)+cellWidth/2-text.length*.68*scale/2;
    const top=.18+Math.floor(index/columns)*cellDepth+(cellDepth-scale)/2;
    const fade=Math.min(1,(duration-age)*5), entrance=Math.min(1,age/.15);
    const alpha=palette==='black'?1:fade*(.7+.3*entrance);
    for(let n=0;n<text.length;n++)for(const key of segments[Number(text[n])]!){
      const [x,z,w,h]=bars[key]!,color=paletteColor(palette,time,n*.23+x*.4+z*.25);
      const rect=(target:Batch,expand:number,y:number,rgba:RGBA)=>{
        const x1=left+(n*.68+x*.62)*scale-expand,z1=top+z*scale-expand;
        const x2=x1+w*.62*scale+expand*2,z2=z1+h*scale+expand*2;
        target.quad({x:x1,y,z:z1},{x:x2,y,z:z1},{x:x2,y,z:z2},{x:x1,y,z:z2},rgba);
      };
      const halo=palette==='black'?sampleRainbow(time,n*.3+z*.2):color;
      rect(digitGlow,.032*scale,config.tableY+.021,{...halo,a:fade*.38});
      rect(digits,0,config.tableY+.024,{...color,a:alpha});
    }
  }
  return {
    worldRoot,tableRoot,lightning:electric.mesh,numbers:digits.mesh,
    stats:()=>({...stats,numbers:[...stats.numbers]}),
    update(snapshot:GameSnapshot,reducedMotion=false,lowPriorityOpacity=1) {
      if(disposed)return;
      const time=snapshot.simTime,frame=celebrationFrame(snapshot.celebrations,time),motionTime=reducedMotion?0:time;
      electric.clear();electricGlow.clear();digits.clear();digitGlow.clear();environment.clear();
      // The event count and number notices are unchanged. Bound the visual
      // footprint instead of allowing 204 overlapping full-background bolts.
      const netBolts=snapshot.score>=1500?0:Math.min(24,frame.netBolts);
      for(let i=0;i<netBolts;i++)bolt({x:(hash(i+5)*2-1)*config.tableHalfWidth,y:config.tableY+.18,z:0},
        Math.min(.7,frame.strength?frame.netSize/frame.strength:0)*(.6+hash(i+50)*.4),i+1,motionTime,{r:.34,g:.78,b:1},frame.strength*.55*lowPriorityOpacity,Math.min(.02,.007+Math.min(100,snapshot.celebrations.lossStreak)*.00065));
      if(frame.edgeElectric&&snapshot.score<1500)for(let i=0;i<48;i++){
        const side=Math.floor(i/12),t=(i%12)/11;
        const origin=side<2?{x:(side===0?-1:1)*config.tableHalfWidth,y:config.tableY+.015,z:(t*2-1)*config.tableHalfLength}
          :{x:(t*2-1)*config.tableHalfWidth,y:config.tableY+.015,z:(side===2?-1:1)*config.tableHalfLength};
        bolt(origin,.18+hash(i+9)*.25,i+301,motionTime,{r:.08,g:1,b:.22},.9*lowPriorityOpacity,.009);
      }
      const numbers=[...frame.numbers].sort((a,b)=>b.value-a.value).slice(0,1);
      numbers.forEach((n,i)=>drawNumber(n.value,i,numbers.length,motionTime,n.age,n.duration,reducedMotion?({55:'black',77:'blue',88:'green',99:'gold'} as Record<number,CelebrationPalette>)[n.value]??n.palette:n.palette,reducedMotion));
      const ambientEnvironment=snapshot.score<1000?frame.environment:null;
      if(ambientEnvironment)for(let i=0;i<24;i++){
        const x1=-9+i*.75,x2=x1+.75,age=time-(snapshot.celebrations.centuryAt??time);
        // The five-second century cue keeps its rainbow/gold intent, but broad
        // surfaces crossfade instead of switching every .3s over moving colors.
        const blend=reducedMotion?0:.5-.5*Math.cos(age*Math.PI*2/1.2);
        const rainbow=paletteColor('rainbow',motionTime,i/24),gold=paletteColor('gold',motionTime,i/24);
        const color={r:rainbow.r+(gold.r-rainbow.r)*blend,g:rainbow.g+(gold.g-rainbow.g)*blend,b:rainbow.b+(gold.b-rainbow.b)*blend};
        const rgba={...color,a:.9*Math.min(1,Math.max(0,age)/.12,Math.max(0,5-age)/.25)},y=config.tableY-.792;
        environment.quad({x:x1,y,z:-9},{x:x2,y,z:-9},{x:x2,y,z:9},{x:x1,y,z:9},rgba);
        environment.quad({x:x1,y:y-.01,z:-6.08},{x:x2,y:y-.01,z:-6.08},{x:x2,y:y+12,z:-6.08},{x:x1,y:y+12,z:-6.08},rgba);
      }
      const shake=reducedMotion||snapshot.score>=1500?0:frame.shake;
      tableRig.position.set(Math.sin(time*5)*shake,Math.sin(time*6)*shake*.28,Math.cos(time*4.5)*shake*.35);
      tableRig.rotation.z=shake?Math.sin(time*5.5)*shake*.28:0;
      for(const target of [electric,electricGlow,digits,digitGlow,environment])target.finish();
      stats={netBolts,edgeBolts:frame.edgeElectric&&snapshot.score<1500?48:0,numbers:numbers.map(n=>n.value),environment:ambientEnvironment};
    },
    dispose(){if(disposed)return;disposed=true;for(const target of [electric,electricGlow,digits,digitGlow,environment])target.dispose();tableRoot.removeFromParent();worldRoot.removeFromParent();tableRig.position.set(0,0,0);tableRig.rotation.z=0;},
  };
}
