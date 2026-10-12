// Connect the selected held receiving snapshot to an actual ordinary home return.
import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,ownedDirectory,stoppedFileSource} from './stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './stopped-revision-io.mjs';
import {guardedHandoffHash,inspectGuardedOutdoorPublication,prepareGuardedOutdoorHandoff,freshGuardedOutdoorStore} from './guarded-outdoor-handoff.mjs';
import {openEntityRevisionStore,encodeEntityRevision} from '../../web/world/entity-revisions.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,checkpointAgentRecordValues,
  checkpointAgentValues,checkpointContainerEntries,checkpointAgentQueues} from '../../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function rows(s,iterator,key){const out=new Map();for await(const r of iterator(s)){assert(!out.has(key(r)));out.set(key(r),r);}return out;}
async function bytes(s,r){assert(r&&r.size<=65536);const b=Buffer.alloc(r.size);
  for(let at=0;at<r.size;at+=4096)b.set(await s.readAt(r.offset+at,Math.min(4096,r.size-at)),at);return b;}
const memory=b=>({size:b.length,async readAt(at,n){assert(n<=4096&&at>=0&&at+n<=b.length);return Uint8Array.from(b.subarray(at,at+n));}});
async function payload(s,r){assert(r&&r.primary.size<=4096);return Buffer.from(await s.readAt(r.primary.offset+16,r.primary.size));}
function normalizedUnit(b,from,to,fromParent,toParent,fromAgent,toAgent){
  assert.equal(b.readUInt32LE(36),from);b.writeUInt32LE(to,36);
  assert.equal(b.readUInt32LE(56),fromParent);b.writeUInt32LE(toParent,56);
  if(fromAgent){let at=92+(b.readUInt32LE(80)?16:0),count=b.readUInt32LE(at+4),found=0;at+=8;assert(count<=128);
    for(let k=0;k<count;k++,at+=8)if(b.readUInt32LE(at)===0x4541){assert.equal(b.readUInt32LE(at+4),fromAgent);b.writeUInt32LE(toAgent,at+4);found++;}assert.equal(found,1);}
  return b;
}
async function normalizedScript(b,from,to,fromUnit,toUnit,fromHome,toHome){
  for await(const v of checkpointAgentRecordValues(memory(b)))if(v.type===5&&v.targetAgentId){
    assert([from,fromHome].includes(v.targetAgentId));b.writeUInt32LE(v.targetAgentId===from?to:toHome,v.offset);}
  assert.equal(b.readUInt32LE(b.length-24),from);assert.equal(b.readUInt32LE(b.length-19),fromUnit);
  b.writeUInt32LE(to,b.length-24);b.writeUInt32LE(toUnit,b.length-19);return b;
}
function request(r,worlds){return {worlds,aliases:r.selectedState.aliases,homeAliases:r.selectedState.homeAliases,
  referenceBindings:r.selectedState.referenceBindings,ownerSide:r.selectedState.ownerSide,visitedSides:r.selectedState.visitedSides,
  operationId:r.selectedState.operationId,kind:r.selectedState.kind,expectedManifest:r.previousManifest};}
async function worldSources(inputs){const worlds=[];for(const r of inputs){const s=await stoppedFileSource(r.filename);
  assert.equal(s.size,r.bytes);assert.equal(await guardedHandoffHash(r.filename),r.sha256);worlds.push({source:s,sha256:r.sha256});}return worlds;}
async function readonly(r){await ownedDirectory(r.fixture,'actor-arrival-fixture-entity-revision-');const io=await stoppedRevisionStorage(r.fixture);
  io.atomicWrite=async()=>{throw Error('Preserve selected world publication');};return openEntityRevisionStore(io,r.identity.contentDigest);}
