#!/usr/bin/env node
// Publish real original-engine return worlds as one bounded ownership revision.
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {prepareNativeReturnHandoff} from './prepare-native-return-handoff.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [departure,departed,incoming,output]=process.argv.slice(2);
if(!departure||!departed||!incoming||!output||process.argv.length!==6)throw Error('Usage: <departure> <departed reload> <returned reload> <fresh publication report>');
try{await lstat(output);throw Error('Preserve previous return publications');}catch(e){if(e.code!=='ENOENT')throw e;}
// Historical evidence reconstruction is independent of the launch guard. The
// store itself compares the exact prior manifest, or accepts the exact same
// already-published operation. A different stale request cannot advance it.
const p=await prepareNativeReturnHandoff(departure,departed,incoming,{requireCurrent:false});
const record=await p.store.commit(p.request),retry=await p.store.commit(p.request);
assert.equal(retry.idempotent,true);assert.equal(retry.manifest,record.manifest);
const reopened=await openEntityRevisionStore(await stoppedRevisionStorage(p.receipt.revisionDirectory,p.stats),p.receipt.identity.contentDigest),selected=await reopened.read();
assert.equal(selected.record.manifest,record.manifest);assert.equal(selected.record.state.kind,'handoff');
assert.equal(selected.record.state.ownerSide,0);assert.equal(selected.owner.entityId,p.receipt.identity.entityId);
assert.deepEqual(selected.record.state.aliases,p.request.aliases);assert.deepEqual(selected.record.worlds,record.worlds);
assert.equal(record.revision,p.receipt.state.revision+1);
await assert.rejects(verifyRevisionExport(p.report.receipt,0,p.receipt.worlds[0].sha256),/Selected revision changed/);
for(let side=0;side<2;++side)await verifyRevisionExport(p.report.receipt,side,p.receipt.worlds[side].sha256,{requireCurrent:false});
const files=await readdir(p.receipt.revisionDirectory);assert.equal(files.length,8);
assert.ok(p.stats.largestRead<=4096&&p.stats.largestWrite<=4096&&p.stats.peakReads===1);
const report={qualified:true,scope:'Real stopped original-engine return states committed together as revision4 with stable entity identity, one owner, fresh returning aliases, bounded storage, exact retries and stale-launch refusal. Fresh paired native reload, continuous region paging and browser resources remain unqualified.',
  preparation:p.report,revisionDirectory:p.receipt.revisionDirectory,previousRevision:p.receipt.state.revision,revision:record.revision,manifest:record.manifest,
  owner:selected.owner,worlds:record.worlds,aliases:selected.record.state.aliases,originalNativeReturnOwnershipPublicationQualified:true,
  firstCommitIdempotent:record.idempotent,exactRetryIdempotent:true,staleLaunchRejected:true,historicalReceiptRetained:true,
  retainedFiles:files.length,largestRead:p.stats.largestRead,largestWrite:p.stats.largestWrite,peakReads:p.stats.peakReads,
  freshPairedReturnedRevisionNativeReloadQualified:false,repeatedGameplayCrossingsQualified:false,continuousPagingQualified:false,wholeBrowserMemoryBoundQualified:false,
  browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,
  sourceSha256:sha(await readFile(new URL(import.meta.url)))};
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,revision:record.revision,owner:selected.owner,exactRetryIdempotent:true,firstCommitIdempotent:record.idempotent,retainedFiles:files.length,staleLaunchRejected:true}));
