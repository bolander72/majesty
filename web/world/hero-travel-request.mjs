// Copy the admitted destination input into the held source's fixed mailbox.
// This is inert until a separate native travel action is issued. File staging
// alone must never retire a hero, release a kingdom or resume original ticks.
import {Sha256} from './sha256.mjs';
import {regionKey} from './region.mjs';
import {HERO_ARRIVAL_INPUT,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_HOME} from './hero-arrival-staging.mjs';

export const HERO_TRAVEL_REQUEST='Frontier_Hero_Travel_Request.json';
const hash=bytes=>new Sha256().update(bytes).hex();
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const region=v=>typeof v==='string'&&v.length<=24&&regionKey(...v.split('_').map(Number))===v;
const keys=(v,n)=>v&&Object.keys(v).sort().join(',')===[...n].sort().join(',');

export async function stageNativeHeroTravelRequest(source,destination,staged,{check,validate}={}){
 staged=staged&&{...staged};
 if(!source||!destination||typeof source.getFileHandle!=='function'||typeof destination.getFileHandle!=='function'||
  typeof check!=='function'||typeof validate!=='function'||typeof staged?.inputManifest!=='string'||
  staged.inputManifest.length>4096||!digest(staged.inputSha256)||
  ['sourceRetired','destinationLoaded','heroImported','ownerTransferred'].some(k=>staged[k]!==false))
  throw Error('Travel request requires its staged arrival');
 const text=staged.inputManifest,encoded=new TextEncoder().encode(text);
 if(encoded.length>4096||hash(encoded)!==staged.inputSha256)throw Error('Staged travel input changed');
 let input;try{input=JSON.parse(text);}catch{throw Error('Invalid staged travel input');}
 const proxy=input.kind==='majesty-hero-proxy-home-input-v1';
 const fields=['version','kind','serial','sourceRegion','targetRegion','sourceClock','destinationClock','sourceAlias','homeAlias',
  'sourceNativeManifest','destinationNativeManifest','ownerManifest','package',...(proxy?['home']:[])];
 if(!keys(input,fields)||input.version!==1||(!proxy&&input.kind!=='majesty-hero-native-home-input-v1')||
  !uint(input.serial)||!input.serial||input.serial!==staged.serial||input.targetRegion!==staged.targetRegion||
  !region(input.sourceRegion)||!region(input.targetRegion)||!uint(input.sourceClock)||!uint(input.destinationClock)||
  !keys(input.sourceAlias,['unitId','agentId'])||!uint(input.sourceAlias.unitId)||!input.sourceAlias.unitId||
  !uint(input.sourceAlias.agentId,0x7fffffff)||!input.sourceAlias.agentId||
  !keys(input.homeAlias,['kind','unitId','agentId'])||input.homeAlias.kind!==(proxy?'proxy':'native')||
  !uint(input.homeAlias.unitId)||(proxy?input.homeAlias.unitId!==0:!input.homeAlias.unitId)||
  !uint(input.homeAlias.agentId,0x7fffffff)||!input.homeAlias.agentId||
  !['sourceNativeManifest','destinationNativeManifest','ownerManifest'].every(k=>typeof input[k]==='string'&&input[k].length>0&&input[k].length<=512)||
  !keys(input.package,['filename','size','sha256'])||input.package.filename!==HERO_ARRIVAL_PACKAGE||
  !uint(input.package.size,256*1024)||input.package.size<96||!digest(input.package.sha256)||
  input.package.size!==staged.packageSize||input.package.sha256!==staged.packageSha256||JSON.stringify(input)+'\n'!==text)
  throw Error('Invalid staged travel boundary');
 const [sx,sy]=input.sourceRegion.split('_').map(Number),[tx,ty]=input.targetRegion.split('_').map(Number);
 if(Math.abs(sx-tx)+Math.abs(sy-ty)!==1)throw Error('Travel request requires one neighbor');
 if(proxy&&(!keys(input.home,['filename','admission','size','sha256'])||input.home.filename!==HERO_ARRIVAL_HOME||
  !['reserve-new','reuse-existing'].includes(input.home.admission)||!uint(input.home.size,1024)||input.home.size<56||!digest(input.home.sha256)))
  throw Error('Invalid staged travel home');
 async function verify(folder,name,size,sha256){
  check();const handle=await folder.getFileHandle(name);check();const file=await handle.getFile();check();
  if(file.size!==size)throw Error('Travel input size changed');
  const h=new Sha256();for(let at=0;at<size;at+=4096){
   const n=Math.min(4096,size-at),bytes=new Uint8Array(await file.slice(at,at+n).arrayBuffer());check();
   if(bytes.length!==n)throw Error('Truncated travel input');h.update(bytes);
  }
  if(h.hex()!==sha256)throw Error('Travel input digest changed');
 }
 async function verifyDestination(){
  await verify(destination,HERO_ARRIVAL_INPUT,encoded.length,staged.inputSha256);
  if(proxy)await verify(destination,HERO_ARRIVAL_HOME,input.home.size,input.home.sha256);
  await verify(destination,HERO_ARRIVAL_PACKAGE,input.package.size,input.package.sha256);
 }
 check();await validate();check();await verifyDestination();
 await validate();check();
 const result=idempotent=>Object.freeze({serial:input.serial,sourceRegion:input.sourceRegion,targetRegion:input.targetRegion,
  requestManifest:text,requestSha256:staged.inputSha256,requestSize:encoded.length,idempotent,
  nativeAction:`frontier-hero-travel-${input.serial}`,nativeActionIssued:false,
  sourceRetired:false,destinationLoaded:false,heroImported:false,ownerTransferred:false});
 let previous;
 try{const handle=await source.getFileHandle(HERO_TRAVEL_REQUEST);check();previous=await handle.getFile();check();}
 catch(error){if(error?.name!=='NotFoundError')throw error;}
 if(previous?.size===encoded.length){
  const bytes=new Uint8Array(await previous.slice(0,previous.size).arrayBuffer());check();
  if(bytes.length===encoded.length&&hash(bytes)===staged.inputSha256){
   await validate();check();return result(true);
  }
 }
 const handle=await source.getFileHandle(HERO_TRAVEL_REQUEST,{create:true});check();
 const stream=await handle.createWritable();
 try{check();await stream.write(encoded);check();await stream.close();check();}
 catch(error){await stream.abort().catch(()=>{});throw error;}
 await verify(source,HERO_TRAVEL_REQUEST,encoded.length,staged.inputSha256);await verifyDestination();await validate();check();
 return result(false);
}
