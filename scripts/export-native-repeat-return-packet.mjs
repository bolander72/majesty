#!/usr/bin/env node
// Exact current crossing inputs; version 2 adds the receiving leader and grid.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRepeatCrossingCapsule} from './prepare-native-repeat-crossing.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [reportName,profileName]=process.argv.slice(2);
if(!reportName||!profileName||process.argv.length!==4)throw Error('Usage: <current repeat capsule> <owned receiving profile|--inputs>');
await verifyRepeatCrossingCapsule(reportName);
const capsuleBytes=await readFile(reportName),r=JSON.parse(capsuleBytes),p=r.plan;
assert.equal(p.revision,5);assert.equal(p.sourceSide,0);assert.equal(p.destinationSide,1);
assert.equal(p.referenceBindings.length,1);
const receipt=JSON.parse(await readFile(p.receipt)),publication=JSON.parse(await readFile(p.publicationReport)),
  pair=JSON.parse(await readFile(publication.reloadReport)),producer=pair.absent.fixture;
assert.equal(pair.absent.sourceManifest,resolve(pair.absent.sourceManifest));
const producerBytes=await readFile(pair.absent.sourceManifest);
assert.equal(sha(producerBytes),pair.absent.sourceManifestSha256);assert.deepEqual(JSON.parse(producerBytes),producer);
assert.equal(sha(await readFile(publication.reloadReport)),publication.reloadReportSha256);
assert.equal(producer.physicalGridExtent,256);assert.equal(producer.nativeSessionTerminal,true);
const selectedRevisionExport=await verifyRevisionExport(p.receipt,p.destinationSide,receipt.worlds[p.destinationSide].sha256);
assert.equal(selectedRevisionExport.sha256,p.destinationWorld);
if(profileName==='--inputs') {
  console.log(JSON.stringify({producer,producerManifest:pair.absent.sourceManifest,producerManifestSha256:sha(producerBytes),
    selectedRevisionExport,sourceAlias:p.sourceAlias,retiredDestinationAlias:p.retiredDestinationAlias,physicalGridExtent:256}));
} else {
  const profile=await ownedDirectory(resolve(profileName),'actor-arrival-fixture-joint-reload-');
  if(!profile.endsWith('/frontier_0_0'))throw Error('Require isolated receiving profile');
  const words=values=>{const bytes=Buffer.alloc(values.length*4);values.forEach((v,i)=>{
    if(!Number.isInteger(v)||v<0||v>0xffffffff)throw Error('Invalid repeat packet word');bytes.writeUInt32LE(v,i*4);});return bytes;};
  const edits=p.edits.map(e=>{
    const record=['Unit','GPL','Orders'].indexOf(e.record);let kind=0,value=e.after,nonzero=0;
    if(value==='fresh-unit-id'){kind=1;value=0;}else if(value==='fresh-agent-id'){kind=2;value=0;}
    else if(typeof value==='object'){kind=3;nonzero=Number(value.rejectZero);value=value.destinationClockMinusElapsed;}
    if(record<0||![0,1].includes(nonzero))throw Error('Invalid repeat edit kind');
    return words([record,e.offset,e.before,kind,value,nonzero]);
  });
  const records=[];
  for(const kind of ['Unit','GPL','Orders']) {
    const s=await stoppedFileSource(join(r.directory,kind+'.bin'));
    if(s.size>2048)throw Error('Repeat record exceeds native extent');
    const bytes=await s.readAt(0,s.size);assert.equal(sha(bytes),p.records[kind].sha256);records.push(bytes);
  }
  const leader=p.referenceBindings[0].destination,grid=p.geometry.to.widthCells*2;
  assert.equal(grid,p.geometry.to.heightCells*2);assert.equal(grid,producer.physicalGridExtent);
  const bytes=Buffer.concat([words([0x3154524e,2,p.sourceAlias.unitId,p.sourceAlias.agentId,
    p.retiredDestinationAlias.unitId,p.retiredDestinationAlias.agentId,p.sourceClock,...records.map(b=>b.length),edits.length,
    leader.unitId,leader.agentId,grid]),...records,...edits]);
  if(bytes.length>8192||edits.length>64)throw Error('Repeat packet exceeds native bound');
  await writeFile(join(profile,'Native_Return_Packet.bin'),bytes,{flag:'wx'});
  console.log(JSON.stringify({version:2,bytes:bytes.length,sha256:sha(bytes),returnReport:resolve(reportName),returnReportSha256:sha(capsuleBytes),
    receipt:p.receipt,planSha256:r.planSha256,sourceWorld:p.sourceWorld,destinationWorld:p.destinationWorld,edits:edits.length,
    receivingLeader:leader,physicalGridExtent:grid,nativeReturnQualified:false,sourceSha256:sha(await readFile(new URL(import.meta.url)))}));
}
