#!/usr/bin/env node
// Verify the journal-selected whole-world load and its original continuation.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointActorRecords,checkpointAgentValues,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
const[manifestName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-selected-halo-owner-\d{3}-observed\.json$/);
await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const m=await json(manifestName),p=await json(m.selectedOwnerPreparation.filename);
assert.equal(m.nativeSelectedOwnerRequested,true);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);assert.equal(m.linkedHaloLiveTrialCompleted,true);
try{process.kill(m.nativePid,0);throw Error('Selected owner producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(m.browserUsed,false);assert.equal(m.selectedOwnerManifestUnchanged,true);assert.equal(m.sourceCheckpointUnchanged,true);
assert.equal(m.privateNativeExecutableUnchanged,true);assert.deepEqual(m.preservedBefore,m.preservedAfter);
assert.equal(await hash(m.selectedOwnerPreparation.filename),m.selectedOwnerPreparation.sha256);
assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [['scripts/run-native-halo-bundle.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
assert.equal(await hash(m.log),m.logSha256);const log=await readFile(m.log,'utf8');
assert.ok(log.includes('Halo route owner reload clock=1000 hero=510 flag=511 survivor=513 retired=512 home=53 agents=54,55 imported=0 expired-effect-restored=0 reward-rejoined=0 result=pass'));
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));assert.ok(!/result=fail|abort from/.test(log));
const match=/Halo bundle live evolved clock=(\d+) changed=(\d+) ai=(\d+),(\d+) contexts=(\d+),(\d+) commands=(\d+),(\d+),(\d+),(\d+) initial=(-?\d+),(-?\d+),(-?\d+) accepted=(-?\d+),(-?\d+),(-?\d+) footprint=4 drawing=1 reciprocal=1 evolved-saved=1 original-pause=1 hooks-removed=1 source-retired=0 owner-published=0 result=pass/.exec(log);
assert.ok(match);const v=match.slice(1).map(Number);assert.equal(v[0],1500);assert.equal(v[8],0);
for(const i of [1,2,3,4,5,6,7,9])assert.ok(v[i]>0&&v[i]<4096);
assert.notDeepEqual(v.slice(10,13),v.slice(13,16));
const rows=[m.sourceCheckpoint,m.loadedCheckpoint,m.activatedCheckpoint,m.evolvedCheckpoint],worlds=[];
assert.equal(m.sourceCheckpoint.sha256,p.selected.entry.world.sha256);
for(const r of rows){assert.ok(r);assert.equal(await hash(r.filename),r.sha256);worlds.push(await stoppedFileSource(r.filename));}
const nativeIds=[510,511,513],agentIds=[53,54,55];
async function selected(w){const records=new Map();
  for await(const u of checkpointUnits(w))if(nativeIds.includes(u.primary.words[1]))records.set('UNIT:'+u.primary.words[1],u);
  for await(const a of checkpointAgents(w))if(agentIds.includes(a.agentId))records.set('GPL:'+a.agentId,a);
  for await(const a of checkpointAttachments(w))if(nativeIds.includes(a.unitId))records.set(a.kind+':'+a.unitId,a);
  return records;
}
const before=await selected(worlds[0]);assert.equal(before.size,11);
for(const index of [1,2]){const actual=await selected(worlds[index]);assert.equal(actual.size,before.size);
  for(const[key,r]of before){const t=actual.get(key);assert.ok(t);assert.equal(t.size,r.size);
    for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);
      assert.deepEqual(await worlds[index].readAt(t.offset+at,n),await worlds[0].readAt(r.offset+at,n),key);}
  }
}
for(const[index,w]of worlds.entries()){
  assert.equal(await checkpointSavedClock(w),index===3?1500:1000);
  for await(const u of checkpointUnits(w))assert.notEqual(u.primary.words[1],512);
  for await(const a of checkpointAttachments(w))assert.notEqual(a.unitId,512);
  await verifyRegisteredHeroSnapshot(p.identity,p.selected.entry.alias,p.selected.entry.homeAlias,w,true,'0_-1');
  await verifyEntitySnapshot(p.identity,p.selected.entry.alias,w,true,p.selected.entry.homeAlias);
}
const evolved=worlds[3],hero=await checkpointActorRecords(evolved,510),effect=[...await selected(evolved)].find(([key])=>key==='UNIT:513')[1];
assert.equal(effect.primary.words[6],510);
assert.deepEqual(await evolved.readAt(effect.offset+72,8),await evolved.readAt(hero.unit.offset+72,8));
const pose=await evolved.readAt(hero.unit.offset+60,12),view=new DataView(pose.buffer,pose.byteOffset,12);
assert.deepEqual([0,4,8].map(at=>view.getInt32(at,true)),v.slice(13,16));
let association=0;for await(const c of checkpointContainerEntries(evolved))if(c.type==='member'&&
  ((c.unitId===510&&c.groupKind===101&&c.targetUnitId===511)||(c.unitId===511&&c.groupKind===100&&c.targetUnitId===510)))association++;
assert.ok(association===0||association===2);let root;
for await(const value of checkpointAgentValues(evolved,55))if(value.attribute.toLowerCase()==='heroes'&&!value.path.length)root=value;
assert.ok(root);assert.equal(root.type,4);assert.equal(root.childCount,association?1:0);
assert.equal(m.frames.length,2);for(const f of m.frames){assert.equal(await hash(f.filename),f.sha256);assert.equal(f.bytes,1440015);}
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.finishedAtMs-m.startedAtMs<37000);
assert.ok(m.resourceSamples.length);for(const s of m.resourceSamples)assert.ok(s.rssBytes<=m.rssCeilingBytes);
assert.equal(p.dormantWorldsOpened,0);assert.equal(p.stats.peakReads,1);assert.ok(p.stats.largestRead<=4096);
const sourceSha256={};for(const n of ['scripts/inspect-native-selected-halo-owner.mjs','scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs',
  'web/world/checkpoint.mjs','web/world/saved-clock.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs','web/world/order-entries.mjs',
  'web/world/remote-home.mjs','web/world/reward-membership.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,selectedOriginalHaloOwnerReloadQualified:true,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,
  selectedOwnerPreparation:m.selectedOwnerPreparation,selectedOwner:p.selected.owner,selectedManifest:p.selected.record.manifest,
  identity:p.identity,sourceClock:1000,evolvedClock:1500,exactLoadedRecords:11,exactRecordComparisons:22,retiredEffectRestored:false,
  originalAiAndTimersContinued:true,rewardAssociationPresent:association!==0,heroPoseBefore:v.slice(10,13),heroPoseAfter:v.slice(13,16),
  aiCalls:v.slice(2,4),contextCalls:v.slice(4,6),commandCalls:v.slice(6,10),evolvedWorld:m.evolvedCheckpoint,
  dormantWorldsOpened:0,selectedOwnerManifestUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,
  ownerSavePublished:false,seamlessLiveTravelQualified:false,browserUsed:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedOriginalHaloOwnerReloadQualified:true,exactRecords:11,evolvedClock:1500,retiredEffectRestored:false}));
