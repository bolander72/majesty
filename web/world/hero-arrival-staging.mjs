// Stage one bounded import package. The caller owns the injected game lease
// and revalidates the held source, selected owner and dormant destination.
// Publishing this input manifest does not authorize native retirement/resume.
import {Sha256} from './sha256.mjs';
import {regionKey} from './region.mjs';

export const HERO_ARRIVAL_PACKAGE='Frontier_Hero_Arrival.pack';
export const HERO_ARRIVAL_INPUT='Frontier_Hero_Travel_Input.json';
export const HERO_ARRIVAL_HOME='Frontier_Hero_Home.GPL';
const hash=bytes=>new Sha256().update(bytes).hex();
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const region=v=>typeof v==='string'&&v.length<=24&&regionKey(...v.split('_').map(Number))===v;

export function stageNativeHeroHomeInput(folder,input,options={}){
 return stageHeroArrivalInput(folder,input,options,false);
}
export function stageNativeHeroProxyInput(folder,input,options={}){
 return stageHeroArrivalInput(folder,input,options,true);
}
async function stageHeroArrivalInput(folder,input,{check,validate}={},proxy){
 if(!folder||typeof folder.getFileHandle!=='function'||typeof check!=='function'||typeof validate!=='function'||
  !input||!uint(input.serial)||!input.serial||!region(input.sourceRegion)||!region(input.targetRegion)||
  !uint(input.sourceClock)||!uint(input.destinationClock)||
  !uint(input.sourceAlias?.unitId)||!input.sourceAlias.unitId||!uint(input.sourceAlias.agentId,0x7fffffff)||!input.sourceAlias.agentId||
  input.homeAlias?.kind!==(proxy?'proxy':'native')||!uint(input.homeAlias.unitId)||
  (proxy?input.homeAlias.unitId!==0:!input.homeAlias.unitId)||
  !uint(input.homeAlias.agentId,0x7fffffff)||!input.homeAlias.agentId||
  ![input.sourceNativeManifest,input.destinationNativeManifest,input.ownerManifest].every(v=>typeof v==='string'&&v.length>0&&v.length<=4096)||
  !(input.pack instanceof Uint8Array)||input.pack.length<96||input.pack.length>256*1024||!digest(input.sha256))
  throw Error('Invalid native home arrival staging');
 if(proxy&&(!['reserve-new','reuse-existing'].includes(input.homeAdmission)||
  !(input.homeRecord instanceof Uint8Array)||input.homeRecord.length<56||input.homeRecord.length>1024||!digest(input.homeSha256)))
  throw Error('Invalid proxy home arrival staging');
 const r={...input,sourceAlias:{...input.sourceAlias},homeAlias:{...input.homeAlias},pack:Uint8Array.from(input.pack),
  ...(proxy?{homeRecord:Uint8Array.from(input.homeRecord)}:{})};
 check();if(hash(r.pack)!==r.sha256)throw Error('Native home arrival package changed');
 if(proxy&&hash(r.homeRecord)!==r.homeSha256)throw Error('Proxy home arrival record changed');
 const [sx,sy]=r.sourceRegion.split('_').map(Number),[tx,ty]=r.targetRegion.split('_').map(Number);
 if(Math.abs(sx-tx)+Math.abs(sy-ty)!==1)throw Error('Native home arrival must target one neighbor');
 const view=new DataView(r.pack.buffer),header=[0x3141484d,1,4,r.sourceClock,r.destinationClock,
  r.sourceAlias.unitId,r.sourceAlias.agentId,r.homeAlias.agentId,100000,1000,0,r.pack.length-96];
 if(header.some((n,i)=>view.getUint32(i*4,true)!==n))throw Error('Native home arrival package differs from its staged boundary');
 let at=48;
 for(let kind=0;kind<4;kind++){
  if(at+12>r.pack.length||view.getUint32(at,true)!==kind||view.getUint32(at+4,true)!==r.sourceAlias.unitId)
   throw Error('Invalid native home arrival package descriptor');
  const size=view.getUint32(at+8,true);if(!size||size>64*1024||at+12+size>r.pack.length)throw Error('Invalid native home arrival record size');
  at+=12+size;
 }
 if(at!==r.pack.length)throw Error('Trailing native home arrival package bytes');
 const manifest=JSON.stringify({version:1,kind:proxy?'majesty-hero-proxy-home-input-v1':'majesty-hero-native-home-input-v1',serial:r.serial,
  sourceRegion:r.sourceRegion,targetRegion:r.targetRegion,sourceClock:r.sourceClock,destinationClock:r.destinationClock,
  sourceAlias:r.sourceAlias,homeAlias:r.homeAlias,sourceNativeManifest:r.sourceNativeManifest,
  destinationNativeManifest:r.destinationNativeManifest,ownerManifest:r.ownerManifest,
  ...(proxy?{home:{filename:HERO_ARRIVAL_HOME,admission:r.homeAdmission,size:r.homeRecord.length,sha256:r.homeSha256}}:{}),
  package:{filename:HERO_ARRIVAL_PACKAGE,size:r.pack.length,sha256:r.sha256}})+'\n';
 const encoded=new TextEncoder().encode(manifest);if(encoded.length>4096)throw Error('Native home input manifest exceeds its byte budget');
 async function write(name,bytes){
  check();const handle=await folder.getFileHandle(name,{create:true});check();
  const writable=await handle.createWritable();
  try{check();for(let offset=0;offset<bytes.length;offset+=4096){await writable.write(bytes.subarray(offset,offset+4096));check();}
   await writable.close();check();
  }catch(error){await writable.abort().catch(()=>{});throw error;}
 }
 async function verify(name,size,sha256){
  check();const handle=await folder.getFileHandle(name);check();const file=await handle.getFile();check();
  if(file.size!==size)throw Error('Staged native home input size differs');
  const digest=new Sha256();for(let offset=0;offset<size;offset+=4096){
   const bytes=new Uint8Array(await file.slice(offset,Math.min(size,offset+4096)).arrayBuffer());check();
   if(bytes.length!==Math.min(4096,size-offset))throw Error('Truncated staged native home input');digest.update(bytes);
  }
  if(digest.hex()!==sha256)throw Error('Staged native home input digest differs');
 }
 check();await validate();check();
 const result=idempotent=>Object.freeze({serial:r.serial,targetRegion:r.targetRegion,inputManifest:manifest,
  inputSha256:hash(encoded),packageSha256:r.sha256,packageSize:r.pack.length,idempotent,
  sourceRetired:false,destinationLoaded:false,heroImported:false,ownerTransferred:false});
 let old;
 try{const handle=await folder.getFileHandle(HERO_ARRIVAL_INPUT);check();old=await handle.getFile();check();}
 catch(error){if(error?.name!=='NotFoundError')throw error;}
 if(old?.size===encoded.length){
  const bytes=new Uint8Array(await old.slice(0,old.size).arrayBuffer());check();
  if(bytes.length===encoded.length&&hash(bytes)===hash(encoded)){
   if(proxy)await verify(HERO_ARRIVAL_HOME,r.homeRecord.length,r.homeSha256);
   await verify(HERO_ARRIVAL_PACKAGE,r.pack.length,r.sha256);await validate();check();return result(true);
  }
 }
 if(proxy){await write(HERO_ARRIVAL_HOME,r.homeRecord);await verify(HERO_ARRIVAL_HOME,r.homeRecord.length,r.homeSha256);}
 await write(HERO_ARRIVAL_PACKAGE,r.pack);await verify(HERO_ARRIVAL_PACKAGE,r.pack.length,r.sha256);
 await validate();check(); // Select the manifest only after both worlds still match.
 await write(HERO_ARRIVAL_INPUT,encoded);await verify(HERO_ARRIVAL_INPUT,encoded.length,hash(encoded));check();
 return result(false);
}
