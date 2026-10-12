import {haloTerrainHeight} from '../../web/world/halo-region-layout.mjs';
import {connectedHeightQ16} from '../../web/world/connected-height.mjs';
import {nativeHeightBits} from '../../web/world/native-height.mjs';
export function haloTerrainCheckpoint(key,{width=128,height=128,legacy=false,defect=null}={}){
  function chunk(tag,version,count,...parts){const body=Buffer.concat(parts),head=Buffer.alloc(16);
    head.write(tag);head.writeUInt32LE(body.length,4);head.writeUInt32LE(version,8);head.writeUInt32LE(count,12);return Buffer.concat([head,body]);}
  const map=Buffer.alloc(40);map.writeUInt32LE(width);map.writeUInt32LE(height,4);
  const vertices=Buffer.alloc((width+1)*(height+1)*9),cells=Buffer.alloc(width*height*5),[rx,ry]=key.split('_').map(Number);
  for(let y=0;y<=height;++y)for(let x=0;x<=width;++x){
    const at=(y*(width+1)+x)*9,value=legacy?connectedHeightQ16(rx*128+x,ry*128+y):haloTerrainHeight(key,x,y);
    vertices.writeUInt32LE(nativeHeightBits(value),at);vertices[at+4]=255;vertices.writeUInt32LE(0xaabbccdd,at+5);
  }
  if(defect){const at=(defect.y*(width+1)+defect.x)*9;vertices.writeUInt32LE(defect.bits??0x7fc00000,at);}
  return Buffer.concat([chunk('MAP ',0,1,chunk('PRIM',2,0,map)),chunk('MTER',0,2,
    chunk('MVTX',0,1,chunk('PRIM',2,(width+1)*(height+1),vertices)),chunk('MCEL',0,1,chunk('PRIM',5,width*height,cells)))]);
}
