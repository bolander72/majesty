#!/usr/bin/env node
// Independently repeat projection, rebind only actual aliases, and compare all
// original records plus every changed world root at the held home boundary.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {checkpointChunks,checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentValues,
 checkpointContainerEntries,checkpointAbsentAgentReferences} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-homeward-import-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const m=await json(manifestName),p=await json(m.preparation),r=await json(p.capsule.filename);
const activate=m.activationRequested===true;assert.equal(p.selectedHaloHomewardActivationPrepared===true,activate);
assert.equal(m.selectedHaloHomewardImportTrialCompleted,true);assert.equal(m.nativeSessionTerminal,true);
assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
assert.equal(m.browserUsed,false);assert.equal(m.nativeProcessesStarted,1);assert.equal(m.ownerPublished,false);
assert.equal(m.nativeActivationQualified,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.journalBefore,p.journalSha256);
try{process.kill(m.nativePid,0);throw Error('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.match(basename(m.fixture),/^actor-arrival-fixture-halo-world-homeward-/);assert.equal(m.profile,join(m.fixture,'frontier_0_0'));
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256,...r.sourceSha256}))assert.equal(await hash(n),h);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);assert.deepEqual(m.compiledSourceSha256,p.compiledSourceSha256);
for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],[p.capsule.filename,p.capsule.sha256],
 [m.privateNativeExecutable,m.nativeExecutableSha256],[m.log,m.logSha256],['scripts/run-native-halo-homeward-import.py',m.runnerSha256],
 ['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
const build=await json(m.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(build.nativeSymbolsSha256,m.nativeSymbolsSha256);
assert.equal(await hash(p.archive.filename),p.archive.sha256);const archive=await json(p.archive.filename);
assert.equal(archive.nativeHomewardSourceRetirementQualified,true);
for(const row of archive.sources.concat(archive.evidence))assert.equal(await hash(row.preserved),row.sha256);
for(const row of [r.sourceWorld,r.retiredWorld,p.homeWorld,p.pack,m.sourceCheckpoint,m.pack,m.layoutMetadata,...p.records,...m.worlds,m.loadedCheckpoint,...m.frames]){
 assert.equal(await hash(row.filename),row.sha256);assert.equal((await lstat(row.filename)).size,row.bytes);}
for(const row of p.settings)assert.equal(await hash(row.preserved),row.sha256);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.ownerManifest);
for(const key of ['sourceCheckpointUnchanged','packUnchanged','layoutMetadataUnchanged','privateNativeExecutableUnchanged'])assert.equal(m[key],true);
const source=await stoppedFileSource(r.sourceWorld.filename),home=await stoppedFileSource(p.homeWorld.filename);
const repeated=await prepareCheckpointRegisteredHeroArrival(source,home,{unitId:532,freshUnitId:100000,freshAgentId:1000,
 unitBindings:[],attachedUnitBindings:[],sourceClockMs:3750,destinationClockMs:84550,
 haloRegions:{version:'halo-v1',sourceRegion:'1_0',destinationRegion:'0_0'}},
 {identity:r.identity,regions:['1_0','0_0'],ownerSide:0,aliases:r.selected.entries.map(e=>e.alias),
  homeAliases:r.selected.entries.map(e=>e.homeAlias),referenceBindings:[]});
assert.deepEqual(JSON.parse(JSON.stringify(repeated.plan)),r.plan);
const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024&&!/result=fail|abort from|refused boundary=/.test(log));
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(log.includes('Halo homeward stage status=00000000 complete=1 failure=0'));
assert.ok(log.includes('Family orders restored requests=18 requested-bytes=560 payload-bytes=500 exact=1 transferred=1 result=pass'));
const matches=[...log.matchAll(/Halo homeward imported hero=(\d+) agent=(\d+) home=469\/7 clock=84550 records=4 commands=3 exact=1 native-roster=1 script-roster=1 scheduled=0 activation=0 owner-published=0 result=pass/g)];
assert.equal(matches.length,1);const [hero,agent]=matches[0].slice(1).map(Number);assert.ok(hero>496&&agent>22);
if(!activate)assert.ok(log.includes('Halo homeward cleanup requests=18 aliases-absent=1 rosters-empty=1 registry-preserved=1 queues-preserved=1 drawing-preserved=1 original-removal=1 hooks-preserved=1 original-pause=1 result=pass'));
const nativeMap=new Map([[100000,hero],[469,469]]),agentMap=new Map([[1000,agent],[7,7]]),expected=new Map(),standalone=[];
for(const row of p.records){const bytes=Uint8Array.from(await readFile(row.filename));assert.deepEqual(bytes,repeated.records[row.key]);
 const v=new DataView(bytes.buffer),put=(at,map)=>{const value=v.getUint32(at,true);assert.ok(map.has(value));v.setUint32(at,map.get(value),true);};
 let key,name,observed=bytes;
 if(row.key==='unit'){put(36,nativeMap);for(const e of r.plan.edits)if(e.record==='unit'&&e.reason==='native script association')put(e.offset-r.plan.ranges.unit.offset,agentMap);
  key='UNIT:'+hero;name='Halo_Homeward_Unit_Observed.UNIT';
 }else if(row.key==='agent'){for(const e of r.plan.edits)if(e.record==='agent'){
   if(e.reason==='script identity'||e.reason.startsWith('script:'))put(e.offset-r.plan.ranges.agent.offset,agentMap);
   else if(e.reason==='script native association')put(e.offset-r.plan.ranges.agent.offset,nativeMap);}
  key='GPL:'+agent;name='Halo_Homeward_Agent_Observed.GPL';
 }else if(row.key==='container'){put(0,nativeMap);let at=44;assert.equal(v.getUint32(40,true),2);
  for(let g=0;g<2;g++){const count=v.getUint32(at+4,true);put(at+12,nativeMap);at+=16;
   for(let j=0;j<count;j++,at+=8){put(at,nativeMap);assert.equal(v.getUint32(at+4,true),1);}}
  assert.equal(at,bytes.length);key='CONT:'+hero;name='Halo_Homeward_Container_Observed.bin';observed=bytes.subarray(36);
 }else{assert.equal(row.key,'order');put(0,nativeMap);key='ORDR:'+hero;name='Halo_Homeward_Orders_Observed.bin';observed=bytes.subarray(36);}
 const filename=join(m.profile,name);assert.deepEqual(Uint8Array.from(await readFile(filename)),observed,key);
 expected.set(key,bytes);standalone.push({key,filename,...await hashNativeFile(filename)});}
