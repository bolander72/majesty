#!/usr/bin/env node
// Prepare a bounded original outdoor hero and attached effects for the actual
// generated checkpoint with a restored pure home. No actor/owner activation.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,stat} from 'node:fs/promises';
import {join,resolve,dirname,relative} from 'node:path';
import {inspectNativeRegionalHome} from './inspect-native-regional-home.mjs';
import {stoppedFileSource,workspace,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {prepareRouteRegisteredHeroArrival} from '../web/world/registered-hero-arrival.mjs';
import {checkpointUnitAgentLinks,checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {MAX_ARRIVAL_ATTACHED_UNITS,MAX_ARRIVAL_RECORD_BYTES,MAX_ARRIVAL_TOTAL_RECORD_BYTES} from '../web/world/arrival.mjs';
import {Sha256} from '../web/world/sha256.mjs';
const hash=async p=>(await hashNativeFile(p)).sha256;
async function sourceClosure(){
  const pending=[resolve('scripts/prepare-native-regional-hero.mjs')],result={};
  while(pending.length){
    const file=pending.pop(),name=relative(workspace,file);if(result[name])continue;
    assert.ok(!name.startsWith('..')&&Object.keys(result).length<128);
    assert.ok((await stat(file)).size<=256*1024);
    const bytes=await readFile(file);result[name]=new Sha256().update(bytes).hex();
    for(const match of bytes.toString('utf8').matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))
      if(match[1].startsWith('.'))pending.push(resolve(dirname(file),match[1]));
  }
  return result;
}
async function json(p){assert.ok((await stat(p)).size<=256*1024);return JSON.parse(await readFile(p,'utf8'));}
const [outdoorProof,regionalProof,producerArchive,reportName]=process.argv.slice(2);assert.equal(process.argv.length,6);
const outdoor=await json(outdoorProof);assert.equal(outdoor.qualified,true);assert.equal(outdoor.originalHeroOutdoorDepartureStateQualified,true);
assert.equal(await hash(outdoor.manifest),outdoor.manifestSha256);
const archive=await json(producerArchive);assert.equal(archive.artifactPreserved,true);
const archiveRoot=await ownedDirectory(archive.directory,'actor-arrival-fixture-outdoor-hero-generation-');
const observer=archive.evidence['scripts/inspect-native-region-session.mjs'];
assert.ok(resolve(observer.filename).startsWith(archiveRoot+'/'));
assert.equal(await hash(observer.filename),outdoor.sourceSha256['scripts/inspect-native-region-session.mjs']);
assert.equal(await hash(archive.nativeExecutable.filename),outdoor.nativeExecutableSha256);
for(const [name,h]of Object.entries(outdoor.nativeSourceSha256)){
  assert.ok(resolve(archive.sources[name].filename).startsWith(archiveRoot+'/'));
  assert.equal(await hash(archive.sources[name].filename),h);
}
const m=await json(outdoor.manifest);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Outdoor producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(m.log),m.logSha256);assert.equal(await hash(m.receipt),m.receiptSha256);
const receipt=await json(m.receipt),capture=m.snapshotCaptures[0];assert.equal(capture.region,'0_0');assert.equal(await hash(capture.file),capture.sha256);
const frozen=Object.values(archive.checkpoints).find(r=>r.sha256===capture.sha256);assert.ok(frozen);
assert.equal(await hash(frozen.filename),capture.sha256);
const stored=await json(regionalProof),regional=await inspectNativeRegionalHome(stored.sourceManifest);
assert.equal(stored.sourceManifestSha256,regional.sourceManifestSha256);assert.deepEqual(stored.savedWorld,regional.savedWorld);
assert.equal(regional.regionalHomeOriginalReloadQualified,true);assert.equal(regional.registeredGuildEntityId,receipt.identity.registeredHome.guildEntityId);
const source=await stoppedFileSource(capture.file),actor=await checkpointActorRecords(source,receipt.owner.unitId);
assert.equal(actor.unit.parentUnitId,0);assert.equal(actor.agent.agentId,receipt.owner.agentId);
const attachedUnitBindings=[];
for await(const u of checkpointUnitAgentLinks(source))if(u.parentUnitId===receipt.owner.unitId){
  assert.ok(attachedUnitBindings.length<MAX_ARRIVAL_ATTACHED_UNITS);
  attachedUnitBindings.push({from:u.unitId,to:100001+attachedUnitBindings.length});
}
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
const stats={},io=await stoppedHeroRouteStorage(directory,stats),store=new HeroRouteStore(io,receipt.identity,receipt.identity.contentDigest);
// A separate stopped-world branch starts at the proven outdoor checkpoint.
// It never replaces the newer resident-hero branch or mutates either save.
const selected=await store.commit({kind:'seed',operationId:'3'.repeat(64),expectedManifest:null,regions:['0_0'],
  aliases:[receipt.state.aliases[0]],homeAliases:[receipt.state.homeAliases[0]],
  worlds:[{source,sha256:capture.sha256}]});
