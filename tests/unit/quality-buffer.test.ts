// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createView } from '../../src/render/createView';
import { DEFAULT_CONFIG } from '../../src/game/config';
const resizes=vi.hoisted(()=>({count:0}));
vi.mock('three',async original=>{
  const actual=await original<typeof import('three')>();
  return {...actual,WebGLRenderer:class{
    canvas:HTMLCanvasElement;
    constructor(options:{canvas:HTMLCanvasElement}){this.canvas=options.canvas;}
    setPixelRatio(){} setSize(w:number,h:number,updateStyle:boolean){resizes.count++;expect(updateStyle).toBe(false);this.canvas.width=w;this.canvas.height=h;}
    dispose(){}
  }};
});
it('internal resolution preserves the existing live camera mapping and CSS dimensions; fixed modes ignore levels',()=>{
  const canvas=document.createElement('canvas'),rect={left:15,top:27,width:402,height:874};
  canvas.getContext=(()=>({}))as unknown as HTMLCanvasElement['getContext'];
  canvas.getBoundingClientRect=()=>({...rect,x:rect.left,y:rect.top,right:417,bottom:901,toJSON(){return rect;}});
  vi.stubGlobal('devicePixelRatio',3);
  const view=createView(canvas,DEFAULT_CONFIG);view.resize(rect.width,rect.height);
  view.setQuality('auto');const mapping=view.inputMapping();
  const points=[[.5,.5],[0,0],[1,0],[0,1],[1,1],[.5,0],[.5,1],[0,.5],[1,.5]].map(([x,y])=>[rect.left+x!*rect.width,rect.top+y!*rect.height]);
  const targets=points.map(([x,y])=>mapping.toWorld(x!,y!));
  expect(canvas.width).toBe(603);expect(canvas.height).toBe(1311);
  for(const level of [1,2,1,0]){
    view.setResolutionLevel!(level);
    const count=resizes.count;
    for(let i=0;i<30;i++)view.setResolutionLevel!(level);
    expect(resizes.count).toBe(count);
    expect(mapping.isCurrent!()).toBe(true);
    points.forEach(([x,y],i)=>expect(mapping.toWorld(x!,y!)).toEqual(targets[i]));
    expect(canvas.getBoundingClientRect().width).toBe(rect.width);expect(canvas.style.width).toBe('');
  }
  view.setQuality('low');expect(canvas.width).toBe(402);view.setResolutionLevel!(0);expect(canvas.width).toBe(402);
  view.setQuality('standard');expect(canvas.width).toBe(603);view.setResolutionLevel!(2);expect(canvas.width).toBe(603);
  view.dispose();vi.unstubAllGlobals();
});
