#!/usr/bin/env node
// Copy the selected pending owner into an owned native fixture with both
// saved-world and family-pause clocks; this is not an ordinary export.
import assert from 'node:assert/strict';
import {readFile,mkdir,lstat,open,writeFile} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {inspectGuardedOutdoorHoldPublication} from './lib/guarded-outdoor-return.mjs';
import {guardedHandoffHash} from './lib/guarded-outdoor-handoff.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {readSelectedRemoteHomeTask} from '../web/world/remote-home-task.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <held receiving publication> <fresh preparation directory>');
const directory=resolve(out);try{await lstat(directory);throw Error('Preserve previous preparation');}catch(e){if(e.code!=='ENOENT')throw e;}
const p=await inspectGuardedOutdoorHoldPublication(name),r=p.publication;
const store=await openEntityRevisionStore(await stoppedRevisionStorage(r.fixture),r.identity.contentDigest);
const route=await readSelectedRemoteHomeTask(store,{expectedManifest:r.selectedManifest});
assert.equal(route.sourceSide,1);assert.equal(route.homeSide,0);assert.equal(route.queuedHome.cProcId,4099);
assert.equal(route.sourceClockMs,r.selectedReceivingClockMs);assert.equal(route.sourceClockMs,25300);
assert.equal(r.homeRequest.pauseAnchorClockMs,r.pauseAnchorClockMs);assert.equal(r.pauseAnchorClockMs,24250);
assert(route.sourceClockMs>=r.pauseAnchorClockMs&&route.sourceClockMs-r.pauseAnchorClockMs<=6000);
const producer=JSON.parse(await readFile(p.receiving.manifest,'utf8'));
assert.equal(producer.nativeExitCode,0);assert.equal(producer.nativeSessionTerminal,true);
const oldPreparation=JSON.parse(await readFile(producer.preparation,'utf8'));
await mkdir(directory,{recursive:false});
async function copy(source,filename){const f=await open(filename,'wx');try{
  for(let at=0;at<source.size;at+=4096){const b=await source.readAt(at,Math.min(4096,source.size-at));
    for(let n=0;n<b.length;){const {bytesWritten}=await f.write(b,n,b.length-n,at+n);assert(bytesWritten>0);n+=bytesWritten;}}
  await f.sync();
}finally{await f.close();}return {filename,bytes:source.size,sha256:await guardedHandoffHash(filename)};}
const worlds=await store.withSelected(async selected=>{
  assert.equal(selected.record.manifest,route.ownerManifest);assert.deepEqual(selected.owner,route.owner);
  const records=[];for(let side=0;side<2;side++){
    const file=await copy(selected.sources[side],join(directory,`Selected_${side?'Receiving':'Home'}.GMP`));
    assert.equal(file.sha256,selected.record.worlds[side].sha256);records.push(file);
  }return records;
});
const records=[];
for(const leaf of ['Family_Route_Binding.bin','Family_Route_Proxy_Proposal.GPL']){
  const original=oldPreparation.records.find(e=>basename(e.filename)===leaf);assert(original);
  assert.equal(await guardedHandoffHash(original.filename),original.sha256);
  const copied=await copy(await stoppedFileSource(original.filename),join(directory,leaf));assert.equal(copied.sha256,original.sha256);records.push(copied);
}
const binding=await readFile(records[0].filename);assert.equal(binding.length,320);
for(const [offset,text]of [[32,route.entityId],[96,route.guildEntityId],[160,route.worldId],[224,route.contentDigest]])
  assert.equal(binding.subarray(offset,offset+64).toString(),text);
const compiledSources={...producer.nativeSourceSha256,...producer.nativeHeapRuntimeSourceSha256,...producer.nativeOrderRuntimeSourceSha256};
assert.equal(Object.keys(compiledSources).length,20);
const result={version:2,selectedRemoteHomePreparation:true,route,worlds,records,pauseAnchorClockMs:r.pauseAnchorClockMs,
  publication:resolve(name),publicationSha256:await guardedHandoffHash(name),selectedManifest:r.selectedManifest,selectedState:r.selectedState,
  identity:r.identity,settingsProfile:oldPreparation.settingsProfile,inputHashes:oldPreparation.inputHashes,
  compiledProducerSources:compiledSources,compiledProducerExecutableSha256:producer.nativeExecutableSha256,
  sourceSha256:{},scope:'Exact selected revision5 copies for an owned guarded native restore. Saved world clock25300 and family pause anchor24250 remain distinct. Ordinary export and unguarded/browser activation are not qualified.'};
for(const file of ['scripts/prepare-native-selected-remote-home.mjs','web/world/remote-home-task.mjs','web/world/entity-revisions.mjs'])
  result.sourceSha256[file]=await guardedHandoffHash(join(workspace,file));
await writeFile(join(directory,'prepared.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedRemoteHomePreparation:true,revision:route.ownerRevision,sourceClockMs:route.sourceClockMs,
  pauseAnchorClockMs:r.pauseAnchorClockMs,worlds:2,records:2,browserUsed:false}));
