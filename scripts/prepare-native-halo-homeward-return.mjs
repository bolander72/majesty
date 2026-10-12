#!/usr/bin/env node
// Bind the actual accepted crossing/retirement to the selected dormant home.
// Produce inert original-reader records; never mutate the route or a kingdom.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {prepareCheckpointHaloHeroOrders} from '../web/world/halo-hero-orders.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const [archiveName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-homeward-return-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.nativeHomewardSourceRetirementQualified,true);
assert.equal(archive.sourceRetired,true);assert.equal(archive.completeScriptRootQualified,true);assert.equal(archive.ownerPublished,false);
assert.equal(archive.selectedRevision,5);assert.equal(archive.endClock,3750);assert.equal(archive.homeRegionRestored,false);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
function bound(name,digest){const rows=archive.evidence.filter(r=>r.original===resolve(name));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const proofRow=bound(archive.proof.filename,archive.proof.sha256),proof=await json(proofRow.preserved);
assert.equal(proof.nativeHomewardSourceRetirementQualified,true);assert.equal(proof.exactRemainingRecords,479);
const crossing=await json(bound(proof.crossingProof.filename,proof.crossingProof.sha256).preserved);
const trial=await json(bound(crossing.manifest,crossing.manifestSha256).preserved);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Original producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
const base=await json(bound(trial.preparation,trial.preparationSha256).preserved);
const sourceRow=bound(proof.beforeWorld.filename,proof.beforeWorld.sha256),source=await stoppedFileSource(sourceRow.preserved);
assert.equal(await checkpointSavedClock(source),3750);
await verifyRegisteredHeroSnapshot(base.identity,{unitId:532,agentId:35},{kind:'proxy',unitId:0,agentId:34},source,true,'1_0');
for(const[n,h]of Object.entries(base.journalSha256))assert.equal(await hash(join(base.journal,n)),h);
assert.equal(await readFile(join(base.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),base.ownerManifest);
const stats={},io=await stoppedHeroRouteStorage(base.journal,stats),store=new HeroRouteStore(io,base.identity,base.identity.contentDigest);
io.atomicWrite=async()=>{throw Error('Homeward preparation cannot write custody');};
const opened=[],originalOpen=io.open;io.open=async n=>{opened.push(n);return originalOpen(n);};
let prepared,orders,selected,homeRow,ground,escaped;
// Only the selected owner and actual dormant home are leased, regardless of
// the number of previously visited regions. The crossing file is frozen above.
await store.withDestination('0_0',null,async v=>{
 assert.equal(v.record.revision,5);assert.equal(v.record.manifest,base.ownerManifest);assert.deepEqual(v.owner,base.selected.owner);
 assert.deepEqual(v.entries[0].alias,{unitId:532,agentId:35});assert.deepEqual(v.entries[1].alias,{unitId:496,agentId:22});
 assert.deepEqual(v.entries[0].homeAlias,{kind:'proxy',unitId:0,agentId:34});
 assert.deepEqual(v.entries[1].homeAlias,{kind:'native',unitId:469,agentId:7});
 assert.equal(await checkpointSavedClock(v.sources[0]),3550);assert.equal(await checkpointSavedClock(v.sources[1]),84550);
 const regions={version:'halo-v1',sourceRegion:'1_0',destinationRegion:'0_0'};
 prepared=await prepareCheckpointRegisteredHeroArrival(source,v.sources[1],{
  unitId:532,freshUnitId:100000,freshAgentId:1000,unitBindings:[],attachedUnitBindings:[],
  sourceClockMs:3750,destinationClockMs:84550,haloRegions:regions},
  {identity:base.identity,regions:v.regions,ownerSide:0,aliases:v.entries.map(e=>e.alias),
   homeAliases:v.entries.map(e=>e.homeAlias),referenceBindings:[]});
 const p=prepared.plan;assert.deepEqual(Object.keys(prepared.records).sort(),['agent','container','order','unit']);
 assert.equal(p.heroOrders.entries.length,3);assert.equal((p.attachedUnits??[]).length,0);assert.equal((p.attachedOrders??[]).length,0);
 assert.equal(p.registeredHome.destination.unitId,469);assert.equal(p.registeredHome.destination.agentId,7);
 assert.deepEqual(p.haloPlacement.sourceFixed,{x:125384,y:250634,z:117986});
 assert.deepEqual(p.haloPlacement.destinationFixed,{x:8251848,y:250634,z:117986});
 orders=await prepareCheckpointHaloHeroOrders(source,v.sources[1],532,regions,p.registeredHome);
 const transformed=Uint8Array.from(orders.preparedAttachment);new DataView(transformed.buffer).setUint32(0,100000,true);
 assert.deepEqual(prepared.records.order,transformed);
 const terrains=[await checkpointTerrain(source),await checkpointTerrain(v.sources[1])];
 const heights=[await sampleNativeGroundHeight(terrains[0],p.haloPlacement.sourceFixed),
  await sampleNativeGroundHeight(terrains[1],p.haloPlacement.destinationFixed)];assert.equal(heights[0],heights[1]);
 ground={sourceHeight:heights[0],destinationHeight:heights[1],savedHeroZ:117986,zPreserved:true};
 // Complete inert records must differ only through declared clock, identity,
 // home-reference, position/navigation edits and the home container insertion.
 let comparisons=0;for(const[key,r]of Object.entries(p.ranges)){
  const bytes=new Uint8Array(r.size);for(let at=0;at<r.size;at+=4096)bytes.set(await source.readAt(r.offset+at,Math.min(4096,r.size-at)),at);
  const view=new DataView(bytes.buffer);for(const e of p.edits.filter(e=>e.record===key)){
   const at=e.offset-r.offset;assert.equal(view.getUint32(at,true),e.before);view.setUint32(at,e.after,true);}
  const t=p.containerTransforms.find(t=>t.record===key);let expected=bytes;
  if(t){assert.equal(key,'container');assert.equal(t.removeBytes,0);assert.deepEqual(t.insertWords,[469,1]);
   const insert=new Uint8Array(8),v=new DataView(insert.buffer);v.setUint32(0,469,true);v.setUint32(4,1,true);
   const at=t.offset-r.offset;expected=new Uint8Array(bytes.length+8);expected.set(bytes.subarray(0,at));expected.set(insert,at);expected.set(bytes.subarray(at),at+8);}
  assert.deepEqual(prepared.records[key],expected);comparisons++;}assert.equal(comparisons,4);
 await mkdir(directory);const filename=join(directory,'Selected_Home.GMP'),f=await open(filename,'wx');let at=0;
 try{assert.equal(await hashCheckpointSource(v.sources[1],async bytes=>{
  for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }),v.entries[1].world.sha256);await f.sync();}finally{await f.close();}
 homeRow={filename,...await hashNativeFile(filename)};
 selected={record:v.record,owner:v.owner,entries:v.entries};escaped=v.sources[1];
});
await assert.rejects(escaped.readAt(0,16),/lease ended/);assert.equal(stats.peakReads,1);assert.ok(stats.largestRead<=4096);
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_1_0_0.GMP','Frontier_Hero_Route_0_0_0.GMP']);
const records={};for(const[key,b]of Object.entries(prepared.records)){const filename=join(directory,'Homeward_'+key+'.bin');await writeFile(filename,b,{flag:'wx'});records[key]={filename,...await hashNativeFile(filename)};}
const payloadName=join(directory,'Homeward_Orders.bin');await writeFile(payloadName,orders.payload,{flag:'wx'});
for(const[n,h]of Object.entries(base.journalSha256))assert.equal(await hash(join(base.journal,n)),h);
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-homeward-return.mjs','scripts/lib/stopped-hero-route-io.mjs',
 'scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs','web/world/hero-route-store.mjs',
 'web/world/arrival.mjs','web/world/halo-hero-orders.mjs','web/world/hero-order-arrival.mjs','web/world/halo-order-navigation.mjs',
 'web/world/order-dispatch-clock.mjs','web/world/order-restore-bounds.mjs','web/world/order-entries.mjs',
 'web/world/terrain-ground.mjs','web/world/checkpoint.mjs','web/world/entity-home-ownership.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,homewardReturnCapsulePrepared:true,archive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 retirementProof:{filename:proofRow.preserved,sha256:proofRow.sha256},identity:base.identity,selected,
 sourceWorld:{filename:sourceRow.preserved,sha256:sourceRow.sha256,bytes:sourceRow.bytes},retiredWorld:proof.retiredWorld,
 homeWorld:homeRow,journal:base.journal,journalSha256:base.journalSha256,ownerManifest:base.ownerManifest,
 plan:prepared.plan,records,orderPayload:{filename:payloadName,...await hashNativeFile(payloadName)},orderPlan:orders.plan,
 ground,stats,sourceSha256,sourceClock:3750,destinationClock:84550,originalRecordComparisons:4,
 readerRevoked:true,dormantWorldsOpened:1,intermediateWorldsOpened:0,sourceRetired:true,
 nativeImportQualified:false,homeRegionRestored:false,ownerPublished:false,browserUsed:false,nativeProcessesStarted:0,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({homewardReturnCapsulePrepared:true,records:4,sourceClock:3750,destinationClock:84550,dormantWorldsOpened:1,nativeImportQualified:false}));
