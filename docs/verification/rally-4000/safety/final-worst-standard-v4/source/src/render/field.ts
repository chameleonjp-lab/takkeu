import { Group, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import type { GameConfig } from '../game/types';
import { sampleRandomMotion } from './rainbow';

/** Both surfaces sample the same screen-space field: their seam has no color boundary. */
export function createOpponentField(config:GameConfig){
  const root=new Group();root.visible=false;
  const material=new ShaderMaterial({toneMapped:false,uniforms:{uResolution:{value:new Vector2(1,1)},uTime:{value:0},uMotion:{value:new Vector2()},uPulse:{value:1}},
    vertexShader:`void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec2 uResolution;uniform float uTime;uniform vec2 uMotion;uniform float uPulse;
      vec3 rainbow(float h){vec3 p=abs(fract(h+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);return .025+.975*clamp(p-1.0,0.0,1.0);}
      void main(){vec2 uv=gl_FragCoord.xy/max(uResolution,vec2(1.0));
      float hue=uv.x*(.85+uMotion.x*.3)+uv.y*(.65+uMotion.y*.3)+uTime*.12+uMotion.x;
      gl_FragColor=vec4(rainbow(hue)*uPulse,1.0);}`});
  const floor=new Mesh(new PlaneGeometry(18,9),material);floor.rotation.x=-Math.PI/2;floor.position.set(0,config.tableY-.8,-4.5);
  const wall=new Mesh(new PlaneGeometry(18,12),material);wall.position.set(0,config.tableY+5.2,-6.15);
  root.add(floor,wall);
  return {root,material,surfaces:[floor,wall],
    resize(width:number,height:number){material.uniforms.uResolution!.value.set(width,height);},
    update(time:number,random:boolean,pulse:number,seed=490){const motion=random?sampleRandomMotion(time,seed):{x:0,y:0};
      material.uniforms.uTime!.value=time;material.uniforms.uMotion!.value.set(motion.x,motion.y);material.uniforms.uPulse!.value=pulse;},
  };
}
