#!/usr/bin/env node
// Prepare the journal-selected hero and every current physical child for home.
// This writes an inert capsule only; it never imports/schedules original actors.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,mkdtemp,open,readdir} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {prepareRouteRegisteredHeroArrival} from '../web/world/registered-hero-arrival.mjs';
import {checkpointUnitAgentLinks,checkpointActorRecords,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const files=async directory=>Object.fromEntries(await Promise.all((await readdir(directory)).sort().map(async n=>[n,await hash(join(directory,n))])));
export async function prepareSelectedHaloReturn(journal,publication){
 const before=await files(journal),stats={},io=await stoppedHeroRouteStorage(journal,stats);
 io.atomicWrite=async()=>{throw Error('Return preparation may not write the route journal');};
 const store=new HeroRouteStore(io,publication.identity,publication.identity.contentDigest),selected=await store.read();
 assert.equal(selected.record.manifest,publication.selectedManifest);assert.equal(selected.record.revision,2);
 assert.deepEqual(selected.owner,publication.selectedOwner);assert.equal(selected.owner.region,'0_-1');
 const children=[];
 await store.withOwner(async s=>{
  assert.equal(await checkpointSavedClock(s.source),1500);
  for await(const u of checkpointUnitAgentLinks(s.source))if(u.parentUnitId===s.owner.unitId)children.push(u);
  assert.deepEqual(children.map(u=>[u.unitId,u.description,u.stateFlags,u.size]),[[513,0x34475241,544,151],[516,0x32425241,2592,165]]);
  const heroOrders=[];for await(const e of checkpointActorOrderEntries(s.source,s.owner.unitId))heroOrders.push(e);
  assert.deepEqual(heroOrders,[]); // Original AI has removed the actor's command record.
  const actor=await checkpointActorRecords(s.source,s.owner.unitId),root=[];
  for await(const v of checkpointAgentValues(s.source,actor.agent.agentId))if(!v.path.length&&v.type===5)root.push(v);
  const target=root.find(v=>v.attribute.toLowerCase()==='target');assert.ok(target);assert.equal(target.targetAgentId,null);
 });
 const request={expectedManifest:selected.record.manifest,freshUnitId:100000,freshAgentId:1000,
  unitBindings:[],attachedUnitBindings:children.map((u,i)=>({from:u.unitId,to:100001+i})),navigationLayout:'halo-v1'};
 const prepared=await prepareRouteRegisteredHeroArrival(store,'0_0',null,request),p=prepared.plan;
 assert.deepEqual([p.sourceClockMs,p.destinationClockMs,p.unitId,p.agentId],[1500,60650,510,54]);
 assert.equal(p.registeredHome.source.kind,'proxy');assert.equal(p.registeredHome.destination.kind,'native');
 assert.equal(p.registeredHome.destination.unitId,469);assert.equal(p.registeredHome.destination.agentId,7);
 assert.equal(p.attachedOrders.length,2);assert.equal(p.attachedUnits.length,2);
 assert.deepEqual(p.attachedOrders.map(o=>o.markerClock.profile),['wait-arg4','arb2-extended-marker']);
 assert.equal(p.attachedOrders[1].markerClock.allocationRequestBytes,316);
 assert.equal(Object.keys(prepared.records).length,7);
 const placement=p.haloPlacement;assert.ok(placement);let ground,byteComparisons=0;
 await store.withDestination('0_0',null,async s=>{
  assert.equal(s.record.manifest,selected.record.manifest);
  const terrains=[];for(const source of s.sources)terrains.push(await checkpointTerrain(source));
  const original=await sampleNativeGroundHeight(terrains[0],placement.sourceFixed),destination=await sampleNativeGroundHeight(terrains[1],placement.destinationFixed);
  ground={sourceHeightQ16:original,destinationHeightQ16:destination,heightsEqual:original===destination,
   savedHeroZQ11:placement.sourceFixed.z,zPreserved:placement.sourceFixed.z===placement.destinationFixed.z};
  // Reconstruct every record from original bytes and the declared patches;
  // opaque command fields and relative effect poses must survive unchanged.
  for(const [key,range]of Object.entries(p.ranges)){
   assert.ok(range.size<=4096);const bytes=Uint8Array.from(await s.sources[0].readAt(range.offset,range.size)),view=new DataView(bytes.buffer);
   for(const e of p.edits.filter(e=>e.record===key)){
    const at=e.offset-range.offset;assert.equal(view.getUint32(at,true),e.before);view.setUint32(at,e.after,true);
   }
   const t=p.containerTransforms.find(t=>t.record===key);let expected=bytes;
   if(t){assert.equal(key,'container');assert.equal(t.removeBytes,0);assert.deepEqual(t.insertWords,[469,1]);
    const at=t.offset-range.offset,insert=new Uint8Array(8),v=new DataView(insert.buffer);v.setUint32(0,469,true);v.setUint32(4,1,true);
    expected=new Uint8Array(bytes.length+8);expected.set(bytes.subarray(0,at));expected.set(insert,at);expected.set(bytes.subarray(at),at+8);
   }
   assert.deepEqual(prepared.records[key],expected);byteComparisons++;
  }
 });
 assert.equal(byteComparisons,7);assert.deepEqual(await files(journal),before);assert.ok(stats.largestRead<=4096&&stats.peakReads===1);
 return {prepared,request,selected,stats,ground,byteComparisons,journalSha256:before};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const[archiveName,auditName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,5);
 const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
 assert.match(basename(directory),/^native-selected-halo-return-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
 const archive=await json(archiveName);assert.equal(archive.generation,246);assert.equal(archive.selectedOriginalHaloOwnerReloadQualified,true);
 for(const row of archive.sources.concat(archive.evidence)){
  assert.ok(resolve(row.preserved).startsWith(dirname(resolve(archiveName))+'/'));
  const h=await hashNativeFile(row.preserved);assert.equal(h.sha256,row.sha256);assert.equal(h.bytes,row.bytes);
 }
 const publicationRow=archive.evidence.find(r=>r.original.endsWith('/output/native-selected-halo-save-001-observed.json'));assert.ok(publicationRow);
 const publication=await json(publicationRow.preserved);assert.equal(publication.selectedRevision,2);
 const audit=await json(auditName);assert.equal(audit.qualified,true);assert.equal(audit.inheritedFramingQualified,true);
 assert.equal(audit.objectBytes,100);assert.equal(audit.originalCommonHeaderReplayChecks,2);assert.equal(audit.originalCallbackTokenReplayChecks,4);
 assert.deepEqual(audit.commonDispatchWords,{rate:5,when:6,delta:7,info:8});assert.deepEqual(audit.callbackWords,{base:11,marker:30});
 for(const[name,h]of Object.entries(audit.sourceSha256))assert.equal(await hash(name),h);
 const journal=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
 const rows=archive.evidence.filter(r=>dirname(r.original)===publication.directory);assert.equal(rows.length,9);
 for(const row of rows){const f=await open(join(journal,basename(row.original)),'wx');let at=0;
  try{await hashNativeFile(row.preserved,{maximum:4*1024*1024,sink:async bytes=>{
   for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});await f.sync();}finally{await f.close();}
 }
 const result=await prepareSelectedHaloReturn(journal,publication);await mkdir(directory);const records={};let total=0;
 for(const[key,bytes]of Object.entries(result.prepared.records)){
  const filename=join(directory,key+'.bin');await writeFile(filename,bytes,{flag:'wx'});records[key]={filename,...await hashNativeFile(filename)};total+=bytes.length;
 }
 const sourceNames=['scripts/prepare-native-selected-halo-return.mjs','web/world/registered-hero-arrival.mjs','web/world/arrival.mjs',
  'web/world/hero-route-store.mjs','web/world/entity-home-ownership.mjs','web/world/entity-ownership.mjs','web/world/hero-order-arrival.mjs',
  'web/world/halo-companion-orders.mjs','web/world/order-dispatch-clock.mjs','web/world/order-callbacks.mjs','web/world/order-restore-bounds.mjs',
  'web/world/order-entries.mjs','web/world/checkpoint.mjs','web/world/halo-region-layout.mjs','web/world/actor-coordinates.mjs',
  'web/world/saved-clock.mjs','web/world/terrain.mjs','web/world/terrain-ground.mjs','scripts/lib/stopped-hero-route-io.mjs'];
 const sourceSha256=Object.fromEntries(await Promise.all(sourceNames.map(async n=>[n,await hash(n)])));
 const report={version:1,selectedHaloReturnCapsulePrepared:true,archive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
  publication:{filename:publicationRow.preserved,sha256:publicationRow.sha256},journal,identity:publication.identity,selected:result.selected,
  inheritedWriterAudit:{filename:resolve(auditName),sha256:await hash(auditName)},
  request:result.request,plan:result.prepared.plan,records,totalRecordBytes:total,ground:result.ground,byteComparisons:result.byteComparisons,
  journalSha256:result.journalSha256,stats:result.stats,sourceSha256,sourceWorldsUnchanged:true,selectedOwnerUnchanged:true,
  completeCurrentPhysicalFamilyIncluded:true,originalAiTargetAndTaskPreserved:true,
  nativeReaderReady:false,nativeImportQualified:false,sourceRetired:false,ownerPublished:false,
  automaticReturnCrossingQualified:false,nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
 await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({selectedHaloReturnCapsulePrepared:true,records:7,totalRecordBytes:total,ground:result.ground,nativeImportQualified:false}));
}
