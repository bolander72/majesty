import {checkpointTerrain,TERRAIN_WINDOW_SIDE,MAX_NATIVE_MAP_SIDE} from './terrain.mjs';
import {MAX_NATIVE_ACTIVE_WINDOWS} from './terrain-scene.mjs';
import {regionKey} from './region.mjs';
import {Sha256} from './sha256.mjs';
import {savedUnitWindows} from './atlas-units.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';

// Load only requested independent saved realms under the world's read lease.
// No persistent in-memory catalogue and no source retained after the callback.
export function realmTerrainProvider(store,{realmWidth=128,realmHeight=128,includeUnits=false}={}){
  if(!store||typeof store.withRegions!=='function'||typeof includeUnits!=='boolean'||![realmWidth,realmHeight].every(n=>
      Number.isSafeInteger(n)&&n>=32&&n<=MAX_NATIVE_MAP_SIDE&&n%32===0))throw new Error('Invalid native realm terrain layout');
  const layout=`${realmWidth}x${realmHeight}`,limit=1000000*MAX_NATIVE_MAP_SIDE/32+MAX_NATIVE_MAP_SIDE/32;
  function locate(wx,wy){
    if(!Number.isSafeInteger(wx)||!Number.isSafeInteger(wy)||Math.abs(wx)>limit||Math.abs(wy)>limit)
      throw new Error('Invalid native realm window');
    const x=wx*32,y=wy*32,rx=Math.floor(x/realmWidth),ry=Math.floor(y/realmHeight);
    return {key:Math.abs(rx)<=1000000&&Math.abs(ry)<=1000000?regionKey(rx,ry):null,x:x-rx*realmWidth,y:y-ry*realmHeight};
  }
  return {async withSnapshot(consume,{windows,signal}={}){
    checkCheckpointReadSignal(signal);
    if(typeof consume!=='function'||!Array.isArray(windows)||windows.length>MAX_NATIVE_ACTIVE_WINDOWS)
      throw new Error('Invalid native realm terrain request');
    const wanted=new Map(),keys=new Set();
    for(const point of windows){
      if(!Array.isArray(point)||point.length!==2)throw new Error('Invalid native realm window');
      const id=point.join(','),position=locate(...point);
      if(wanted.has(id))throw new Error('Duplicate native realm window');
      wanted.set(id,position);if(position.key!==null)keys.add(position.key);
    }
    return store.withRegions([...keys].sort(),async selected=>{
      checkCheckpointReadSignal(signal);
      if(!(selected instanceof Map)||selected.size!==keys.size)throw new Error('Incomplete native realm read set');
      const terrains=new Map(),unitWindows=new Map(),hash=new Sha256(),encoder=new TextEncoder();
      for(const key of [...keys].sort()){
        if(!selected.has(key))throw new Error('Incomplete native realm read set');
        const value=selected.get(key);hash.update(encoder.encode(key+'\n'+(value?.record.manifest??'missing')+'\n'));
        if(value){
          const terrain=await checkpointTerrain(value.source);
          checkCheckpointReadSignal(signal);
          if(terrain.width!==realmWidth||terrain.height!==realmHeight)throw new Error('Native realm dimensions differ from layout');
          terrains.set(key,terrain);
        }
      }
      let active=true;
      function position(wx,wy){
        checkCheckpointReadSignal(signal);
        if(!active)throw new Error('Native realm terrain lease ended');
        if(!Number.isSafeInteger(wx)||!Number.isSafeInteger(wy))throw new Error('Invalid native realm window');
        const value=wanted.get(`${wx},${wy}`);if(!value)throw new Error('Native window outside captured scene');return value;
      }
      const snapshot=Object.freeze({identity:layout+':'+hash.hex(),windowIdentity(wx,wy){
        const p=position(wx,wy);return layout+':'+p.key+':'+(selected.get(p.key)?.record.manifest??'missing');
      },async readWindow(wx,wy){
        const p=position(wx,wy),terrain=terrains.get(p.key);
        if(!terrain)return null;
        const value=await terrain.window(p.x,p.y,TERRAIN_WINDOW_SIDE,TERRAIN_WINDOW_SIDE);
        checkCheckpointReadSignal(signal);
        if(includeUnits&&!unitWindows.has(p.key)){
          const local=[...wanted.values()].filter(point=>point.key===p.key).map(point=>[point.x,point.y]);
          unitWindows.set(p.key,await savedUnitWindows(selected.get(p.key).source,local,realmWidth,realmHeight));
          checkCheckpointReadSignal(signal);
        }
        if(!active)throw new Error('Native realm terrain lease ended');
        const units=unitWindows.get(p.key)?.get(`${p.x},${p.y}`);
        return {...value,realmKey:p.key,...units};
      }});
      try{return await consume(snapshot);}finally{active=false;terrains.clear();unitWindows.clear();wanted.clear();}
    },{signal});
  }};
}
