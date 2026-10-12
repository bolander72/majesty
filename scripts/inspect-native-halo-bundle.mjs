#!/usr/bin/env node
// Require a clean terminal process and exact independently rebound write-backs.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointActorRecords,checkpointAgents,checkpointAgentValues,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyExploreRewardAssociation} from '../web/world/reward-membership.mjs';
import {verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';
const[manifestName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const output=resolve(outputName);assert.match(outputName,/^output\/native-halo-bundle-[0-9]{3}-observed\.json$/);
await assert.rejects(lstat(output),e=>e.code==='ENOENT');
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const m=await json(manifestName),prep=await json(m.preparation);
const live=m.nativeActivationRequested===true;
assert.equal((await hashNativeFile(m.preparation)).sha256,m.preparationSha256);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.equal(m.stopReason,null);assert.equal(live?m.linkedHaloLiveTrialCompleted:m.linkedHaloReaderTrialCompleted,true);assert.equal(m.browserUsed,false);
assert.equal(m.nativeActivationQualified,false);assert.deepEqual(m.preservedAfter,m.preservedBefore);
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.finishedAtMs-m.startedAtMs<37000);assert.ok(m.resourceSamples.length>0);
for(const sample of m.resourceSamples)assert.ok(sample.rssBytes>=0&&sample.rssBytes<=m.rssCeilingBytes);
assert.equal(m.sourceCheckpointUnchanged,true);assert.equal(m.packUnchanged,true);assert.equal(m.privateNativeExecutableUnchanged,true);
assert.match(basename(m.fixture),/^actor-arrival-fixture-halo-world-bundle-/);
assert.equal(m.profile,join(m.fixture,'frontier_0_-1'));
assert.ok(!execFileSync('ps',['-axo','pid='],{encoding:'utf8'}).trim().split(/\s+/).map(Number).includes(m.nativePid));
for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal((await hashNativeFile(n)).sha256,h);
for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal((await hashNativeFile(n)).sha256,h);
for(const[n,h]of [['scripts/run-native-halo-bundle.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal((await hashNativeFile(n)).sha256,h);
assert.equal((await hashNativeFile(m.privateNativeExecutable)).sha256,m.nativeExecutableSha256);
assert.equal((await hashNativeFile(m.log)).sha256,m.logSha256);assert.ok((await lstat(m.log)).size<4*1024*1024);
const log=await readFile(m.log,'utf8');
const re=/^\[streaming\] Halo bundle records hero=(\d+) flag=(\d+) effects=(\d+),(\d+) home=(\d+) agents=(\d+),(\d+) clock=0 records=13 exact=1 reciprocal=1 native-home=0 scheduled=0 activation=0 owner-published=0 result=pass$/gm;
const rows=[...log.matchAll(re)];assert.equal(rows.length,1);
const actual=rows[0].slice(1).map(Number),native=new Map(prep.options.proposedUnits.map((id,i)=>[id,actual[i]])),
  agents=new Map(prep.options.proposedAgents.map((id,i)=>[id,actual[4+i]]));
assert.equal(new Set(actual.slice(0,4)).size,4);assert.equal(new Set(actual.slice(4)).size,3);
for(const id of [481,492,494,495])assert.ok(log.includes(`Halo bundle stage source=${id} status=00000000 complete=1 failure=0`));
if(!live)assert.ok(/Halo bundle cleanup requests=\d+ original-removal=1 aliases-absent=1 registry-preserved=1 queues-preserved=1 hooks-removed=1 result=pass/.test(log));
assert.ok(log.includes('guest exit code:    0')&&log.includes('undeliverable calls: none')&&log.includes('all expectations met'));
const checked=[];
for(const r of prep.records){
  const original=Uint8Array.from(await readFile(r.file.filename));assert.equal((await hashNativeFile(r.file.filename)).sha256,r.file.sha256);
  const expected=Uint8Array.from(original),view=new DataView(expected.buffer);let name;
  const put=(at,map)=>{const before=view.getUint32(at,true);assert.ok(map.has(before));view.setUint32(at,map.get(before),true);};
  if(r.type==='unit'){
    const i=prep.plan.sourceUnitIds.indexOf(r.sourceUnitId),range=prep.plan.sourceRecords[i].record;
    put(36,native);if(i>1)put(56,native);
    for(const p of r.plan.patches)if(p.reason==='native script association')put(p.offset-range.offset,agents);
    name=`Halo_Observed_${r.sourceUnitId}.UNIT`;
  }else if(r.type==='agent'){
    const i=r.sourceUnitId===481?4:5,range=prep.plan.sourceRecords[i].record;
    for(const p of r.plan.patches){
      const at=p.offset-range.offset;
      if(p.reason==='script identity'||p.reason.startsWith('script:'))put(at,agents);
      else if(p.reason==='script native backlink')put(at,native);
    }
    name=`Halo_Observed_Agent_${r.sourceUnitId===481?1:2}.GPL`;
  }else if(r.type==='proxy'){
    put(r.plan.identityOffset,agents);name='Halo_Observed_Agent_0.GPL';
  }else if(r.type==='container'){
    let at=8;assert.equal(view.getUint32(0,true),1);
    for(let g=0;g<view.getUint32(4,true);++g){
      assert.equal(view.getUint32(at,true),1);const count=view.getUint32(at+4,true);put(at+12,native);at+=16;
      for(let n=0;n<count;++n,at+=8){put(at,native);assert.equal(view.getUint32(at+4,true),1);}
    }
    assert.equal(at,expected.length);name=`Halo_Observed_${r.sourceUnitId}_Container.bin`;
  }else{assert.equal(r.type,'orders');name=`Halo_Observed_${r.sourceUnitId}_Orders.bin`;}
  const filename=join(m.profile,name);assert.equal((await lstat(filename)).size,expected.length);
  const observed=Uint8Array.from(await readFile(filename));assert.deepEqual(observed,expected);
  checked.push({type:r.type,sourceUnitId:r.sourceUnitId??null,filename,...(await hashNativeFile(filename))});
}
assert.equal(checked.length,13);
assert.equal(m.frames.length,2);
for(const f of m.frames){
  const bytes=await readFile(f.filename);assert.equal(bytes.length,1440015);
  assert.equal(bytes.subarray(0,15).toString(),'P6\n800 600\n255\n');assert.equal((await hashNativeFile(f.filename)).sha256,f.sha256);
}
for(const row of [prep.sourceCheckpoint,prep.destinationCheckpoint])assert.equal((await hashNativeFile(row.preserved)).sha256,row.sha256);
let liveEvidence=null;
if(live){
  assert.equal((await hashNativeFile(m.coldReaderArchive.filename)).sha256,m.coldReaderArchive.sha256);
  const frozen=await json(m.coldReaderArchive.filename);assert.equal(frozen.nativeLinkedHaloReaderQualified,true);
  for(const row of frozen.sources.concat(frozen.evidence))assert.equal((await hashNativeFile(row.preserved)).sha256,row.sha256);
  assert.ok(log.includes(`Halo bundle live activated hero=${actual[0]} flag=${actual[1]} effects=${actual[2]},${actual[3]} clock=0 footprint=4 drawing=1 command-members=4 queued=2 ready-saved=1 owner-published=0 result=pass`));
  const end=[...log.matchAll(/Halo bundle live evolved clock=(\d+) changed=(\d+) ai=(\d+),(\d+) contexts=(\d+),(\d+) commands=(\d+),(\d+),(\d+),(\d+) initial=(-?\d+),(-?\d+),(-?\d+) accepted=(-?\d+),(-?\d+),(-?\d+) footprint=4 drawing=1 reciprocal=1 evolved-saved=1 original-pause=1 hooks-removed=1 source-retired=0 owner-published=0 result=pass/g)];
  assert.equal(end.length,1);const v=end[0].slice(1).map(Number);assert.equal(v[0],500);for(const n of v.slice(1,10))assert.ok(n>0&&n<4096);
  assert.notDeepEqual(v.slice(10,13),v.slice(13,16));
  const worlds=[];
  for(const [name,row,clock,pose]of [['activated',m.activatedCheckpoint,0,v.slice(10,13)],['evolved',m.evolvedCheckpoint,500,v.slice(13,16)]]){
    assert.ok(row);assert.equal((await hashNativeFile(row.filename)).sha256,row.sha256);
    const world=await stoppedFileSource(row.filename);assert.equal(await checkpointSavedClock(world),clock);
    const units=new Map();for await(const u of checkpointUnits(world))if(actual.slice(0,4).includes(u.primary.words[1])){assert.ok(!units.has(u.primary.words[1]));units.set(u.primary.words[1],u);}
    assert.equal(units.size,4);const hero=units.get(actual[0]),flag=units.get(actual[1]);
    const xyz=await world.readAt(hero.offset+60,12),pv=new DataView(xyz.buffer,xyz.byteOffset,xyz.byteLength);
    assert.deepEqual([0,4,8].map(at=>pv.getInt32(at,true)),pose);
    assert.equal(flag.components.length,1);assert.equal(flag.primary.words[0],4);
    const h=await checkpointActorRecords(world,actual[0]),f=await checkpointActorRecords(world,actual[1]);
    assert.equal(h.agent.agentId,actual[5]);assert.equal(f.agent.agentId,actual[6]);
    await verifyExploreRewardAssociation(world,actual[0],actual[5],actual[1],0);
    const heroNav=Array.from(await world.readAt(hero.offset+72,8));
    for(const id of actual.slice(2,4)){const u=units.get(id);assert.equal(u.primary.words[6],actual[0]);assert.equal(u.primary.words[2]&4,0);assert.deepEqual(Array.from(await world.readAt(u.offset+72,8)),heroNav);}
    const allAgents=new Map();for await(const a of checkpointAgents(world)){assert.ok(allAgents.size<4096);allAgents.set(a.agentId,a);}
    const newReferences=[];let homeCount=0;
    for(const id of actual.slice(5))for await(const value of checkpointAgentValues(world,id)){
      if(value.type===5&&value.targetAgentId){
        const target=allAgents.get(value.targetAgentId);assert.ok(target&&!target.deleted);
        if(clock===0)assert.ok(actual.slice(4).includes(value.targetAgentId));
        else if(!actual.slice(4).includes(value.targetAgentId)){
          // Ordinary AI may select an existing destination enemy or building.
          // Require its saved native/script backlink, not the old closed proposal.
          assert.ok(target.unitId);const linked=await checkpointActorRecords(world,target.unitId);assert.equal(linked.agent.agentId,target.agentId);
          newReferences.push({agentId:id,attribute:value.attribute,targetAgentId:target.agentId,targetUnitId:target.unitId});
        }
      }
      if(id===actual[5]&&value.attribute==='home'&&!value.path.length){++homeCount;assert.equal(value.type,5);assert.equal(value.targetAgentId,actual[4]);}
    }
    assert.equal(homeCount,1);const proxy=allAgents.get(actual[4]);assert.ok(proxy);
    const bytes=await world.readAt(proxy.offset,proxy.size);await verifyRemoteHomeAgent({size:bytes.length,async readAt(at,n){return bytes.slice(at,at+n);}},prep.registered,actual[4]);
    const queue=[];for await(const q of checkpointAgentQueues(world))if(q.type==='queued-agent'&&actual.slice(4).includes(q.agentId))queue.push(q.agentId);
    assert.deepEqual(queue.sort((a,b)=>a-b),actual.slice(5).sort((a,b)=>a-b));
    worlds.push({name,...row,clock,heroPose:pose,actorRewardReferencesClosed:true,pureHomeProxyCanonical:true,newDestinationReferences:newReferences});
  }
  liveEvidence={worlds,changedSamples:v[1],agentReturns:v.slice(2,4),contextReturns:v.slice(4,6),commandReturns:v.slice(6,10),originalPauseRequested:true};
}
const report={version:1,nativeLinkedHaloReaderQualified:true,scope:'Unscheduled linked original reader/writer and cleanup; no spatial activation or ownership transfer',
  manifest:resolve(manifestName),manifestSha256:(await hashNativeFile(manifestName)).sha256,
  actualNativeUnitIds:actual.slice(0,4),actualAgentIds:actual.slice(4),records:checked,
  actorAndRewardReferencesClosed:true,originalFlagAndCommandReadersExecuted:true,originalWritebacksExact:true,
  originalCleanupQualified:!live,nativeSessionTerminal:true,nativeExitCode:0,sourceAndNorthUnchanged:true,
  nativeActivationQualified:live,destinationCollisionQualified:live,liveEvidence,sourceRetired:false,ownerPublished:false,browserUsed:false,goalComplete:false};
if(live)report.scope='Linked hero/Explore flag/effects, original activation, 500ms ordinary play and two original whole-world saves; source retirement and ownership remain unfinished';
report.sourceSha256=Object.fromEntries(await Promise.all(['scripts/inspect-native-halo-bundle.mjs','scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs','web/world/reward-membership.mjs','web/world/remote-home.mjs'].map(async n=>[n,(await hashNativeFile(n)).sha256])));
report.elapsedMs=m.finishedAtMs-m.startedAtMs;report.peakSampledNativeRssBytes=Math.max(...m.resourceSamples.map(r=>r.rssBytes));
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeLinkedHaloReaderQualified:true,exactRecords:13,originalCleanupQualified:!live,nativeActivationQualified:live}));
