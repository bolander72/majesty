#!/usr/bin/env node
// Verify fresh original-world loading and resumed gameplay from frozen live saves.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointActorRecords,checkpointAgentValues,checkpointAgentQueues,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {verifyExploreRewardAssociation} from '../web/world/reward-membership.mjs';
const [manifestName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-halo-reload-bundle-\d{3}-observed\.json$/);
await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const m=await json(manifestName),prep=await json(m.preparation);
assert.equal(m.nativeReloadRequested,true);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);assert.equal(m.linkedHaloLiveTrialCompleted,true);
assert.equal(m.browserUsed,false);assert.equal(m.sourceCheckpointUnchanged,true);assert.equal(m.privateNativeExecutableUnchanged,true);
assert.deepEqual(m.preservedBefore,m.preservedAfter);
assert.ok(!execFileSync('ps',['-axo','pid='],{encoding:'utf8'}).trim().split(/\s+/).map(Number).includes(m.nativePid));
assert.equal(await hash(m.preparation),m.preparationSha256);assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);
for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(n),h);
for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(n),h);
for(const[n,h]of [['scripts/run-native-halo-bundle.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
const archive=await json(m.liveProducerArchive.filename);assert.equal(await hash(m.liveProducerArchive.filename),m.liveProducerArchive.sha256);
assert.equal(archive.nativeActivationQualified,true);assert.equal(archive.ordinaryPlayMs,500);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
const p=archive.evidence.find(r=>r.original.endsWith('/output/native-halo-bundle-003-observed.json'));assert.ok(p);
const producer=await json(p.preserved),ids=producer.actualNativeUnitIds,agents=producer.actualAgentIds;
assert.equal(producer.liveEvidence.worlds[1].sha256,m.sourceCheckpoint.sha256);
assert.equal(await hash(m.log),m.logSha256);const log=await readFile(m.log,'utf8');
assert.ok(log.includes(`Halo bundle fresh reload clock=500 hero=${ids[0]} flag=${ids[1]} effects=${ids[2]},${ids[3]} home=${agents[0]} agents=${agents[1]},${agents[2]} imported=0 original-world-reader=1 result=pass`));
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(!/result=fail|abort from/.test(log));
const end=[...log.matchAll(/Halo bundle live evolved clock=(\d+) changed=(\d+) ai=(\d+),(\d+) contexts=(\d+),(\d+) commands=(\d+),(\d+),(\d+),(\d+) initial=(-?\d+),(-?\d+),(-?\d+) accepted=(-?\d+),(-?\d+),(-?\d+) footprint=4 drawing=1 reciprocal=1 evolved-saved=1 original-pause=1 hooks-removed=1 source-retired=0 owner-published=0 result=pass/g)];
assert.equal(end.length,1);const v=end[0].slice(1).map(Number);assert.equal(v[0],1000);for(const n of v.slice(1,10))assert.ok(n>0&&n<4096);
assert.notDeepEqual(v.slice(10,13),v.slice(13,16));
const worlds=[];for(const row of [m.sourceCheckpoint,m.loadedCheckpoint,m.activatedCheckpoint,m.evolvedCheckpoint]){
  assert.ok(row);assert.equal(await hash(row.filename),row.sha256);worlds.push(await stoppedFileSource(row.filename));
}
for(let i=0;i<worlds.length;i++)assert.equal(await checkpointSavedClock(worlds[i]),i===3?1000:500);
async function records(world){const rows=new Map();
  for await(const u of checkpointUnits(world))if(ids.includes(u.primary.words[1]))rows.set('UNIT:'+u.primary.words[1],u);
  for await(const a of checkpointAgents(world))if(agents.includes(a.agentId))rows.set('GPL:'+a.agentId,a);
  for await(const a of checkpointAttachments(world))if(ids.includes(a.unitId))rows.set(a.kind+':'+a.unitId,a);
  return rows;
}
const before=await records(worlds[0]),loaded=await records(worlds[1]),activated=await records(worlds[2]);assert.equal(before.size,13);
const checked=[];
for(const [key,r]of before)for(const [name,rows,world]of [['loaded',loaded,worlds[1]],['activated',activated,worlds[2]]]){
  const t=rows.get(key);assert.ok(t,key);assert.equal(t.size,r.size,key);
  for(let at=0;at<r.size;at+=4096){const count=Math.min(4096,r.size-at),a=await worlds[0].readAt(r.offset+at,count),b=await world.readAt(t.offset+at,count);
    assert.equal(a.length,count);assert.equal(b.length,count);for(let i=0;i<count;i++)assert.equal(b[i],a[i],`${name} ${key} byte ${at+i}`);}
  checked.push({phase:name,record:key,bytes:r.size});
}
const world=worlds[3],hero=await checkpointActorRecords(world,ids[0]),flag=await checkpointActorRecords(world,ids[1]);
assert.equal(hero.agent.agentId,agents[1]);assert.equal(flag.agent.agentId,agents[2]);
const poseBytes=await world.readAt(hero.unit.offset+60,12),pose=new DataView(poseBytes.buffer,poseBytes.byteOffset,12);
assert.deepEqual([0,4,8].map(at=>pose.getInt32(at,true)),v.slice(13,16));
const members=[];for await(const c of checkpointContainerEntries(world))if(c.type==='member'&&
  ((c.unitId===ids[0]&&c.groupKind===101&&c.targetUnitId===ids[1])||(c.unitId===ids[1]&&c.groupKind===100&&c.targetUnitId===ids[0])))members.push(c);
const association=members.length===2;assert.ok(members.length===0||association);
if(association)await verifyExploreRewardAssociation(world,ids[0],agents[1],ids[1],0);
else{let root;for await(const value of checkpointAgentValues(world,agents[2]))if(value.attribute.toLowerCase()==='heroes'){
  assert.equal(value.path.length,0);assert.equal(value.type,4);assert.equal(value.childCount,0);assert.ok(!root);root=value;
}assert.ok(root);}
assert.ok(log.includes(`Halo bundle reward association clock=1000 present=${Number(association)} native-reciprocal=1 original-contexts=${v[5]} result=pass`));
const allAgents=new Map();for await(const a of checkpointAgents(world)){assert.ok(allAgents.size<4096);allAgents.set(a.agentId,a);}
let home=0;for(const id of agents.slice(1))for await(const value of checkpointAgentValues(world,id)){
  if(value.type===5&&value.targetAgentId){const target=allAgents.get(value.targetAgentId);assert.ok(target&&!target.deleted);
    if(target.unitId){const actor=await checkpointActorRecords(world,target.unitId);assert.equal(actor.agent.agentId,target.agentId);}}
  if(id===agents[1]&&value.attribute==='home'&&!value.path.length){home++;assert.equal(value.type,5);assert.equal(value.targetAgentId,agents[0]);}
}assert.equal(home,1);
const proxy=allAgents.get(agents[0]);assert.ok(proxy);const bytes=await world.readAt(proxy.offset,proxy.size);
await verifyRemoteHomeAgent({size:bytes.length,async readAt(at,n){return bytes.slice(at,at+n);}},prep.registered,agents[0]);
const queue=[];for await(const q of checkpointAgentQueues(world))if(q.type==='queued-agent'&&agents.includes(q.agentId))queue.push(q.agentId);
assert.deepEqual(queue.sort((a,b)=>a-b),agents.slice(1).sort((a,b)=>a-b));
const retired=new RegExp(`Halo bundle effect retired id=${ids[2]} clock=(\\d+) original-commands=(\\d+) result=pass`).exec(log);assert.ok(retired);assert.equal(Number(retired[1]),800);assert.ok(Number(retired[2])>0);
const survivors=new Map();for await(const u of checkpointUnits(world))if(ids.includes(u.primary.words[1]))survivors.set(u.primary.words[1],u);
assert.equal(survivors.has(ids[2]),false);assert.equal(survivors.size,3);assert.equal(survivors.get(ids[3]).primary.words[6],ids[0]);
assert.deepEqual(Array.from(await world.readAt(survivors.get(ids[3]).offset+72,8)),Array.from(await world.readAt(hero.unit.offset+72,8)));
assert.equal(m.frames.length,2);for(const f of m.frames){assert.equal(await hash(f.filename),f.sha256);assert.equal(f.bytes,1440015);}
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.finishedAtMs-m.startedAtMs<37000);
for(const s of m.resourceSamples)assert.ok(s.rssBytes<=m.rssCeilingBytes);
const sourceSha256=Object.fromEntries(await Promise.all(['scripts/inspect-native-halo-reload.mjs','scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs','web/world/remote-home.mjs','web/world/reward-membership.mjs'].map(async n=>[n,await hash(n)])));
const report={version:1,nativeFreshHaloReloadQualified:true,scope:'Exact linked records at fresh load and resumed original AI/commands through1000ms; source retirement and ownership incomplete',
  manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,recordsChecked:checked,
  originalLoadedRecordsExact:true,originalReloadImportedActors:false,originalPlayResumed:true,sourceClock:500,evolvedClock:1000,
  heroPoseBefore:v.slice(10,13),heroPoseAfter:v.slice(13,16),agentReturns:v.slice(2,4),contextReturns:v.slice(4,6),commandReturns:v.slice(6,10),
  rewardAssociationPresent:association,rewardScriptAndNativeRostersConsistent:true,effectRetiredClock:800,proxyCanonical:true,
  nativeSessionTerminal:true,nativeExitCode:0,sourceRetired:false,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({nativeFreshHaloReloadQualified:true,exactRecords:13,originalPlayResumed:true,effectRetiredClock:800}));
