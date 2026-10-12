// A fresh neighbor has no import capsule yet: its original world must first
// exist. Stage a separate, inert request while the captured source stays held.
// Only the engine's generation action may unload it; staging issues no action.
import {Sha256} from './sha256.mjs';
import {regionKey} from './region.mjs';
import {HALO_LAYOUT_VERSION,HALO_NATIVE_CELLS,HALO_CORE_CELLS} from './halo-region-layout.mjs';

export const HERO_GENERATION_REQUEST='Frontier_Hero_Generation_Request.json';
const hash=bytes=>new Sha256().update(bytes).hex();
const keys=(v,n)=>v&&Object.keys(v).sort().join(',')===[...n].sort().join(',');
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
function coordinates(key){
 if(typeof key!=='string'||key.length>24)throw Error('Invalid generation region');
 const xy=key.split('_').map(Number);
 if(xy.length!==2||regionKey(...xy)!==key)throw Error('Invalid generation region');
 return xy;
}
// Match the pinned engine's region_seed, including signed coordinate wrapping.
export function nativeRegionGenerationSeed(key){
 const [x,y]=coordinates(key);
 let h=(Math.imul(71201^x,0x045d9f3b)^Math.imul(y,0x27d4eb2d))>>>0;
 h=(h^(h>>>16))>>>0;h=Math.imul(h,0x045d9f3b)>>>0;h=(h^(h>>>16))>>>0;
 return (h&0x7fffffff)||1;
}
function generationInput(request){
 const fields=['serial','sourceRegion','targetRegion','sourceClock','sourceAlias','homeAlias','sourceNativeManifest','ownerManifest'];
 if(!keys(request,fields)||!uint(request.serial)||!request.serial||!uint(request.sourceClock)||
  !keys(request.sourceAlias,['unitId','agentId'])||!uint(request.sourceAlias.unitId)||!request.sourceAlias.unitId||
  !uint(request.sourceAlias.agentId,0x7fffffff)||!request.sourceAlias.agentId||
  !keys(request.homeAlias,['kind','unitId','agentId'])||!['native','proxy'].includes(request.homeAlias.kind)||
  !uint(request.homeAlias.unitId)||(request.homeAlias.kind==='native'?!request.homeAlias.unitId:request.homeAlias.unitId!==0)||
  !uint(request.homeAlias.agentId,0x7fffffff)||!request.homeAlias.agentId||
  !['sourceNativeManifest','ownerManifest'].every(k=>typeof request[k]==='string'&&request[k].length>0&&request[k].length<=512&&
    /^[\x20-\x7e\n]+$/.test(request[k])))throw Error('Invalid captured generation boundary');
 const [sx,sy]=coordinates(request.sourceRegion),[tx,ty]=coordinates(request.targetRegion);
 if(Math.abs(sx-tx)+Math.abs(sy-ty)!==1)throw Error('Generation requires one neighboring region');
 return {version:1,kind:'majesty-hero-generation-input-v1',serial:request.serial,
  sourceRegion:request.sourceRegion,targetRegion:request.targetRegion,sourceClock:request.sourceClock,
  sourceAlias:{...request.sourceAlias},homeAlias:{...request.homeAlias},
  sourceNativeManifest:request.sourceNativeManifest,ownerManifest:request.ownerManifest,
  generation:{layout:HALO_LAYOUT_VERSION,seed:nativeRegionGenerationSeed(request.targetRegion),
   nativeCells:HALO_NATIVE_CELLS,coreCells:HALO_CORE_CELLS}};
}

export async function stageNativeHeroGenerationRequest(source,request,{check,validate}={}){
 if(!source||typeof source.getFileHandle!=='function'||typeof check!=='function'||typeof validate!=='function')
  throw Error('Generation staging requires its held source validation');
 const input=generationInput(request),text=JSON.stringify(input)+'\n',bytes=new TextEncoder().encode(text);
 if(bytes.length>4096)throw Error('Generation request exceeds its bound');
 const sha256=hash(bytes);
 const result=idempotent=>Object.freeze({serial:input.serial,sourceRegion:input.sourceRegion,targetRegion:input.targetRegion,
  requestManifest:text,requestSha256:sha256,requestSize:bytes.length,idempotent,
  nativeAction:`frontier-hero-generate-${input.serial}`,nativeActionIssued:false,
  sourceRetired:false,destinationGenerated:false,heroImported:false,ownerTransferred:false});
 async function matches(){
  check();let file;
  try{const handle=await source.getFileHandle(HERO_GENERATION_REQUEST);check();file=await handle.getFile();check();}
  catch(error){if(error?.name==='NotFoundError')return false;throw error;}
  if(file.size!==bytes.length)return false;
  const saved=new Uint8Array(await file.slice(0,file.size).arrayBuffer());check();
  return saved.length===bytes.length&&hash(saved)===sha256;
 }
 check();await validate();check();
 if(await matches()){await validate();check();return result(true);}
 await validate();check();const handle=await source.getFileHandle(HERO_GENERATION_REQUEST,{create:true});check();
 const stream=await handle.createWritable();
 try{check();await stream.write(bytes);check();await stream.close();check();}
 catch(error){await stream.abort().catch(()=>{});throw error;}
 if(!await matches())throw Error('Generation request changed after staging');
 await validate();check();return result(false);
}
