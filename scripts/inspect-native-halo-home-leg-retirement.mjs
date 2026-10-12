#!/usr/bin/env node
// Qualify original removal of the running hero at its accepted west crossing.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {checkpointChunks,checkpointUnits,checkpointAgents,checkpointAttachments,
 checkpointContainerEntries,checkpointAbsentAgentReferences} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
const [crossingName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-home-leg-retirement-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const crossing=await json(crossingName);assert.equal(crossing.nativeSelectedHaloHomeLegQualified,true);
assert.equal(crossing.originalHomewardMovementQualified,true);assert.equal(crossing.endClock,3750);
assert.equal(await hash(crossing.manifest),crossing.manifestSha256);
const m=await json(crossing.manifest),p=await json(m.preparation);
assert.equal(m.retirementRequested,true);assert.equal(m.sourceRetirementTrialCompleted,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
try{process.kill(m.nativePid,0);throw Error('Retirement producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
for(const[n,h]of Object.entries({...crossing.sourceSha256,...m.compiledSourceSha256}))assert.equal(await hash(n),h);
assert.equal(await hash(m.preparation),m.preparationSha256);assert.equal(await hash(m.log),m.logSha256);
assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.ownerManifest);
assert.equal(p.selectedHaloHomeLegRetirementPrepared,true);assert.equal(await hash(p.homeLegArchive.filename),p.homeLegArchive.sha256);
const prior=await json(p.homeLegArchive.filename);assert.equal(prior.generation,276);assert.equal(prior.originalHomewardMovementQualified,true);
for(const r of prior.sources.concat(prior.evidence))assert.equal(await hash(r.preserved),r.sha256);
const beforeRow=m.worlds[2],afterRow=m.retiredWorld;assert.ok(afterRow);assert.equal(await hash(afterRow.filename),afterRow.sha256);
assert.deepEqual(beforeRow,crossing.wholeWorlds.at(-1));assert.equal(await hash(beforeRow.filename),beforeRow.sha256);
const before=await stoppedFileSource(beforeRow.filename),after=await stoppedFileSource(afterRow.filename);
const bs=await connectedWorldState(beforeRow.filename,{unscheduledAgents:[34]}),as=await connectedWorldState(afterRow.filename,{unscheduledAgents:[34]});
assert.equal(bs.clock,3750);assert.equal(as.clock,3750);assert.equal(bs.rng,as.rng);assert.equal(bs.gameplayRng,as.gameplayRng);
assert.equal(bs.rawTerrainSha256,as.rawTerrainSha256);assert.equal(bs.activeQueue,as.activeQueue);
async function records(w){const map=new Map(),add=(k,r)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,r);};
 for await(const r of checkpointUnits(w))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(w))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(w))add(r.kind+':'+r.unitId,r);return map;}
const bm=await records(before),am=await records(after),removed=['UNIT:532','GPL:35','ORDR:532','CONT:532'];
assert.equal(bm.size,483);assert.equal(am.size,479);
for(const k of removed)assert.ok(bm.has(k)&&!am.has(k));
assert.deepEqual([...am.keys()],[...bm.keys()].filter(k=>!removed.includes(k)));
let exactRemainingRecords=0;
for(const[k,r]of am){const old=bm.get(k);assert.equal(r.size,old.size,k);
 for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await before.readAt(old.offset+at,n),await after.readAt(r.offset+at,n),k);}exactRemainingRecords++;}
await verifyRegisteredHeroSnapshot(p.identity,{unitId:532,agentId:35},{kind:'proxy',unitId:0,agentId:34},after,false,'1_0');
await verifyEntitySnapshot(p.identity,{unitId:532,agentId:35},after,false,{kind:'proxy',unitId:0,agentId:34});
assert.equal((await checkpointAbsentAgentReferences(after,35)).sites.length,0);
for await(const r of checkpointUnits(after))assert.notEqual(r.primary.words[6],532);
for await(const c of checkpointContainerEntries(after))for(const v of [c.unitId,c.groupOwnerUnitId,c.targetUnitId])assert.notEqual(v,532);
for(const r of am.values())if(r.kind==='ORDR')for await(const ref of checkpointActorOrderUnitReferences(after,r.unitId))assert.notEqual(ref.targetUnitId,532);
assert.equal(bs.queues.flat().filter(id=>id===35).length,1);assert.ok(!as.queues.flat().includes(35));
for(let i=0;i<2;i++)assert.deepEqual(as.queues[i],bs.queues[i].filter(id=>id!==35));
async function root(w,tag){let found;for await(const c of checkpointChunks(w))if(c.tag===tag){assert.equal(found,undefined);found=c;}assert.ok(found);return found;}
assert.deepEqual(bs.roots.filter(r=>!['VHCL','GPL ','CONT','ORDR','ORLS'].includes(r.tag)),as.roots.filter(r=>!['VHCL','GPL ','CONT','ORDR','ORLS'].includes(r.tag)));
for(const[tag,key]of [['VHCL','UNIT:532'],['CONT','CONT:532'],['ORDR','ORDR:532']]){
 const a=await root(before,tag),b=await root(after,tag);assert.equal(a.version,b.version);assert.equal(b.count,a.count-1);assert.equal(b.size,a.size-bm.get(key).size);}
