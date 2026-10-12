#!/usr/bin/env node
// Selected revision export; current-state launch guard and immutable historical
// receipt verification are distinct, so later saves do not invalidate evidence.
import {open,readFile,writeFile,mkdtemp,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {openEntityRevisionStore,encodeRevisionIdentity,encodeEntityRevision,parseEntityRevisionManifest} from '../web/world/entity-revisions.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {exportSelectedEntityPair} from '../web/world/entity-export.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {workspace,stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {inspectNativeHeroHandoff} from './inspect-native-hero-handoff.mjs';
import {inspectNativeHeroReturnPair} from './inspect-native-hero-return-pair.mjs';
import {inspectOutdoorOwnerPublication} from './lib/registered-hero-outdoor-save.mjs';
import {inspectGuardedOutdoorRoundTrip} from './lib/guarded-outdoor-return.mjs';
import {inspectInterruptedHomeCheckpoint} from './lib/interrupted-home-checkpoint.mjs';
import {inspectNativeSingleSessionHomePublication} from './lib/single-session-home-publication.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const keys=(o,k)=>o&&Object.keys(o).sort().join(',')===[...k].sort().join(',');
export const MAX_REVISION_RECEIPT_BYTES=8192;
async function jsonFile(filename,limit) {
  const source=await stoppedFileSource(filename);if(source.size>limit)throw Error('Revision metadata exceeds bound');
  const bytes=new Uint8Array(source.size);
  for(let at=0;at<source.size;at+=4096)bytes.set(await source.readAt(at,Math.min(4096,source.size-at)),at);
  return {bytes,value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};
}
async function revision(reportName,directory) {
  const {bytes,value:report}=await jsonFile(reportName,65536);
  const returned=report.actualRegisteredHeroStoppedReturnPairPublished===true;
  const outdoor=report.actualRegisteredHeroOutdoorSavePublished===true;
  const roundTrip=report.actualGuardedOutdoorRoundTripPublished===true;
  const nativeSession=report.nativeSingleSessionStoppedHomeOwnershipPublished===true;
  const interrupted=report.nativeInterruptedHomeCheckpointQualified===true;
  const registered=report.actualRegisteredHeroStoppedPairPublished===true||returned||outdoor||roundTrip||nativeSession||interrupted;
  // Pending receiving-home owners deliberately remain unexportable. The checked
  // completed home or durable interrupted home checkpoint uses this path;
  if(interrupted)await inspectInterruptedHomeCheckpoint(reportName);
  else if(nativeSession)await inspectNativeSingleSessionHomePublication(reportName);
  else if(roundTrip)await inspectGuardedOutdoorRoundTrip(reportName);
  else if(outdoor)await inspectOutdoorOwnerPublication(reportName);
  else if(returned)await inspectNativeHeroReturnPair(reportName);
  else if(registered)await inspectNativeHeroHandoff(reportName);
  else if(report.qualified!==true||report.persistedGameplayStateRevisionsQualified!==true||report.stableEntityIdentityAcrossRevisionsQualified!==true)throw Error('Require qualified evolved revision store');
  const fixture=await ownedDirectory(report.fixture,'actor-arrival-fixture-entity-revision-');
  if(directory!==(registered?fixture:join(fixture,'after-publish')))throw Error('Require owned healthy published revision case');
  const store=await openEntityRevisionStore(await stoppedRevisionStorage(directory),report.identity.contentDigest);
  assert.deepEqual(store.identity,report.identity);return {store,report,reportSha256:sha(bytes)};
}
export async function verifyRevisionExport(receiptName,side,expectedDigest,{requireCurrent=true}={}) {
  const directory=await ownedDirectory(resolve(receiptName,'..'),'actor-arrival-fixture-entity-revision-export-');
  if(resolve(receiptName)!==join(directory,'Selected_Entity_Revision.json')||![0,1].includes(side)||!/^[a-f0-9]{64}$/.test(expectedDigest))throw Error('Invalid revision export request');
  const {bytes,value:r}=await jsonFile(receiptName,MAX_REVISION_RECEIPT_BYTES);
  if(!keys(r,['version','manifest','identity','state','owner','worlds','revisionReport','revisionReportSha256','revisionDirectory'])||r.version!==1||!Array.isArray(r.worlds)||r.worlds.length!==2)throw Error('Invalid revision export receipt');
  const p=await revision(r.revisionReport,r.revisionDirectory),identitySha256=sha(encodeRevisionIdentity(r.identity)),stateBytes=encodeEntityRevision(r.state),m=parseEntityRevisionManifest(r.manifest,identitySha256);
  assert.deepEqual(r.identity,p.store.identity);
  if(r.revisionReportSha256!==p.reportSha256||r.state.identitySha256!==identitySha256||r.state.revision!==m.revision||sha(stateBytes)!==m.stateSha256)throw Error('Changed revision export provenance');
  const owner={entityId:r.identity.entityId,region:r.identity.regions[r.state.ownerSide],...r.state.aliases[r.state.ownerSide]};
  assert.deepEqual(r.owner,owner);const sources=[];
  for(let i=0;i<2;++i) {
    const w=r.worlds[i];if(!keys(w,['filename','size','sha256'])||w.filename!==join(directory,i?'Destination.GMP':'Source.GMP'))throw Error('Invalid revision world path');
    assert.deepEqual({size:w.size,sha256:w.sha256},r.state.worlds[i]);
    const source=await stoppedFileSource(w.filename);if(source.size!==w.size||await hashCheckpointSource(source)!==w.sha256)throw Error('Exported revision world changed');sources.push({source});
  }
  await verifyEntityOwnership(r.identity,r.state.aliases,r.state.referenceBindings,sources,r.state.ownerSide,r.state.homeAliases);
  if(requireCurrent)await p.store.withSelected(async selected=>{
    if(!selected||selected.record.manifest!==r.manifest)throw Error('Selected revision changed; export the latest before launch');
    assert.deepEqual(selected.record.state,r.state);assert.deepEqual(selected.owner,owner);
  });
  if(r.worlds[side].sha256!==expectedDigest)throw Error('Selected revision differs from original native proof');
  return {filename:r.worlds[side].filename,bytes:r.worlds[side].size,sha256:r.worlds[side].sha256,
    receipt:resolve(receiptName),receiptSha256:sha(bytes),side,revision:r.state.revision,manifest:r.manifest,owner,
    revisionReportSha256:r.revisionReportSha256,identitySha256,stateSha256:m.stateSha256};
}
async function main() {
  if(['--verify','--verify-historical'].includes(process.argv[2])) {
    if(process.argv.length!==6||!/^[01]$/.test(process.argv[4]))throw Error('Usage: --verify[|-historical] <receipt> <side> <expected digest>');
    console.log(JSON.stringify(await verifyRevisionExport(process.argv[3],Number(process.argv[4]),process.argv[5],{requireCurrent:process.argv[2]==='--verify'})));return;
  }
  const [reportName,basename]=process.argv.slice(2);
  if(!reportName||!basename||process.argv.length!==4||!/^[a-z][a-z0-9-]*$/.test(basename))throw Error('Usage: <revision qualification> <fresh output basename>');
  const output=join(workspace,'output',basename+'.json');try{await lstat(output);throw Error('Preserve prior revision export evidence');}catch(e){if(e.code!=='ENOENT')throw e;}
  const report=JSON.parse(await readFile(reportName,'utf8')),registered=report.actualRegisteredHeroStoppedPairPublished===true||report.actualRegisteredHeroStoppedReturnPairPublished===true||report.actualRegisteredHeroOutdoorSavePublished===true||report.actualGuardedOutdoorRoundTripPublished===true||report.nativeSingleSessionStoppedHomeOwnershipPublished===true||report.nativeInterruptedHomeCheckpointQualified===true,
    revisionDirectory=registered?report.fixture:join(report.fixture,'after-publish'),p=await revision(resolve(reportName),revisionDirectory);
  const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-')),receiptName=join(directory,'Selected_Entity_Revision.json');let largestWrite=0;
  let state;
  // Outer selection retains the state matching the inner export. The stopped
  // fixture lock is non-reentrant, so use the one already-held selected lease.
  await p.store.withSelected(async selected=>{
    if(!selected)throw Error('Missing selected revision');state=selected.record.state;
    await exportSelectedEntityPair({withSelected:consume=>consume(selected)},async(i,d,produce)=>{
      const f=await open(join(directory,i?'Destination.GMP':'Source.GMP'),'wx');let at=0;
      try {
        await produce({async write(b){largestWrite=Math.max(largestWrite,b.length);for(let n=0;n<b.length;){const {bytesWritten}=await f.write(b,n,b.length-n,at);if(!bytesWritten)throw Error('Short revision export write');n+=bytesWritten;at+=bytesWritten;}}});
        if(at!==d.size)throw Error('Revision export size differs');await f.sync();
      }finally{await f.close();}
    },async receipt=>{
      const r={...receipt,identity:p.store.identity,state,worlds:receipt.worlds.map((w,i)=>({...w,filename:join(directory,i?'Destination.GMP':'Source.GMP')})),
        revisionReport:resolve(reportName),revisionReportSha256:p.reportSha256,revisionDirectory};
      const bytes=Buffer.from(JSON.stringify(r)+'\n');if(bytes.length>MAX_REVISION_RECEIPT_BYTES)throw Error('Revision receipt exceeds bound');await writeFile(receiptName,bytes,{flag:'wx'});
    });
  });
  const worlds=[];for(let i=0;i<2;++i)worlds.push(await verifyRevisionExport(receiptName,i,state.worlds[i].sha256));
  const result={qualified:true,scope:'Stopped selected revision export and current-state/historical receipt verification; original-engine loading and cross-region return unqualified.',
    receipt:receiptName,receiptSha256:worlds[0].receiptSha256,revision:state.revision,worlds,largestWrite,browserUsed:false,nativeProcessesStarted:0,selectedRevisionNativeReloadQualified:false};
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,revision:state.revision,receipt:receiptName,largestWrite}));
}
if(resolve(process.argv[1]||'')===resolve(new URL(import.meta.url).pathname))await main();
