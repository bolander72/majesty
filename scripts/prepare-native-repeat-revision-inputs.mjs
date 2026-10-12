#!/usr/bin/env node
// Verify a committed next handoff and expose exact inputs for paired native loads.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {prepareRepeatHandoff} from './prepare-native-repeat-handoff.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function metadata(name,cap=65536){const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Committed handoff metadata exceeds bound');const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return {value:JSON.parse(b),sha256:sha(b)};}
export async function repeatRevisionInputs(publicationName,receiptName,side,{requireCurrent=true}={}) {
  if(![0,1].includes(side))throw Error('Invalid committed handoff side');
  const pb=await metadata(publicationName),publication=pb.value,r=(await metadata(receiptName,8192)).value,old=publication.preparation;
  if(publication.qualified!==true||publication.originalNativeRepeatOwnershipPublicationQualified!==true||!old)throw Error('Require actually committed original next crossing');
  const p=await prepareRepeatHandoff(old.departureReport,old.departedReloadReport,old.incomingReloadReport,{requireCurrent:false});assertRevalidatedNativeProof(p.report,old);
  assert.equal(r.manifest,publication.manifest);assert.deepEqual(r.identity,p.receipt.identity);assert.equal(r.revisionDirectory,p.receipt.revisionDirectory);
  assert.equal(publication.revisionDirectory,r.revisionDirectory);assert.deepEqual(r.owner,publication.owner);assert.equal(r.state.revision,6);
  assert.equal(publication.previousRevision,5);assert.equal(publication.revision,6);assert.equal(r.state.previous,sha(Buffer.from(p.receipt.manifest)));
  assert.equal(r.state.operationId,p.request.operationId);assert.equal(r.state.kind,'handoff');assert.equal(r.state.ownerSide,1);assert.equal(r.state.visitedSides,p.request.visitedSides);
  assert.deepEqual(r.state.aliases,p.request.aliases);assert.deepEqual(publication.aliases,r.state.aliases);assert.deepEqual(r.state.referenceBindings,p.request.referenceBindings);
  const worlds=p.request.worlds.map(w=>({size:w.source.size,sha256:w.sha256}));assert.deepEqual(r.state.worlds,worlds);assert.deepEqual(publication.worlds,worlds);
  const exports=[];for(let s=0;s<2;++s)exports.push(await verifyRevisionExport(receiptName,s,worlds[s].sha256,{requireCurrent}));
  const active=side===r.state.ownerSide,producer=active?p.incoming.fixture:p.departed.fixture,saved=active?p.incoming.after:p.departed.roundtrip;
  assert.equal(saved.sha256,worlds[side].sha256);assert.equal(saved.bytes,worlds[side].size);
  return {publicationReport:resolve(publicationName),publicationReportSha256:pb.sha256,selectedRevisionExport:exports[side],identity:r.state.aliases[side],
    active,physicalGridExtent:side?256:512,producer,producerManifest:active?p.incoming.sourceManifest:p.departed.sourceManifest,
    producerManifestSha256:active?p.incoming.sourceManifestSha256:p.departed.sourceManifestSha256,
    expectedRecords:active?saved.records:null,expectedSnapshot:saved,expectedClock:active?p.incoming.motionSamples.at(-1)[1]:null,
    retiredAlias:p.receipt.state.aliases[side],receipt:r};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [pub,receipt,side]=process.argv.slice(2);if(!pub||!receipt||! /^[01]$/.test(side)||process.argv.length!==5)throw Error('Usage: <publication> <current receipt> <side>');
  console.log(JSON.stringify(await repeatRevisionInputs(pub,receipt,Number(side))));
}
