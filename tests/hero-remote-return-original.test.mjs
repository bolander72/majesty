// Replay the real stopped native071 backtracking capture in a fresh document
// lease. GMP bytes and clocks stay exact; content labels and the document's
// restarted serial epoch are controlled. This does not run the native importer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {parseHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointActorOrderNavigation} from '../web/world/order-navigation.mjs';
import {stoppedFileSource} from '../scripts/lib/stopped-entity-io.mjs';
import {prepareSelectedHeroNeighborArrival} from '../web/world/hero-home-arrival-package.mjs';
import {openNativeHeroRouteStore} from '../web/world/hero-route-profile.mjs';
import {HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {Sha256} from '../web/world/sha256.mjs';
import {startNativeWorldPlayer,confirmNativeHeroGameReady,queueNativeHeroGameSave,publishNativeHeroGameSave,
 restoreNativeHeroTravelHome,prepareNativeHeroTravelArrival,
 endNativeHeroGameSave} from '../web/world/realm-session.mjs';

const archiveName=process.env.MAJESTY_HERO_REMOTE_RETURN_ARCHIVE;
test('actual remote backtracking restores the retired kingdom and preserves custody when original orders cannot migrate',
 {skip:!archiveName,timeout:45000},async()=>{
 const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
 const descriptor=async filename=>{const {bytes,sha256}=await hashNativeFile(filename);return {filename:resolve(filename),bytes,sha256};};
 const archive=await json(archiveName),hashText=text=>new Sha256().update(new TextEncoder().encode(text)).hex();
 const evidence=async pattern=>{
  const rows=archive.evidence.filter(row=>pattern.test(basename(row.source)));assert.equal(rows.length,1);
  assert.equal((await descriptor(rows[0].preserved)).sha256,rows[0].sha256);return rows[0].preserved;
 };
 const manifestName=await evidence(/^native-hero-binding-attempt-071\.json$/),m=await json(manifestName);
 assert.equal(m.nativeSessionTerminal,true);assert.equal(m.publicationWorkerTerminal,true);
 assert.equal(m.ownedProducerAbsent,true);assert.equal(m.publicationWorkerAbsent,true);
 for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
 const logName=await evidence(/^native-hero-binding-attempt-071\.log$/),log=await readFile(logName,'utf8');
 assert.equal(hashText(log),m.logSha256);
 const movement=/^\[frontier\] Hero crossing serial=5 region=(-1_-1) target=(0_-1) previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) phase=3 pending=7 original-tick=1 native-cells=4$/m.exec(log);
 assert.ok(movement);const pose=value=>Object.fromEntries(value.split(',').map((v,i)=>[['x','y','z'][i],Number(v)]));
 const crossing={serial:1,region:movement[1],target:movement[2],previousClock:Number(movement[3]),clock:Number(movement[4]),
  unitId:Number(movement[5]),agentId:Number(movement[6]),previous:pose(movement[7]),accepted:pose(movement[8])};
 const source=crossing.region,target=crossing.target;
 const reference=async relative=>{
  const filename=join(m.fixture,relative),row=archive.references.find(r=>r.filename===filename);assert.ok(row,relative);
  assert.deepEqual(await descriptor(filename),row);return row;
 };
 const captured=await reference(`frontier_${source}/Documents/My Games/MajestyHD/SaveGame/Frontier_${source}_Recovery.GMP`);
 const previous=await reference(`frontier_${target}/Documents/My Games/MajestyHD/SaveGame/Frontier_${target}_Recovery.GMP`);
 const retired=await reference(`frontier_${target}/Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Source_Retired.GMP`);
 const held=new RegExp(`^\\[frontier\\] Hero save held serial=5 region=${source} clock=${crossing.clock} slot=1 bytes=${captured.bytes} sha256=${captured.sha256} phase=7 pending=0$`,'m');
 assert.match(log,held);
 const startup=await json(await evidence(/^hero-crossing-source-original-020\.json$/));
 const headText=await readFile(join(m.publicationJournal,HERO_ROUTE_HEAD),'utf8');assert.equal(JSON.parse(headText).revision,8);
 assert.match(log,new RegExp(`Hero travel resumed serial=4 region=${source} .*manifest-sha256=${hashText(headText)} `));
 const out=resolve(process.env.MAJESTY_HERO_REMOTE_RETURN_REPORT);assert.equal(dirname(out),resolve('output'));
 assert.match(basename(out),/^hero-remote-return-original-\d{3}\.json$/);
 const fixture=out.slice(0,-5);for(const name of [out,fixture])await assert.rejects(lstat(name),e=>e.code==='ENOENT');
 const world='remote-return-'+basename(fixture).slice(-3),profile=join(fixture,'majesty/profile/native-world-'+world),journal=join(profile,'hero-route');
 await mkdir(journal,{recursive:true});const originalJournalHashes={};
 for(const name of await readdir(m.publicationJournal)){
  assert.match(name,/^Frontier_Hero_Route(?:_Identity\.json|\.checkpoint|_Node_\d+\.json|_-?\d+_-?\d+_[01]\.GMP)$/);
  originalJournalHashes[name]=(await descriptor(join(m.publicationJournal,name))).sha256;
  await copyFile(join(m.publicationJournal,name),join(journal,name));
 }
 let heldLease=false,receipt;const locks={async request(name,options,consume){
  assert.equal(name,'majesty-pair-native-world-'+world);assert.equal(options.ifAvailable,true);
  if(heldLease)return consume(null);heldLease=true;try{return await consume({});}finally{heldLease=false;}
 }};
 const adapter=fileProfileStorage(fixture,()=>heldLease),content=startup.content;
 let entered,rejected;const ready=new Promise((r,j)=>{entered=r;rejected=j;});
 const search='?'+new URLSearchParams({world,profile:'frontier_'+source,RECOMP_RULE_FRONTIER_REGION:source,
  RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
  'hero-world':startup.worldId,'hero-entity':startup.receipt.owner.entityId,'hero-layout':'halo-v1'});
 startNativeWorldPlayer(async(_profile,retain,prepare)=>{receipt=await prepare(content,{signal:new AbortController().signal});retain();entered();},
  {search,locks,storage:adapter.storage,events:{addEventListener(){},removeEventListener(){}}}).catch(rejected);
 await ready;assert.equal(receipt.ownerRevision,8);
 const binding=parseHeroRuntimeBinding(receipt.runtimeBinding);assert.equal(binding.unitId,crossing.unitId);assert.equal(binding.agentId,crossing.agentId);
 confirmNativeHeroGameReady(world,receipt.runtimeBinding);
 const install=async(region,row)=>{
  const names=realmFiles(region),folder=join(profile,'frontier_'+region),save=join(folder,'Documents/My Games/MajestyHD/SaveGame');
  await mkdir(save,{recursive:true});await copyFile(row.filename,join(save,names.slots[1]));
  await writeFile(join(folder,names.marker),['checkpoint-v1',1,row.bytes,row.sha256,content,''].join('\n'));
 };
 await install(source,captured);await install(target,previous);
 queueNativeHeroGameSave(world,1,{crossing});
 const published=await publishNativeHeroGameSave(world,{serial:1,region:source,clock:crossing.clock,slot:1,size:captured.bytes,sha256:captured.sha256},{storage:adapter.storage});
 assert.equal(published.ownerRevision,9);
 await assert.rejects(prepareNativeHeroTravelArrival(world,1,target,{layout:'halo-v1',storage:adapter.storage}),/selected dormant kingdom/);
 const restored=await restoreNativeHeroTravelHome(world,1,target,{layout:'halo-v1',storage:adapter.storage});
 assert.equal(restored.regionRestored,true);assert.equal(restored.homeRestored,false);
 assert.equal(restored.sha256,retired.sha256);assert.equal(restored.size,retired.bytes);assert.equal(restored.clock,91200);
 const names=realmFiles(target),folder=join(profile,'frontier_'+target),save=join(folder,'Documents/My Games/MajestyHD/SaveGame');
 assert.equal((await descriptor(join(save,names.slots[1]))).sha256,previous.sha256,'earlier live departure remains intact');
 const writes=adapter.stats.writes;assert.equal((await restoreNativeHeroTravelHome(world,1,target,{layout:'halo-v1',storage:adapter.storage})).idempotent,true);
 assert.equal(adapter.stats.writes,writes);
 const borrowed={async request(name,options,consume){assert.equal(heldLease,true);assert.equal(name,'majesty-pair-native-world-'+world);return consume({});}};
 const identity=await json(join(journal,'Frontier_Hero_Route_Identity.json'));
 const route=await openNativeHeroRouteStore(adapter.directory(join(fixture,'majesty/profile')),world,
  {worldId:startup.worldId,entityId:startup.receipt.owner.entityId,contentDigest:identity.contentDigest},{locks:borrowed});
 assert.equal(await route.hasVisitedRegion(target),true);assert.equal(await route.hasVisitedRegion('-2_-1'),false);
 await route.withDestination(target,null,async selected=>{
  assert.equal(selected.entries[1].world.sha256,retired.sha256);
  assert.deepEqual(selected.entries[1].homeAlias,{kind:'proxy',unitId:0,agentId:62});
  assert.equal(await checkpointSavedClock(selected.sources[0]),500);assert.equal(await checkpointSavedClock(selected.sources[1]),91200);
  await assert.rejects(prepareSelectedHeroNeighborArrival(route.identity,selected,crossing),/outside the destination region/);
 });
 const rejectedWrites=adapter.stats.writes;
 await assert.rejects(prepareNativeHeroTravelArrival(world,1,target,{layout:'halo-v1',storage:adapter.storage}),/outside the destination region/);
 assert.equal(adapter.stats.writes,rejectedWrites,'unqualified navigation cannot stage an import or departure');
 const navigation=[];for await(const point of checkpointActorOrderNavigation(await stoppedFileSource(captured.filename),crossing.unitId)){
  assert.ok(navigation.length<32);navigation.push(point);
 }
 const goal=navigation.find(point=>point.kind===4&&point.field==='destination');assert.ok(goal);
 assert.deepEqual([goal.x,goal.y],[32,2048]);
 assert.equal((await route.read()).record.revision,9,'preparation must not transfer custody');
 await endNativeHeroGameSave(world,1,{abandoned:true});
 for(const [name,sha]of Object.entries(originalJournalHashes))assert.equal((await descriptor(join(m.publicationJournal,name))).sha256,sha);
 for(const row of [captured,previous,retired])assert.deepEqual(await descriptor(row.filename),row);
 assert.equal(adapter.stats.activeIO,0);assert.ok(adapter.stats.largestRead<=4096&&adapter.stats.largestWrite<=4096);
 await writeFile(out,JSON.stringify({version:1,actualRemoteReturnRestorationQualified:true,actualRemoteReturnPreparationQualified:false,
  originalOutOfDestinationNavigationRefused:true,archive:await descriptor(archiveName),fixture,
  originalSerial:5,replayedDocumentSerial:1,sourceRegion:source,targetRegion:target,crossing,captured,previous,retired,
  originalJournalHashes,ownerRevision:9,restored,selectedProxyAgentId:62,navigation,
  preparationRefusal:'Actor is outside the destination region',refusedPreparationWrites:0,stats:adapter.stats,
  originalEvidenceUnchanged:true,controlledFilesystemAdapter:true,browserUsed:false,nativeImporterConsumed:false,
  liveOPFSQualified:false,sustainedBrowserMemoryQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
 });
