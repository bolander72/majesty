#!/usr/bin/env node
// Real evolved GMP revisions and supervised interruption recovery, no game.
import {readFile,writeFile,mkdtemp,mkdir,readdir,lstat,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {EntityRevisionStore,openEntityRevisionStore,REVISION_MANIFEST,REVISION_IDENTITY} from '../web/world/entity-revisions.mjs';
import {openEntityPairStore} from '../web/world/entity-pair.mjs';
import {exportSelectedEntityPair} from '../web/world/entity-export.mjs';
import {workspace,stoppedFileSource,stoppedPairReader} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
const run=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex'),script=resolve(new URL(import.meta.url).pathname);
async function request(config,index,expectedManifest) {
  const worlds=[];
  for(const [i,name] of config.files[index].entries())worlds.push({source:await stoppedFileSource(name),sha256:config.worlds[index][i].sha256});
  return {worlds,aliases:config.aliases,referenceBindings:config.referenceBindings,ownerSide:1,visitedSides:3,
    operationId:String(index+1).repeat(64),kind:index?'save':'seed',expectedManifest};
}
async function child(configName,directory,point) {
  const c=JSON.parse(await readFile(configName,'utf8')),s=await openEntityRevisionStore(await stoppedRevisionStorage(directory),c.identity.contentDigest),old=await s.read();
  assert.equal(old.record.revision,1);
  await s.commit(await request(c,2,old.record.manifest),async at=>{if(at===point)process.exit(77);});
  throw Error('Expected revision worker interruption did not occur');
}
async function main() {
  if(process.argv[2]==='--owned-child') {
    if(process.argv.length!==6)throw Error('Invalid revision worker arguments');await child(...process.argv.slice(3));return;
  }
  const [basename,continuityInput]=process.argv.slice(2);
  if(!basename||![3,4].includes(process.argv.length)||!/^[a-z][a-z0-9-]*$/.test(basename))throw Error('Use a fresh qualification basename and optional current continuity report');
  const output=join(workspace,'output',basename+'.json');
  try{await lstat(output);throw Error('Preserve prior revision qualification');}catch(e){if(e.code!=='ENOENT')throw e;}
  const continuityName=continuityInput?resolve(continuityInput):join(workspace,'output/native-npc-evolved-continuity-current-observed.json'),bytes=await readFile(continuityName),continuity=JSON.parse(bytes);
  const code="import importlib.util,json;from pathlib import Path;s=importlib.util.spec_from_file_location('c','scripts/check-native-npc-evolved-continuity.py');c=importlib.util.module_from_spec(s);s.loader.exec_module(c);r=__import__('sys').argv;print(json.dumps(c.verify(Path(r[1]),Path(r[2]))))";
  const {stdout}=await run('python3',['-c',code,continuity.firstCapture,continuity.secondCapture],{cwd:workspace,maxBuffer:2*1024*1024});
  assert.deepEqual(JSON.parse(stdout),continuity);
  const captures=[];
  for(const name of [continuity.firstCapture,continuity.secondCapture]){
    const p=JSON.parse(await readFile(name,'utf8'));assert.equal(p.fixture.nativeSessionTerminal,true);assert.equal(p.fixture.nativeExitCode,0);
    try{process.kill(p.fixture.nativePid,0);throw Error('Native process still live');}catch(e){if(e.code!=='ESRCH')throw e;}
    captures.push(p);
  }
  const pairName=join(workspace,'output/native-entity-pair-current-observed.json'),pairBytes=await readFile(pairName),pair=JSON.parse(pairBytes);
  assert.equal(pair.fileBackedPairedOwnershipPublicationQualified,true);
  const legacyDirectory=join(pair.fixture,'after-publish'),legacy=await openEntityPairStore(await stoppedPairReader(legacyDirectory),pair.ledger.contentDigest),selected=await legacy.read();
  assert.equal(selected.record.moved,true);assert.equal(selected.owner.entityId,pair.ledger.entityId);
  assert.equal(selected.record.worlds[1].sha256,captures[0].before.sha256);
  const {entityId,contentDigest,regions,actor}=pair.ledger,identity={version:1,entityId,contentDigest,regions,actor};
  const owned=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-'));
  const files=[0,1,2].map(i=>[join(legacyDirectory,`Frontier_Transfer_Source_${selected.record.slot}.GMP`),i?captures[i-1].after.filename:join(legacyDirectory,`Frontier_Transfer_Destination_${selected.record.slot}.GMP`)]);
  const worlds=[selected.record.worlds,...captures.map(p=>[selected.record.worlds[0],{size:p.after.size,sha256:p.after.sha256}])];
  const config={identity,files,worlds,aliases:pair.ledger.aliases,referenceBindings:pair.ledger.referenceBindings},configName=join(owned,'Owned_Revision_Inputs.json');
  await writeFile(configName,JSON.stringify(config)+'\n',{flag:'wx'});const stats={},cases=[];
  for(const point of ['after-source','after-state','before-publish','after-publish']) {
    const directory=join(owned,point);await mkdir(directory);const io=await stoppedRevisionStorage(directory,stats),s=new EntityRevisionStore(io,identity,contentDigest);
    const seed=await legacy.withSelected(async chosen=>s.commit({...await request(config,0,null),worlds:chosen.sources.map((source,i)=>({source,sha256:chosen.record.worlds[i].sha256}))}));
    const first=await s.commit(await request(config,1,seed.manifest));assert.equal(first.revision,1);
    try{await run(process.execPath,[script,'--owned-child',configName,directory,point],{maxBuffer:4096});throw Error('Missing interrupted revision worker exit');}
    catch(e){if(e.code!==77)throw e;}
    const reopened=await openEntityRevisionStore(io,contentDigest),after=await reopened.read(),published=point==='after-publish';
    assert.equal(after.record.revision,published?2:1);assert.equal(after.owner.entityId,entityId);
    assert.deepEqual(after.record.worlds,worlds[published?2:1]);
    const recovered=await reopened.commit(await request(config,2,first.manifest));assert.equal(recovered.idempotent,published);
    assert.equal((await reopened.commit(await request(config,2,first.manifest))).idempotent,true);
    await assert.rejects(reopened.commit(await request(config,1,seed.manifest)),/changed/);
    const final=await(await openEntityRevisionStore(io,contentDigest)).read();assert.equal(final.record.revision,2);
    const names=await readdir(directory);assert.equal(names.length,8);assert.equal(names.filter(n=>n.endsWith('.GMP')).length,4);
    const exportHashes=[];
    await exportSelectedEntityPair(reopened,async(i,d,produce)=>{const h=createHash('sha256');await produce({async write(b){h.update(b);}});exportHashes.push(h.digest('hex'));},async r=>{assert.equal(r.manifest,final.record.manifest);assert.equal(r.owner.entityId,entityId);});
    assert.deepEqual(exportHashes,worlds[2].map(w=>w.sha256));
    cases.push({point,workerExit:77,revisionAfterInterruption:after.record.revision,finalRevision:2,owner:final.owner,
      recoveredIdempotent:recovered.idempotent,retryIdempotent:true,staleRevisionRejected:true,retainedFiles:8,retainedWorldSlots:4,selectedExportHashes:exportHashes});
  }
  const damagedDirectory=join(owned,'damaged-state');await mkdir(damagedDirectory);
  const damagedIo=await stoppedRevisionStorage(damagedDirectory,stats),damagedStore=new EntityRevisionStore(damagedIo,identity,contentDigest);
  let prior=null;for(let i=0;i<3;++i)prior=(await damagedStore.commit(await request(config,i,prior))).manifest;
  const latest=await damagedStore.read(),stateName=join(damagedDirectory,`Frontier_Revision_State_${latest.record.slot}.json`),f=await open(stateName,'r+');
  try{await f.write(Buffer.from([0]),0,1,0);}finally{await f.close();}
  await assert.rejects(damagedStore.read(),/Damaged selected/);
  const result={qualified:true,scope:'Stopped real original NPC arrival plus two evolved-save revisions with persistent identity, four supervised worker exits, stale-write rejection and bounded selected storage. New revision namespace engine loading, cross-region return, simultaneous regions, browser recovery and whole-browser resources unqualified.',
    fixture:owned,identity,cases,worlds,persistedGameplayStateRevisionsQualified:true,supervisedRevisionProcessRecoveryQualified:true,
    stableEntityIdentityAcrossRevisionsQualified:true,staleWriteAndIdempotentRetryQualified:true,damagedSelectedStateRejected:true,
    retainedWorldSlotsPerPair:4,retainedRevisionStatesPerPair:2,retainedIdentityFilesPerPair:1,retainedFilesPerPair:8,
    largestRead:stats.largestRead,largestWrite:stats.largestWrite,peakReads:stats.peakReads,
    browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,
    selectedRevisionNativeReloadQualified:false,repeatedGameplayCrossingsQualified:false,wholeBrowserMemoryBoundQualified:false,
    completeReferenceClosureQualified:false,concurrentOsWritersQualified:false,
    evidenceSha256:{[pairName]:sha(pairBytes),[continuityName]:sha(bytes)},sourceSha256:{}};
  for(const name of ['web/world/entity-revisions.mjs','web/world/entity-ownership.mjs','web/world/entity-pair.mjs','scripts/qualify-native-entity-revisions.mjs','scripts/lib/stopped-revision-io.mjs'])result.sourceSha256[name]=sha(await readFile(join(workspace,name)));
  assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096&&stats.peakReads===1);
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,revisions:3,workerInterruptionCases:4,retainedFiles:8,largestRead:stats.largestRead,largestWrite:stats.largestWrite,nativeProcessesStarted:0,browserUsed:false}));
}
await main();
