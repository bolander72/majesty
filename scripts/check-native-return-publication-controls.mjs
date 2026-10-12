#!/usr/bin/env node
// Exercise real-world request rejection/retries only in a disposable store.
import {readFile,writeFile,mkdtemp,readdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {prepareNativeReturnHandoff} from './prepare-native-return-handoff.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
const [departure,departed,incoming,output]=process.argv.slice(2);
if(!departure||!departed||!incoming||!output||process.argv.length!==6)throw Error('Usage: <departure> <departed reload> <returned reload> <fresh report>');
const p=await prepareNativeReturnHandoff(departure,departed,incoming),sha=b=>createHash('sha256').update(b).digest('hex'),
  original=p.receipt.revisionDirectory,files=(await readdir(original)).sort(),hashes={};
for(const name of files)hashes[name]=sha(await readFile(join(original,name)));
const trial=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-return-trial-'));
for(const name of files)await copyFile(join(original,name),join(trial,name));
const stats={largestRead:0,largestWrite:0,peakReads:0,activeReads:0},store=await openEntityRevisionStore(await stoppedRevisionStorage(trial,stats),p.receipt.identity.contentDigest),cases=[];
for(const [name,mutate] of [
  ['wrong owner',r=>{r.ownerSide=1;}],['reused returning alias',r=>{r.aliases[0]={...p.receipt.state.aliases[0]};}],
  ['changed outgoing alias',r=>{r.aliases[1].unitId++;}],['missing leader binding',r=>{r.referenceBindings=[];}],
  ['wrong expected manifest',r=>{r.expectedManifest=null;}],['wrong operation kind',r=>{r.kind='save';}],
  ['source digest forged',r=>{r.worlds[0].sha256='0'.repeat(64);}],['dormant digest forged',r=>{r.worlds[1].sha256='0'.repeat(64);} ],
]) {
  for(const file of files)await copyFile(join(original,file),join(trial,file));
  const request={...p.request,aliases:structuredClone(p.request.aliases),referenceBindings:structuredClone(p.request.referenceBindings),worlds:p.request.worlds.map(w=>({...w}))};mutate(request);
  await assert.rejects(store.commit(request));assert.deepEqual((await readdir(trial)).sort(),files);
  const selected=await store.read();assert.equal(selected.record.manifest,p.receipt.manifest);assert.deepEqual(selected.record.state,p.receipt.state);
  const changedFiles=[];for(const file of files)if(sha(await readFile(join(trial,file)))!==hashes[file])changedFiles.push(file);
  const inactiveSlot=selected.record.slot===0?1:0;
  assert.ok(changedFiles.every(file=>file.endsWith(`_${inactiveSlot}.GMP`)||file===`Frontier_Revision_State_${inactiveSlot}.json`));
  cases.push({name,rejected:true,selectedTrialRevisionUnchanged:true,changedUnselectedFiles:changedFiles});
}
for(const file of files)await copyFile(join(original,file),join(trial,file));
const committed=await store.commit(p.request),retry=await store.commit(p.request);assert.equal(committed.revision,4);assert.equal(retry.idempotent,true);
const selected=await store.read();assert.equal(selected.owner.entityId,p.receipt.identity.entityId);assert.deepEqual(selected.owner,{entityId:p.receipt.identity.entityId,region:'0_0',unitId:2142,agentId:72});
for(const [name,request] of [['different stale operation',{...p.request,operationId:'0'.repeat(64)}],['same operation changed aliases',{...p.request,aliases:[{unitId:2143,agentId:73},p.request.aliases[1]]}]]) {
  await assert.rejects(store.commit(request));assert.equal((await store.read()).record.manifest,committed.manifest);cases.push({name,rejected:true,selectedTrialManifestUnchanged:true});
}
assert.deepEqual((await readdir(original)).sort(),files);for(const file of files)assert.equal(sha(await readFile(join(original,file))),hashes[file]);
assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096&&stats.peakReads===1);
await writeFile(output,JSON.stringify({qualified:true,rejected:cases.length,cases,disposableTrial:trial,realWorldTrialCommitQualified:true,exactRetryIdempotent:true,
  originalStoreUnchanged:true,retainedTrialFiles:(await readdir(trial)).length,largestRead:stats.largestRead,largestWrite:stats.largestWrite,peakReads:stats.peakReads,
  browserUsed:false,nativeProcessesStarted:0,sourceSha256:sha(await readFile(new URL(import.meta.url)))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:cases.length,realWorldTrialCommitQualified:true,originalStoreUnchanged:true,exactRetryIdempotent:true}));
