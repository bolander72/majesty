#!/usr/bin/env node
// Browser production stagers over owned copied files beside one live engine.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {stageSelectedHeroBrowserInput} from './lib/stage-selected-hero-browser-input.mjs';
import {fileProfileStorage} from '../tests/fixtures/file-profile-storage.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {NativeRealmStore,realmFiles,opfsRealmStorage} from '../web/world/realm-store.mjs';
import {nativeRealmRelativePath} from '../web/world/realm-profile.mjs';
import {restoreSelectedDormantHeroRegion} from '../web/world/hero-dormant-home-restore.mjs';
import {publishHeldHeroOwnerCheckpoint} from '../web/world/hero-owner-checkpoint-publication.mjs';
import {requireCheckpointHeroCrossing} from '../web/world/hero-travel-boundary.mjs';
import {prepareSelectedHeroNeighborArrival} from '../web/world/hero-home-arrival-package.mjs';
import {prepareOrReuseRemoteHomeAgent} from '../web/world/remote-home-cache.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {stageNativeHeroTravelRequest} from '../web/world/hero-travel-request.mjs';
import {parseNativeHeroArrivalReady,publishHeldNativeHeroArrival} from '../web/world/hero-travel-publication.mjs';

const [manifestName]=process.argv.slice(2);assert.equal(process.argv.length,3);
const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
const op=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const m=await json(manifestName);assert.equal(m.remoteBacktrack,true);assert.equal(m.nativeSessionTerminal,false);
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');await ownedDirectory(m.journal,'actor-arrival-fixture-hero-route-');
const out=join(m.fixture,'backtrack.json');await assert.rejects(lstat(out),e=>e.code==='ENOENT');
const check=()=>process.kill(m.nativePid,0),deadline=Date.now()+80000;
async function log(){check();assert.ok((await lstat(m.log)).size<m.logCeilingBytes);return readFile(m.log,'utf8');}
async function until(pattern,label){while(Date.now()<deadline){const text=await log(),match=pattern.exec(text);
  if(match)return match;
  assert.ok(!/invariant failed|abort from|result=fail|Selected hero binding refused|Hero arrival activation refused|Hero (?:departure|generation) load refused/.test(text),label+' engine failure');
  await new Promise(r=>setTimeout(r,100));
}assert.fail(label+' deadline');}
const identity=await json(join(m.journal,'Frontier_Hero_Route_Identity.json')),stats={},
  store=new HeroRouteStore(await stoppedHeroRouteStorage(m.journal,stats),identity,identity.contentDigest);
const initial=await store.withOwner(async s=>({record:s.record,entry:s.entry}));assert.equal(initial.record.revision,17);
const untouched=['0_0','1_0','1_-1','0_-1','-1_-1','-2_-1','-3_-1'],
  dormant=async()=>{const rows=[];for(const key of untouched)rows.push(await store.withDestination(key,null,async s=>s.entries[1]));return rows;};
const dormantBefore=await dormant();
const c=await until(/^\[frontier\] Hero crossing serial=1 region=(-5_-1) target=(-4_-1) previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) phase=3 pending=7 original-tick=1 native-cells=4$/m,'real crossing');
const pose=value=>Object.fromEntries(value.split(',').map((v,i)=>[['x','y','z'][i],Number(v)])),
  crossing={serial:1,region:c[1],target:c[2],previousClock:Number(c[3]),clock:Number(c[4]),unitId:Number(c[5]),agentId:Number(c[6]),previous:pose(c[7]),accepted:pose(c[8])};
const held=await until(/^\[frontier\] Hero save held serial=1 region=-5_-1 clock=(\d+) slot=([01]) bytes=(\d+) sha256=([a-f0-9]{64}) phase=7 pending=0$/m,'held crossing save');
assert.equal(Number(held[1]),crossing.clock);
const from=join(m.fixture,'frontier_-5_-1'),to=join(m.fixture,'frontier_-4_-1'),names=realmFiles(crossing.region),
  captured=await descriptor(join(from,'Documents/My Games/MajestyHD/SaveGame',names.slots[Number(held[2])]));
