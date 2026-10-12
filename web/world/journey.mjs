// Optional navigation recovery. Kingdom bytes remain owned by native checkpoints.
// Keep one small record per named world, never a growing travel history.
import {BrowserRegionStore} from './stream.mjs';
import {selectedRegion,regionKey,nativeRegionURL,atlasURL} from './region.mjs';
import {selectedWorld} from './world-name.mjs';
import {nativeWorldSessionConfig} from './realm-session.mjs';

import {JOURNEY_KEY,parseJourney,journeyContentIdentity as identity} from './journey-record.mjs';
export {JOURNEY_KEY,MAX_JOURNEY_BYTES,parseJourney} from './journey-record.mjs';

function serialize(value){
  const text=JSON.stringify(value);parseJourney(text,value.world);return text;
}
async function withStore(world,open,consume){
  const store=await open(world,{nativeWorld:true});
  try{return await consume(store);}finally{store.close();}
}
export async function recordJourney(destination,{base=location.href,content,open=BrowserRegionStore.open}={}){
  const here=new URL(base),world=selectedWorld(here.search);if(!world)return;
  nativeWorldSessionConfig(here.search);
  const source=selectedRegion(here.search);if(!source)throw new Error('Journey requires a native region');
  const url=new URL(destination,base);let target,state;
  if(url.href===atlasURL(base).href){target={x:source.x,y:source.y};state='active';}
  else{
    const region=selectedRegion(url.search);
    if(!region||url.href!==nativeRegionURL(region.x,region.y,base).href)throw new Error('Journey destination differs from this world');
    target={x:region.x,y:region.y};state='pending';
  }
  const text=serialize({version:1,world,source:{x:source.x,y:source.y},target,state,content:identity(content)});
  await withStore(world,open,store=>store.write(JOURNEY_KEY,text));
}
export async function recordJourneyArrival({search=location.search,content,open=BrowserRegionStore.open}={}){
  const world=selectedWorld(search);if(!world)return;
  nativeWorldSessionConfig(search);
  const region=selectedRegion(search);if(!region)throw new Error('Journey requires a native region');
  const currentContent=identity(content);
  return withStore(world,open,async store=>{
    const text=await store.read(JOURNEY_KEY);if(text===undefined||text===null)return;
    const old=parseJourney(text,world);
    if(old.state!=='pending'||old.target.x!==region.x||old.target.y!==region.y)return;
    if(old.content!==currentContent)throw new Error('Journey requires the original game content');
    await store.write(JOURNEY_KEY,serialize({...old,state:'active'}));
  });
}
