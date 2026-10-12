#!/usr/bin/env node
// Commit both actually qualified next original saves under one ownership manifest.
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {prepareRepeatHandoff} from './prepare-native-repeat-handoff.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
const [d,q,i,out]=process.argv.slice(2);if(!d||!q||!i||!out||process.argv.length!==6)throw Error('Usage: <departure> <departed reload> <incoming reload> <fresh publication>');
try{await lstat(out);throw Error('Preserve prior handoff publication');}catch(e){if(e.code!=='ENOENT')throw e;}
// Historical reconstruction supports exact retries. The store requires the
// exact old manifest or the identical already-committed operation.
const p=await prepareRepeatHandoff(d,q,i,{requireCurrent:false}),record=await p.store.commit(p.request),retry=await p.store.commit(p.request);
assert.equal(retry.idempotent,true);assert.equal(retry.manifest,record.manifest);
const reopened=await openEntityRevisionStore(await stoppedRevisionStorage(p.receipt.revisionDirectory,p.stats),p.receipt.identity.contentDigest),selected=await reopened.read();
assert.equal(selected.record.manifest,record.manifest);assert.equal(record.revision,6);assert.equal(selected.record.state.kind,'handoff');assert.equal(selected.record.state.ownerSide,1);
assert.equal(selected.owner.entityId,p.receipt.identity.entityId);assert.deepEqual(selected.record.state.aliases,p.request.aliases);assert.deepEqual(selected.record.worlds,record.worlds);
for(let side=0;side<2;++side){await assert.rejects(verifyRevisionExport(p.report.receipt,side,p.receipt.worlds[side].sha256),/Selected revision changed/);await verifyRevisionExport(p.report.receipt,side,p.receipt.worlds[side].sha256,{requireCurrent:false});}
const files=await readdir(p.receipt.revisionDirectory);assert.equal(files.length,8);assert.ok(p.stats.largestRead<=4096&&p.stats.largestWrite<=4096&&p.stats.peakReads===1);
const report={qualified:true,scope:'Next real original-engine crossing saves committed together as revision6, stable entity identity, fresh incoming532/GPL85 in side1 and outgoing2142/GPL72 absent, one owner and known reference bindings, bounded storage, exact retries and stale-launch refusal. Committed paired native reload, general repeated journeys/region disposal and browser resources remain unqualified.',
  preparation:p.report,revisionDirectory:p.receipt.revisionDirectory,previousRevision:5,revision:record.revision,manifest:record.manifest,owner:selected.owner,aliases:selected.record.state.aliases,worlds:record.worlds,
  originalNativeRepeatOwnershipPublicationQualified:true,firstCommitIdempotent:record.idempotent,exactRetryIdempotent:true,staleLaunchRejected:true,historicalReceiptRetained:true,retainedFiles:8,
  largestRead:p.stats.largestRead,largestWrite:p.stats.largestWrite,peakReads:p.stats.peakReads,freshCommittedPairedNativeReloadQualified:false,
  repeatedGameplayCrossingsQualified:false,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,
  sourceSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex')};
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,revision:6,owner:selected.owner,firstCommitIdempotent:record.idempotent,exactRetryIdempotent:true,retainedFiles:8}));