const candidate={source:await stoppedFileSource(regional.savedWorld.filename),sha256:regional.savedWorld.sha256,
  alias:{unitId:100000,agentId:1000},homeAlias:{kind:'proxy',unitId:0,agentId:regional.agentId}};
let prepared;
try{
  prepared=await prepareRouteRegisteredHeroArrival(store,regional.region,candidate,
    {expectedManifest:selected.manifest,freshUnitId:100000,freshAgentId:1000,attachedUnitBindings});
}catch(error){
  await writeFile(reportName,JSON.stringify({version:1,originalOutdoorHeroGeneratedRegionCapsulePrepared:false,
    refusal:error.message,directory,source:capture,destination:regional.savedWorld,attachedUnitBindings,
    producerArchive:resolve(producerArchive),producerArchiveSha256:await hash(producerArchive),
    sourceProof:resolve(outdoorProof),regionalProof:resolve(regionalProof),
    originalSourceUnchanged:await hash(capture.file)===capture.sha256,
    originalDestinationUnchanged:await hash(regional.savedWorld.filename)===regional.savedWorld.sha256,
    heroImported:false,ownerPublished:false,browserUsed:false,nativeProcessesStarted:0,goalComplete:false},null,2)+'\n',{flag:'wx'});
  throw error;
}
const records={};let total=0;
for(const [name,bytes]of Object.entries(prepared.records)){
  assert.match(name,/^[a-zA-Z0-9_]+$/);assert.ok(bytes.length<=MAX_ARRIVAL_RECORD_BYTES);total+=bytes.length;
  const filename=join(directory,name+'.bin');await writeFile(filename,bytes,{flag:'wx'});
  records[name]={filename,bytes:bytes.length,sha256:new Sha256().update(bytes).hex()};
}
assert.ok(total<=MAX_ARRIVAL_TOTAL_RECORD_BYTES);assert.equal(prepared.plan.registeredHome.homeRegion,'0_0');
assert.equal(prepared.plan.registeredHome.destinationRegion,regional.region);
assert.equal(prepared.plan.registeredHome.destination.agentId,regional.agentId);
assert.equal(prepared.plan.registeredHome.destinationNativeMembershipRequired,false);
assert.equal(await hash(capture.file),capture.sha256);assert.equal(await hash(regional.savedWorld.filename),regional.savedWorld.sha256);
assert.equal((await store.read()).owner.region,'0_0');
const report={version:1,originalOutdoorHeroGeneratedRegionCapsulePrepared:true,directory,records,totalRecordBytes:total,
  source:capture,destination:regional.savedWorld,sourceProof:resolve(outdoorProof),sourceProofSha256:await hash(outdoorProof),
  regionalProof:resolve(regionalProof),regionalProofSha256:await hash(regionalProof),identity:receipt.identity,
  selectedOwner:prepared.selectedOwner,selectedManifest:selected.manifest,registeredHomeAgentId:regional.agentId,
  producerArchive:resolve(producerArchive),producerArchiveSha256:await hash(producerArchive),sourceSha256:await sourceClosure(),
  attachedUnitBindings,plan:prepared.plan,stats,originalSourceUnchanged:true,originalDestinationUnchanged:true,
  heroImported:false,ownerPublished:false,continuousPositionQualified:false,browserUsed:false,nativeProcessesStarted:0,goalComplete:false,
  scope:'Actual outdoor Warrior504/GPL28 and three original physical effects prepared for the generated west region with native-restored pure home23. Records are inert; spatial seam placement, original factory import, child lifetime and atomic source removal remain required.'};
await writeFile(reportName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalOutdoorHeroGeneratedRegionCapsulePrepared:true,records:Object.keys(records).length,totalRecordBytes:total,
  attachedUnits:attachedUnitBindings.length,registeredHomeAgentId:regional.agentId,heroImported:false}));