export function expectedGuardedReturnState(before,req,revision,previousManifest){
  return JSON.parse(new TextDecoder().decode(encodeEntityRevision({...before,revision,kind:req.kind,previous:sha(previousManifest),
    operationId:req.operationId,ownerSide:req.ownerSide,aliases:req.aliases,worlds:req.worlds.map(w=>({size:w.source.size,sha256:w.sha256}))})));
}
export async function inspectGuardedOutdoorHoldPublication(name){
  const r=await json(name);assert.equal(r.actualGuardedOutdoorHoldSavePublished,true);
  for(const[n,h]of Object.entries(r.sourceSha256))assert.equal(await guardedHandoffHash(join(workspace,n)),h);
  assert.equal(await guardedHandoffHash(r.previousPublication),r.previousPublicationSha256);
  const outward=await inspectGuardedOutdoorPublication(r.previousPublication),receiving=await json(outward.receivingProof);
  const inputs=[outward.inputs[0],receiving.worlds.Held];assert.deepEqual(r.inputs,inputs);
  assert.deepEqual(r.identity,outward.identity);assert.equal(r.previousManifest,outward.selectedManifest);
  assert.deepEqual(r.homeRequest,receiving.homeRequest);assert.equal(r.pauseAnchorClockMs,24250);
  assert.equal(r.selectedReceivingClockMs,receiving.endClockMs);assert.equal(r.selectedReceivingClockMs,25300);
  assert(r.homeRequest.requestClockMs>r.pauseAnchorClockMs&&r.homeRequest.requestClockMs<=r.selectedReceivingClockMs);
  const worlds=await worldSources(inputs),req=request(r,worlds);
  assert.equal(await checkpointSavedClock(worlds[1].source),r.selectedReceivingClockMs);
  const evidence={previousPublication:resolve(r.previousPublication),previousPublicationSha256:r.previousPublicationSha256};
  assert.equal(req.operationId,sha(JSON.stringify({evidence,worlds:inputs.map(i=>i.sha256)})+'\n'));
  const expected=expectedGuardedReturnState(outward.selectedState,req,5,outward.selectedManifest),store=await readonly(r),selected=await store.read();
  assert.deepEqual(store.identity,r.identity);assert.equal(selected.record.manifest,r.selectedManifest);
  assert.deepEqual(selected.record.state,expected);assert.deepEqual(r.selectedState,expected);
  assert.deepEqual(r.selectedOwner,outward.selectedOwner);assert.deepEqual(selected.owner,r.selectedOwner);
  assert.deepEqual(r.worlds,selected.record.worlds);assert.equal((await readdir(r.fixture)).length,8);
  assert.equal(r.guardedHomeRequestPending,true);assert.deepEqual(r.guardsRequired,outward.guardsRequired);
  for(const k of ['nativeEngineOwnershipActivationQualified','ordinaryUnguardedLaunchQualified','activeRemoteContinuationQualified','seamlessHeroCrossingQualified','browserUsed'])assert.equal(r[k],false);
  return {publication:r,outward,receiving,holdRequest:req};
}
export async function prepareGuardedOutdoorReturn(name){
  const context=await inspectGuardedOutdoorHoldPublication(name),{publication,outward,receiving}=context;
  // The outward checker binds both the archived native142 home producer and
  // the current native146 receiving producer. Compare their actual payloads,
  // rather than asserting that similarly named heroes are interchangeable.
  const home=await json(outward.homeProof),archive=await json(outward.homeArchive),native=await json(home.manifest);
  assert.equal(await guardedHandoffHash(native.preparation),native.preparationSha256);
  assert.equal(archive.evidence[native.preparation].sha256,native.preparationSha256);
  const prep=await json(native.preparation);assert.deepEqual(prep.request,publication.homeRequest);
  assert.deepEqual([prep.sourceClockMs,prep.destinationClockMs,prep.scriptClockAnchorMs],[24250,57650,57650]);
  const proposals=new Map();for(const r of prep.records){assert(!proposals.has(basename(r.filename)));proposals.set(basename(r.filename),r);
    assert.equal(await guardedHandoffHash(r.filename),r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);
    assert.equal(archive.evidence[r.filename].sha256,r.sha256);assert.equal(await guardedHandoffHash(archive.evidence[r.filename].filename),r.sha256);}
  assert.equal(proposals.size,13);
  const held=await stoppedFileSource(publication.inputs[1].filename),ready=await stoppedFileSource(home.worlds.Ready.filename);
  const remoteUnits=await rows(held,checkpointUnitAgentLinks,r=>r.unitId),remoteAgents=await rows(held,checkpointAgents,r=>r.agentId);
  const remoteAttachments=await rows(held,checkpointAttachments,r=>`${r.kind}:${r.unitId}`);
  const homeUnits=await rows(ready,checkpointUnitAgentLinks,r=>r.unitId),homeAgents=await rows(ready,checkpointAgents,r=>r.agentId);
  const homeAttachments=await rows(ready,checkpointAttachments,r=>`${r.kind}:${r.unitId}`);
  const oldIds=[504,527,528,529],remoteIds=[receiving.heroId,...receiving.effectIds],homeIds=[home.heroId,...home.effectIds];let clockPatches=0;
  const proposal=async n=>{const r=proposals.get(n);assert(r);return readFile(r.filename);};
  for(let i=0;i<4;i++){
    const canonical=await proposal(`Family_Proposal_${oldIds[i]}.UNIT`);
    assert.deepEqual(normalizedUnit(await bytes(held,remoteUnits.get(remoteIds[i])),remoteIds[i],oldIds[i],i?remoteIds[0]:0,i?504:0,i?0:49,i?0:28),canonical);
    assert.deepEqual(normalizedUnit(await bytes(ready,homeUnits.get(homeIds[i])),homeIds[i],oldIds[i],i?homeIds[0]:0,i?504:0,i?0:home.agentId,i?0:28),canonical);
    const orders=await payload(held,remoteAttachments.get(`ORDR:${remoteIds[i]}`)),orderProposal=proposals.get(`Family_Proposal_${oldIds[i]}_Orders.bin`);
    assert(orderProposal.clockPatches.length<=4);
    for(const p of orderProposal.clockPatches){assert.equal(orders.readUInt32LE(p.offset),p.before);
      assert.equal((57650-((publication.pauseAnchorClockMs-p.before)>>>0))>>>0,p.after);orders.writeUInt32LE(p.after,p.offset);clockPatches++;}
    const expectedOrders=await proposal(`Family_Proposal_${oldIds[i]}_Orders.bin`);assert.deepEqual(orders,expectedOrders);
    assert.deepEqual(await payload(ready,homeAttachments.get(`ORDR:${homeIds[i]}`)),expectedOrders);
  }
  assert.equal(remoteAgents.get(49).name,'');assert.equal(homeAgents.get(home.agentId).name,'');
  const script=await proposal('Family_Proposal_Agent.GPL');
  assert.deepEqual(await normalizedScript(await bytes(held,remoteAgents.get(49)),49,28,561,504,45,7),script);
  assert.deepEqual(await normalizedScript(await bytes(ready,homeAgents.get(home.agentId)),home.agentId,28,home.heroId,504,7,7),script);
  const internal=await payload(held,remoteAttachments.get('CONT:561'));
  assert.deepEqual(Array.from({length:12},(_,i)=>internal.readUInt32LE(i*4)),[1,1,1,3,1,561,562,1,563,1,564,1]);
  internal.writeUInt32LE(504,20);for(let i=1;i<4;i++)internal.writeUInt32LE(oldIds[i],16+i*8);
  const container=await proposal('Family_Proposal_Container.bin');assert.deepEqual(internal.subarray(8),container.subarray(32));
  assert.deepEqual(JSON.parse(await proposal('Family_Return_Request.json')),publication.homeRequest);
  const departed=await stoppedFileSource(receiving.worlds.Departed.filename),departedUnits=await rows(departed,checkpointUnitAgentLinks,r=>r.unitId),departedAgents=await rows(departed,checkpointAgents,r=>r.agentId);
  assert.equal(await checkpointSavedClock(departed),25300);let otherUnitsExact=0,otherAgentsExact=0;
  for(const[id,r]of remoteUnits)if(!remoteIds.includes(id)){assert.deepEqual(await bytes(held,r),await bytes(departed,departedUnits.get(id)));otherUnitsExact++;}
  for(const[id,r]of remoteAgents)if(id!==49){assert.deepEqual(await bytes(held,r),await bytes(departed,departedAgents.get(id)));otherAgentsExact++;}
  for(const id of remoteIds)assert(!departedUnits.has(id));assert(!departedAgents.has(49));
  assert.equal(remoteUnits.size-departedUnits.size,4);assert.equal(remoteAgents.size-departedAgents.size,1);
  const entered=await stoppedFileSource(home.worlds.Entered.filename),enteredUnits=await rows(entered,checkpointUnitAgentLinks,r=>r.unitId);
  assert.equal(await checkpointSavedClock(ready),57650);assert.equal(await checkpointSavedClock(entered),home.endClockMs);
  assert.equal(home.endClockMs-home.startClockMs,1000);assert.equal(enteredUnits.get(home.heroId).parentUnitId,469);
  for(const s of [ready,entered]){
    const members=[];for await(const v of checkpointAgentValues(s,7))if(v.attribute==='members'&&v.type===5)members.push(v.targetAgentId);assert.deepEqual(members,[home.agentId]);
    let queued=0;for await(const q of checkpointAgentQueues(s))if(q.type==='queued-agent'&&q.agentId===home.agentId)queued++;assert.equal(queued,1);
    const links=[];for await(const c of checkpointContainerEntries(s))if(c.type==='member'&&((c.unitId===469&&c.targetUnitId===home.heroId)||(c.unitId===home.heroId&&c.targetUnitId===469)))links.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
    assert.deepEqual(links,s===ready?[[469,100,530,1],[530,101,469,1]]:[[469,100,530,1],[469,2,530,1],[530,101,469,1]]);
  }
  let active;for await(const v of checkpointAgentValues(entered,home.agentId))if(v.attribute==='activescript'&&!v.path.length)active=v;
  assert(active?.functions.some(f=>f.name==='Rest_at_guild'));
  const evidence={previousPublication:resolve(name),previousPublicationSha256:await guardedHandoffHash(name)};
  const aliases=[{unitId:home.heroId,agentId:home.agentId},publication.selectedState.aliases[1]],returnInputs=[home.worlds.Ready,receiving.worlds.Departed],entryInputs=[home.worlds.Entered,receiving.worlds.Departed];
  const common={aliases,homeAliases:publication.selectedState.homeAliases,referenceBindings:publication.selectedState.referenceBindings,ownerSide:0,visitedSides:3};
  const returnRequest={...common,worlds:await worldSources(returnInputs),kind:'handoff',expectedManifest:publication.selectedManifest,
    operationId:sha(JSON.stringify({evidence,stage:'return',worlds:returnInputs.map(i=>i.sha256),aliases})+'\n')};
  const entryRequest={...common,worlds:await worldSources(entryInputs),kind:'save',operationId:sha(JSON.stringify({evidence,stage:'guild-entry',worlds:entryInputs.map(i=>i.sha256),aliases})+'\n')};
  const outwardPreparation=await prepareGuardedOutdoorHandoff(outward.previousPublication,outward.receivingProof,outward.homeProof,outward.homeArchive);
  return {...context,outwardPreparation,home,evidence,returnInputs,entryInputs,returnRequest,entryRequest,evidenceCounts:{normalizedUnitRecords:8,normalizedScriptRecords:2,orderPayloadsExact:8,clockPatches,internalChildren:3,otherReceivingUnitsExact:otherUnitsExact,otherReceivingAgentsExact:otherAgentsExact}};
}
export async function freshGuardedReturnStore(p){
  const outward=p.outwardPreparation;
  const t=await freshGuardedOutdoorStore(outward),handoff=await t.store.commit(outward.request);assert.equal(handoff.manifest,p.outward.selectedManifest);
  const held=await t.store.commit(p.holdRequest);assert.equal(held.manifest,p.publication.selectedManifest);
  assert.deepEqual((await t.store.read()).record.state,p.publication.selectedState);return t;
}
export async function inspectGuardedOutdoorRoundTrip(name){
  const r=await json(name);assert.equal(r.actualGuardedOutdoorRoundTripPublished,true);
  for(const[n,h]of Object.entries(r.sourceSha256))assert.equal(await guardedHandoffHash(join(workspace,n)),h);
  const p=await prepareGuardedOutdoorReturn(r.previousPublication);
  for(const[n,v]of Object.entries({...p.evidence,...p.evidenceCounts}))assert.deepEqual(r[n],v);
  assert.deepEqual(r.identity,p.publication.identity);assert.deepEqual(r.inputs,p.entryInputs);
  assert.equal(r.previousManifest,p.publication.selectedManifest);
  const returned=expectedGuardedReturnState(p.publication.selectedState,p.returnRequest,6,r.previousManifest);
  assert.deepEqual(r.returnedState,returned);
  const expectedReturnManifest=['majesty-entity-revision-v1',0,6,returned.identitySha256,sha(encodeEntityRevision(returned)),''].join('\n');
  assert.equal(r.returnedManifest,expectedReturnManifest);
  const expected=expectedGuardedReturnState(returned,p.entryRequest,7,r.returnedManifest),store=await readonly(r),s=await store.read();
  assert.deepEqual(store.identity,r.identity);assert.equal(s.record.manifest,r.selectedManifest);
  assert.deepEqual(s.record.state,expected);assert.deepEqual(r.selectedState,expected);
  assert.deepEqual(s.owner,{entityId:r.identity.entityId,region:'0_0',...p.returnRequest.aliases[0]});assert.deepEqual(r.selectedOwner,s.owner);
  assert.deepEqual(r.worlds,s.record.worlds);assert.equal((await readdir(r.fixture)).length,8);
  assert.deepEqual(r.consumedHomeRequest,p.publication.homeRequest);assert.equal(r.guardedHomeRequestPending,false);
  assert.equal(r.actualOrdinaryGuildEntrySelected,true);assert.equal(r.selectedHomeClockMs,p.home.endClockMs);assert.equal(r.dormantReceivingClockMs,25300);
  for(const k of ['nativeEngineOwnershipActivationQualified','ordinaryUnguardedLaunchQualified','activeRemoteContinuationQualified','seamlessHeroCrossingQualified','browserUsed'])assert.equal(r[k],false);
  return r;
}
