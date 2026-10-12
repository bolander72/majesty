#!/usr/bin/env node
// Verify exact activation separately from the original, unmodified AI run.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointChunks,
 checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';

const [importName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-homeward-activation-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const imported=await json(importName);assert.equal(imported.nativeHaloHomewardImportQualified,true);
assert.equal(imported.completeScriptRootsQualified,true);assert.equal(imported.originalCleanupQualified,false);
assert.equal(await hash(imported.manifest),imported.manifestSha256);
const m=await json(imported.manifest),p=await json(m.preparation);
for(const key of ['activationRequested','selectedHaloHomewardActivationTrialCompleted','nativeSessionTerminal','ownedProducerAbsent'])assert.equal(m[key],true);
assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
try{process.kill(m.nativePid,0);throw Error('Native producer is live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);
assert.deepEqual(m.journalBefore,p.journalSha256);assert.equal(m.privateNativeExecutableUnchanged,true);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...imported.sourceSha256,...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[m.log,m.logSha256],[m.preparation,m.preparationSha256],
 [m.privateNativeExecutable,m.nativeExecutableSha256],['scripts/run-native-halo-homeward-import.py',m.runnerSha256]])assert.equal(await hash(n),h);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(m.activationWorlds.length,2);
const rows=[m.worlds[1],...m.activationWorlds];
assert.deepEqual(rows.map(r=>r.filename.split('/').at(-1)),['Halo_Homeward_Imported.GMP','Halo_Homeward_Ready.GMP','Halo_Homeward_Evolved.GMP']);
const hero=imported.actualNativeUnitId,agent=imported.actualAgentId,worlds=[],states=[],maps=[];
async function records(s){const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
for(const[i,r]of rows.entries()){
 assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);
 worlds.push(await stoppedFileSource(r.filename));states.push(await connectedWorldState(r.filename,{unscheduledAgents:i?[]:[agent]}));
 maps.push(await records(worlds[i]));
 await verifyRegisteredHeroSnapshot(p.identity,{unitId:hero,agentId:agent},{kind:'native',unitId:469,agentId:7},worlds[i],true,'0_0');
}
assert.deepEqual(states.map(s=>s.clock),[84550,84550,94550]);
assert.deepEqual([...maps[0].keys()].sort(),[...maps[1].keys()].sort());
let exactActivationRecords=0;
for(const[key,a]of maps[0]){const b=maps[1].get(key);assert.equal(b.size,a.size,key);
 for(let at=0;at<a.size;at+=4096){const n=Math.min(4096,a.size-at);
  assert.deepEqual(await worlds[1].readAt(b.offset+at,n),await worlds[0].readAt(a.offset+at,n),key);}
 ++exactActivationRecords;}
assert.equal(exactActivationRecords,494);
assert.equal(states[0].rng,states[1].rng);assert.equal(states[0].gameplayRng,states[1].gameplayRng);
assert.equal(states[0].rawTerrainSha256,states[1].rawTerrainSha256);
assert.deepEqual(states[0].roots.filter(r=>r.tag!=='GPL '),states[1].roots.filter(r=>r.tag!=='GPL '));
assert.equal(states[0].activeQueue,states[1].activeQueue);
const own=states[1].queues.map((q,index)=>({index,count:q.filter(id=>id===agent).length}));
assert.equal(own.reduce((n,r)=>n+r.count,0),1);const insertedQueue=own.find(r=>r.count===1).index;
for(let k=0;k<2;++k)assert.deepEqual(states[1].queues[k],k===insertedQueue?[...states[0].queues[k],agent]:states[0].queues[k]);
// Reconstruct every GPL-root byte; only the original pending queue append and
// its four counts/lengths may differ. Reads stay bounded at 4 KiB.
async function root(s,tag){let result;for await(const r of checkpointChunks(s))if(r.tag===tag){assert.equal(result,undefined);result=r;}assert.ok(result);return result;}
const bg=await root(worlds[0],'GPL '),ag=await root(worlds[1],'GPL '),agents=[];
for await(const r of checkpointAgents(worlds[0]))agents.push(r);
const tail=agents.at(-1).offset+agents.at(-1).size;
const countOffset=tail+(insertedQueue?4+4*states[0].queues[0].length:0);
const insertion=countOffset+4+4*states[0].queues[insertedQueue].length;
assert.equal(ag.size,bg.size+4);assert.equal(ag.version,bg.version);assert.equal(ag.count,bg.count);
const patches=[];for(const relative of [4,16,28,countOffset-bg.offset]){
 const bytes=Buffer.from(await worlds[0].readAt(bg.offset+relative,4));
 bytes.writeUInt32LE(bytes.readUInt32LE(0)+(relative===countOffset-bg.offset?1:4));patches.push({relative,bytes});}
assert.equal(Buffer.from(await worlds[1].readAt(ag.offset+insertion-bg.offset,4)).readUInt32LE(),agent);
for(let at=0;at<bg.size+16;){const n=Math.min(4096,bg.size+16-at,at<insertion-bg.offset?insertion-bg.offset-at:Infinity);
 const bytes=Uint8Array.from(await worlds[0].readAt(bg.offset+at,n));
 for(const patch of patches)for(let j=0;j<4;++j){const pos=patch.relative+j-at;if(pos>=0&&pos<n)bytes[pos]=patch.bytes[j];}
 assert.deepEqual(await worlds[1].readAt(ag.offset+at+(at>=insertion-bg.offset?4:0),n),bytes);at+=n;}
const poses=[],orders=[];
for(let i=0;i<3;++i){assert.equal(states[i].queues.flat().filter(id=>id===agent).length,i?1:0);
 const unit=maps[i].get('UNIT:'+hero);assert.ok(unit);assert.equal(unit.primary.words[2]&4,0);
 const b=Buffer.from(await worlds[i].readAt(unit.offset+60,20));poses.push([0,4,8,12,16].map(at=>b.readInt32LE(at)));
 const values=[];for await(const v of checkpointAgentValues(worlds[i],agent))values.push(v);
 for(const name of ['home','target'])assert.equal(values.find(v=>v.attribute===name&&!v.path.length).targetAgentId,7);
 const task=values.find(v=>v.attribute==='taskname'&&!v.path.length);assert.equal(task.stringBytes,7);
 assert.equal(Buffer.from(await worlds[i].readAt(task.offset,7)).toString('ascii'),'go_home');
 const entries=[];for await(const e of checkpointActorOrderEntries(worlds[i],hero))if(e.type==='entry')entries.push(e);
 orders.push(entries);assert.deepEqual(entries.map(e=>e.kind),[2,4,7]);
}
assert.deepEqual(poses[0],poses[1]);assert.notDeepEqual(poses[1],poses[2]);
// Gameplay updates terrain caches and explored state. Prove the immutable
// height geometry directly rather than requiring those live bytes to freeze.
const terrains=await Promise.all(worlds.slice(1).map(s=>checkpointTerrain(s)));
assert.deepEqual(terrains.map(t=>[t.width,t.height]),[[128,128],[128,128]]);
let unchangedTerrainHeights=0;
for(let y=0;y<=128;++y){const before=await worlds[1].readAt(terrains[0].heightOffset(0,y),129*9);
 const after=await worlds[2].readAt(terrains[1].heightOffset(0,y),129*9);
 for(let x=0;x<=128;++x){assert.deepEqual(after.subarray(x*9,x*9+4),before.subarray(x*9,x*9+4));++unchangedTerrainHeights;}}
assert.ok((await lstat(m.log)).size<4*1024*1024);const log=await readFile(m.log,'utf8');
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(!/result=fail|abort from|refused boundary=/.test(log));
assert.ok(log.includes(`Halo homeward activated hero=${hero} agent=${agent} home=469/7 clock=84550 footprint=4 drawing=1 queued=1 orders-admitted=1 original-collision=1 original-first-postload=1 completed-model-step-cached=1 original-second-postload=1 ungated-ai=1 ready-saved=1 owner-published=0 result=pass`));
const endpoints=[...log.matchAll(/Halo homeward endpoint clock=94550 ticks=200 ai=(\d+) other-ai=(\d+) contexts=(\d+) building=(\d+) commands=(\d+) moved=1 parent=(\d+) cells=(\d+) drawing=(\d+)/g)];
assert.equal(endpoints.length,1);const counts=endpoints[0].slice(1).map(Number);
for(const n of counts.slice(0,5))assert.ok(n>0&&n<=65536);
const parent=maps[2].get('UNIT:'+hero).primary.words[6];assert.equal(counts[5],parent);
assert.ok(parent===0||parent===469);assert.equal(counts[6],parent?0:4);assert.equal(counts[7],parent?0:1);
assert.ok(log.includes(`Halo homeward evolved hero=${hero} agent=${agent} home=469/7 clock=94550 ticks=200 original-ai=1 ungated-building-use=1 original-commands=1 moved=1 parent=${parent} queued=1 reciprocal-rosters=1 evolved-saved=1 hooks-removed=1 original-pause=1 owner-published=0 result=pass`));
assert.equal(m.deadlineSeconds,45);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.resourceSamples.length&&m.finishedAtMs-m.startedAtMs<47000);
for(const s of m.resourceSamples)assert.ok(s.rssBytes<=m.rssCeilingBytes);
const sourceSha256={...imported.sourceSha256,'scripts/inspect-native-halo-homeward-activation.mjs':await hash('scripts/inspect-native-halo-homeward-activation.mjs'),
 'web/world/order-entries.mjs':await hash('web/world/order-entries.mjs'),'web/world/terrain.mjs':await hash('web/world/terrain.mjs')};