assert.equal(expected.size,4);
async function records(w){const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
 for await(const row of checkpointUnits(w))add('UNIT:'+row.primary.words[1],row);
 for await(const row of checkpointAgents(w))add('GPL:'+row.agentId,row);
 for await(const row of checkpointAttachments(w))add(row.kind+':'+row.unitId,row);return map;}
async function exact(a,ar,b,br,key){assert.ok(ar&&br,key);assert.equal(br.size,ar.size,key);
 for(let at=0;at<ar.size;at+=4096){const n=Math.min(4096,ar.size-at);assert.deepEqual(await b.readAt(br.offset+at,n),await a.readAt(ar.offset+at,n),key);}}
async function root(w,tag){let r;for await(const c of checkpointChunks(w))if(c.tag===tag){assert.equal(r,undefined);r=c;}assert.ok(r);return r;}
const worlds=[],states=[],maps=[];assert.equal(m.worlds.length,activate?2:3);
for(const[i,row]of m.worlds.entries()){assert.equal(basename(row.filename),['Halo_Homeward_Before.GMP','Halo_Homeward_Imported.GMP','Halo_Homeward_Cleaned.GMP'][i]);
 worlds.push(await stoppedFileSource(row.filename));states.push(await connectedWorldState(row.filename,{unscheduledAgents:i===1?[agent]:[]}));
 maps.push(await records(worlds[i]));assert.equal(states[i].clock,84550);}
const originalState=await connectedWorldState(p.homeWorld.filename),loadedState=await connectedWorldState(m.loadedCheckpoint.filename);
const reload=compareConnectedWorlds(originalState,loadedState);compareConnectedWorlds(loadedState,states[0]);
assert.equal(loadedState.rawTerrainSha256,states[0].rawTerrainSha256);
assert.deepEqual([...maps[1].keys()].sort(),[...maps[0].keys(),...expected.keys()].sort());if(!activate)assert.deepEqual([...maps[2].keys()],[...maps[0].keys()]);
let unrelatedRecordComparisons=0,cleanupRecordComparisons=0;
for(const[key,b]of expected){const row=maps[1].get(key);assert.equal(row.size,b.length);assert.deepEqual(await worlds[1].readAt(row.offset,row.size),b,key);}
for(const[key,row]of maps[0]){if(!['GPL:7','CONT:469'].includes(key)){await exact(worlds[0],row,worlds[1],maps[1].get(key),key);unrelatedRecordComparisons++;}
 if(!activate){await exact(worlds[0],row,worlds[2],maps[2].get(key),key);cleanupRecordComparisons++;}}
