import { AdditiveBlending, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Points, ShaderMaterial } from 'three';
import type { GameEvent, GameSnapshot } from '../game/types';
import type { Quality } from '../storage/preferences';
import { sampleRainbow } from './rainbow';

export const PARTICLE_LIMIT = 1536;
const LIFE = 0.7;
/** Fixed GPU buffers and a bounded ring: a crowded rally cannot grow resources. */
export function createFireworks() {
  const geometry = new BufferGeometry();
  const position = new Float32BufferAttribute(new Float32Array(PARTICLE_LIMIT * 3),3).setUsage(DynamicDrawUsage);
  const color = new Float32BufferAttribute(new Float32Array(PARTICLE_LIMIT * 3),3).setUsage(DynamicDrawUsage);
  const opacity = new Float32BufferAttribute(new Float32Array(PARTICLE_LIMIT),1).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position',position); geometry.setAttribute('color',color); geometry.setAttribute('opacity',opacity);
  geometry.setDrawRange(0,0);
  const material = new ShaderMaterial({ transparent:true, depthWrite:false, blending:AdditiveBlending, toneMapped:false,
    vertexShader: `attribute vec3 color; attribute float opacity; varying vec3 vColor; varying float vOpacity;
      void main(){vColor=color;vOpacity=opacity;vec4 p=modelViewMatrix*vec4(position,1.0);
      gl_Position=projectionMatrix*p;gl_PointSize=clamp(38.0/max(1.0,-p.z),2.0,12.0);}`,
    fragmentShader: `varying vec3 vColor; varying float vOpacity;
      void main(){float r=length(gl_PointCoord-vec2(.5))*2.0;if(r>1.0)discard;
      gl_FragColor=vec4(vColor*1.2,vOpacity*(1.0-r)*(1.0-r));}` });
  const root = new Points(geometry,material); root.frustumCulled=false;
  const births = new Float64Array(PARTICLE_LIMIT).fill(-Infinity), origins = new Float32Array(PARTICLE_LIMIT*3);
  const velocities = new Float32Array(PARTICLE_LIMIT*3), hues = new Float32Array(PARTICLE_LIMIT);
  const seen = new Set<string>(), order:string[]=[];
  let runId='', cursor=0, active=0, disposed=false;
  const clear=()=>{births.fill(-Infinity);seen.clear();order.length=0;cursor=0;active=0;geometry.setDrawRange(0,0);};
  return { root, geometry, material, active:()=>active,
    update(snapshot:GameSnapshot,events:readonly GameEvent[],quality:Quality) {
      if(disposed)return;
      if(runId!==snapshot.runId){clear();runId=snapshot.runId;}
      if(snapshot.phase==='gameover'||snapshot.phase==='ready'){clear();return;}
      for(const event of events){
        if(event.runId!==runId||!event.effect||!event.position||seen.has(event.id)||event.time>snapshot.simTime+1e-9||snapshot.simTime-event.time>=LIFE)continue;
        seen.add(event.id);order.push(event.id);if(order.length>512)seen.delete(order.shift()!);
        const count=quality==='low'?12:24;
        for(let i=0;i<count;i++){
          const slot=cursor++%PARTICLE_LIMIT, index=slot*3;
          const angle=2*Math.PI*i/count+event.time*2.31, spread=.6+((i*17)%13)/20;
          births[slot]=event.time;hues[slot]=i/count;
          origins[index]=event.position.x;origins[index+1]=event.position.y;origins[index+2]=event.position.z;
          velocities[index]=Math.cos(angle)*spread;velocities[index+1]=.5+Math.sin(angle)*.55;velocities[index+2]=Math.sin(angle)*spread*.65;
        }
      }
      active=0;
      for(let slot=0;slot<PARTICLE_LIMIT;slot++){
        const age=snapshot.simTime-births[slot]!;if(age<0||age>=LIFE)continue;
        const index=slot*3;
        position.setXYZ(active,origins[index]!+velocities[index]!*age,origins[index+1]!+velocities[index+1]!*age-1.1*age*age,origins[index+2]!+velocities[index+2]!*age);
        const rgb=sampleRainbow(0,hues[slot]!);color.setXYZ(active,rgb.r,rgb.g,rgb.b);opacity.setX(active,(1-age/LIFE)*.8);active++;
      }
      geometry.setDrawRange(0,active);position.needsUpdate=true;color.needsUpdate=true;opacity.needsUpdate=true;
    },
    dispose(){if(disposed)return;disposed=true;clear();geometry.dispose();material.dispose();root.removeFromParent();},
  };
}
