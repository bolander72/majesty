// Saved positions only. No actor activation, guessed parent coordinates or
// full-world unit catalogue retained after the snapshot lease ends.
import {checkpointPlacements} from './checkpoint.mjs';
import {TERRAIN_WINDOW_SIDE} from './terrain.mjs';

export const ATLAS_MARKER_WORDS=5,MAX_ATLAS_WINDOW_MARKERS=64;
export const MAX_ATLAS_WINDOW_MARKER_BYTES=ATLAS_MARKER_WORDS*MAX_ATLAS_WINDOW_MARKERS*4;
export const ATLAS_POSITION_SCALE=2048*32; // Q11 world position per terrain cell.

export async function savedUnitWindows(source,windows,width,height){
  if(!Array.isArray(windows)||windows.length>49||![width,height].every(n=>
    Number.isInteger(n)&&n>=32&&n<=1024&&n%32===0))throw new Error('Invalid saved unit window request');
  const selected=new Map();
  for(const [x,y]of windows){
    const key=`${x},${y}`;
    if(![x,y].every(Number.isInteger)||x<0||y<0||x%32||y%32||x+32>width||y+32>height||selected.has(key))
      throw new Error('Invalid saved unit window');
    selected.set(key,{words:null,count:0,omitted:0});
  }
  try{
    for await(const unit of checkpointPlacements(source)){
      const kind=unit.family==='BLDG'?1:unit.family==='VHCL'?2:0;
      if(!kind||unit.requiresParentPosition)continue;
      const {x,y}=unit.fixedPosition;
      if(x<0||y<0||x>=width*ATLAS_POSITION_SCALE||y>=height*ATLAS_POSITION_SCALE)continue;
      const wx=Math.floor(x/(ATLAS_POSITION_SCALE*TERRAIN_WINDOW_SIDE))*TERRAIN_WINDOW_SIDE;
      const wy=Math.floor(y/(ATLAS_POSITION_SCALE*TERRAIN_WINDOW_SIDE))*TERRAIN_WINDOW_SIDE;
      const window=selected.get(`${wx},${wy}`);if(!window)continue;
      if(window.count===MAX_ATLAS_WINDOW_MARKERS){++window.omitted;continue;}
      window.words??=new Int32Array(MAX_ATLAS_WINDOW_MARKERS*ATLAS_MARKER_WORDS);
      window.words.set([unit.unitId,unit.playerNumber,kind,x-wx*ATLAS_POSITION_SCALE,y-wy*ATLAS_POSITION_SCALE],
        window.count++*ATLAS_MARKER_WORDS);
    }
    // Compact one window at a time, releasing its oversized working buffer.
    for(const [key,window]of selected)selected.set(key,Object.freeze({
      markers:window.words?.slice(0,window.count*ATLAS_MARKER_WORDS)??new Int32Array(0),omittedMarkers:window.omitted}));
    return selected;
  }catch(error){selected.clear();throw error;}
}