assert.equal(captured.bytes,Number(held[3]));assert.equal(captured.sha256,held[4]);
const nativeManifest=await readFile(join(from,names.marker),'utf8'),source=await stoppedFileSource(captured.filename);
assert.equal(nativeManifest,['checkpoint-v1',held[2],captured.bytes,captured.sha256,m.controlledNativeContentLabel,''].join('\n'));
const prep=await json(m.preparation.filename),travel=await requireCheckpointHeroCrossing(source,prep.runtimeBinding,crossing);
const publication=await publishHeldHeroOwnerCheckpoint(store,{operationId:op(['remote-backtrack-capture',initial.record.manifest,captured.sha256]),
  expectedManifest:initial.record.manifest,region:crossing.region,alias:initial.entry.alias,homeAlias:initial.entry.homeAlias,
  clock:crossing.clock,sha256:captured.sha256,source});assert.equal(publication.ownerRevision,18);
const adapter=fileProfileStorage(m.fixture,()=>{check();return true;});
// Match the browser coordinator's borrowed writer lease. Restoration commits
// within its existing region read scope; this is a serial copied-file adapter,
// not an interprocess lock or live navigator.locks qualification.
const locks={async request(name,options,consume){check();return consume({});}};
const mapped={async getFileHandle(name,options){const parts=nativeRealmRelativePath(name),file=join(m.fixture,...parts);
  return adapter.directory(dirname(file)).getFileHandle(parts.at(-1),options);}};
const native=new NativeRealmStore(opfsRealmStorage(mapped,'remote-backtrack',locks),{content:m.controlledNativeContentLabel});
await mkdir(join(to,'Documents/My Games/MajestyHD/SaveGame'),{recursive:true});
const restored=await restoreSelectedDormantHeroRegion(store,native,{serial:1,sourceRegion:crossing.region,targetRegion:crossing.target,
  sourceAlias:initial.entry.alias,sourceOwnerManifest:publication.ownerManifest,sourceNativeManifest:nativeManifest,
  sourceSha256:captured.sha256,sourceSize:captured.bytes,sourceClock:crossing.clock},{check});
assert.equal(restored.regionRestored,true);assert.equal(restored.heroImported,false);
const targetManifest=(await native.read(crossing.target)).manifest;
let destinationEntry,home,arrival,destinationClock;
await store.withDestination(crossing.target,null,async selected=>{
  destinationEntry=selected.entries[1];destinationClock=await checkpointSavedClock(selected.sources[1]);
  home=await prepareOrReuseRemoteHomeAgent(selected.sources[1],registeredHeroHome(identity),{
    worldId:identity.registeredHome.worldId,contentDigest:identity.contentDigest,destinationRegion:crossing.target,
    freshAgentId:await checkpointNextAgentId(selected.sources[1])});
  assert.equal(home.plan.admission,'reuse-existing');assert.equal(home.plan.proposedAgentId,destinationEntry.homeAlias.agentId);
  arrival=await prepareSelectedHeroNeighborArrival(identity,selected,crossing);
});
await mkdir(to,{recursive:true});const packFile=join(to,'Remote_Return_Prepared.pack'),homeFile=join(to,'Remote_Return_Proxy.GPL');
await writeFile(packFile,arrival.pack,{flag:'wx'});await writeFile(homeFile,home.record,{flag:'wx'});
const pack=await descriptor(packFile),proxyRecord=await descriptor(homeFile),capture={crossing,journal:m.journal,publicationReceipt:publication,nativeManifest};
const target={region:crossing.target,clock:destinationClock,nativeManifest:targetManifest,homeAlias:destinationEntry.homeAlias,
  homeAdmission:'reuse-existing',proxyRecord};
