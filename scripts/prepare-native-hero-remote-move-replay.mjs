#!/usr/bin/env node
// Regenerate the exact stopped native072 three-command capsule, without
// changing its save bytes, journal, clocks, orders or source identities.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {prepareSelectedHeroGeneratedNeighbor} from './lib/prepare-selected-hero-generated-neighbor.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {selectedHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';

const [archiveName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/hero-remote-move-replay-\d{3}-preparation\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const descriptor=async filename=>{const {bytes,sha256}=await hashNativeFile(filename);return {filename:resolve(filename),bytes,sha256};};
const json=async filename=>{assert.ok((await lstat(filename)).size<1024*1024);return JSON.parse(await readFile(filename,'utf8'));};
const sourceSha256={};
for(const name of ['scripts/prepare-native-hero-remote-move-replay.mjs',
 ...await readdir('web/world').then(names=>names.filter(n=>n.endsWith('.mjs')).map(n=>'web/world/'+n)),
 ...await readdir('scripts/lib').then(names=>names.filter(n=>n.endsWith('.mjs')).map(n=>'scripts/lib/'+n))])
 sourceSha256[name]=(await descriptor(name)).sha256;
const archive=await json(archiveName);
const evidence=async pattern=>{
 const rows=archive.evidence.filter(row=>pattern.test(basename(row.source)));assert.equal(rows.length,1);
 assert.equal((await descriptor(rows[0].preserved)).sha256,rows[0].sha256);return rows[0].preserved;
};
const producerName=await evidence(/^native-hero-binding-attempt-072\.json$/),m=await json(producerName);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.publicationWorkerAbsent,true);
for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
await ownedDirectory(m.publicationJournal,'actor-arrival-fixture-hero-route-');
const logName=await evidence(/^native-hero-binding-attempt-072\.log$/),log=await readFile(logName,'utf8');
assert.equal((await descriptor(logName)).sha256,m.logSha256);
const movement=/^\[frontier\] Hero crossing serial=6 region=(-2_-1) target=(-3_-1) previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) phase=3 pending=7 original-tick=1 native-cells=4$/m.exec(log);
assert.ok(movement);const pose=text=>Object.fromEntries(text.split(',').map((v,i)=>[['x','y','z'][i],Number(v)]));
const crossing={serial:6,region:movement[1],target:movement[2],previousClock:Number(movement[3]),clock:Number(movement[4]),
 unitId:Number(movement[5]),agentId:Number(movement[6]),previous:pose(movement[7]),accepted:pose(movement[8])};
const profile=join(m.fixture,'frontier_'+crossing.target),packetName=join(profile,'Frontier_Hero_Travel_Input.json'),packet=await json(packetName);
assert.equal(packet.serial,6);assert.equal(packet.sourceRegion,crossing.region);assert.equal(packet.targetRegion,crossing.target);
assert.equal(packet.sourceClock,crossing.clock);assert.equal(packet.destinationClock,100);
assert.deepEqual(packet.sourceAlias,{unitId:crossing.unitId,agentId:crossing.agentId});
async function reference(filename){
 const row=archive.references.find(row=>row.filename===filename);assert.ok(row,filename);
 assert.deepEqual(await descriptor(filename),row);return row;
}
const warm=await reference(join(profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Home_Before.GMP'));
const home=await reference(join(profile,packet.home.filename)),pack=await reference(join(profile,packet.package.filename));
assert.equal(home.sha256,packet.home.sha256);assert.equal(home.bytes,packet.home.size);
assert.equal(pack.sha256,packet.package.sha256);assert.equal(pack.bytes,packet.package.size);
const identity=await json(join(m.publicationJournal,'Frontier_Hero_Route_Identity.json')),stats={},
 store=new HeroRouteStore(await stoppedHeroRouteStorage(m.publicationJournal,stats),identity,identity.contentDigest);
const headName=join(m.publicationJournal,HERO_ROUTE_HEAD),headBefore=await descriptor(headName);
assert.equal(await readFile(headName,'utf8'),packet.ownerManifest);
const selected=await store.withOwner(async selected=>({record:selected.record,owner:selected.owner,entry:selected.entry}));
assert.equal(selected.record.revision,11);assert.equal(selected.record.manifest,packet.ownerManifest);
assert.equal(selected.owner.region,crossing.region);assert.deepEqual(selected.entry.alias,packet.sourceAlias);
const source=await reference(join(m.fixture,'frontier_'+crossing.region,'Documents/My Games/MajestyHD/SaveGame/Frontier_'+crossing.region+'_Recovery.GMP'));
assert.equal(source.sha256,selected.entry.world.sha256);assert.equal(await checkpointSavedClock(await stoppedFileSource(source.filename)),crossing.clock);
const orders=[];
for await(const row of checkpointActorOrderEntries(await stoppedFileSource(source.filename),crossing.unitId))
 if(row.type==='entry')orders.push({bank:row.bank,index:row.index,kind:row.kind});
assert.deepEqual(orders,[{bank:0,index:0,kind:2},{bank:0,index:1,kind:4},{bank:1,index:0,kind:7}]);
const runtimeBinding=selectedHeroRuntimeBinding(identity,selected.entry,crossing.clock),
 prepared=await prepareSelectedHeroGeneratedNeighbor(store,runtimeBinding,crossing,warm);
assert.equal(prepared.destinationClock,100);assert.equal(prepared.home.plan.proposedAgentId,packet.homeAlias.agentId);
assert.equal(prepared.home.plan.admission,'reserve-new');assert.equal(prepared.packSha256,pack.sha256);
assert.deepEqual(prepared.arrival.pack,new Uint8Array(await readFile(pack.filename)));
assert.deepEqual(prepared.home.record,new Uint8Array(await readFile(home.filename)));
assert.equal(stats.writes??0,0);assert.deepEqual(await descriptor(headName),headBefore);
for(const row of [warm,home,pack,source])assert.deepEqual(await descriptor(row.filename),row);
for(const [name,digest]of Object.entries(sourceSha256))assert.equal((await descriptor(name)).sha256,digest);
await writeFile(outName,JSON.stringify({version:1,exactStoppedThreeCommandCapsulePrepared:true,archive:await descriptor(archiveName),
 producer:await descriptor(producerName),log:await descriptor(logName),input:await descriptor(packetName),crossing,clock:100,
 sourceCheckpoint:source,warmCheckpoint:warm,home,pack,homeAgentId:packet.homeAlias.agentId,orders,
 sourceOwnerRevision:11,sourceHead:headBefore,sourceJournalUnchanged:true,sourceWrites:0,adapterStats:stats,sourceSha256,
 preparedNavigation:prepared.arrival.plan.heroOrders.haloNavigation,browserUsed:false,nativeProcessesStarted:0,
 nativeImportQualified:false,ownerTransferred:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({exactStoppedThreeCommandCapsulePrepared:true,commands:orders.length,sourceOwnerRevision:11,browserUsed:false}));
