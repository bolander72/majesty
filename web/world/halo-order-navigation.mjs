// Prepare coordinate edits for stopped navigation commands in overlapping
// maps. This never changes an actor, reuses a native route, or publishes an owner.
import {checkpointActorOrderEntries} from './order-entries.mjs';
import {checkpointActorOrderNavigation} from './order-navigation.mjs';
import {haloRegionLayout,HALO_LAYOUT_VERSION,HALO_NATIVE_CELLS} from './halo-region-layout.mjs';
import {actorRegionCoordinates,actorRegionGridCells} from './actor-coordinates.mjs';

export const MAX_HALO_ORDER_COORDINATE_PATCHES=16384;
export async function checkpointHaloOrderCoordinatePlan(source,unitId,regions){
  if(regions?.version!==HALO_LAYOUT_VERSION)throw Error('Explicit halo-v1 navigation layout required');
  const from=haloRegionLayout(regions.sourceRegion),to=haloRegionLayout(regions.destinationRegion);
  const dx=from.native.originX-to.native.originX,dy=from.native.originY-to.native.originY;
  if(Math.abs(dx)+Math.abs(dy)!==from.core.widthCells*32)
    throw Error('Halo navigation requires adjacent cardinal regions');
  let entries=0;
  for await(const e of checkpointActorOrderEntries(source,unitId)){
    if(e.type!=='entry')continue;
    if(++entries>128||![2,4,7].includes(e.kind))throw Error('Unqualified halo navigation command');
    // This profile preserves absolute goals in the shared strip. A target
    // relative route needs independently reconciled target placement instead.
    if((e.kind===2||e.kind===4)&&e.words[25]!==0)throw Error('Target-relative halo navigation is unqualified');
    if(e.kind===2&&![0,0x4000].includes(e.words[24]))throw Error('Unqualified in-flight Move flags');
  }
  // Only Path4's consumed prefix can be omitted. Its original consumer reads
  // cursor/current and cursor+1; Queue7 has different completion semantics.
  // Keep the current/future points, cursor relationship and allocated capacity.
  const pathHeaders=new Map(),trimCounts=new Map();
  for await(const point of checkpointActorOrderNavigation(source,unitId)){
    const key=point.bank+':'+point.index;
    if(point.type==='navigation'&&point.kind===4)pathHeaders.set(key,point);
    if(point.type!=='coordinate'||point.kind!==4||point.field!=='waypoint')continue;
    actorRegionGridCells(point,from.native,from.native); // Always validate source.
    const x=point.x+dx/16,y=point.y+dy/16;
    if(x>=0&&y>=0&&x<HALO_NATIVE_CELLS*2&&y<HALO_NATIVE_CELLS*2)continue;
    const header=pathHeaders.get(key);
    if(!header||point.waypointIndex>=header.cursor)
      throw Error('Saved navigation cell is outside the destination region');
    trimCounts.set(key,point.waypointIndex+1);
  }
  const patches=[],consumedPathPrefixes=[];
  for(const [key,count]of trimCounts){
    const header=pathHeaders.get(key),body=header.cursorOffset-120;
    patches.push({offset:header.cursorOffset,size:4,before:header.cursor,after:header.cursor-count},
      {offset:body+136,size:4,before:header.count,after:header.count-count});
    consumedPathPrefixes.push(Object.freeze({bank:header.bank,index:header.index,kind:4,
      offset:body+140,size:count*8,removedPoints:count,sourceCursor:header.cursor,
      sourceCount:header.count,destinationCursor:header.cursor-count,destinationCount:header.count-count,
      capacity:header.capacity,policy:'omit-consumed-prefix-preserve-current-and-future'}));
  }
  let coordinates=0,waypoints=0;
  for await(const point of checkpointActorOrderNavigation(source,unitId)){
    if(point.type!=='coordinate')continue;
    ++coordinates;if(point.field==='waypoint')++waypoints;
    if(point.kind===4&&point.field==='waypoint'&&point.waypointIndex<(trimCounts.get(point.bank+':'+point.index)??0))continue;
    let projected;
    if(point.space==='navigation-grid')projected=actorRegionGridCells(point,from.native,to.native);
    else{
      const fixed=point.space==='native-fixed'?point:{x:point.x*2048,y:point.y*2048,z:0};
      projected=actorRegionCoordinates(fixed,from.native,to.native).fixed;
      if(point.space==='native-world')projected={x:projected.x/2048,y:projected.y/2048};
    }
    // Current/future points and all other coordinates must fit both maps.
    for(const[axis,index]of [['x',0],['y',1]]){
      const before=point[axis],after=projected[axis];
      if(before===after)continue;
      if(patches.length===MAX_HALO_ORDER_COORDINATE_PATCHES)throw Error('Halo coordinate patch budget exceeded');
      patches.push(Object.freeze({offset:point.offset+index*4,size:4,before:before>>>0,after:after>>>0,
        bank:point.bank,index:point.index,kind:point.kind,field:point.field,axis,space:point.space,
        ...(point.waypointIndex===undefined?{}:{waypointIndex:point.waypointIndex})}));
    }
  }
  return Object.freeze({version:HALO_LAYOUT_VERSION,sourceRegion:from.key,destinationRegion:to.key,
    nativeWidthCells:HALO_NATIVE_CELLS,deltaWorld:Object.freeze({x:dx,y:dy}),entries,coordinates,waypoints,
    patches:Object.freeze(patches),consumedPathPrefixes:Object.freeze(consumedPathPrefixes),
    elevationPolicy:'preserve-original-in-flight-elevation',
    destinationGroundQualified:false,destinationCollisionQualified:false,
    completeOrderMigration:false,nativeActivationQualified:false});
}
