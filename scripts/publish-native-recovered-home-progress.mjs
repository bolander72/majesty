#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,open,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectNativeInterruptedHomeRecovery} from './inspect-native-interrupted-home-recovery.mjs';
import {inspectInterruptedHomeCheckpoint} from './lib/interrupted-home-checkpoint.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {inspectRecoveredHomeProgress} from './lib/recovered-home-progress.mjs';
const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const observed=await inspectNativeInterruptedHomeRecovery(name),m=JSON.parse(await readFile(name,'utf8'));
const prior=(await inspectInterruptedHomeCheckpoint(m.publication)).report;
const oldIo=await stoppedRevisionStorage(prior.fixture),oldStore=await openEntityRevisionStore(oldIo,prior.identity.contentDigest),before=await oldStore.read();assert.equal(before.record.manifest,prior.selectedManifest);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-recovered-home-'));
await oldIo.withLock('shared',async()=>{const names=await readdir(prior.fixture);assert.equal(names.length,8);
  for(const n of names){const source=await oldIo.open(n),f=await open(join(directory,n),'wx');try{
    for(let at=0;at<source.size;at+=4096){const b=await source.readAt(at,Math.min(4096,source.size-at));for(let used=0;used<b.length;){const r=await f.write(b,used,b.length-used,at+used);assert(r.bytesWritten);used+=r.bytesWritten;}}await f.sync();
  }finally{await f.close();}}});
let writes=0;const stats={},adapter=await stoppedRevisionStorage(directory,stats),io={...adapter,async atomicWrite(n,p){writes++;return adapter.atomicWrite(n,p);}};
const store=await openEntityRevisionStore(io,prior.identity.contentDigest),home=m.snapshotCaptures.at(-1),peer=m.selectedRevisionExports[1];
const operationId=createHash('sha256').update('native-recovered-home-save-v1\n'+observed.manifestSha256+'\n').digest('hex');
const request={...prior.selectedState,worlds:await Promise.all([home,peer].map(async r=>({source:await stoppedFileSource(r.filename),sha256:r.sha256}))),
  kind:'save',expectedManifest:prior.selectedManifest,operationId};
// commit() accepts only the selected-state fields required for a save request.
for(const n of ['version','identitySha256','revision','previous'])delete request[n];
const result=await store.commit(request);assert.equal(result.revision,7);const after=writes;assert.equal((await store.commit(request)).idempotent,true);assert.equal(writes,after);
const selected=await store.read();assert.deepEqual(selected.owner,prior.selectedOwner);assert.deepEqual(await oldStore.read(),before);
assert.equal((await readdir(directory)).length,8);assert(stats.largestRead<=4096&&stats.largestWrite<=4096&&stats.peakReads===1);
const sourceSha256={};for(const n of ['scripts/publish-native-recovered-home-progress.mjs','scripts/lib/recovered-home-progress.mjs','scripts/inspect-native-interrupted-home-recovery.mjs','web/world/entity-revisions.mjs'])sourceSha256[n]=(await hashNativeFile(join(workspace,n))).sha256;
await writeFile(out,JSON.stringify({version:1,nativeRecoveredHomeProgressPublished:true,recoveryManifest:resolve(name),recoveryManifestSha256:observed.manifestSha256,
  fixture:directory,identity:prior.identity,previousManifest:prior.selectedManifest,selectedManifest:result.manifest,selectedState:result.state,selectedOwner:selected.owner,
  inputs:[home,peer],selectedHomeClockMs:home.clock,exactRetryWrites:0,retainedFiles:8,retainedWorldSlots:4,largestRead:stats.largestRead,largestWrite:stats.largestWrite,peakReads:stats.peakReads,
  originalInterruptedSelectionUnchanged:true,sourceSha256,browserUsed:false,nativeProcessesStarted:0,
  scope:'The ordinary native recovery saved its home progress; stopped revision7 publication pairs the last captured home with the unchanged dormant receiving world. The original interrupted revision6 and export remain preserved. Subsequent loading of revision7, other interruption stages and browser/co-op recovery remain unqualified.'},null,2)+'\n',{flag:'wx'});
await inspectRecoveredHomeProgress(out);console.log(JSON.stringify({nativeRecoveredHomeProgressPublished:true,revision:7,homeClockMs:home.clock,exactRetryWrites:0,browserUsed:false}));
