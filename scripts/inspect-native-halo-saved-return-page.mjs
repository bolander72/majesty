#!/usr/bin/env node
// Independently qualify retirement, complete unload and the held home reload.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {equalWorlds} from './inspect-native-halo-session-actor.mjs';
import {checkpointChunks,checkpointUnits,checkpointAgents,checkpointAttachments,checkpointContainerEntries,checkpointAbsentAgentReferences} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
const [activationName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-saved-return-page-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const activation=await json(activationName);assert.equal(activation.nativeSavedNeighborHomeLegQualified,true);assert.equal(activation.crossingClock,4050);
assert.equal(await hash(activation.manifest),activation.manifestSha256);const m=await json(activation.manifest),p=await json(m.preparation);
assert.equal(m.savedActorReturnPageRequested,true);assert.equal(m.haloSavedActorReturnPageTrialCompleted,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
try{process.kill(m.nativePid,0);throw Error('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const[n,h]of Object.entries({...activation.sourceSha256,...m.compiledSourceSha256}))assert.equal(await hash(n),h);
const request=m.savedActorReturnPageRequest;
for(const row of [request.preparation,request.crossed,request.homeWorld,request.packet,m.savedReturnGate])assert.equal(await hash(row.filename),row.sha256);
assert.equal(await hash('scripts/prepare-native-halo-saved-return-page.mjs'),request.helperSha256);
const prep=await json(request.preparation.filename);assert.equal(prep.nativeSavedActorReturnPagePrepared,true);
for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash(prep.producer.filename),prep.producer.sha256);const producer=await json(prep.producer.filename);
assert.equal(producer.nativeSessionTerminal,false);assert.equal(producer.nativePid,m.nativePid);assert.deepEqual(producer.compiledSourceSha256,m.compiledSourceSha256);
assert.deepEqual(prep.alias,{unitId:537,agentId:37});assert.deepEqual(prep.alias,activation.destinationAliases);
const gate=await json(m.savedReturnGate.filename);assert.equal(gate.generation,291);assert.equal(gate.nativeSavedNeighborHomeLegQualified,true);
for(const r of gate.sources.concat(gate.evidence))assert.equal(await hash(r.preserved),r.sha256);
assert.equal(await readFile(request.packet.filename,'utf8'),`halo-session-saved-return-page-v1\n1\n1_0\n0_0\n4050\n103500\n${request.crossed.sha256}\n`);
function file(region,name){const filename=join(m.root,'frontier_'+region,'Documents/My Games/MajestyHD/SaveGame',name),rows=m.files.filter(r=>r.filename===filename);assert.equal(rows.length,1);return rows[0];}
const beforeRow=activation.worlds.at(-1),afterRow=file('1_0','Halo_Session_Saved_Return_Retired_1.GMP');
for(const key of ['filename','sha256','bytes'])assert.equal(beforeRow[key],request.crossed[key]);
for(const r of [beforeRow,afterRow])assert.equal(await hash(r.filename),r.sha256);
const before=await stoppedFileSource(beforeRow.filename),after=await stoppedFileSource(afterRow.filename);
const bs=await connectedWorldState(beforeRow.filename,{unscheduledAgents:[34]}),as=await connectedWorldState(afterRow.filename,{unscheduledAgents:[34]});
assert.equal(bs.clock,4050);assert.equal(as.clock,4050);assert.equal(bs.rng,as.rng);assert.equal(bs.gameplayRng,as.gameplayRng);
assert.equal(bs.rawTerrainSha256,as.rawTerrainSha256);assert.equal(bs.activeQueue,as.activeQueue);
async function records(w){const map=new Map(),add=(k,r)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,r);};
 for await(const r of checkpointUnits(w))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(w))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(w))add(r.kind+':'+r.unitId,r);return map;}
const bm=await records(before),am=await records(after),removed=['UNIT:537','GPL:37','ORDR:537','CONT:537'];
assert.equal(bm.size,483);assert.equal(am.size,479);
for(const k of removed)assert.ok(bm.has(k)&&!am.has(k));
assert.deepEqual([...am.keys()],[...bm.keys()].filter(k=>!removed.includes(k)));
let exactRemainingRecords=0;
for(const[k,r]of am){const old=bm.get(k);assert.equal(r.size,old.size,k);
 for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await before.readAt(old.offset+at,n),await after.readAt(r.offset+at,n),k);}exactRemainingRecords++;}
