#!/usr/bin/env node
// Both actual committed worlds must survive separate fresh original loaders.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const digest=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function records(f,iterator,key) {
 const out=new Map();for await(const r of iterator(f)){const id=key(r);assert.ok(!out.has(id));out.set(id,r);}return out;
}
async function exact(a,b,iterator,key) {
 const input=await records(a,iterator,key),output=await records(b,iterator,key);
 assert.deepEqual([...output.keys()],[...input.keys()]);
 for(const [id,r] of input) {
  const s=output.get(id);assert.equal(s.size,r.size,'Reloaded record size differs: '+id);
  for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await a.readAt(r.offset+at,n),await b.readAt(s.offset+at,n),'Reloaded record differs: '+id);}
 }
 return output;
}
export async function inspectNativeHeroPairReload(sourceName,destinationName) {
 const inputs=[sourceName,destinationName].map(n=>resolve(n)),manifests=await Promise.all(inputs.map(json));
 assert.equal(manifests[0].receipt,manifests[1].receipt);assert.equal(manifests[0].publicationManifest,manifests[1].publicationManifest);
 assert.equal(manifests[0].buildReport,manifests[1].buildReport);
 assert.deepEqual(manifests[0].nativeSourceSha256,manifests[1].nativeSourceSha256);
 assert.equal(manifests[0].nativeExecutableSha256,manifests[1].nativeExecutableSha256);
 const receipt=await json(manifests[0].receipt),publication=await json(manifests[0].publicationManifest),loaded=[],sides=[];
 for(const [side,m] of manifests.entries()) {
  assert.deepEqual([m.version,m.phase,m.side,m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.heroPairReloadTrialCompleted,m.stopReason],
   [1,'pair-reload',side,true,false,true,0,true,null]);
  const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-pair-reload-');
  assert.equal(m.profile,join(directory,side?'frontier_1_0':'frontier_0_0'));
  assert.equal(await hash(m.receipt),m.receiptSha256);assert.equal(await hash(m.publicationManifest),m.publicationManifestSha256);
  assert.equal(m.publicationManifest,receipt.revisionReport);assert.equal(m.publicationManifestSha256,receipt.revisionReportSha256);
  const selected=[];for(let i=0;i<2;i++)selected.push(await verifyRevisionExport(m.receipt,i,receipt.worlds[i].sha256));
  assert.deepEqual(m.selectedRevisionExports,selected);assert.equal(m.source,selected[side].filename);assert.equal(m.sourceSha256,selected[side].sha256);
  const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);
  assert.equal(build.nativeBuildQualified,true);assert.equal(await hash(build.log),build.logSha256);await verifyConnectedNativeArtifact(m,build);
  assert.ok(build.finishedAtMs<=m.startedAtMs);assert.equal(m.nativeSymbolsSha256,build.nativeSymbolsSha256);
  const previous=await json(m.previousManifest);assert.equal(await hash(m.previousManifest),m.previousManifestSha256);
  assert.equal(m.previousManifest,publication[side?'liveManifest':'departureManifest']);
  assert.equal(m.previousManifestSha256,publication[side?'liveManifestSha256':'departureManifestSha256']);
  assert.equal(m.settingsProfile,previous.profile);assert.deepEqual(m.inputHashes,previous.inputHashes);
  for(const [n,h] of Object.entries(m.inputHashes)){assert.equal(await hash(join(m.settingsProfile,n)),h);assert.equal(await hash(join(m.profile,n)),h);}
  for(const n of ['originalSourceUnchanged','sourceCopyUnchanged','identityUnchanged','originalSettingsUnchanged','publicationUnchanged','receiptUnchanged'])assert.equal(m[n],true);
  const ids=Buffer.alloc(16);[0x31504852,side,side?554:502,side?48:27].forEach((n,i)=>ids.writeUInt32LE(n,i*4));
  assert.equal(m.identity,join(m.profile,'Hero_Pair_Reload_Identity.bin'));assert.deepEqual(await readFile(m.identity),ids);assert.equal(await hash(m.identity),m.identitySha256);
  assert.equal(m.script,join(directory,'load-hero-pair-reload.script'));assert.equal(await hash(m.script),m.scriptSha256);
  assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);
  const log=await readFile(m.log,'utf8');assert.ok(log.includes('all expectations met'));assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
  assert.deepEqual(log.split('\n').filter(l=>l.startsWith('[streaming] Hero pair reload ')),[
   `[streaming] Hero pair reload saved side=${side} clock=${side?24250:25800} hero=${side?554:502} agent=${side?48:27} present=${side} home=${side?45:7} queued=${side} footprint=${side?4:0} effect-absent=1 original-full-load=1 saved=1 travel-qualified=0 result=pass`,
   `[streaming] Hero pair reload cleanup side=${side} original-removal=${side} aliases-absent=1 home-preserved=1 hooks-preserved=1 result=pass`]);
  assert.equal(m.saves.length,2);assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Pair_Reload_Input.GMP'));
  assert.equal(await hash(m.sourceCopy),m.sourceSha256);
  const copied=m.saves.find(r=>r.filename===m.sourceCopy);assert.ok(copied);assert.deepEqual([copied.bytes,copied.sha256],[selected[side].bytes,selected[side].sha256]);
  const saved=m.saves.find(r=>r.filename===join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Pair_Reload_'+(side?'Destination':'Source')+'.GMP'));
  assert.ok(saved);assert.deepEqual(await hashNativeFile(saved.filename),{bytes:saved.bytes,sha256:saved.sha256,largestRead:4096});
  const a=await stoppedFileSource(m.source),b=await stoppedFileSource(saved.filename);
  assert.equal(await checkpointSavedClock(a),side?24250:25800);assert.equal(await checkpointSavedClock(b),side?24250:25800);
  const units=await exact(a,b,checkpointUnitAgentLinks,r=>r.unitId),agents=await exact(a,b,checkpointAgents,r=>r.agentId);
  const attachments=await exact(a,b,checkpointAttachments,r=>r.kind+':'+r.unitId);
  const queues=async f=>{const out=[];for await(const q of checkpointAgentQueues(f))if(q.type==='queued-agent')out.push([q.queue,q.agentId]);return out;};
  assert.deepEqual(await queues(b),await queues(a));
  assert.equal(m.records.length,side?2:1);
  for(const [name,id] of [['Home',side?45:7],...(side?[['Agent',48]]:[])]) {
   const r=m.records.find(r=>r.filename===join(m.profile,'Hero_Pair_Reload_'+name+'.GPL'));assert.ok(r);
   const expected=agents.get(id);assert.ok(expected&&expected.size<=4096);assert.equal(r.bytes,expected.size);
   assert.equal(r.sha256,digest(await b.readAt(expected.offset,expected.size)));assert.deepEqual(await hashNativeFile(r.filename),{bytes:r.bytes,sha256:r.sha256,largestRead:r.bytes});
  }
  assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=18);
  for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
  assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=35000);
  loaded.push({source:b});sides.push({side,sourceManifest:inputs[side],sourceManifestSha256:await hash(inputs[side]),
   savedWorld:saved,typedUnitsExact:units.size,typedAgentsExact:agents.size,attachmentsExact:attachments.size,
   maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),nativePid:m.nativePid});
 }
 assert.notEqual(sides[0].nativePid,sides[1].nativePid);assert.ok(manifests[0].finishedAtMs<=manifests[1].startedAtMs);
 await verifyEntityOwnership(receipt.identity,receipt.state.aliases,receipt.state.referenceBindings,loaded,1,receipt.state.homeAliases);
 return {version:1,actualRegisteredHeroFreshPairedNativeReloadQualified:true,
  scope:'Actual committed registered-hero revision1 reloads through original whole-world loaders in two sequential fresh native profiles. Full original re-saves retain every typed UNIT/GPL/ORDR/CONT record and actor queue. Source502/27/effect503 remain absent and guild469/7 survives; destination554/48/home45 retain one queue, four occupied cells, rendering and the actual saved home task. Destination actor is cleaned up before normal simulation resumes. No continued AI after this reload, return routing, seam travel, browser loading or repeated-travel resource bound.',
  receipt:manifests[0].receipt,receiptSha256:manifests[0].receiptSha256,publication:manifests[0].publicationManifest,
  publicationSha256:manifests[0].publicationManifestSha256,selectedOwner:receipt.owner,revision:receipt.state.revision,
  sides,nativeExecutableSha256:manifests[0].nativeExecutableSha256,nativeSourceSha256:manifests[0].nativeSourceSha256,
  nativeSymbolsSha256:manifests[0].nativeSymbolsSha256,heroCrossingQualified:false,remoteHomeRoutingQualified:false,
  browserUsed:false,nativeProcessesStarted:0,maximumSampledRssBytes:Math.max(...sides.map(s=>s.maximumSampledRssBytes))};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
 const [source,destination,out]=process.argv.slice(2);assert.equal(process.argv.length,5,'Usage: <source reload> <destination reload> <fresh proof>');
 const r=await inspectNativeHeroPairReload(source,destination);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualRegisteredHeroFreshPairedNativeReloadQualified:true,revision:r.revision,ownerRegion:r.selectedOwner.region,
  exactTypedUnits:r.sides.map(s=>s.typedUnitsExact),heroCrossingQualified:false,browserUsed:false}));
}