const report={version:1,nativeHaloHomewardActivationQualified:true,homewardGameplayResumed:true,
 scope:'Original hero activation at the actual selected home and 200 original ticks of ungated AI/command continuation. Arrival inside the guild, paired publication, repeated residency and browser performance are separate requirements.',
 manifest:imported.manifest,manifestSha256:imported.manifestSha256,importProof:{filename:resolve(importName),sha256:await hash(importName)},sourceSha256,
 actualNativeUnitId:hero,actualAgentId:agent,worlds:rows,exactActivationRecords,completeActivationRootsQualified:true,
 sourceClock:3750,homeClock:84550,evolvedClock:94550,originalTicks:200,originalAiCalls:counts[0],otherAiCalls:counts[1],
 contextCalls:counts[2],buildingUseCalls:counts[3],commandCalls:counts[4],poses,parentUnitId:parent,enteredGuild:parent===469,unchangedTerrainHeights,
 reciprocalGuildMembershipQualified:true,originalSpatialAndDrawingActivationQualified:true,originalCommandsRestored:true,
 sourceRetired:true,ownerPublished:false,actualJournalUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,browserUsed:false,
 peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),elapsedMs:m.finishedAtMs-m.startedAtMs,
 maximumReadBytes:4096,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHaloHomewardActivationQualified:true,exactActivationRecords,originalTicks:200,enteredGuild:report.enteredGuild}));