await verifyRegisteredHeroSnapshot(p.identity,{unitId:537,agentId:37},{kind:'proxy',unitId:0,agentId:34},after,false,'1_0');
await verifyEntitySnapshot(p.identity,{unitId:537,agentId:37},after,false,{kind:'proxy',unitId:0,agentId:34});
assert.equal((await checkpointAbsentAgentReferences(after,37)).sites.length,0);
for await(const r of checkpointUnits(after))assert.notEqual(r.primary.words[6],537);
for await(const c of checkpointContainerEntries(after))for(const v of [c.unitId,c.groupOwnerUnitId,c.targetUnitId])assert.notEqual(v,537);
for(const r of am.values())if(r.kind==='ORDR')for await(const ref of checkpointActorOrderUnitReferences(after,r.unitId))assert.notEqual(ref.targetUnitId,537);
assert.equal(bs.queues.flat().filter(id=>id===37).length,1);assert.ok(!as.queues.flat().includes(37));
for(let i=0;i<2;i++)assert.deepEqual(as.queues[i],bs.queues[i].filter(id=>id!==37));
async function root(w,tag){let found;for await(const c of checkpointChunks(w))if(c.tag===tag){assert.equal(found,undefined);found=c;}assert.ok(found);return found;}
assert.deepEqual(bs.roots.filter(r=>!['VHCL','GPL ','CONT','ORDR','ORLS'].includes(r.tag)),as.roots.filter(r=>!['VHCL','GPL ','CONT','ORDR','ORLS'].includes(r.tag)));
for(const[tag,key]of [['VHCL','UNIT:537'],['CONT','CONT:537'],['ORDR','ORDR:537']]){
 const a=await root(before,tag),b=await root(after,tag);assert.equal(a.version,b.version);assert.equal(b.count,a.count-1);assert.equal(b.size,a.size-bm.get(key).size);}
async function registrations(w){const c=await root(w,'ORLS');assert.equal(c.version,1);assert.ok(c.count<=4096);assert.equal(c.size,(c.count+1)*4);
 const words=[];for(let at=0;at<c.size;at+=4096){const b=Buffer.from(await w.readAt(c.offset+16+at,Math.min(4096,c.size-at)));for(let i=0;i<b.length;i+=4)words.push(b.readUInt32LE(i));}
 assert.equal(words.shift(),0x5244524f);assert.equal(new Set(words).size,words.length);return words;}
assert.deepEqual(await registrations(after),(await registrations(before)).filter(id=>id!==537));
// Reconstruct every byte of the GPL root, including opaque manager metadata:
// one ordered-map key/record deletion, one queue member deletion, three length
// reductions, one map count and one queue count. Alias/RNG/other bytes stay exact.
const bg=await root(before,'GPL '),ag=await root(after,'GPL '),agents=[];for await(const a of checkpointAgents(before))agents.push(a);
assert.equal(ag.version,bg.version);assert.equal(ag.count,bg.count);
const hero=bm.get('GPL:37'),tail=agents.at(-1).offset+agents.at(-1).size;
const ownQueue=bs.queues.findIndex(q=>q.includes(37));assert.ok(ownQueue>=0);
const countOffset=tail+(ownQueue?4+bs.queues[0].length*4:0),queueOffset=countOffset+4+bs.queues[ownQueue].indexOf(37)*4;
const deletions=[{at:hero.offset-4-bg.offset,size:hero.size+4},{at:queueOffset-bg.offset,size:4}].sort((a,b)=>a.at-b.at);
const delta=deletions.reduce((n,d)=>n+d.size,0);assert.equal(ag.size,bg.size-delta);
const patches=[];for(const[at,increment]of [[4,-delta],[16,-delta],[28,-delta],[agents[0].offset-8-bg.offset,-1],[countOffset-bg.offset,-1]]){
 const bytes=Buffer.from(await before.readAt(bg.offset+at,4));bytes.writeUInt32LE(bytes.readUInt32LE(0)+increment);patches.push({at,bytes});}
let written=0;
for(let at=0;at<bg.size+16;){const skip=deletions.find(d=>d.at===at);if(skip){at+=skip.size;continue;}
 const next=deletions.find(d=>d.at>at)?.at??bg.size+16,n=Math.min(4096,next-at,bg.size+16-at);
 assert.ok(n>0);const bytes=Uint8Array.from(await before.readAt(bg.offset+at,n));
 for(const p of patches)for(let i=0;i<4;i++){const offset=p.at+i-at;if(offset>=0&&offset<n)bytes[offset]=p.bytes[i];}
 assert.deepEqual(await after.readAt(ag.offset+written,n),bytes);at+=n;written+=n;}
