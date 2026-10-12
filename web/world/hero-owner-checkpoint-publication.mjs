// A paused engine's continued checkpoint advances its existing hero owner.
// The caller holds the game/world writer lease; no identity or native content
// fingerprint is rewritten here. The journal verifies the complete saved graph.
import {canonicalHeroHomeAliases,registeredHeroRegions} from './entity-home-ownership.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {CheckpointReadLease,checkCheckpointReadSignal} from './checkpoint-lease.mjs';
import {MAX_CHECKPOINT_BYTES} from './checkpoint.mjs';

const keys=(v,n)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...n].sort().join(',');
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export async function publishHeldHeroOwnerCheckpoint(store,request,{signal,boundary=async()=>{}}={}){
 if(!store||typeof store.commit!=='function'||typeof store.withOwner!=='function'||
  !keys(request,['operationId','expectedManifest','region','alias','homeAlias','clock','sha256','source'])||
  !digest(request.operationId)||!digest(request.sha256)||!uint(request.clock)||
  typeof request.expectedManifest!=='string'||!request.expectedManifest.length||request.expectedManifest.length>4096||
  !keys(request.alias,['unitId','agentId'])||!uint(request.alias.unitId)||!request.alias.unitId||
  !uint(request.alias.agentId,0x7fffffff)||!request.alias.agentId||!request.source||
  !uint(request.source.size,MAX_CHECKPOINT_BYTES)||request.source.size<16||typeof request.source.readAt!=='function'||typeof boundary!=='function')
  throw Error('Invalid held hero owner checkpoint');
 registeredHeroRegions([request.region,request.region==='0_0'?'1_0':'0_0']);
 const home=canonicalHeroHomeAliases([request.homeAlias,request.homeAlias])[0];
 const {operationId,expectedManifest,region,clock,sha256}=request,alias={...request.alias};
 checkCheckpointReadSignal(signal);
 const lease=new CheckpointReadLease({maximum:1,signal,ended:'Held hero owner checkpoint read ended',
  bounds:'Held hero owner checkpoint read out of bounds',truncated:'Truncated held hero owner checkpoint'});
 try{
  const source=lease.source(request.source,request.source.size);
  if(await checkpointSavedClock(source)!==clock)throw Error('Held owner checkpoint clock differs');lease.check();
  await store.withOwner(async selected=>{
   lease.check();
   if(selected.owner.region!==region||selected.entry.alias.unitId!==alias.unitId||selected.entry.alias.agentId!==alias.agentId||
    ['kind','unitId','agentId'].some(k=>selected.entry.homeAlias[k]!==home[k]))throw Error('Held checkpoint differs from the current hero owner');
   if(await checkpointSavedClock(selected.source)>clock)throw Error('Held owner checkpoint predates the selected world');
  },{signal});lease.check();
  const record=await store.commit({kind:'save',operationId,expectedManifest,regions:[region],aliases:[alias],homeAliases:[home],worlds:[{source,sha256}]},
   async phase=>{lease.check();await boundary(phase);lease.check();});lease.check();
  await store.withOwner(async selected=>{
   lease.check();
   if(selected.record.manifest!==record.manifest||selected.owner.region!==region||selected.entry.alias.unitId!==alias.unitId||
    selected.entry.alias.agentId!==alias.agentId||['kind','unitId','agentId'].some(k=>selected.entry.homeAlias[k]!==home[k])||
    selected.entry.world.size!==source.size||selected.entry.world.sha256!==sha256||await checkpointSavedClock(selected.source)!==clock)
    throw Error('Published checkpoint differs from the held owner');
  },{signal});lease.check();
  return Object.freeze({region,clock,owner:Object.freeze({...alias}),home:Object.freeze({...home}),size:source.size,sha256,
   ownerRevision:record.revision,ownerManifest:record.manifest,idempotent:record.idempotent});
 }finally{lease.revoke();}
}
