#!/usr/bin/env node
// Publish a stopped original-engine continuation using the exact loaded revision
// as a compare-and-swap token. Repeating the same verified save is idempotent.
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {verifyReturnRevisionPair} from './check-native-return-revision-reload.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
const run=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
async function metadata(filename,maximum=65536) {
  const source=await stoppedFileSource(filename);
  if(source.size>maximum)throw Error('Oversized native revision evidence');
  const bytes=new Uint8Array(source.size);
  for(let at=0;at<source.size;at+=4096)bytes.set(await source.readAt(at,Math.min(4096,source.size-at)),at);
  return {bytes,value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};
}
export async function prepareNativeRevisionSave(reloadName,captureName) {
  // Paired reload evidence includes hashes of all dormant entity records.
  // Keep a fixed metadata cap; GMP inputs still stream in 4096-byte pages.
  const reload=await metadata(reloadName,1024*1024),capture=await metadata(captureName),r=reload.value,c=capture.value;
  if(r.freshPairedReturnedRevisionNativeReloadQualified===true) {
    if(c.nativeOriginalCommittedSnapshotReloadQualified!==true||c.side!==0||c.sourceManifest!==r.active?.sourceManifest)
      throw Error('Require the actual active original save from both committed return reloads');
    const checked=await verifyReturnRevisionPair(r.active.sourceManifest,r.absent.sourceManifest);
    assertRevalidatedNativeProof(checked,r);assert.deepEqual(checked.active,c,'Returned native save evidence changed');
    const receipt=(await metadata(r.receipt,8192)).value;
    for(let side=0;side<2;++side)await verifyRevisionExport(r.receipt,side,receipt.worlds[side].sha256,{requireCurrent:false});
    assert.equal(receipt.state.ownerSide,0);assert.equal(receipt.state.revision,r.revision);assert.deepEqual(receipt.owner,r.owner);
    assert.equal(c.before.sha256,receipt.worlds[0].sha256);assert.equal(c.before.bytes,receipt.worlds[0].size);
    assert.equal(c.savedClock,c.motionSamples[0][1]+12000);
    for(const key of ['family','description','playerNumber'])assert.equal(c.after.actor[key],receipt.identity.actor[key]);
    assert.deepEqual([c.after.actor.unitId,c.after.actor.agentId],[receipt.state.aliases[0].unitId,receipt.state.aliases[0].agentId]);
    return revisionSaveRequest(receipt,r.receipt,{...c,clock:c.savedClock,after:{...c.after,size:c.after.bytes}},reload.bytes,capture.bytes);
  }
  if(r.selectedRevisionNativeReloadQualified!==true||c.originalEvolvedFullSaveQualified!==true||
      resolve(c.sourceManifest)!==resolve(r.destinationManifest))throw Error('Require a save from the selected revision native reload');
  // Independently recompute original reload, movement and full-writer evidence.
  // The scripts directory is explicit because this helper runs outside Python's
  // ordinary script launcher, which normally establishes its import path.
  const code="import sys,json,importlib.util;from pathlib import Path;sys.path.insert(0,str(Path('scripts').resolve()));s=importlib.util.spec_from_file_location('revision_reload','scripts/check-native-entity-revision-reload.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps(m.verify(Path(sys.argv[1]),Path(sys.argv[2]))))";
  const checkedReload=await run('python3',['-c',code,r.sourceManifest,r.destinationManifest],{cwd:workspace,maxBuffer:2*1024*1024});
  assertRevalidatedNativeProof(JSON.parse(checkedReload.stdout),r);
  const checkedCapture=await run(process.execPath,[join(workspace,'scripts/check-native-npc-evolved.mjs'),c.sourceManifest,'--stdout'],{cwd:workspace,maxBuffer:2*1024*1024});
  assertRevalidatedNativeProof(JSON.parse(checkedCapture.stdout),c);
  for(const manifest of [r.sourceManifest,r.destinationManifest]) {
    const m=(await metadata(manifest)).value;
    if(m.nativeSessionTerminal!==true||m.nativeExitCode!==0||!Number.isInteger(m.nativePid)||m.nativePid<=0)throw Error('Native continuation is not terminal');
    try{process.kill(m.nativePid,0);throw Error('Native continuation process is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
  }
  const receipt=(await metadata(r.receipt,8192)).value;
  for(let side=0;side<2;++side)await verifyRevisionExport(r.receipt,side,r.worlds[side].sha256,{requireCurrent:false});
  const owner=receipt.state.ownerSide;
  if(owner!==1||receipt.state.revision!==r.revision||receipt.owner.entityId!==r.owner.entityId||
      c.before.sha256!==receipt.worlds[owner].sha256||c.before.size!==receipt.worlds[owner].size||
      c.clock!==r.evolvedStartingClock+12000)throw Error('Native save did not continue the loaded revision');
  for(const key of ['family','description','playerNumber'])assert.equal(c.after.actor[key],receipt.identity.actor[key]);
  assert.equal(c.after.actor.unitId,receipt.state.aliases[owner].unitId);
  assert.equal(c.after.actor.agentId,receipt.state.aliases[owner].agentId);
  return revisionSaveRequest(receipt,r.receipt,c,reload.bytes,capture.bytes);
}
async function revisionSaveRequest(receipt,oldReceipt,capture,reloadBytes,captureBytes) {
  const owner=receipt.state.ownerSide,c=capture;
  const stats={largestRead:0,largestWrite:0,peakReads:0,activeReads:0},store=await openEntityRevisionStore(await stoppedRevisionStorage(receipt.revisionDirectory,stats),receipt.identity.contentDigest);
  assert.deepEqual(store.identity,receipt.identity);
  const operationId=sha(new TextEncoder().encode(JSON.stringify({manifest:receipt.manifest,
    captureManifestSha256:c.sourceManifestSha256,worldSha256:c.after.sha256})+'\n'));
  const worlds=[];for(let side=0;side<2;++side)worlds.push(side===owner?
    {source:await stoppedFileSource(c.after.filename),sha256:c.after.sha256}:
    {source:await stoppedFileSource(receipt.worlds[side].filename),sha256:receipt.worlds[side].sha256});
  const request={worlds,
    aliases:receipt.state.aliases,referenceBindings:receipt.state.referenceBindings,ownerSide:owner,
    visitedSides:receipt.state.visitedSides,operationId,kind:'save',expectedManifest:receipt.manifest};
  return {store,request,stats,receipt,oldReceipt,reloadSha256:sha(reloadBytes),captureSha256:sha(captureBytes),capture:c};
}
async function main() {
  const [reloadName,captureName,output]=process.argv.slice(2);
  if(!reloadName||!captureName||!output||process.argv.length!==5)throw Error('Usage: <selected native reload proof> <new native save proof> <fresh report>');
  try{await lstat(output);throw Error('Preserve prior revision publication evidence');}catch(e){if(e.code!=='ENOENT')throw e;}
  const p=await prepareNativeRevisionSave(resolve(reloadName),resolve(captureName));
  const record=await p.store.commit(p.request),retry=await p.store.commit(p.request);
  assert.equal(retry.idempotent,true);assert.equal(record.manifest,retry.manifest);
  const reopened=await openEntityRevisionStore(await stoppedRevisionStorage(p.receipt.revisionDirectory,p.stats),p.receipt.identity.contentDigest),selected=await reopened.read();
  assert.equal(selected.record.manifest,record.manifest);assert.deepEqual(selected.record.worlds,record.worlds);
  assert.equal(selected.owner.entityId,p.receipt.identity.entityId);
  assert.deepEqual(record.worlds[1-p.receipt.state.ownerSide],p.receipt.state.worlds[1-p.receipt.state.ownerSide]);
  for(let side=0;side<2;++side) {
    await assert.rejects(verifyRevisionExport(p.oldReceipt,side,p.receipt.worlds[side].sha256),/Selected revision changed/);
    await verifyRevisionExport(p.oldReceipt,side,p.receipt.worlds[side].sha256,{requireCurrent:false});
  }
  const files=await readdir(p.receipt.revisionDirectory);assert.equal(files.length,8);
  assert.ok(p.stats.largestRead<=4096&&p.stats.largestWrite<=4096&&p.stats.peakReads===1);
  const result={qualified:true,scope:'Stopped original gameplay continuation published as a bounded save revision with unchanged dormant world, stable identity, exact retries and stale launch refusal. Repeated region crossings and browser integration remain unqualified.',
    reloadReport:resolve(reloadName),reloadReportSha256:p.reloadSha256,captureReport:resolve(captureName),captureReportSha256:p.captureSha256,
    revisionDirectory:p.receipt.revisionDirectory,previousReceipt:p.oldReceipt,previousRevision:p.receipt.state.revision,
    revision:record.revision,manifest:record.manifest,owner:selected.owner,worlds:record.worlds,
    originalEvolvedSavePublicationQualified:true,exactRetryIdempotent:true,firstCommitIdempotent:record.idempotent,
    staleLaunchRejected:true,historicalReceiptRetained:true,dormantWorldUnchanged:true,retainedFiles:files.length,
    largestRead:p.stats.largestRead,largestWrite:p.stats.largestWrite,peakReads:p.stats.peakReads,
    originalClock:p.capture.clock,position:p.capture.after.actor.position,counts:p.capture.after.counts,
    browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,repeatedGameplayCrossingsQualified:false,wholeBrowserMemoryBoundQualified:false,
    sourceSha256:{}};
  for(const f of ['scripts/publish-native-entity-revision.mjs','scripts/export-native-entity-revision.mjs','web/world/entity-revisions.mjs','web/world/entity-ownership.mjs','scripts/lib/stopped-revision-io.mjs','scripts/lib/stopped-entity-io.mjs'])result.sourceSha256[f]=sha(await readFile(join(workspace,f)));
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,revision:record.revision,exactRetryIdempotent:true,staleLaunchRejected:true,retainedFiles:files.length,originalClock:p.capture.clock}));
}
if(resolve(process.argv[1]||'')===resolve(new URL(import.meta.url).pathname))await main();