assert.equal(written,ag.size+16);
const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024&&!/abort from|result=fail|refused boundary=/.test(log));
const matches=[...log.matchAll(/Halo saved return retired hero=537 agent=37 proxy=34 clock=4050 original-removal=1 aliases-absent=1 other-registry-preserved=1 other-queues-preserved=1 other-drawing-preserved=1 grid-absent=1 proxy-preserved=1 counters-preserved=1 released-bytes=(\d+) released-blocks=(\d+) released-crt=(\d+) owner-published=0 result=pass/g)];
assert.equal(matches.length,1);const [releasedBytes,releasedBlocks,releasedCrtAllocations]=matches[0].slice(1).map(Number);
assert.ok(releasedBytes>=0&&releasedBlocks>=0&&releasedCrtAllocations>0);
assert.ok(log.includes('Halo saved return page serial=2 source=1_0 target=0_0 source-clock=4050 home-clock=103500 original-quit=1 checkpoint-bound=1 owner-published=0 result=pass'));
const release=[...log.matchAll(/Session released serial=2 region=1_0 roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288 heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) clock=0/g)];
assert.equal(release.length,1);const [heapBefore,heapAfter,blocksBefore,blocksAfter]=release[0].slice(1).map(Number);
assert.ok(heapBefore>heapAfter&&blocksBefore>blocksAfter);
const observerRemoved=log.indexOf('Session release observer removed serial=2 hooks=3 retained-roots=0'),unloaded=log.indexOf('Session unloaded serial=2 source=1_0 target=0_0 world-null=1'),attached=log.indexOf('Session attached serial=2 region=0_0 mode=saved phase=1 pending=2'),held=log.indexOf('Halo saved return home held serial=2 key=0_0 clock=103500 phase=7 ordinary-ticks=0 source-retired=1 incoming-imported=0 owner-published=0 result=pass');
assert.ok(release[0].index<unloaded&&unloaded<observerRemoved&&observerRemoved<attached&&attached<held);
const loadedHome=file('0_0','Halo_Session_Reloaded_2.GMP'),heldHome=file('0_0','Halo_Session_Return_Home_Held_2.GMP');
for(const r of [loadedHome,heldHome])assert.equal(await hash(r.filename),r.sha256);
const homeReload=await equalWorlds(request.homeWorld,loadedHome),homeHold=await equalWorlds(loadedHome,heldHome);
for(const r of [loadedHome,heldHome]){
 const source=await stoppedFileSource(r.filename);assert.equal(await checkpointSavedClock(source),103500);
 await verifyEntitySnapshot(p.identity,{unitId:508,agentId:25},source,false,{kind:'native',unitId:469,agentId:7});
 await verifyRegisteredHeroSnapshot(p.identity,{unitId:508,agentId:25},{kind:'native',unitId:469,agentId:7},source,false,'0_0');
}
const lines=(await readFile(join(m.root,'frontier_1_0/Frontier_1_0.checkpoint'),'utf8')).split('\n');assert.equal(lines.length,6);assert.equal(lines[0],'checkpoint-v1');assert.ok(['0','1'].includes(lines[1]));
const selectedEast=file('1_0',`Frontier_1_0${lines[1]==='1'?'_Recovery':''}.GMP`);assert.equal(String(selectedEast.bytes),lines[2]);assert.equal(selectedEast.sha256,lines[3]);
const eastPublication=await equalWorlds(afterRow,selectedEast,{unscheduledAgents:[34]});
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.selectedManifest);
const sourceSha256={...activation.sourceSha256,...prep.sourceSha256,'scripts/inspect-native-halo-saved-return-page.mjs':await hash('scripts/inspect-native-halo-saved-return-page.mjs')};
const report={version:1,nativeSavedNeighborReturnRetirementQualified:true,nativeSavedNeighborHomeReloadQualified:true,
 activationProof:{filename:resolve(activationName),sha256:await hash(activationName)},manifest:activation.manifest,manifestSha256:activation.manifestSha256,
 sourceSha256,returnPagePreparation:request.preparation,alias:prep.alias,homeAlias:prep.homeAlias,
 beforeWorld:beforeRow,retiredWorld:afterRow,selectedEast,loadedHome,heldHome,selectedHome:request.homeWorld,
 removedRecords:removed,exactRemainingRecords,completeScriptRootQualified:true,remainingQueuesExact:true,proxyPreserved:true,noIncomingTypedReferences:true,
 eastPublication,homeReload,homeHold,exactReloadRecordComparisons:homeReload.records+homeHold.records+eastPublication.records,
 originalDisposals:2,freedRootsPerDisposal:8,returnRelease:{heapBefore,heapAfter,blocksBefore,blocksAfter},releasedBytes,releasedBlocks,releasedCrtAllocations,
 sourceClock:4050,destinationClock:103500,sourceRetired:true,sourceUnloaded:true,homeRegionRestored:true,homeSimulationHeld:true,incomingActorImported:false,
 actualJournalUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSavedNeighborReturnRetirementQualified:true,nativeSavedNeighborHomeReloadQualified:true,exactRemainingRecords,exactReloadRecordComparisons:report.exactReloadRecordComparisons}));
