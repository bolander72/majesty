import {JOURNEY_KEY,parseJourney} from './journey.mjs';
import {nativeRegionURL} from './region.mjs';

export async function initializeJourney({document,store,world,base,navigate}){
  const source=document.querySelector('#journey-source'),target=document.querySelector('#journey-target'),status=document.querySelector('#journey-status');
  for(const link of [source,target]){link.hidden=true;link.removeAttribute('href');}
  if(!world){status.textContent='Open a named world to remember region travel.';return;}
  try{
    const text=await store.read(JOURNEY_KEY);
    if(text===undefined||text===null){status.textContent='Your next saved region trip will appear here.';return;}
    const record=parseJourney(text,world);
    let navigating=false;
    function link(node,region,label){
      const destination=nativeRegionURL(region.x,region.y,base).href;
      node.textContent=label;node.href=destination;node.hidden=false;
      node.onclick=async event=>{
        event.preventDefault();if(navigating)return;navigating=true;
        try{await navigate(destination);}catch(error){navigating=false;status.textContent=`Could not open region: ${error.message}. Kingdom checkpoints are preserved.`;}
      };
    }
    if(record.state==='pending'){
      status.textContent='A saved trip has not confirmed arrival. Continue to its destination or reopen the kingdom saved before leaving.';
      link(target,record.target,`Continue to region ${record.target.x}, ${record.target.y}`);
      link(source,record.source,`Reopen saved region ${record.source.x}, ${record.source.y}`);
    }else{
      status.textContent='Open the last visited region. Majesty checks its checkpoint and imported content when loading; progress since the last save is not recorded here.';
      link(target,record.target,`Open region ${record.target.x}, ${record.target.y}`);
      if(record.source.x!==record.target.x||record.source.y!==record.target.y)
        link(source,record.source,`Reopen saved region ${record.source.x}, ${record.source.y}`);
    }
  }catch(error){status.textContent=`Travel recovery unavailable: ${error.message}. Kingdom checkpoints are preserved.`;}
}