const staged=await stageSelectedHeroBrowserInput(m,capture,target,{pack});
async function validate(){check();assert.equal(await readFile(join(m.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),publication.ownerManifest);
  for(const [key,expected]of [[crossing.region,nativeManifest],[crossing.target,targetManifest]])assert.equal((await native.read(key)).manifest,expected);
}
const request=await stageNativeHeroTravelRequest(adapter.directory(from),adapter.directory(to),staged.staged,{check,validate});
const stagedEvidence={version:1,crossing,captured,travel,publication,restored,destinationEntry,destinationClock,targetManifest,pack,proxyRecord,
  request,browserInput:staged,preparationSource:'production-browser-stagers-with-copied-files',stagedBeforeRetirement:true};
await writeFile(join(m.fixture,'backtrack-staged.json'),JSON.stringify(stagedEvidence,null,2)+'\n',{flag:'wx'});
// The smoke input queues the ordinary named travel action after staging.
const readyMatch=await until(/^\[frontier\] Hero travel publication held receipt=(majesty-hero-travel-ready-v1\|1\|-4_-1\|\S+) phase=7 pending=0 ordinary-ticks=0$/m,'original activated arrival');
const ready=parseNativeHeroArrivalReady(readyMatch[1]),retired=await descriptor(join(from,'Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Source_Retired.GMP')),
  acceptedManifest=await readFile(join(to,realmFiles(crossing.target).marker),'utf8'),slot=Number(acceptedManifest.split('\n')[1]),
  active=await descriptor(join(to,'Documents/My Games/MajestyHD/SaveGame',realmFiles(crossing.target).slots[slot]));
assert.equal(active.sha256,ready.sha256);assert.equal(active.bytes,ready.size);assert.equal(ready.clock,destinationClock);
const receipt=await publishHeldNativeHeroArrival(store,{ready:readyMatch[1],operationId:op(['remote-backtrack-arrival',retired.sha256,active.sha256]),
  expectedManifest:publication.ownerManifest,sourceRegion:crossing.region,sourceAlias:initial.entry.alias,sourceHome:initial.entry.homeAlias,
  sourceClock:crossing.clock,capturedSha256:captured.sha256,retiredSource:{source:await stoppedFileSource(retired.filename),sha256:retired.sha256},
  activeSource:{source:await stoppedFileSource(active.filename),sha256:active.sha256}});
assert.equal(receipt.ownerRevision,19);assert.deepEqual(receipt.home,destinationEntry.homeAlias);
await writeFile(join(to,'Frontier_Hero_Travel_Published.txt'),receipt.acknowledgement,{flag:'wx'});
const played=await until(/^\[frontier\] Remote backtrack gameplay held region=-4_-1 unit=(\d+) agent=(\d+) proxy=(\d+) from-clock=(\d+) clock=(\d+) ticks=6 original-gameplay=1 phase=7 pending=0 result=pass$/m,'resumed original gameplay');
assert.equal(Number(played[4]),destinationClock);assert.equal(Number(played[5]),destinationClock+300);
assert.deepEqual(await dormant(),dormantBefore);
const playedCheckpoint=await descriptor(join(to,'Documents/My Games/MajestyHD/SaveGame/Hero_Remote_Return_Played.GMP'));
assert.equal(await checkpointSavedClock(await stoppedFileSource(playedCheckpoint.filename)),destinationClock+300);
await writeFile(out,JSON.stringify({version:1,nativeRemoteBacktrackCompleted:true,...stagedEvidence,
  ready:readyMatch[1],retired,active,receipt,acceptedManifest,playedCheckpoint,playedClock:Number(played[5]),
  otherSevenDormantEntriesUnchanged:true,dormantBefore,stats,adapterStats:adapter.stats,
  newRouteAfterArrivalIssued:false,browserUsed:false,liveOPFSQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeRemoteBacktrackCompleted:true,revision:19,target:crossing.target,playedClock:Number(played[5])}));