// Exactly one original roster insertion, with every opaque byte preserved.
const modified=new Map();
async function inserted(row,key,offset,words,patches){assert.ok(row.size<=4096);const old=await worlds[0].readAt(row.offset,row.size),next=new Uint8Array(old.length+8);
 next.set(old.subarray(0,offset));next.set(old.subarray(offset),offset+8);const v=new DataView(next.buffer);
 words.forEach((n,i)=>v.setUint32(offset+i*4,n,true));for(const[at,n]of patches)v.setUint32(at,v.getUint32(at,true)+n,true);
 assert.equal(maps[1].get(key).size,next.length);assert.deepEqual(await worlds[1].readAt(maps[1].get(key).offset,next.length),next,key);modified.set(key,next);}
let memberRoot;for await(const v of checkpointAgentValues(worlds[0],7))if(v.attribute==='members'&&!v.path.length)memberRoot=v;
assert.equal(memberRoot.type,4);assert.equal(memberRoot.childCount,0);const guild=maps[0].get('GPL:7'),list=memberRoot.typeOffset-guild.offset;
await inserted(guild,'GPL:7',list+16,[5,agent],[[0,8],[8,8],[list+4,8],[list+12,1]]);
let group;for await(const c of checkpointContainerEntries(worlds[0]))if(c.unitId===469&&c.groupKind===100&&c.type==='group')group=c;
assert.equal(group.memberCount,0);const cont=maps[0].get('CONT:469'),at=group.offset-cont.offset;
await inserted(cont,'CONT:469',at+16,[hero,1],[[8,8],[cont.primary.offset-cont.offset+4,8],[at+4,1]]);
await verifyRegisteredHeroSnapshot(r.identity,{unitId:hero,agentId:agent},{kind:'native',unitId:469,agentId:7},worlds[1],true,'0_0');
if(!activate)assert.equal((await checkpointAbsentAgentReferences(worlds[2],agent)).sites.length,0);
for(const state of states.slice(1)){assert.equal(state.rng,states[0].rng);assert.equal(state.gameplayRng,states[0].gameplayRng);
 assert.equal(state.rawTerrainSha256,states[0].rawTerrainSha256);assert.deepEqual(state.queues,states[0].queues);assert.equal(state.activeQueue,states[0].activeQueue);
 assert.deepEqual(state.roots.filter(r=>!['MAP ','GPL ','VHCL','ORDR','CONT','ORLS'].includes(r.tag)),states[0].roots.filter(r=>!['MAP ','GPL ','VHCL','ORDR','CONT','ORLS'].includes(r.tag)));}
// Original alias reservations advance once and are never rewound on cleanup.
const mapRoot=await root(worlds[0],'MAP '),mapBytes=Uint8Array.from(await worlds[0].readAt(mapRoot.offset+16,mapRoot.size));
assert.equal(mapBytes.length,56);const mapView=new DataView(mapBytes.buffer);assert.equal(mapView.getUint32(48,true)+1,hero);mapView.setUint32(48,hero,true);
for(let i=1;i<worlds.length;i++){const c=await root(worlds[i],'MAP ');assert.deepEqual(await worlds[i].readAt(c.offset+16,c.size),mapBytes);}
// Reconstruct the complete GPL root: one ordered map insertion, one guild
// roster insertion, three envelope lengths, map count and monotonic counter.
const bg=await root(worlds[0],'GPL '),oldAgents=[];for await(const a of checkpointAgents(worlds[0]))oldAgents.push(a);
const oldCounter=Buffer.from(await worlds[0].readAt(bg.end-12,4)).readUInt32LE();assert.equal(oldCounter,agent);
const followingAgent=oldAgents.find(a=>a.agentId>agent);
const gplInsert=followingAgent?followingAgent.offset-4:oldAgents.at(-1).offset+oldAgents.at(-1).size;
assert.ok(Number.isInteger(gplInsert));
const newRecord=expected.get('GPL:'+agent),newEntry=new Uint8Array(newRecord.length+4);new DataView(newEntry.buffer).setUint32(0,agent,true);newEntry.set(newRecord,4);
const memberBytes=new Uint8Array(8),memberView=new DataView(memberBytes.buffer);memberView.setUint32(0,5,true);memberView.setUint32(4,agent,true);
async function reconstructGpl(i){const insertions=i===1?[{at:gplInsert-bg.offset,bytes:newEntry},{at:memberRoot.typeOffset-guild.offset+16+guild.offset-bg.offset,bytes:memberBytes}].sort((a,b)=>a.at-b.at):[];
 const delta=insertions.reduce((n,r)=>n+r.bytes.length,0),patches=[];
 const patch=async(at,change)=>{const b=Buffer.from(await worlds[0].readAt(bg.offset+at,4));b.writeUInt32LE(b.readUInt32LE()+change);patches.push({at,bytes:b});};
 for(const at of [4,16,28])await patch(at,delta);
 if(i===1){await patch(oldAgents[0].offset-8-bg.offset,1);for(const[at,n]of [[0,8],[8,8],[list+4,8],[list+12,1]])await patch(guild.offset-bg.offset+at,n);}
 await patch(bg.end-12-bg.offset,1);const target=await root(worlds[i],'GPL ');assert.equal(target.size,bg.size+delta);
 let written=0;for(let at=0;at<bg.size+16;){for(const ins of insertions.filter(r=>r.at===at)){assert.deepEqual(await worlds[i].readAt(target.offset+written,ins.bytes.length),ins.bytes);written+=ins.bytes.length;}
  const next=insertions.find(r=>r.at>at)?.at??bg.size+16,n=Math.min(4096,next-at,bg.size+16-at),bytes=Uint8Array.from(await worlds[0].readAt(bg.offset+at,n));assert.ok(n>0);
  for(const patch of patches)for(let k=0;k<4;k++){const pos=patch.at+k-at;if(pos>=0&&pos<n)bytes[pos]=patch.bytes[k];}
  assert.deepEqual(await worlds[i].readAt(target.offset+written,n),bytes,'GPL complete root');at+=n;written+=n;}
 assert.equal(written,target.size+16);}
