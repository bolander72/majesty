#!/usr/bin/env node
// Prepare the actual outdoor source through the existing registered-home
// migration contract. Recipient is the immutable registered neighbor, not the
// newly generated west kingdom. No native actor or ownership is changed here.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {prepareCheckpointRegisteredHeroArrival,MAX_ARRIVAL_ATTACHED_UNITS} from '../web/world/arrival.mjs';
const [observedName,directory]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const proof=await json(observedName);assert.equal(proof.qualified,true);assert.equal(proof.originalHeroOutdoorDepartureStateQualified,true);
assert.equal(await hash('scripts/inspect-native-region-session.mjs'),proof.sourceSha256['scripts/inspect-native-region-session.mjs']);
const m=await json(proof.manifest);assert.equal(await hash(proof.manifest),proof.manifestSha256);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(m.log),m.logSha256);assert.equal(await hash(m.receipt),m.receiptSha256);
const receipt=await json(m.receipt),capture=m.snapshotCaptures[0],recipient=m.selectedRevisionExports[1];
assert.equal(receipt.state.ownerSide,0);assert.equal(receipt.owner.unitId,504);assert.equal(receipt.owner.agentId,28);
assert.equal(capture.region,'0_0');assert.equal(recipient.side,1);
assert.equal(await hash(capture.file),capture.sha256);assert.equal(await hash(recipient.filename),recipient.sha256);
const source=await stoppedFileSource(capture.file),destination=await stoppedFileSource(recipient.filename);
const clocks=[await checkpointSavedClock(source),await checkpointSavedClock(destination)];assert.equal(clocks[0],capture.clock);
const attachedUnitBindings=[];
for await(const unit of checkpointUnitAgentLinks(source))if(unit.parentUnitId===504){
  assert.ok(attachedUnitBindings.length<MAX_ARRIVAL_ATTACHED_UNITS);
  attachedUnitBindings.push({from:unit.unitId,to:100001+attachedUnitBindings.length});
}
let prepared;
try{
  prepared=await prepareCheckpointRegisteredHeroArrival(source,destination,
    {unitId:504,freshUnitId:100000,freshAgentId:1000,unitBindings:[],attachedUnitBindings,
      sourceClockMs:clocks[0],destinationClockMs:clocks[1]},
    {identity:receipt.identity,ownerSide:0,aliases:receipt.state.aliases,
      homeAliases:receipt.state.homeAliases,referenceBindings:receipt.state.referenceBindings});
}catch(error){
  await writeFile(resolve(directory)+'-refused.json',JSON.stringify({version:1,actualOutdoorHeroCapsulePrepared:false,
    refusal:error.message,attachedUnitBindings,sourceProof:resolve(observedName),sourceProofSha256:await hash(observedName),
    preparationSourceSha256:await hash(new URL(import.meta.url).pathname),source:capture,recipient,sourceClocksMs:clocks,
    sourceUnchanged:await hash(capture.file)===capture.sha256,recipientUnchanged:await hash(recipient.filename)===recipient.sha256,
    heroTransferred:false,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
  throw error;
}
assert.equal(prepared.plan.registeredHome.homeRegion,'0_0');
const out=resolve(directory);await mkdir(out);let total=0;const records={};
for(const [name,bytes]of Object.entries(prepared.records)){
  assert.match(name,/^[a-zA-Z0-9_]+$/);assert.ok(bytes.length<=65536);total+=bytes.length;
  const file=join(out,name+'.bin');await writeFile(file,bytes,{flag:'wx'});
  records[name]={filename:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
assert.ok(total<=256*1024);
const report={version:1,actualOutdoorHeroCapsulePrepared:true,heroTransferred:false,spatialCrossingQualified:false,
  browserUsed:false,nativeProcessesStarted:0,originalSourceUnchanged:await hash(capture.file)===capture.sha256,
  recipientUnchanged:await hash(recipient.filename)===recipient.sha256,
  sourceProof:resolve(observedName),sourceProofSha256:await hash(observedName),source:capture,recipient,sourceClocksMs:clocks,
  records,totalRecordBytes:total,plan:prepared.plan,
  scope:'Actual normally evolved outdoor Warrior504/GPL28 from native session departure; bounded registered-home capsule prepared for the existing immutable east recipient with pure home45. It is not imported into the generated west kingdom, moved to a seam, or published as a new owner.'};
await writeFile(join(out,'prepared.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({actualOutdoorHeroCapsulePrepared:true,totalRecordBytes:total,heroTransferred:false}));
