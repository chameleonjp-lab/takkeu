import { expect,it } from 'vitest';
import { computeDrawingSize } from '../../src/render/quality';

it('caps large low-load canvases at 960x540 pixels while preserving phone-sized low-load and standard rendering',()=>{
  expect(computeDrawingSize(1280,720,1,'low')).toEqual({width:960,height:540});
  expect(computeDrawingSize(1280,720,2,'low')).toEqual({width:960,height:540});
  expect(computeDrawingSize(1280,720,1,'standard')).toEqual({width:1280,height:720});
  for(const dpr of [1,2,3])expect(computeDrawingSize(402,874,dpr,'low')).toEqual({width:402,height:874});
  for(const [w,h] of [[720,1280],[1920,1080],[3840,1080],[800,2000]]){
    const low=computeDrawingSize(w!,h!,2,'low');expect(low.width*low.height).toBeLessThanOrEqual(960*540);
    const scale=Math.sqrt((960*540)/(w!*h!));
    // Integer backing-store dimensions can each round down by less than one pixel.
    expect(Math.abs(low.width-w!*scale)).toBeLessThan(1);
    expect(Math.abs(low.height-h!*scale)).toBeLessThan(1);
  }
});
