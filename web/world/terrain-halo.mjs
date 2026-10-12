// Geometry input for the original normal finalizer. No engine pointers,
// mutation, lighting policy or actor/navigation rebuild is performed here.
import {TERRAIN_WINDOW_SIDE,VERTEX_BYTES} from './terrain.mjs';
import {nativeVisibleWindows} from './terrain-scene.mjs';
import {requireExactWindowSeams} from './terrain-seam.mjs';
import {nativeHeightQ16,requireStableNativeHeight} from './native-height.mjs';

export const NORMAL_HALO_PAD=2;
export const NORMAL_HALO_STRIDE=TERRAIN_WINDOW_SIDE+1+NORMAL_HALO_PAD*2;
export const MAX_NORMAL_HALO_BYTES=NORMAL_HALO_STRIDE**2*4;
export function nativeNormalHalo(active,wx,wy){
  if(!active||typeof active.get!=='function'||![wx,wy].every(Number.isSafeInteger))
    throw new Error('Invalid native normal halo');
  const windows=new Map(),views=new Map();
  // Two extra cells on all four sides need the centre and eight neighbours.
  // The original finalizer skips its last cell row; a one-cell bottom halo
  // would leave the core's final vertex row using incomplete normal inputs.
  // Use the scene's canonical coordinate and world-boundary validation.
  const wanted=nativeVisibleWindows(wx*32+16,wy*32+16,1,1);
  for(const [x,y]of wanted){
    const key=`${x},${y}`,value=active.get(key);
    if(!value)throw new Error(`Native normal halo unavailable at ${key}`);
    const {width,height,vertices}=value;
    if(width!==TERRAIN_WINDOW_SIDE||height!==TERRAIN_WINDOW_SIDE)
      throw new Error('Invalid native normal halo window');
    windows.set(key,{width,height,vertices});
  }
  // Validate owned vertex buffers and all captured shared height bits before
  // choosing one canonical owner at duplicate window edges/corners.
  requireExactWindowSeams(windows,4);
  for(const [key,value]of windows)views.set(key,new DataView(value.vertices.buffer));
  const heights=new Int32Array(NORMAL_HALO_STRIDE**2),originX=wx*32-NORMAL_HALO_PAD,originY=wy*32-NORMAL_HALO_PAD;
  for(let y=0;y<NORMAL_HALO_STRIDE;++y)for(let x=0;x<NORMAL_HALO_STRIDE;++x){
    const gx=originX+x,gy=originY+y,bx=Math.floor(gx/32),by=Math.floor(gy/32);
    const localX=gx-bx*32,localY=gy-by*32;
    const bits=views.get(`${bx},${by}`).getUint32((localY*33+localX)*VERTEX_BYTES,true);
    requireStableNativeHeight(bits);heights[y*NORMAL_HALO_STRIDE+x]=nativeHeightQ16(bits);
  }
  return Object.freeze({originX,originY,width:NORMAL_HALO_STRIDE-1,height:NORMAL_HALO_STRIDE-1,
    stride:NORMAL_HALO_STRIDE,coreX:NORMAL_HALO_PAD,coreY:NORMAL_HALO_PAD,coreSide:TERRAIN_WINDOW_SIDE,heights});
}
