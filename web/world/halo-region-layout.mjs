// Fresh-world layout: a fixed native map contains its logical ownership core
// and two terrain cells of overlap on every side. Existing v1 saves keep their
// original origins; this geometry must never be inferred from a region key.
import {regionKey} from './region.mjs';
import {actorRegionCoordinates} from './actor-coordinates.mjs';
import {connectedHeightQ16} from './connected-height.mjs';
export const HALO_LAYOUT_VERSION='halo-v1',HALO_NATIVE_CELLS=128,HALO_CELLS=2;
export const HALO_CORE_CELLS=HALO_NATIVE_CELLS-2*HALO_CELLS;
const CELL=32,Q=2048,CORE=HALO_CORE_CELLS*CELL,GUARD_NAV_CELLS=2;
function coordinates(key){
  if(typeof key!=='string'||key.length>24)throw Error('Invalid halo region key');
  const parts=key.split('_').map(Number);
  if(parts.length!==2||regionKey(...parts)!==key)throw Error('Invalid halo region key');
  return parts;
}
export function haloRegionLayout(key){
  const[x,y]=coordinates(key),originX=x*CORE,originY=y*CORE;
  return {version:HALO_LAYOUT_VERSION,key,core:{originX,originY,widthCells:HALO_CORE_CELLS,heightCells:HALO_CORE_CELLS},
    native:{originX:originX-HALO_CELLS*CELL,originY:originY-HALO_CELLS*CELL,widthCells:HALO_NATIVE_CELLS,heightCells:HALO_NATIVE_CELLS}};
}
export function haloTerrainHeight(key,x,y){
  const[rx,ry]=coordinates(key);
  if(![x,y].every(n=>Number.isInteger(n)&&n>=0&&n<=HALO_NATIVE_CELLS))throw Error('Invalid halo terrain vertex');
  return connectedHeightQ16(rx*HALO_CORE_CELLS-HALO_CELLS+x,ry*HALO_CORE_CELLS-HALO_CELLS+y);
}
export function haloSharedVertex(x,y){
  if(![x,y].every(n=>Number.isInteger(n)&&n>=0&&n<=HALO_NATIVE_CELLS))throw Error('Invalid halo terrain vertex');
  return x<=2*HALO_CELLS||y<=2*HALO_CELLS||x>=HALO_NATIVE_CELLS-2*HALO_CELLS||y>=HALO_NATIVE_CELLS-2*HALO_CELLS;
}
// Observe an ORIGINAL accepted movement, still inside the source's physical
// map. Ownership changes at the inner core edge, with the complete footprint
// inside both maps. The caller must pause/retire/import/publish before resuming;
// this function neither moves an actor nor starts another native engine.
export function planHaloActorHandoff(previous,accepted,sourceKey){
  const from=haloRegionLayout(sourceKey),before=actorRegionCoordinates(previous,from.native,from.native),
    after=actorRegionCoordinates(accepted,from.native,from.native);
  const owner=p=>regionKey(Math.floor(p.x/(CORE*Q)),Math.floor(p.y/(CORE*Q)));
  if(owner(before.globalFixed)!==sourceKey)throw Error('Prior actor pose differs from selected halo owner');
  const targetKey=owner(after.globalFixed);if(targetKey===sourceKey)return null;
  const[a,b]=coordinates(sourceKey),[x,y]=coordinates(targetKey);
  if(Math.abs(x-a)+Math.abs(y-b)!==1)throw Error('Halo handoff requires one cardinal ownership boundary');
  const to=haloRegionLayout(targetKey),projected=actorRegionCoordinates(accepted,from.native,to.native);
  for(const grid of [after.grid,projected.grid])
    if([grid.x,grid.y].some(n=>n<GUARD_NAV_CELLS||n>=HALO_NATIVE_CELLS*2-GUARD_NAV_CELLS))throw Error('Halo actor footprint reaches a physical map boundary');
  return {version:HALO_LAYOUT_VERSION,sourceRegion:sourceKey,destinationRegion:targetKey,
    sourcePose:{x:accepted.x,y:accepted.y,z:accepted.z},destinationPose:projected.fixed,sourceGrid:after.grid,destinationGrid:projected.grid,
    previousGlobalFixed:before.globalFixed,globalFixed:projected.globalFixed,deltaWorld:projected.deltaWorld,
    footprintGuardNavigationCells:GUARD_NAV_CELLS,collisionQualified:false,sourceRetired:false,ownerPublished:false};
}
