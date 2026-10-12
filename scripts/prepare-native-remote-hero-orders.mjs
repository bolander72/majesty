#!/usr/bin/env node
// Prepare the actual moved hero's deferred Queue for another remote hop/home.
// No destination actor, region or ownership transaction is activated here.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyRegisteredHeroSnapshot,registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {checkpointHeroOrderArrivalPlan} from '../web/world/hero-order-arrival.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const[reportArg]=process.argv.slice(2);assert.equal(process.argv.length,3);const report=resolve(reportArg);
await assert.rejects(stat(report),e=>e.code==='ENOENT');
const archiveName=join(workspace,'output/native-regional-reload-generation-218/manifest.json'),archive=await json(archiveName);
assert.equal(archive.artifactPreserved,true);assert.equal(archive.originalMovedHeroFreshReloadQualified,true);
async function historical(n,h){const row=archive.evidence.find(r=>r.original===n);assert.ok(row,'Missing preserved execution input');
  if(h)assert.equal(row.sha256,h);assert.equal(await hash(n),row.sha256);assert.equal(await hash(row.preserved),row.sha256);return row.sha256;}
const reloadName=join(workspace,'output/native-regional-hero-027-fresh-reload-observed.json');await historical(reloadName);
const reload=await json(reloadName);assert.equal(reload.originalMovedHeroFreshReloadQualified,true);
await historical(reload.manifest,reload.manifestSha256);const m=await json(reload.manifest);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
try{process.kill(m.nativePid,0);throw Error('Reload producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);await historical(m.log,m.logSha256);
assert.equal(Object.keys(m.compiledSourceSha256).length,53);
for(const[n,h]of Object.entries(m.compiledSourceSha256)){const row=archive.sources.find(r=>r.original===join(workspace,n));assert.ok(row);assert.equal(row.sha256,h);assert.equal(await hash(row.preserved),h);}
await historical(m.reloadProof,m.reloadProofSha256);const savedProof=await json(m.reloadProof),saved=savedProof.savedMovedHero;
assert.equal(savedProof.originalMovedHeroWholeWorldSaveQualified,true);assert.equal(saved.filename,m.source);
await historical(saved.filename,saved.sha256);const source=await stoppedFileSource(saved.filename),sourceClockMs=await checkpointSavedClock(source);
assert.equal(sourceClockMs,saved.clockMs);await historical(m.preparation,m.preparationSha256);const p=await json(m.preparation);
await historical(p.capsulePreparation,p.capsulePreparationSha256);const capsule=await json(p.capsulePreparation),identity=capsule.identity;
const registered=registeredHeroHome(identity).record,home=registered.home;
assert.equal(registered.guildEntityId,savedProof.ordinaryEffects.registeredHomeRequest.guildEntityId);
const sourceHome={kind:'proxy',unitId:0,agentId:saved.homeAgentId};
await verifyRegisteredHeroSnapshot(identity,{unitId:saved.heroId,agentId:saved.agentId},sourceHome,source,true,savedProof.region);
assert.equal(await hash(p.destination.filename),p.destination.sha256);assert.equal(await hash(p.originalSource.file),p.originalSource.sha256);
const clocks={remote:await checkpointSavedClock(await stoppedFileSource(p.destination.filename)),
  home:await checkpointSavedClock(await stoppedFileSource(p.originalSource.file))};
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-remote-hero-orders-')),plans={};
for(const kind of ['remote','home']){
  const destination=kind==='home'?{kind:'native',unitId:home.unitId,agentId:home.agentId}:sourceHome;
  const plan=await checkpointHeroOrderArrivalPlan(source,saved.heroId,{sourceClockMs,destinationClockMs:clocks[kind]},
    {source:sourceHome,destination,registeredNativeHomeUnitId:home.unitId,guildEntityId:registered.guildEntityId,homeRegion:home.region},()=>{throw Error('Unbound actual native target');});
  assert.deepEqual(plan.banks.map(b=>b.count),[0,1,0]);assert.equal(plan.entries.length,1);assert.equal(plan.entries[0].kind,7);assert.equal(plan.waypointCount,1);
  assert.equal(plan.nativeActivationQualified,false);assert.equal(plan.deferredNativeHomeReferences.length,kind==='remote'?1:0);
  const range=plan.attachment.primary,bytes=Buffer.from(await source.readAt(range.offset+16,range.size)),before=Buffer.from(bytes),allowed=new Set();
  assert.equal(bytes.length,152);
  for(const edit of plan.patches){const at=edit.offset-range.offset-16;assert.ok(at>=0&&at+4<=bytes.length);assert.equal(bytes.readUInt32LE(at),edit.before);
    bytes.writeUInt32LE(edit.after,at);for(let i=0;i<4;++i)allowed.add(at+i);}
  for(let i=0;i<bytes.length;++i)if(!allowed.has(i))assert.equal(bytes[i],before[i]);
  // The actual Queue's dispatch time and guild callback are independently
  // known serialized offsets. Its consumed waypoint remains source data.
  assert.equal(before.readUInt32LE(44),8750);assert.equal(bytes.readUInt32LE(44),clocks[kind]-(sourceClockMs-8750));
  assert.equal(bytes.readUInt32LE(60),home.unitId);assert.equal(bytes.readUInt32LE(64),0x1003);
  const filename=join(directory,`${kind}_Queue.bin`);await writeFile(filename,bytes,{flag:'wx'});
  plans[kind]={destinationClockMs:clocks[kind],records:{filename,bytes:bytes.length,sha256:await hash(filename)},
    pendingGuildUnitId:home.unitId,patches:plan.patches,deferredNativeHomeReferences:plan.deferredNativeHomeReferences,
    waypointCount:plan.waypointCount,allocationRequestBytes:plan.allocationRequestBytes,nativeActivationQualified:false};
}
assert.equal(await hash(saved.filename),saved.sha256);assert.equal(await hash(p.destination.filename),p.destination.sha256);assert.equal(await hash(p.originalSource.file),p.originalSource.sha256);
const modules=['scripts/prepare-native-remote-hero-orders.mjs','web/world/arrival.mjs','web/world/hero-order-arrival.mjs'];
const result={version:1,actualRemoteHeroOrderPreparationQualified:true,archive:archiveName,archiveSha256:await hash(archiveName),
  reloadProof:reloadName,reloadProofSha256:await hash(reloadName),source:saved.filename,sourceSha256:saved.sha256,heroId:saved.heroId,
  registeredGuildEntityId:registered.guildEntityId,sourceClockMs,plans,
  sourceSha256ByModule:Object.fromEntries(await Promise.all(modules.map(async n=>[n,await hash(join(workspace,n))]))),
  originalWorldsUnchanged:true,coordinateReconciliationQualified:false,nativeProcessesStarted:0,browserUsed:false,ownerPublished:false,goalComplete:false,
  scope:'Actual saved Queue prepared for a remote hop and actual registered home. No destination region is selected or actor imported; source waypoint geometry remains held.'};
await writeFile(report,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({actualRemoteHeroOrderPreparationQualified:true,heroId:saved.heroId,records:2,ownerPublished:false}));
