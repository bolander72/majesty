#!/usr/bin/env node
// Separate original loader/save with the outgoing alias absent throughout.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRepeatDeparture} from './check-native-repeat-departure.mjs';
import {repeatReceivingMembership} from './check-native-repeat-return.mjs';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=1024*1024){const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Departed metadata exceeds bound');const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
export async function verifyRepeatDepartedReload(manifestName) {
  const mb=await bounded(manifestName,65536),m=JSON.parse(mb),sources=await verifiedNativeSources(m);
  if(m.repeatDepartedReload!==true||m.reloadDepartedNpc!==true||m.observeMotion!==false||m.scheduleNpc!==false||m.departNpc!==false||m.reloadScheduledNpc!==false||
    m.activateReturnedNpc!==false||m.clockMode!=='pinned'||m.physicalGridExtent!==512||m.privateReturnPacket)throw Error('Require separate original departed reload');
  const profile=await ownedDirectory(m.profile,'actor-arrival-fixture-joint-reload-');assert.equal(profile,join(m.fixture,'frontier_0_0'));
  const db=await bounded(m.sourceDepartureReport),d=JSON.parse(db);assert.equal(sha(db),m.sourceDepartureReportSha256);assertRevalidatedNativeProof(await verifyRepeatDeparture(d.sourceManifest),d);
  assert.notEqual(m.nativePid,d.fixture.nativePid);assert.notEqual(profile,d.fixture.profile);assert.deepEqual([m.unitId,m.agentId],[d.identity.unitId,d.identity.agentId]);
  assert.deepEqual(m.nativeSourceSha256,d.fixture.nativeSourceSha256);assert.equal(m.nativeExecutableSha256AtLaunch,d.fixture.nativeExecutableSha256AtLaunch);
  const settings=['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav'],worldName='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP',evidence={};
  assert.deepEqual(Object.keys(m.inputHashes).sort(),[...settings,worldName,'Joint_Reload_Expected.bin'].sort());
  for(const [name,digest] of Object.entries(m.inputHashes)){const file=join(profile,name);assert.equal(await hashCheckpointSource(await stoppedFileSource(file)),digest);evidence[file]=digest;if(settings.includes(name))assert.equal(digest,d.fixture.inputHashes[name]);}
  assert.equal(m.inputHashes[worldName],d.after.sha256);
  const header=await bounded(join(profile,'Joint_Reload_Expected.bin'),16);assert.equal(header.length,16);assert.deepEqual(Array.from({length:4},(_,i)=>header.readUInt32LE(i*4)),[0x31524a4e,2,m.unitId,m.agentId]);
  const input=await repeatReceivingMembership(join(profile,worldName),d.identity),roundtrip=await repeatReceivingMembership(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Departed_Reload.GMP'),d.identity);
  assert.equal(input.sha256,d.after.sha256);assert.equal(input.bytes,d.after.bytes);
  for(const key of ['counts','records','queues','activeQueue']){assert.deepEqual(input[key],d.after[key]);assert.deepEqual(roundtrip[key],input[key]);}
  const log=(await bounded(m.log)).toString('utf8');if(!log.includes('all expectations met')||/result=fail|SIGSEGV|exception e06d7363|undeliverable call(?!s: none)/i.test(log)||
    /^\[streaming\] (Return active|Private return|Joint motion|Joint schedule|Joint departure|Joint reload unit)/m.test(log))throw Error('Failed or mutated departed reload');
  const loaded=[...log.matchAll(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=\d+ sample-bytes=\d+$/gm)];assert.equal(loaded.length,1);assert.equal(Number(loaded[0][1]),input.counts.units);
  const rows=[...log.matchAll(/^\[streaming\] Joint departed reload unit=(\d+) agent=(\d+) unit-absent=1 agent-absent=1 entries=(\d+) queued=(\d+) groups=1 queues-same=1 counters-same=1 native-counter=(\d+) script-counter=(\d+) hooks-same=1 roundtrip-saved=1 result=pass$/gm)];assert.equal(rows.length,1);
  const [unitId,agentId,entries,queued,nativeCounter,scriptCounter]=rows[0].slice(1).map(Number);assert.deepEqual([unitId,agentId,entries,queued],[m.unitId,m.agentId,input.counts.agents,input.counts.agents]);
  if(nativeCounter<unitId||scriptCounter<agentId)throw Error('Departed reload reset monotonic counters');
  for(const name of ['scripts/check-native-repeat-departed-reload.mjs','scripts/run-native-repeat-departed-reload.py'])sources[name]=sha(await readFile(join(workspace,name)));
  return {qualified:true,scope:'Separate original512-grid departed reload/save: outgoing2142/GPL72 absent, all2120 surviving records and other saved queues preserved, counters/registry/hooks unchanged. Paired publication, continuous region unloading and browser resource bounds remain unqualified.',
    sourceManifest:resolve(manifestName),sourceManifestSha256:sha(mb),fixture:m,sourceDepartureReport:m.sourceDepartureReport,sourceDepartureReportSha256:m.sourceDepartureReportSha256,
    identity:d.identity,input,roundtrip,nativeCounters:{nativeCounter,scriptCounter},unchangedOtherRecords:Object.values(input.counts).reduce((a,b)=>a+b,0),
    freshDepartedReloadQualified:true,originalOutgoingAbsenceQualified:true,pairedOwnershipHandoffQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,
    sourceSha256:sources,evidenceSha256:{...evidence,[resolve(manifestName)]:sha(mb),[m.log]:sha(Buffer.from(log)),[roundtrip.filename]:roundtrip.sha256}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [manifest,output]=process.argv.slice(2);if(!manifest||!output||process.argv.length!==4)throw Error('Usage: <terminal departed manifest> <fresh output|--stdout>');const r=await verifyRepeatDepartedReload(manifest);
  if(output==='--stdout')console.log(JSON.stringify(r));else{await writeFile(output,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,identity:r.identity,unchangedOtherRecords:r.unchangedOtherRecords,freshDepartedReloadQualified:true}));}
}
