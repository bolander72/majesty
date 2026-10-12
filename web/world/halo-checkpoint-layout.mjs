// Admit a caller's explicit halo-v1 recipe only after checking the actual saved
// MAP/MTER dimensions and every height. A region name alone is not authority.
import {checkpointTerrain,VERTEX_BYTES} from './terrain.mjs';
import {haloRegionLayout,haloTerrainHeight,haloSharedVertex,HALO_LAYOUT_VERSION,HALO_NATIVE_CELLS} from './halo-region-layout.mjs';
import {nativeHeightBits,requireStableNativeHeight} from './native-height.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';

export async function requireCheckpointHaloLayout(source,key,version,{signal}={}){
  if(version!==HALO_LAYOUT_VERSION)throw Error('Halo travel requires an explicit supported layout');
  const layout=haloRegionLayout(key);checkCheckpointReadSignal(signal);
  const terrain=await checkpointTerrain(source);checkCheckpointReadSignal(signal);
  if(terrain.width!==HALO_NATIVE_CELLS||terrain.height!==HALO_NATIVE_CELLS)
    throw Error('Saved kingdom dimensions differ from the halo layout');
  // One packed row, no full terrain copy or growing region cache. The height
  // bits must survive original loading; shading and tile data are untouched.
  let sharedVertices=0;
  for(let y=0;y<=HALO_NATIVE_CELLS;++y){
    checkCheckpointReadSignal(signal);
    const row=await source.readAt(terrain.heightOffset(0,y),(HALO_NATIVE_CELLS+1)*VERTEX_BYTES);
    checkCheckpointReadSignal(signal);
    if(!(row instanceof Uint8Array)||row.length!==(HALO_NATIVE_CELLS+1)*VERTEX_BYTES)throw Error('Truncated halo terrain row');
    const view=new DataView(row.buffer,row.byteOffset,row.byteLength);
    for(let x=0;x<=HALO_NATIVE_CELLS;++x){
      const bits=view.getUint32(x*VERTEX_BYTES,true);requireStableNativeHeight(bits);
      // Original building foundations may change interior terrain. Only the
      // protected overlap bands belong to the common global height recipe.
      if(haloSharedVertex(x,y)){
        ++sharedVertices;if(bits!==nativeHeightBits(haloTerrainHeight(key,x,y)))
          throw Error('Saved kingdom heights differ from the explicit halo layout');
      }
    }
  }
  return Object.freeze({version:HALO_LAYOUT_VERSION,key,core:Object.freeze({...layout.core}),
    native:Object.freeze({...layout.native}),verifiedVertices:(HALO_NATIVE_CELLS+1)**2,sharedVertices,
    largestTerrainRead:(HALO_NATIVE_CELLS+1)*VERTEX_BYTES});
}
