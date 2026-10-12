// A held original arrival can resume only after its two saved worlds select
// the new owner together. The caller retains the game's exclusive world lease
// and guards the journal adapter for the lifetime of this operation.
import {registeredHeroRegions,canonicalHeroHomeAliases,registeredHeroHome} from './entity-home-ownership.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {CheckpointReadLease,checkCheckpointReadSignal} from './checkpoint-lease.mjs';
import {MAX_CHECKPOINT_BYTES} from './checkpoint.mjs';
import {Sha256} from './sha256.mjs';

const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uint=(v,max=0xffffffff)=>Number.isInteger(v)&&v>=0&&v<=max;
const keys=(v,n)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...n].sort().join(',');
const fail=()=>{throw Error('Invalid held hero arrival receipt');};
const hash=text=>new Sha256().update(new TextEncoder().encode(text)).hex();
function canonical(v){
 if(!keys(v,['serial','region','clock','unitId','agentId','homeAgentId','size','sha256'])||
  !uint(v.serial)||!v.serial||!uint(v.clock)||!uint(v.unitId)||!v.unitId||!uint(v.agentId,0x7fffffff)||!v.agentId||
  !uint(v.homeAgentId,0x7fffffff)||!v.homeAgentId||v.agentId===v.homeAgentId||!uint(v.size,MAX_CHECKPOINT_BYTES)||v.size<16||!digest(v.sha256))fail();
 registeredHeroRegions([v.region,v.region==='0_0'?'1_0':'0_0']);
 return Object.freeze({serial:v.serial,region:v.region,clock:v.clock,unitId:v.unitId,agentId:v.agentId,
  homeAgentId:v.homeAgentId,size:v.size,sha256:v.sha256});
}
export function nativeHeroArrivalReady(v){
 const r=canonical(v);
 return ['majesty-hero-travel-ready-v1',r.serial,r.region,r.clock,r.unitId,r.agentId,r.homeAgentId,r.size,r.sha256].join('|');
}
export function parseNativeHeroArrivalReady(text){
 if(typeof text!=='string'||text.length>256)fail();
 const f=text.split('|');if(f.length!==9||f[0]!=='majesty-hero-travel-ready-v1')fail();
 const r=canonical({serial:Number(f[1]),region:f[2],clock:Number(f[3]),unitId:Number(f[4]),agentId:Number(f[5]),
  homeAgentId:Number(f[6]),size:Number(f[7]),sha256:f[8]});
 if(nativeHeroArrivalReady(r)!==text)fail();return r;
}
export function nativeHeroArrivalPublished(ready,manifest){
 const r=parseNativeHeroArrivalReady(ready);
 if(typeof manifest!=='string'||!manifest.length||manifest.length>4096)throw Error('Invalid published hero owner manifest');
 let head;try{head=JSON.parse(manifest);}catch{throw Error('Invalid published hero owner manifest');}
 if(!keys(head,['version','identitySha256','revision','nodeSha256'])||head.version!==1||!uint(head.revision)||
  !digest(head.identitySha256)||!digest(head.nodeSha256)||JSON.stringify({version:1,identitySha256:head.identitySha256,
   revision:head.revision,nodeSha256:head.nodeSha256})+'\n'!==manifest)throw Error('Invalid published hero owner manifest');
 return ['majesty-hero-travel-published-v1',r.serial,r.region,r.clock,r.unitId,r.agentId,r.homeAgentId,r.size,r.sha256,hash(manifest)].join('|')+'\n';
}
function alias(v){
 if(!keys(v,['unitId','agentId'])||!uint(v.unitId)||!v.unitId||!uint(v.agentId,0x7fffffff)||!v.agentId)throw Error('Invalid outgoing hero alias');
 return Object.freeze({unitId:v.unitId,agentId:v.agentId});
}

