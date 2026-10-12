// Select ordinary native evolution without changing the logical owner or home.
// This operates only on stopped, owned fixtures; no browser/OS locking claim.
import assert from 'node:assert/strict';
import {readFile,stat,readdir,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,ownedDirectory,stoppedFileSource} from './stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './stopped-revision-io.mjs';
import {hashNativeFile} from './native-generation.mjs';
import {connectedWorldState} from './connected-residency.mjs';
import {requireSessionTrace,requireOutdoorHeroCheckpoint} from '../inspect-native-region-session.mjs';
import {openEntityRevisionStore,encodeRevisionIdentity,encodeEntityRevision,
  REVISION_IDENTITY,REVISION_MANIFEST} from '../../web/world/entity-revisions.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';

export const outdoorHash=async name=>(await hashNativeFile(name)).sha256;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function json(name){assert((await stat(name)).size<=256*1024);return JSON.parse(await readFile(name,'utf8'));}
async function selectedStore(publication){
  await ownedDirectory(publication.fixture,'actor-arrival-fixture-entity-revision-');
  const io=await stoppedRevisionStorage(publication.fixture);
  io.atomicWrite=async()=>{throw Error('Preserve previous selected owner store');};
  const store=await openEntityRevisionStore(io,publication.identity.contentDigest);
  assert.deepEqual(store.identity,publication.identity);
  const selected=await store.read();
  assert.equal(selected.record.manifest,publication.selectedManifest);
  assert.deepEqual(selected.record.state,publication.selectedState);
  assert.deepEqual(selected.owner,publication.selectedOwner);
  assert.deepEqual(selected.record.worlds,publication.worlds);
  return {store,selected};
}