await reconstructGpl(1);if(!activate)await reconstructGpl(2);
for(const[tag,key]of [['VHCL','UNIT:'+hero],['ORDR','ORDR:'+hero],['CONT','CONT:'+hero]]){const a=await root(worlds[0],tag),b=await root(worlds[1],tag);
 assert.equal(b.version,a.version);assert.equal(b.count,a.count+1);assert.equal(b.size,a.size+expected.get(key).length+(tag==='CONT'?8:0));
 if(!activate){const c=await root(worlds[2],tag);assert.deepEqual({...c,offset:0,end:0},{...a,offset:0,end:0});}}
async function registrations(w){const c=await root(w,'ORLS');assert.equal(c.version,1);assert.equal(c.size,(c.count+1)*4);assert.ok(c.size<4096);
 const b=Buffer.from(await w.readAt(c.offset+16,c.size)),words=Array.from({length:c.count+1},(_,i)=>b.readUInt32LE(i*4));assert.equal(words.shift(),0x5244524f);return words;}
const baseOrders=await registrations(worlds[0]);assert.deepEqual(await registrations(worlds[1]),baseOrders.concat(hero));if(!activate)assert.deepEqual(await registrations(worlds[2]),baseOrders);
assert.equal(m.frames.length,2);for(const row of m.frames)assert.equal(row.bytes,1440015);
assert.equal(m.deadlineSeconds,activate?45:35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.finishedAtMs-m.startedAtMs<(activate?47000:37000)&&m.resourceSamples.length);for(const s of m.resourceSamples)assert.ok(s.rssBytes<=m.rssCeilingBytes);
const sourceSha256={};for(const n of ['scripts/inspect-native-halo-homeward-import.mjs','scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs',
 'scripts/lib/connected-residency.mjs','scripts/check-native-world-persistence.mjs','web/world/checkpoint.mjs','web/world/arrival.mjs','web/world/entity-home-ownership.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeHaloHomewardImportQualified:true,scope:activate?
 'Actual accepted west crossing imported with exact populated commands and reciprocal memberships at the held home boundary; activation and subsequent gameplay require independent qualification.':
 'Accepted original west crossing imported with exact Move/Path/Queue banks and reciprocal guild membership into the actual selected dormant home. Private clone cleaned before a tick; activation and joint publication remain unqualified.',
 manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,records:standalone,actualNativeUnitId:hero,actualAgentId:agent,
 sourceClock:3750,destinationClock:84550,standaloneRecordComparisons:4,savedRecordComparisons:4,unrelatedRecordComparisons,cleanupRecordComparisons,
 completeScriptRootsQualified:true,otherWorldRootsAndRngExact:true,wholeWorlds:m.worlds,homeReload:reload,reciprocalGuildMembershipQualified:true,
 freedCommandReservations:activate?0:18,originalCleanupQualified:!activate,journalUnchanged:true,sourceRetired:true,ownerPublished:false,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),maximumReadBytes:4096,
 nativeActivationQualified:false,homewardGameplayResumed:false,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHaloHomewardImportQualified:true,hero,agent,standaloneRecords:4,unrelatedRecordComparisons,cleanupRecordComparisons}));
