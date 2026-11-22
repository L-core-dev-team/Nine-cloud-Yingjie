import {inflateSync} from "node:zlib";
import {pngInfo} from "../image-tasks/files.mjs";

// YJ-05 checks the envelope and every CRC. Also verify the static pixel stream before caching or outbound use.
export function staticPng(bytes) {
  const info=pngInfo(bytes);
  const depth=bytes[24],type=bytes[25],interlace=bytes[28];
  const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
  if(!depths[type]?.includes(depth) || bytes[26] || bytes[27] || interlace>1)throw Error("png-encoding");
  const channels={0:1,2:3,3:1,4:2,6:4}[type];
  const data=[];
  let palette=false,ended=false;
  for(let i=8;i<bytes.length;i+=12+bytes.readUInt32BE(i)){
    const n=bytes.readUInt32BE(i),tag=bytes.toString("latin1",i+4,i+8);
    if(tag==="acTL" || tag==="fcTL" || tag==="fdAT" || (tag==="IHDR" && i!==8))throw Error("non-static-png");
    if(tag==="IEND" && (n!==0 || i+12!==bytes.length))throw Error("invalid-iend");
    if(!/^[A-Za-z]{4}$/.test(tag) || (/^[A-Z]/.test(tag) && !["IHDR","PLTE","IDAT","IEND"].includes(tag)))throw Error("unknown-png-chunk");
    if(tag==="PLTE"){
      if(palette || data.length || type===0 || type===4 || !n || n%3 || n>768 || (type===3 && n/3>2**depth))throw Error("invalid-palette");
      palette=true;
    }
    if(tag==="IDAT"){
      if(ended || (type===3 && !palette))throw Error("invalid-idat");
      data.push(bytes.subarray(i+8,i+8+n));
    }else if(data.length)ended=true;
  }
  const passes=interlace?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
  const rows=[];
  let expected=0;
  for(const [x,y,dx,dy] of passes){
    const w=Math.ceil((info.width-x)/dx),h=Math.ceil((info.height-y)/dy);
    if(w<=0 || h<=0)continue;
    const stride=1+Math.ceil(w*channels*depth/8);
    rows.push({stride,h});expected+=stride*h;
  }
  if(expected>64*1024*1024)throw Error("pixels-too-large");
  const pixels=inflateSync(Buffer.concat(data),{maxOutputLength:expected});
  if(pixels.length!==expected)throw Error("incomplete-pixels");
  let offset=0;
  for(const {stride,h} of rows)for(let i=0;i<h;i++,offset+=stride)if(pixels[offset]>4)throw Error("invalid-png-filter");
  return info;
}
