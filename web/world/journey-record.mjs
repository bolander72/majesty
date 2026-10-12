// Shared bounded travel metadata validation; no native runtime or storage imports.
import {regionKey} from './region.mjs';
import {worldName} from './world-name.mjs';

export const JOURNEY_KEY='journey-v1',MAX_JOURNEY_BYTES=768;
function coordinate(value){
  if(!value||Object.keys(value).sort().join(',')!=='x,y')throw new Error('Invalid journey coordinates');
  const {x,y}=value;regionKey(x,y);return Object.freeze({x,y});
}
export function journeyContentIdentity(content){
  if(typeof content!=='string'||!/^[a-f0-9]{64}:[a-f0-9]{64}$/.test(content))throw new Error('Journey content identity unavailable');
  return content;
}
export function parseJourney(text,world){
  worldName(world);
  if(typeof text!=='string'||text.length>MAX_JOURNEY_BYTES)throw new Error('Invalid journey record size');
  const value=JSON.parse(text);
  if(!value||Object.keys(value).sort().join(',')!=='content,source,state,target,version,world'||
      value.version!==1||value.world!==world||!['pending','active'].includes(value.state))throw new Error('Invalid journey record');
  const source=coordinate(value.source),target=coordinate(value.target),distance=Math.abs(source.x-target.x)+Math.abs(source.y-target.y);
  if(distance>1||value.state==='pending'&&distance!==1)throw new Error('Invalid journey route');
  return Object.freeze({version:1,world,source,target,state:value.state,content:journeyContentIdentity(value.content)});
}