async function registrations(w){const c=await root(w,'ORLS');assert.equal(c.version,1);assert.ok(c.count<=4096);assert.equal(c.size,(c.count+1)*4);
 const words=[];for(let at=0;at<c.size;at+=4096){const b=Buffer.from(await w.readAt(c.offset+16+at,Math.min(4096,c.size-at)));for(let i=0;i<b.length;i+=4)words.push(b.readUInt32LE(i));}
 assert.equal(words.shift(),0x5244524f);assert.equal(new Set(words).size,words.length);return words;}
assert.deepEqual(await registrations(after),(await registrations(before)).filter(id=>id!==532));
// Reconstruct every byte of the GPL root, including opaque manager metadata:
// one ordered-map key/record deletion, one queue member deletion, three length
// reductions, one map count and one queue count. Alias/RNG/other bytes stay exact.
const bg=await root(before,'GPL '),ag=await root(after,'GPL '),agents=[];for await(const a of checkpointAgents(before))agents.push(a);
assert.equal(ag.version,bg.version);assert.equal(ag.count,bg.count);
const hero=bm.get('GPL:35'),tail=agents.at(-1).offset+agents.at(-1).size;
const ownQueue=bs.queues.findIndex(q=>q.includes(35));assert.ok(ownQueue>=0);
const countOffset=tail+(ownQueue?4+bs.queues[0].length*4:0),queueOffset=countOffset+4+bs.queues[ownQueue].indexOf(35)*4;
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
const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024&&!/abort from|result=fail/.test(log));
const matches=[...log.matchAll(/Halo home leg retired hero=532 agent=35 proxy=34 clock=3750 original-removal=1 aliases-absent=1 other-registry-preserved=1 other-queues-preserved=1 other-drawing-preserved=1 grid-absent=1 proxy-preserved=1 counters-preserved=1 released-bytes=(\d+) released-blocks=(\d+) released-crt=(\d+) original-writer=1 owner-published=0 result=pass/g)];
assert.equal(matches.length,1);const releasedBytes=Number(matches[0][1]),releasedBlocks=Number(matches[0][2]),releasedCrtAllocations=Number(matches[0][3]);assert.ok(releasedBytes>=0&&releasedBlocks>=0&&releasedCrtAllocations>0);
const resources=[...log.matchAll(/Halo home retirement resources heap-bytes=(\d+),(\d+) heap-blocks=(\d+),(\d+) crt-live=(\d+),(\d+) crt-valid=1 grid-matches=0/g)];assert.equal(resources.length,1);
const [heapBefore,heapAfter,blocksBefore,blocksAfter,crtBefore,crtAfter]=resources[0].slice(1).map(Number);
assert.equal(heapBefore-heapAfter,releasedBytes);assert.equal(blocksBefore-blocksAfter,releasedBlocks);
assert.equal(crtBefore-crtAfter,releasedCrtAllocations);
const sourceSha256={...crossing.sourceSha256};for(const n of ['scripts/inspect-native-halo-home-leg-retirement.mjs','web/world/order-unit-bindings.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeHomewardSourceRetirementQualified:true,crossingProof:{filename:resolve(crossingName),sha256:await hash(crossingName)},
 manifest:crossing.manifest,manifestSha256:crossing.manifestSha256,sourceSha256,beforeWorld:beforeRow,retiredWorld:afterRow,
 removedRecords:removed,exactRemainingRecords,completeScriptRootQualified:true,otherWorldRootsAndRngExact:true,
 remainingQueuesExact:true,proxyPreserved:true,noIncomingTypedReferences:true,sourceClock:3750,releasedBytes,releasedBlocks,releasedCrtAllocations,
 actualJournalUnchanged:true,sourceRetired:true,homeRegionRestored:false,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHomewardSourceRetirementQualified:true,removedRecords:removed.length,exactRemainingRecords,releasedBytes,releasedBlocks,releasedCrtAllocations}));