export async function prepareOutdoorOwnerSave(publicationName,sessionProofName){
  const publication=await json(publicationName),proof=await json(sessionProofName);
  assert.equal(publication.actualRegisteredHeroStoppedReturnPairPublished,true);
  assert.equal(proof.qualified,true);assert.equal(proof.originalHeroOutdoorDepartureStateQualified,true);
  assert.equal(proof.browserQualified,false);
  for(const [n,h]of Object.entries(proof.sourceSha256))assert.equal(await outdoorHash(join(workspace,n)),h);
  assert.equal(await outdoorHash(proof.manifest),proof.manifestSha256);
  const native=await json(proof.manifest);
  assert.deepEqual([native.nativeOnly,native.browserUsed,native.nativeSessionTerminal,native.nativeExitCode,native.stopReason],
    [true,false,true,0,null]);
  try{process.kill(native.nativePid,0);throw Error('Outdoor native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const fixture=await ownedDirectory(native.fixture,'actor-arrival-fixture-session-');
  assert.equal(native.publicationManifest,resolve(publicationName));
  assert.equal(await outdoorHash(publicationName),native.publicationManifestSha256);
  const build=await json(native.buildReport);assert.equal(await outdoorHash(native.buildReport),native.buildReportSha256);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
  assert.equal(build.nativeExecutableSha256,native.nativeExecutableSha256);
  assert.deepEqual(build.nativeSourceSha256,native.nativeSourceSha256);
  const archive=await json(native.nativeArtifactArchive);
  assert.equal(archive.artifactPreserved,true);
  assert.equal(archive.nativeExecutable.sha256,native.nativeExecutableSha256);
  await ownedDirectory(archive.directory,'actor-arrival-fixture-');
  assert.equal(await outdoorHash(archive.nativeExecutable.filename),native.nativeExecutableSha256);
  for(const [n,h]of Object.entries(native.nativeSourceSha256)){
    assert.equal(archive.sources[n].sha256,h);assert.equal(await outdoorHash(archive.sources[n].filename),h);
  }
  assert.equal(await outdoorHash(native.log),native.logSha256);assert((await stat(native.log)).size<=1024*1024);
  const trace=requireSessionTrace(native,await readFile(native.log,'utf8'));
  const {store,selected}=await selectedStore(publication);
  assert.equal(selected.record.revision,2);assert.equal(selected.record.state.ownerSide,0);
  assert.deepEqual(selected.record.state.aliases[0],{unitId:504,agentId:28});
  assert.equal(native.selectedRevisionExports.length,2);
  for(let i=0;i<2;i++){
    const r=native.selectedRevisionExports[i];
    assert.equal(r.manifest,selected.record.manifest);assert.deepEqual(r.owner,selected.owner);
    assert.deepEqual({size:r.bytes,sha256:r.sha256},selected.record.worlds[i]);
    assert.equal(await outdoorHash(r.filename),r.sha256);
  }
  const initial=await connectedWorldState(native.selectedRevisionExports[0].filename);
  const outdoor=await requireOutdoorHeroCheckpoint(native,trace,initial);
  assert.deepEqual(outdoor,proof.outdoorHero);
  const capture=native.snapshotCaptures[0];assert.equal(capture.file,join(fixture,'Session_Saved_1.GMP'));
  assert.equal(await outdoorHash(capture.file),capture.sha256);assert.equal(capture.clock,57650);
  const inputs=[{filename:capture.file,bytes:capture.size,sha256:capture.sha256},publication.inputs[1]],worlds=[];
  for(const r of inputs){const source=await stoppedFileSource(r.filename);
    assert.equal(source.size,r.bytes);assert.equal(await outdoorHash(r.filename),r.sha256);worlds.push({source,sha256:r.sha256});}
  assert.deepEqual({size:inputs[1].bytes,sha256:inputs[1].sha256},selected.record.worlds[1]);
  assert.equal(await checkpointSavedClock(worlds[1].source),24250);
  const priorFiles={};for(const n of await readdir(publication.fixture))priorFiles[n]=await outdoorHash(join(publication.fixture,n));
  assert.equal(Object.keys(priorFiles).length,8);
  const evidence={previousPublication:resolve(publicationName),previousPublicationSha256:await outdoorHash(publicationName),
    sessionProof:resolve(sessionProofName),sessionProofSha256:await outdoorHash(sessionProofName),
    sessionManifest:proof.manifest,sessionManifestSha256:proof.manifestSha256};
  const request={worlds,aliases:selected.record.state.aliases,homeAliases:selected.record.state.homeAliases,
    referenceBindings:selected.record.state.referenceBindings,ownerSide:0,visitedSides:selected.record.state.visitedSides,
    kind:'save',operationId:sha(JSON.stringify({evidence,worlds:inputs.map(r=>r.sha256)})+'\n'),expectedManifest:selected.record.manifest};
  return {publication,store,selected,priorFiles,inputs,request,evidence,outdoor,initialClockMs:initial.clock};
}

export async function freshOutdoorOwnerStore(p){
  const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-'));
  const stats={},io=await stoppedRevisionStorage(directory,stats);let writes=0;
  const write=io.atomicWrite.bind(io);io.atomicWrite=async(...args)=>{await write(...args);writes++;};
  // Copy one complete selection under its existing lease. The original pair,
  // unused slot and player settings remain untouched. Publish the marker last.
  await p.store.withSelected(async selected=>{
    assert.equal(selected.record.manifest,p.selected.record.manifest);const slot=selected.record.slot;
    await io.atomicWrite(REVISION_IDENTITY,sink=>sink.write(encodeRevisionIdentity(p.store.identity)));
    for(let side=0;side<2;side++)await io.atomicWrite(`Frontier_Revision_${side?'Destination':'Source'}_${slot}.GMP`,async sink=>{
      const source=selected.sources[side];for(let at=0;at<source.size;at+=4096)await sink.write(await source.readAt(at,Math.min(4096,source.size-at)));
    });
    await io.atomicWrite(`Frontier_Revision_State_${slot}.json`,sink=>sink.write(encodeEntityRevision(selected.record.state)));
    await io.atomicWrite(REVISION_MANIFEST,sink=>sink.write(new TextEncoder().encode(selected.record.manifest)));
  });
  const store=await openEntityRevisionStore(io,p.publication.identity.contentDigest);
  assert.deepEqual(await store.read(),p.selected);assert.equal(writes,5);
  return {directory,stats,io,store,writes:()=>writes};
}

export async function assertOutdoorSaveInputsUnchanged(p){
  assert.deepEqual(await p.store.read(),p.selected);
  assert.deepEqual((await readdir(p.publication.fixture)).sort(),Object.keys(p.priorFiles).sort());
  for(const [n,h]of Object.entries(p.priorFiles))assert.equal(await outdoorHash(join(p.publication.fixture,n)),h);
  for(const r of p.inputs)assert.equal(await outdoorHash(r.filename),r.sha256);
  for(const [n,v]of Object.entries(p.evidence))if(!n.endsWith('Sha256'))assert.equal(await outdoorHash(v),p.evidence[n+'Sha256']);
}

export async function inspectOutdoorOwnerPublication(name){
  const r=await json(name);assert.equal(r.actualRegisteredHeroOutdoorSavePublished,true);
  for(const [n,h]of Object.entries(r.sourceSha256))assert.equal(await outdoorHash(join(workspace,n)),h);
  const p=await prepareOutdoorOwnerSave(r.previousPublication,r.sessionProof);
  for(const [n,v]of Object.entries(p.evidence))assert.deepEqual(r[n],v);
  assert.equal(r.previousManifest,p.selected.record.manifest);
  assert.deepEqual(r.identity,p.publication.identity);assert.deepEqual(r.inputs,p.inputs);
  const {selected}=await selectedStore(r);
  assert.equal(selected.record.revision,3);
  assert.deepEqual(selected.record.state,{...p.selected.record.state,revision:3,kind:'save',
    previous:sha(p.selected.record.manifest),operationId:p.request.operationId,
    worlds:p.inputs.map(i=>({size:i.bytes,sha256:i.sha256}))});
  assert.deepEqual(selected.owner,p.selected.owner);
  assert.deepEqual(selected.record.state.aliases,p.request.aliases);
  assert.deepEqual(selected.record.state.homeAliases,p.request.homeAliases);
  assert.deepEqual(selected.record.state.referenceBindings,p.request.referenceBindings);
  assert.deepEqual(selected.record.worlds,p.inputs.map(i=>({size:i.bytes,sha256:i.sha256})));
  assert.equal(r.startClockMs,p.initialClockMs);assert.equal(r.endClockMs,57650);
  assert.equal((await readdir(r.fixture)).length,8);
  assert.equal(r.browserUsed,false);assert.equal(r.heroTransferred,false);
  await assertOutdoorSaveInputsUnchanged(p);return r;
}
