// Replay the stopped original journey through current browser APIs. Content
// labels and the resulting journal receipt are controlled; GMP bytes are exact.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {NativeHeroSaveSession} from '../web/world/hero-save-session.mjs';
import {startNativeWorldPlayer,confirmNativeHeroGameReady,queueNativeHeroGameSave,publishNativeHeroGameSave,
 prepareNativeHeroTravelArrival,stageNativeHeroTravelGeneration,confirmNativeHeroGenerationDeparture,
 prepareNativeHeroGeneratedArrival,stageNativeHeroTravelArrival,publishNativeHeroTravelArrival,confirmNativeHeroTravelResume} from '../web/world/realm-session.mjs';

const archiveName=process.env.MAJESTY_HERO_GENERATED_BROWSER_ARCHIVE;
test('current browser lease APIs prepare, stage, publish and rebind the actual native348 generated arrival',
 {skip:!archiveName,timeout:45000},async()=>{
 const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
 const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
 async function bound(row){const current=await descriptor(row.filename);assert.equal(current.bytes,row.bytes);assert.equal(current.sha256,row.sha256);}
 const archive=await json(archiveName);assert.equal(archive.nativeGeneratedNeighborArrivalQualified,true);
 async function evidence(name){const row=archive.evidence.find(r=>r.source===resolve(name));assert.ok(row,name);
  assert.equal((await descriptor(row.preserved)).sha256,row.sha256);return json(row.preserved);}
 const m=await evidence('output/native-hero-binding-attempt-058.json'),startup=await evidence(m.startup.filename);
 assert.equal(m.nativeGeneratedNeighborArrivalQualified,true);
 for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
 await bound(m.freshGeneration);const g=await json(m.freshGeneration.filename);
 for(const row of [g.captured,g.retired,g.generated,g.coldGenerated,g.arrival.active,g.arrival.continued,g.arrival.home,g.arrival.pack])await bound(row);
 assert.equal((await descriptor(m.log)).sha256,m.logSha256);
 const lines=(await readFile(m.log,'utf8')).split('\n');
 function line(prefix){const found=lines.filter(v=>v.startsWith(prefix));assert.equal(found.length,1,prefix);return found[0];}
 const out=resolve(process.env.MAJESTY_HERO_GENERATED_BROWSER_REPORT);assert.equal(dirname(out),resolve('output'));
 assert.match(basename(out),/^hero-generated-browser-original-\d{3}\.json$/);
 const fixture=out.slice(0,-5);for(const name of [out,fixture])await assert.rejects(lstat(name),e=>e.code==='ENOENT');
 const world=basename(fixture),root='native-world-'+world,profile=join(fixture,'majesty/profile',root),journal=join(profile,'hero-route');
 await mkdir(journal,{recursive:true});
 const seed=join(startup.fixture,'majesty/profile','native-world-'+startup.receipt.world,'hero-route');
 for(const [name,hash] of Object.entries(startup.routeHashes)){
  assert.ok(!name.includes('/'));assert.equal((await descriptor(join(seed,name))).sha256,hash);await copyFile(join(seed,name),join(journal,name));
 }
 assert.equal(await readFile(join(journal,'Frontier_Hero_Route.checkpoint'),'utf8'),startup.receipt.ownerManifest);
 let held=false,lockCalls=0;
 const lockName='majesty-pair-'+root,locks={async request(name,options,consume){
  assert.equal(name,lockName);assert.equal(options.ifAvailable,true);++lockCalls;
  if(held)return consume(null);held=true;try{return await consume({});}finally{held=false;}
 }};
 const adapter=fileProfileStorage(fixture,()=>held);let entered,receipt;
 const ready=new Promise(r=>entered=r),content=startup.content;
 const search='?'+new URLSearchParams({world,profile:'frontier_0_0',RECOMP_RULE_FRONTIER_REGION:'0_0',
  RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
  'hero-world':startup.worldId,'hero-entity':startup.receipt.owner.entityId,'hero-layout':'halo-v1'});
 void startNativeWorldPlayer(async(_profile,retain,prepare)=>{receipt=await prepare(content,{signal:new AbortController().signal});retain();entered();},
  {search,locks,storage:adapter.storage,events:{addEventListener(){},removeEventListener(){}}});
 await ready;assert.equal(receipt.runtimeBinding,m.runtimeBinding);
 const session=new NativeHeroSaveSession(receipt.runtimeBinding,{haloBinding:receipt.haloBinding});
 session.message(line('[frontier] Selected hero bound '));session.message('[frontier] Region 0_0 ready');
 confirmNativeHeroGameReady(world,receipt.runtimeBinding);
 const crossing=session.message(line('[frontier] Hero crossing serial=1 '));assert.equal(crossing.kind,'crossing');
 queueNativeHeroGameSave(world,1,{crossing:crossing.crossing});
 async function install(region,row,slot){
  const folder=join(profile,'frontier_'+region),save=join(folder,'Documents/My Games/MajestyHD/SaveGame'),names=realmFiles(region);
  await mkdir(save,{recursive:true});await copyFile(row.filename,join(save,names.slots[slot]));
  await writeFile(join(folder,names.marker),['checkpoint-v1',slot,row.bytes,row.sha256,content,''].join('\n'));
 }
 await install('0_0',g.captured,1);
 const boundary=session.message(line('[frontier] Hero save held serial=1 ')).boundary;
 await publishNativeHeroGameSave(world,boundary,{storage:adapter.storage});
 const unexplored=await prepareNativeHeroTravelArrival(world,1,'1_0',{layout:'halo-v1',storage:adapter.storage});assert.equal(unexplored.kind,'new');
 const request=await stageNativeHeroTravelGeneration(world,1,unexplored,{storage:adapter.storage});session.queueTravel(request);session.poll(request.nativeAction);
 const consumed=session.message(line('[frontier] Hero generation request consumed serial=1 '));assert.equal(consumed.kind,'generation-departed');
 confirmNativeHeroGenerationDeparture(world,1,request,consumed.line);
 await install('1_0',g.generated,1);
 const initialized=session.message(line('[frontier] Hero generation initialized serial=1 '));assert.equal(initialized.kind,'generation-held');
 const prepared=await prepareNativeHeroGeneratedArrival(world,1,request,initialized.line,{layout:'halo-v1',storage:adapter.storage});
 assert.equal(prepared.kind,'generated');assert.equal(prepared.sourceRetired,true);assert.equal(prepared.arrival.destinationClock,100);
 assert.equal(prepared.home.sha256,g.arrival.home.sha256);assert.equal(prepared.arrival.sha256,g.arrival.pack.sha256);
 session.acceptGeneratedPreparation(prepared);const staged=await stageNativeHeroTravelArrival(world,1,prepared,{storage:adapter.storage});
 assert.equal(staged.packageSha256,g.arrival.pack.sha256);
 const sourceRecovery=join(profile,'frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Source_Retired.GMP');
 await copyFile(g.retired.filename,sourceRecovery);await install('1_0',g.arrival.active,0);
 const arrival=session.message(line('[frontier] Hero travel publication held receipt='));assert.equal(arrival.kind,'travel-held');
 const published=await publishNativeHeroTravelArrival(world,1,request,arrival.ready,{storage:adapter.storage});assert.equal(published.ownerRevision,2);
 assert.equal(session.acceptTravelPublication(published),null);
 // The isolated browser publisher has a different operation/head hash. Keep
 // the original engine's aliases/clock; substitute only this receipt's digest.
 const originalResume=line('[frontier] Hero travel resumed serial=1 '),resumed=originalResume.replace(g.arrival.published.ownerManifestSha256,published.ownerManifestSha256);
 assert.notEqual(resumed,originalResume);assert.equal(session.message(resumed).kind,'travel-resumed');
 const fresh=confirmNativeHeroTravelResume(world,1,request,resumed);session.completeTravel(fresh);
 assert.equal(fresh.owner.unitId,532);assert.equal(fresh.owner.agentId,34);assert.equal(fresh.home.agentId,33);
 assert.equal(session.queue(),2);assert.equal(session.poll('frontier-hero-save').serial,2);
 queueNativeHeroGameSave(world,2);assert.equal(held,true);assert.equal(lockCalls,1);
 assert.equal(adapter.stats.activeIO,0);assert.ok(adapter.stats.largestRead<=4096&&adapter.stats.largestWrite<=4096);
 for(const row of [g.captured,g.retired,g.generated,g.coldGenerated,g.arrival.active,g.arrival.continued,g.arrival.home,g.arrival.pack])await bound(row);
 await writeFile(out,JSON.stringify({version:1,originalGeneratedBrowserAPIReplayQualified:true,archive:await descriptor(archiveName),
  originalGMPsUnchanged:true,packageExactlyMatchesOriginalImporterInput:true,homeExactlyMatchesOriginalRegisteredInput:true,
  oneInjectedGameLease:true,lockCalls,generatedClock:100,owner:fresh.owner,home:fresh.home,nextSaveSerial:2,
  stagedPackageSha256:staged.packageSha256,controlledContentLabels:true,controlledPublicationDigestSubstitution:true,
  adapterStats:adapter.stats,browserUsed:false,liveOPFSQualified:false,nativeNewReceiptConsumed:false,
  continuousExpansionQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
});
