#!/usr/bin/env node
// Publish an actual original held save only in a copied stopped journal.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir,mkdtemp,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD,HERO_ROUTE_IDENTITY} from '../web/world/hero-route-store.mjs';
import {publishHeldHeroOwnerCheckpoint} from '../web/world/hero-owner-checkpoint-publication.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';
import {selectedHeroRuntimeBinding,selectedHeroHaloBinding} from '../web/world/hero-runtime-binding.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';

const [archiveName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/hero-progressed-owner-restore-\d{3}-preparation\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
const descriptor=async filename=>{const {bytes,sha256}=await hashNativeFile(filename);return {filename:resolve(filename),bytes,sha256};};
const bound=async row=>assert.deepEqual(await descriptor(row.filename),row);
const archive=await json(archiveName);assert.equal(archive.nativeRemoteOwnerRestoreQualified,true);
await bound(archive.trial);await bound(archive.inspection);
const m=await json(archive.trial.filename),proof=await json(archive.inspection.filename);
assert.equal(proof.manifest.sha256,archive.trial.sha256);
assert.equal(m.nativeRemoteOwnerRestoreQualified,true);assert.equal(m.nativeSessionTerminal,true);
assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.throws(()=>process.kill(m.nativePid,0),e=>e.code==='ESRCH');
await bound(m.preparation);await bound(m.savedCheckpoint);
const old=await json(m.preparation.filename);await bound(old.sourceHead);
const source=await stoppedFileSource(m.savedCheckpoint.filename);assert.equal(await checkpointSavedClock(source),m.savedClock);
const originalHeroOrderEntries=[];
for await(const row of checkpointActorOrderEntries(source,568))if(row.type==='entry'){
  assert.ok(originalHeroOrderEntries.length<64);originalHeroOrderEntries.push({bank:row.bank,index:row.index,kind:row.kind});
}
const journal=await mkdtemp(resolve('upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-progressed-'));
const originals=[];let total=0;
for(const name of (await readdir(m.journal)).sort()){
  const file=join(m.journal,name),st=await lstat(file);assert.ok(st.isFile()&&!st.isSymbolicLink());
  assert.ok(originals.length<128&&st.size<=1024*1024&&(total+=st.size)<=32*1024*1024);
  const row=await descriptor(file);assert.equal(row.sha256,m.sourceJournalBefore[name]);
  originals.push(row);await copyFile(file,join(journal,name));
}
const identityFile=join(journal,HERO_ROUTE_IDENTITY),identity=await json(identityFile),stats={};
const store=new HeroRouteStore(await stoppedHeroRouteStorage(journal,stats),identity,identity.contentDigest);
const initial=await store.withOwner(async selected=>({record:selected.record,entry:selected.entry}));
assert.equal(initial.record.revision,16);assert.equal(initial.entry.region,'-5_-1');
assert.deepEqual(initial.entry.alias,{unitId:568,agentId:62});
const dormantRegions=['0_0','1_0','1_-1','0_-1','-1_-1','-2_-1','-3_-1','-4_-1'];
const dormant=async()=>{
  const entries=[];for(const key of dormantRegions)entries.push(await store.withDestination(key,null,async selected=>selected.entries[1]));
  return entries;
};
const beforeDormant=await dormant(),operationId=createHash('sha256').update(JSON.stringify([
  'original-remote-owner-progressed-save-v1',initial.record.manifest,m.savedCheckpoint.sha256,m.savedClock])).digest('hex');
const request={operationId,expectedManifest:initial.record.manifest,region:initial.entry.region,
  alias:initial.entry.alias,homeAlias:initial.entry.homeAlias,clock:m.savedClock,sha256:m.savedCheckpoint.sha256,source};
const publication=await publishHeldHeroOwnerCheckpoint(store,request);assert.equal(publication.ownerRevision,17);
const writes=stats.writes,retry=await publishHeldHeroOwnerCheckpoint(store,request);
assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
assert.deepEqual(await dormant(),beforeDormant);
const selected=await store.withOwner(async selected=>{
  assert.equal(selected.record.revision,17);assert.equal(selected.entry.world.sha256,m.savedCheckpoint.sha256);
  const clock=await checkpointSavedClock(selected.source);assert.equal(clock,m.savedClock);
  const layout=await requireCheckpointHaloLayout(selected.source,'-5_-1','halo-v1'),runtimeBinding=selectedHeroRuntimeBinding(identity,selected.entry,clock);
  return {entry:selected.entry,clock,runtimeBinding,haloBinding:selectedHeroHaloBinding(runtimeBinding,layout),ownerManifest:selected.record.manifest};
});
const sourceCheckpoint=await descriptor(join(journal,`Frontier_Hero_Route_-5_-1_${selected.entry.slot}.GMP`));
assert.equal(sourceCheckpoint.sha256,m.savedCheckpoint.sha256);
for(const row of originals)await bound(row);await bound(old.sourceHead);await bound(m.savedCheckpoint);
const report={version:1,originalRemoteOwnerRestorePrepared:true,progressedHeldOwnerPublished:true,
  archive:await descriptor(archiveName),producer:archive.trial,inspection:archive.inspection,
  sourceCheckpoint,sourceJournal:journal,sourceHead:await descriptor(join(journal,HERO_ROUTE_HEAD)),identity:await descriptor(identityFile),
  sourceOwnerRevision:17,region:'-5_-1',...selected,settingsProfile:m.profile,originalHeroOrderEntries,
  originalJournalInputs:originals,originalSourceHead:old.sourceHead,publication,idempotentRetryVerified:true,
  dormantEntriesPreserved:beforeDormant,privateJournalWrites:writes,sourceWrites:0,originalInputsUnchanged:true,
  sourceJournalUnchangedAfterPreparation:true,adapterStats:stats,
  preparationScript:await descriptor('scripts/prepare-native-hero-progressed-owner-restore.mjs'),
  browserUsed:false,nativeProcessesStarted:0,nativeRemoteOwnerRestored:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({progressedHeldOwnerPublished:true,clock:report.clock,revision:17,dormantRegions:8,originalWrites:0}));
