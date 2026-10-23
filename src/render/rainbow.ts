import { DEFAULT_CONFIG } from '../game/config';
export type RGB = Readonly<{ r: number; g: number; b: number }>;
/** Continuous seven-hue palette, shared game-time clock, no wall-time animation. */
export function sampleRainbow(simTime: number, phase: number): RGB {
  const hue = ((phase + simTime * 0.12) % 1 + 1) % 1;
  const channel = (offset: number): number => 0.025 + 0.975 * Math.max(0, Math.min(1, Math.abs(((hue * 6 + offset) % 6) - 3) - 1));
  return { r: channel(0), g: channel(4), b: channel(2) };
}
export function samplePulse(simTime: number): number {
  return 0.825 + 0.175 * Math.cos(Math.PI * simTime / DEFAULT_CONFIG.pulseHalfPeriod);
}

/** Smooth, irregular motion, isolated from the simulation's random source. */
export function sampleRandomMotion(time:number,seed:number):{x:number;y:number}{
  const step=time/0.85, index=Math.floor(step), t=step-index, smooth=t*t*(3-2*t);
  const hash=(n:number)=>{const value=Math.sin(n*127.1+seed*311.7)*43758.5453;return value-Math.floor(value);};
  const channel=(offset:number)=>2*(hash(index+offset)*(1-smooth)+hash(index+offset+1)*smooth)-1;
  return {x:channel(0),y:channel(73)};
}
