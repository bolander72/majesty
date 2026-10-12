// Native coordinate-router v2 wire. Browser activation is not wired yet.
import {regionKey} from './region.mjs';
export const COORDINATE_TRAVEL_BYTES=36;
function coordinates(x,y){regionKey(x,y);return Object.freeze({x,y});}
export function coordinateTravelReady(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.length!==COORDINATE_TRAVEL_BYTES)throw new Error('Invalid coordinate travel record size');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.length);
  if(view.getUint32(0,true)!==0x32565254||view.getUint32(4,true)!==2||!view.getUint32(8,true))throw new Error('Unsupported coordinate travel record');
  const source=coordinates(view.getInt32(12,true),view.getInt32(16,true)),operation=view.getUint32(32,true);
  if(view.getInt32(20,true)!==source.x||view.getInt32(24,true)!==source.y||![0,2].includes(operation))throw new Error('Invalid coordinate travel readiness');
  return Object.freeze({serial:view.getUint32(8,true),source,initialClock:view.getUint32(28,true),finishOnly:operation===2});
}
export function coordinateTravelRequest(rawReady,target,{finish=false}={}){
  coordinateTravelReady(rawReady);
  const bytes=new Uint8Array(COORDINATE_TRAVEL_BYTES);bytes.set(rawReady);
  const ready=coordinateTravelReady(bytes),destination=coordinates(target?.x,target?.y);
  if(typeof finish!=='boolean'||finish!==ready.finishOnly)throw new Error('Coordinate travel operation differs from readiness');
  const distance=Math.abs(destination.x-ready.source.x)+Math.abs(destination.y-ready.source.y);
  if(distance!==(finish?0:1))throw new Error('Choose one adjacent region');
  const view=new DataView(bytes.buffer);
  view.setInt32(20,destination.x,true);view.setInt32(24,destination.y,true);view.setUint32(32,finish?2:1,true);
  return bytes;
}
