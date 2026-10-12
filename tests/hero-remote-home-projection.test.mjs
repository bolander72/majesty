import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,world,source,hash} from './fixtures/registered-hero-world.mjs';
import {registerCheckpointGuildHome} from '../web/world/hero-home.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {prepareOrReuseRemoteHomeAgent} from '../web/world/remote-home-cache.mjs';
import {withProposedRemoteHome} from '../web/world/remote-home-projection.mjs';
import {checkpointAgentManagerLayout,checkpointNextAgentId,checkpointAgents,checkpointAgentQueues,checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {verifyRemoteHomeAgent,encodeRemoteHomeAgent} from '../web/world/remote-home.mjs';

async function setup(){
 const f=await fixture(),registered=registeredHeroHome(f.identity);
 const other=await registerCheckpointGuildHome(source(world(0,true,{variant:1})),
  {worldId:'b'.repeat(64),contentDigest:f.identity.contentDigest,region:'0_0',guildUnitId:469});
 const bytes=world(1,false,{registration:other}),destination=source(bytes);
 const proposal=await prepareOrReuseRemoteHomeAgent(destination,registered,
  {worldId:f.registration.worldId,contentDigest:f.identity.contentDigest,destinationRegion:'1_0',freshAgentId:100});
 assert.equal(proposal.plan.admission,'reserve-new');return {bytes,destination,registered,proposal};
}
test('fresh home projection preserves all existing agents and queues, increments the real counter and revokes the reader',async()=>{
 const f=await setup(),before=hash(f.bytes),old=await checkpointAgentManagerLayout(f.destination),queues=[];
 for await(const q of checkpointAgentQueues(f.destination))queues.push({type:q.type,queue:q.queue,index:q.index,agentId:q.agentId,activeQueue:q.activeQueue});
 const oldAgents=[];for await(const a of checkpointAgents(f.destination))oldAgents.push({id:a.agentId,record:await f.destination.readAt(a.offset,a.size)});
 let escaped,plan;
 await withProposedRemoteHome(f.destination,f.registered,f.proposal,async projected=>{
  escaped=projected.source;plan=projected.plan;
  assert.equal(await checkpointNextAgentId(escaped),101);
  const layout=await checkpointAgentManagerLayout(escaped);assert.equal(layout.count,old.count+1);
  let index=0;
  for await(const a of checkpointAgents(escaped)){
   const record=await escaped.readAt(a.offset,a.size);
   if(a.agentId===100)await verifyRemoteHomeAgent(source(record),f.registered,100);
   else{assert.equal(a.agentId,oldAgents[index].id);assert.deepEqual(record,oldAgents[index++].record);}
  }assert.equal(index,oldAgents.length);
  const newQueues=[];for await(const q of checkpointAgentQueues(escaped))newQueues.push({type:q.type,queue:q.queue,index:q.index,agentId:q.agentId,activeQueue:q.activeQueue});
  assert.deepEqual(newQueues,queues);
  for await(const u of checkpointUnitAgentLinks(escaped))assert.notEqual(u.agentId,100);
  // Exercise partial DWORD patches and reads crossing both insertion edges.
  for(const at of [old.groupOffset+3,old.countOffset-1,old.insertionOffset-1,
   old.insertionOffset+plan.insertedBytes-1,old.counterOffset+plan.insertedBytes-1]){
   const bytes=await escaped.readAt(at,8),parts=[];
   for(let i=0;i<8;i++)parts.push((await escaped.readAt(at+i,1))[0]);
   assert.deepEqual(bytes,Uint8Array.from(parts));
  }
  for(const [at,n]of [[-1,1],[0,4097],[escaped.size,1],[0,1.5]])await assert.rejects(escaped.readAt(at,n),/out of bounds/);
 });
 assert.equal(plan.insertedBytes,f.proposal.record.length+4);assert.equal(plan.retainedPatchBytes,20);
 assert.equal(plan.worldWritten,false);assert.equal(plan.nativeHomeRegistered,false);assert.equal(hash(f.bytes),before);
 await assert.rejects(escaped.readAt(0,1),/lease ended/);
});
test('proposal projection refuses a stale counter, corrupt home record or reuse admission before exposing a reader',async()=>{
 for(const defect of ['counter','record','admission','oversize']){
  const f=await setup(),before=hash(f.bytes);let consumed=false;
  if(defect==='counter'){
   f.proposal.plan.proposedAgentId=101;
   f.proposal.record=encodeRemoteHomeAgent(f.registered.record,101);
   await verifyRemoteHomeAgent(source(f.proposal.record),f.registered,101);
  }
  if(defect==='record')f.proposal.record[12]^=1;
  if(defect==='admission')f.proposal.plan.admission='reuse-existing';
  if(defect==='oversize')f.proposal.record=new Uint8Array(1025);
  await assert.rejects(withProposedRemoteHome(f.destination,f.registered,f.proposal,()=>consumed=true));
  assert.equal(consumed,false);assert.equal(hash(f.bytes),before);
 }
});
test('projection cancellation and failed consumers revoke outstanding readers without writing the saved world',async()=>{
 for(const mode of ['cancel','consumer']){
  const f=await setup(),before=hash(f.bytes),controller=new AbortController();let escaped;
  await assert.rejects(withProposedRemoteHome(f.destination,f.registered,f.proposal,async projected=>{
   escaped=projected.source;
   if(mode==='cancel'){controller.abort(Error('closed'));await escaped.readAt(0,1);}
   else throw Error('consumer failed');
  },{signal:controller.signal}),/closed|consumer failed/);
  await assert.rejects(escaped.readAt(0,1),/lease ended/);assert.equal(hash(f.bytes),before);
 }
});
