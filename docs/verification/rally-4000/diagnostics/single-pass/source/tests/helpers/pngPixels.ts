import { inflateSync } from 'node:zlib';

/** Decode trusted 8-bit RGB/RGBA browser PNGs without another test dependency. */
export function pngPixels(png:Buffer) {
  const parts:Buffer[]=[];let width=0,height=0,channels=0;
  for(let offset=8;offset<png.length;){
    const length=png.readUInt32BE(offset),kind=png.toString('ascii',offset+4,offset+8),data=png.subarray(offset+8,offset+8+length);
    if(kind==='IHDR'){
      width=data.readUInt32BE(0);height=data.readUInt32BE(4);channels=data[9]===6?4:data[9]===2?3:0;
      if(data[8]!==8||!channels||data[12]!==0)throw new Error('Expected8bit noninterlaced RGB/RGBA browser PNG');
    }
    if(kind==='IDAT')parts.push(data);offset+=length+12;
  }
  const raw=inflateSync(Buffer.concat(parts)),stride=width*channels,pixels=new Uint8Array(width*height*channels);
  const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)]!;
    for(let x=0;x<stride;x++){
      const left=x>=channels?pixels[y*stride+x-channels]!:0,up=y>0?pixels[(y-1)*stride+x]!:0,upperLeft=y>0&&x>=channels?pixels[(y-1)*stride+x-channels]!:0;
      const predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):filter===4?paeth(left,up,upperLeft):NaN;
      if(!Number.isFinite(predictor))throw new Error('Unsupported PNG filter');
      pixels[y*stride+x]=(raw[y*(stride+1)+1+x]!+predictor)&255;
    }
  }
  return {width,height,channels,pixels};
}

export function goldContribution(withAura:Buffer,withoutAura:Buffer) {
  const a=pngPixels(withAura),b=pngPixels(withoutAura);
  if(a.width!==b.width||a.height!==b.height||a.channels!==b.channels)throw new Error('Gold comparison dimensions differ');
  let count=0;const quadrants=[0,0,0,0];
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
    const index=(y*a.width+x)*a.channels;
    const red=(a.pixels[index]!-b.pixels[index]!)/255,green=(a.pixels[index+1]!-b.pixels[index+1]!)/255,blue=(a.pixels[index+2]!-b.pixels[index+2]!)/255;
    // This is a visible gold contribution relative to the exact same painted
    // background; white text cannot satisfy the positive red/green delta.
    if(red>.15&&green>.10&&blue<-.05){count++;quadrants[(y>=a.height/2?2:0)+(x>=a.width/2?1:0)]!++;}
  }
  return {count,quadrants,width:a.width,height:a.height};
}