// Native-ready is a scoped statement from the held engine, not proof that
// custody already changed. Original saved clocks and queue/home ownership are
// verified again by the production journal before an acknowledgement is made.
export async function publishHeldNativeHeroArrival(store,request,{signal,boundary=async()=>{}}={}){
 if(!store||typeof store.commit!=='function'||typeof store.withOwner!=='function'||
  !keys(request,['ready','operationId','expectedManifest','sourceRegion','sourceAlias','sourceHome','sourceClock','capturedSha256','retiredSource','activeSource'])||
  !digest(request.operationId)||!digest(request.capturedSha256)||typeof request.expectedManifest!=='string'||
  !request.expectedManifest.length||request.expectedManifest.length>4096||!uint(request.sourceClock)||typeof boundary!=='function')
  throw Error('Invalid held hero publication');
 checkCheckpointReadSignal(signal);
 const r=parseNativeHeroArrivalReady(request.ready),outgoing=alias(request.sourceAlias),regions=registeredHeroRegions([request.sourceRegion,r.region]);
 const [sx,sy]=regions[0].split('_').map(Number),[tx,ty]=regions[1].split('_').map(Number);
 if(Math.abs(sx-tx)+Math.abs(sy-ty)!==1)throw Error('Held hero arrival is not its adjacent kingdom');
 // The immutable registered origin identifies the real guild on return.
 // A native-ready packet carries its agent ID; it cannot invent a local guild
 // or reinterpret the actual origin building as a foreign pure reference.
 const origin=registeredHeroHome(store.identity).record.home;
 const home=r.region===origin.region?{kind:'native',unitId:origin.unitId,agentId:origin.agentId}:
  {kind:'proxy',unitId:0,agentId:r.homeAgentId};
 if(home.agentId!==r.homeAgentId)throw Error('Held arrival home differs from its registered native guild');
 const homes=canonicalHeroHomeAliases([request.sourceHome,home]);
 const expectedManifest=request.expectedManifest,operationId=request.operationId,sourceClock=request.sourceClock,capturedSha256=request.capturedSha256;
 const ready=request.ready,inputs=[request.retiredSource,request.activeSource].map(v=>{
  if(!keys(v,['source','sha256'])||!digest(v.sha256)||!v.source||!uint(v.source.size,MAX_CHECKPOINT_BYTES)||v.source.size<16||typeof v.source.readAt!=='function')
   throw Error('Invalid held hero saved pair');
  return {source:v.source,sha256:v.sha256};
 });
 if(inputs[1].source.size!==r.size||inputs[1].sha256!==r.sha256)throw Error('Activated save differs from the held native arrival');
 const lease=new CheckpointReadLease({maximum:2,signal,ended:'Held hero publication read ended',
  bounds:'Held hero publication read out of bounds',truncated:'Truncated held hero publication'});
 const incoming={unitId:r.unitId,agentId:r.agentId};
 try{
  for(const v of inputs)v.source=lease.source(v.source,v.source.size);
  if(await checkpointSavedClock(inputs[0].source)!==sourceClock||await checkpointSavedClock(inputs[1].source)!==r.clock)
   throw Error('Saved handoff clock differs from its held native boundary');
  await store.withOwner(async selected=>{
   lease.check();
   // An uncertain previous result may already select this exact arrival.
   // The journal's operation-ID/previous-head checks below decide retryability.
   if(selected.owner.region===regions[0]){
    if(selected.record.manifest!==expectedManifest||selected.entry.alias.unitId!==outgoing.unitId||selected.entry.alias.agentId!==outgoing.agentId||
      selected.entry.world.sha256!==capturedSha256||await checkpointSavedClock(selected.source)!==sourceClock||
      JSON.stringify(selected.entry.homeAlias)!==JSON.stringify(homes[0]))throw Error('Captured hero owner changed before handoff');
   }else if(selected.owner.region!==r.region||selected.entry.alias.unitId!==r.unitId||selected.entry.alias.agentId!==r.agentId||
     JSON.stringify(selected.entry.homeAlias)!==JSON.stringify(homes[1])||selected.entry.world.sha256!==r.sha256||selected.entry.world.size!==r.size)
    throw Error('Held hero publication selected a different owner');
  },{signal});lease.check();
  const published=await store.commit({kind:'handoff',operationId,expectedManifest,regions,aliases:[outgoing,incoming],homeAliases:homes,worlds:inputs},
   async phase=>{lease.check();await boundary(phase);lease.check();});lease.check();
  let selectedManifest;
  await store.withOwner(async selected=>{
   lease.check();
   if(selected.record.manifest!==published.manifest||selected.owner.region!==r.region||selected.entry.alias.unitId!==r.unitId||
     selected.entry.alias.agentId!==r.agentId||JSON.stringify(selected.entry.homeAlias)!==JSON.stringify(homes[1])||
     selected.entry.world.sha256!==r.sha256||selected.entry.world.size!==r.size||await checkpointSavedClock(selected.source)!==r.clock)
    throw Error('Published hero owner differs from its held arrival');
   selectedManifest=selected.record.manifest;
  },{signal});lease.check();
  return Object.freeze({serial:r.serial,region:r.region,clock:r.clock,owner:Object.freeze({...incoming}),home:Object.freeze({...homes[1]}),
   ownerManifest:selectedManifest,ownerManifestSha256:hash(selectedManifest),ownerRevision:published.revision,idempotent:published.idempotent,
   acknowledgement:nativeHeroArrivalPublished(ready,selectedManifest)});
 }finally{lease.revoke();}
}
