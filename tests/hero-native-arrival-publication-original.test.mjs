// Replay actual native340 retired/activated saves through the browser profile
// publisher. All new writes use controlled filesystem storage, never the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,lstat,open} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';
import {publishNativeHeroArrivalOwner,HERO_RETIRED_SNAPSHOT,HERO_ARRIVAL_ACK} from '../web/world/hero-native-arrival-publication.mjs';
import {parseNativeHeroArrivalReady} from '../web/world/hero-travel-publication.mjs';
import {parseHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {afterFileClose} from './fixtures/after-file-close.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {stoppedFileSource} from '../scripts/lib/stopped-entity-io.mjs';

const archiveName=process.env.MAJESTY_HERO_ARRIVAL_PUBLICATION_ARCHIVE;
test('browser publisher recovers all four actual native340 arrival pairs after uncertain close and native save advancement',
 {skip:!archiveName,timeout:120000},async()=>{
 const root=resolve('.'),out=resolve(process.env.MAJESTY_HERO_ARRIVAL_PUBLICATION_REPORT);
 assert.equal(dirname(out),resolve('output'));assert.match(out,/hero-browser-arrival-publication-original-\d{3}\.json$/);
 await assert.rejects(lstat(out),e=>e.code==='ENOENT');
 const json=async name=>{assert.ok((await lstat(name)).size<=1024*1024);return JSON.parse(await readFile(name,'utf8'));};
 const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
 async function bound(row){const h=await hashNativeFile(row.filename??row.preserved);
  assert.equal(h.sha256,row.sha256);if(row.bytes!==undefined)assert.equal(h.bytes,row.bytes);}
 const archive=await json(archiveName);assert.equal(archive.nativeSourceRequestConsumptionQualified,true);
 async function evidence(name){const row=archive.evidence.find(r=>r.original===resolve(name));assert.ok(row,name);await bound(row);return json(row.preserved);}
 const m=await evidence('output/native-hero-binding-attempt-052.json');
 assert.equal(m.nativeSessionTerminal,true);assert.equal(m.publicationWorkerTerminal,true);
 for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
 const first=await evidence(m.publication.filename),second=await evidence(m.secondPublication.filename),
  home=await evidence(m.homePublication.filename),departure=await evidence(m.repeatDeparturePublication.filename),
  repeat=await evidence(m.repeatNeighborPublication.filename),returning=await evidence(m.repeatReturnPublication.filename),
  final=await evidence(m.repeatHomePublication.filename),startup=await evidence(m.startup.filename),
  outward=await evidence(first.firstOutwardInput.filename),homeSaved=await evidence(m.homeSavePublication.filename),
  neighborSaved=await evidence(m.repeatNeighborSavePublication.filename),repeatHomeSaved=await evidence(m.repeatHomeSavePublication.filename);
 const fixture=await mkdtemp(resolve('upstream/majesty-recomp/build/actor-arrival-fixture-browser-arrival-replay-'));
 async function copy(from,to,expected){
  await mkdir(dirname(to),{recursive:true});const f=await open(to,'wx');let at=0;
  try{const copied=await hashNativeFile(from,{sink:async bytes=>{
   for(let used=0;used<bytes.length;){const {bytesWritten}=await f.write(bytes,used,bytes.length-used,at);assert.ok(bytesWritten);at+=bytesWritten;used+=bytesWritten;}
  }});if(expected)assert.equal(copied.sha256,expected);}finally{await f.close();}
 }
 const cases=[];
 for(const [label,captured,pair,base,head,bindingText,nativeManifest,nextCapture] of [
  ['first-outward',first.captured,first,home.beforeJournal,first.capturedManifest,m.runtimeBinding,outward.nativeManifest,second.captured],
  ['first-return',second.captured,home,home.beforeJournal,home.expectedManifest,second.selectedBinding,second.nativeManifest,homeSaved.captured],
  ['repeat-outward',departure.captured,repeat,repeat.beforeJournal,repeat.expectedManifest,departure.runtimeBinding,departure.nativeManifest,neighborSaved.captured],
  ['repeat-return',returning.captured,final,final.beforeJournal,final.expectedManifest,returning.runtimeBinding,returning.nativeManifest,repeatHomeSaved.captured]]){
  const directory=join(fixture,label),world='arrival-replay-'+label,profile=join(directory,'native-world-'+world),journal=join(profile,'hero-route');
  await mkdir(journal,{recursive:true});const ready=parseNativeHeroArrivalReady(pair.ready),binding=parseHeroRuntimeBinding(bindingText);
  const hashes=label==='first-outward'||label==='first-return'?home.beforeJournalSha256:pair.beforeJournalSha256;
  for(const [name,sha256]of Object.entries(hashes))await copy(join(base,name),join(journal,name),sha256);
  for(const row of [captured,pair.retired,pair.active])await bound(row);
  // The first replay selects its earlier exact capture, before the original
  // worker advanced the journal. Higher immutable nodes are irrelevant to head1.
  if(label==='first-outward'){
   const node=await json(join(journal,'Frontier_Hero_Route_Node_1.json')),entry=node.changes[0];
   await writeFile(join(journal,HERO_ROUTE_HEAD),head);
   const name=`Frontier_Hero_Route_${entry.region}_${entry.slot}.GMP`;
   // Only this controlled copy is replaced; the preserved original stays intact.
   const f=await open(join(journal,name),'w');let at=0;
   try{await hashNativeFile(captured.filename,{sink:async bytes=>{
    for(let used=0;used<bytes.length;){const {bytesWritten}=await f.write(bytes,used,bytes.length-used,at);assert.ok(bytesWritten);at+=bytesWritten;used+=bytesWritten;}
   }});}finally{await f.close();}
  }
  assert.equal(await readFile(join(journal,HERO_ROUTE_HEAD),'utf8'),head);
  const saved=(key,name)=>join(profile,'frontier_'+key,'Documents','My Games','MajestyHD','SaveGame',name);
  const sourceNames=realmFiles(binding.region),targetNames=realmFiles(ready.region);
  await copy(captured.filename,saved(binding.region,sourceNames.slots[1]),captured.sha256);
  await copy(pair.retired.filename,saved(binding.region,HERO_RETIRED_SNAPSHOT),pair.retired.sha256);
  await copy(pair.active.filename,saved(ready.region,targetNames.slots[1]),pair.active.sha256);
  // Native test startup used controlled content identities; its later engine
  // markers use the actual executable fingerprint. Project only the marker
  // content line back to that registered test identity. GMP bytes stay exact.
  const content=startup.content,sourceManifest=['checkpoint-v1',1,captured.bytes,captured.sha256,content,''].join('\n'),
   targetManifest=['checkpoint-v1',1,pair.active.bytes,pair.active.sha256,content,''].join('\n');
  const nativeFields=nativeManifest.split('\n');assert.equal(Number(nativeFields[2]),captured.bytes);assert.equal(nativeFields[3],captured.sha256);
  await writeFile(join(profile,'frontier_'+binding.region,sourceNames.marker),sourceManifest,{flag:'wx'});
  await writeFile(join(profile,'frontier_'+ready.region,targetNames.marker),targetManifest,{flag:'wx'});
  let held=false;const adapter=fileProfileStorage(directory,()=>held),locks={async request(name,options,consume){
   assert.equal(name,'majesty-pair-native-world-'+world);assert.equal(options.ifAvailable,true);assert.equal(held,false);
   held=true;try{return await consume({});}finally{held=false;}
  }};
  const request={worldId:startup.worldId,entityId:first.identity.entityId,content,ready:pair.ready,sourceRegion:binding.region,
   sourceAlias:{unitId:binding.unitId,agentId:binding.agentId},sourceHome:{kind:binding.homeKind,unitId:binding.homeUnitId,agentId:binding.homeAgentId},
   sourceClock:binding.clock,sourceNativeManifest:sourceManifest,sourceOwnerManifest:head};
  // Runtime bindings precede the captured movement. The saved crossing supplies
  // the actual held clock, and the original publisher checks it independently.
  request.sourceClock=label==='first-outward'?outward.crossing.clock:
   label==='first-return'?second.held.clock:label==='repeat-outward'?departure.crossing.clock:returning.crossing.clock;
  let recovery;
  const profiles=afterFileClose(adapter.directory(directory),HERO_ARRIVAL_ACK,async()=>{throw Error('uncertain arrival close');});
  await assert.rejects(publishNativeHeroArrivalOwner(profiles,world,request,
   {locks,haloLayout:'halo-v1',onRecovery:value=>recovery=value}),/uncertain arrival close/);assert.ok(recovery);
  // Model the engine's next native capture using its authenticated later save,
  // preserving both the arrival bytes and selected journal. Only fixture copies
  // and their projected native marker change; no game is running.
  await bound(nextCapture);const advancedClock=await checkpointSavedClock(await stoppedFileSource(nextCapture.filename));
  assert.ok(advancedClock>ready.clock);
  await copy(nextCapture.filename,saved(ready.region,targetNames.slots[0]),nextCapture.sha256);
  const advancedManifest=['checkpoint-v1',0,nextCapture.bytes,nextCapture.sha256,content,''].join('\n');
  const markerPath=join(profile,'frontier_'+ready.region,targetNames.marker);await writeFile(markerPath,advancedManifest);
  const writes=adapter.stats.writes,result=await publishNativeHeroArrivalOwner(adapter.directory(directory),world,request,
   {locks,haloLayout:'halo-v1',recovery});
  assert.equal(adapter.stats.writes,writes);assert.equal(result.recoveredAcknowledgement,true);
  assert.equal(result.region,ready.region);assert.equal(result.ownerRevision,pair.publicationReceipt.ownerRevision);
  assert.deepEqual(result.owner,pair.publicationReceipt.owner);assert.deepEqual(result.home,pair.publicationReceipt.home);
  assert.equal(result.haloLayout.key,ready.region);assert.equal(result.haloLayout.verifiedVertices,16641);
  assert.equal(result.haloLayout.sharedVertices,2480);
  assert.equal(await readFile(join(profile,'frontier_'+ready.region,HERO_ARRIVAL_ACK),'utf8'),result.acknowledgement);
  const retry=await publishNativeHeroArrivalOwner(adapter.directory(directory),world,request,{locks,haloLayout:'halo-v1',recovery});
  assert.equal(retry.idempotent,true);assert.equal(retry.acknowledgementWritten,false);assert.equal(adapter.stats.writes,writes);
  assert.equal(await readFile(markerPath,'utf8'),advancedManifest);
  for(const row of [captured,pair.retired,pair.active,nextCapture])await bound(row);
  assert.equal(adapter.stats.activeIO,0);assert.equal(adapter.stats.peakIO,1);
  assert.ok(adapter.stats.largestRead<=4096&&adapter.stats.largestWrite<=4096);
  cases.push({label,serial:ready.serial,ready:pair.ready,source:captured,retired:pair.retired,active:pair.active,
   publication:result,nextCapture,advancedClock,stats:adapter.stats,exactRetryWrites:0,
   sameDocumentAdvancedReceiptRecoveryQualified:true,controlledContentMarkerProjection:true});
 }
 const sourceSha256={},pending=[resolve('tests/hero-native-arrival-publication-original.test.mjs')];
 while(pending.length){const name=pending.pop(),key=relative(root,name);if(sourceSha256[key])continue;
  assert.ok(!key.startsWith('..')&&Object.keys(sourceSha256).length<160);sourceSha256[key]=(await hashNativeFile(name)).sha256;
  for(const match of (await readFile(name,'utf8')).matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))
   if(match[1].startsWith('.'))pending.push(resolve(dirname(name),match[1]));
 }
 await writeFile(out,JSON.stringify({version:1,originalNativeBrowserArrivalPublicationQualified:true,archive:await descriptor(archiveName),
  fixture,cases,sourceSha256,originalNativeWorldsUnchanged:true,productionBrowserProfilePublisherUsed:true,
  sameDocumentAdvancedReceiptRecoveryQualified:true,controlledReceiptCloseFault:true,controlledNativeSaveAdvancement:true,
  controlledFilesystemAdapter:true,controlledContentMarkerProjection:true,browserUsed:false,nativeProcessesStarted:0,
  nativeReceiptConsumptionQualified:false,liveOPFSDurabilityQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
});
