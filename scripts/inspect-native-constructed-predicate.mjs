#!/usr/bin/env node
// Inspect a stopped reload of an original UI-produced construction save.
import assert from 'node:assert/strict';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {checkpointUnits} from '../web/world/checkpoint.mjs';
const sha=async p=>(await hashNativeFile(p)).sha256;
async function main(){
 const [input,out]=process.argv.slice(2);assert.ok(input&&out);
 const m=JSON.parse(await readFile(input,'utf8'));
 assert.equal(m.phase,'constructed-predicate');assert.ok(['guild','temple'].includes(m.kind));
 assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
 assert.equal(m.constructedPredicateCompleted,true);assert.equal(m.browserUsed,false);
 await ownedDirectory(m.fixture,'actor-arrival-fixture-building-constructed-');
 const build=JSON.parse(await readFile(m.buildReport,'utf8'));await verifyConnectedNativeArtifact(m,build);
 for(const [p,d]of [[m.buildReport,m.buildReportSha256],[m.uiTrial,m.uiTrialSha256],[m.uiProof,m.uiProofSha256],
  [m.source,m.sourceSha256],[m.sourceCopy,m.sourceSha256],[m.script,m.scriptSha256],[m.log,m.logSha256],
  ['scripts/run-native-constructed-predicate.py',m.runnerSha256]])assert.equal(await sha(p),d);
 for(const flag of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged','uiEvidenceUnchanged'])assert.equal(m[flag],true);
 for(const [n,d]of Object.entries(m.inputHashes))assert.equal(await sha(join(m.settingsProfile,n)),d);
 const ui=JSON.parse(await readFile(m.uiTrial,'utf8')),proof=JSON.parse(await readFile(m.uiProof,'utf8'));
 assert.equal(proof.inputSha256,m.uiTrialSha256);assert.equal(ui.uiStep,m.kind);assert.equal(proof.saved.filename,m.source);
 assert.equal(proof.saved.sha256,m.sourceSha256);assert.equal(proof.observed.id,521);assert.equal(proof.observed.completed,1);
 const original=m.kind==='guild'?469:466,description=m.kind==='guild'?0x31564241:0x31504241;
 const source=await stoppedFileSource(m.sourceCopy),found=[];let count=0,buildingCount=0;
 for await(const u of checkpointUnits(source)){
  assert.ok(++count<=4096);
  if(u.family==='BLDG')buildingCount++;
  if(![original,521].includes(u.primary.words[1]))continue;
  assert.equal(u.family,'BLDG');assert.equal(u.primary.description,description);assert.equal(u.primary.words[5],0);
  assert.equal(u.primary.words[2]&4,0);found.push(u.primary.words[1]);
 }
 assert.deepEqual(found.sort((a,b)=>a-b),[original,521]);
 assert.ok((await stat(m.log)).size<2*1024*1024);
 const log=await readFile(m.log,'utf8'),rows=log.split('\n').filter(x=>x.startsWith('[campaign-fixture]'));
 assert.equal(rows.length,m.batchScan?4:3);
 const baseline=rows[0].match(/^\[campaign-fixture\] Constructed baseline kind=(guild|temple) unit=521 original=(469|466) owner=0 mask=3 other-owner=1 mask=0 clock=(\d+)$/);
 assert.ok(baseline);assert.equal(baseline[1],m.kind);assert.equal(Number(baseline[2]),original);
 assert.ok(Number(baseline[3])>0&&Number(baseline[3])<=0xffffffff);
 const missing=m.kind==='guild'?2:1;
 assert.equal(rows[1],`[campaign-fixture] Constructed filters original-unfinished=3 both-unfinished=${missing} original-restored=3 new-restored=3 intact=1`);
 let batchRegistryVisits;
 if(m.batchScan){
  const batch=rows[2].match(/^\[campaign-fixture\] Batch registry owners=4 visits=(\d+) masks=3,0,0,0 reversed=0,0,0,3 invalid-refused=1$/);
  assert.ok(batch);batchRegistryVisits=Number(batch[1]);assert.equal(batchRegistryVisits,buildingCount);
 }
 assert.equal(rows.at(-1),`[campaign-fixture] Constructed predicate completed kind=${m.kind} restored=1 owner-filter=1 result=pass`);
 assert.ok(log.includes('all expectations met')&&log.includes('guest exit code:    0')&&log.includes('undeliverable calls: none'));
 const durationMs=m.finishedAtMs-m.startedAtMs;assert.ok(durationMs>0&&durationMs<=47000);
 assert.ok(m.resourceSamples.length>0&&m.resourceSamples.every(s=>s.pid===m.nativePid&&s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes));
 const report={version:1,qualified:true,constructedBuildingReloadPredicateQualified:true,kind:m.kind,
  observed:{newBuilding:521,originalBuilding:original,clock:Number(baseline[3]),bothUnfinishedMask:missing,batchRegistryVisits},
  batchedBuildingScanQualified:!!m.batchScan,
  cooperativeChapterQualified:false,browserUsed:false,nativePid:m.nativePid,durationMs,
  maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),
  inputSha256:await sha(input),constructionProofSha256:m.uiProofSha256,nativeExecutableSha256:m.nativeExecutableSha256,
  inspectorSha256:await sha('scripts/inspect-native-constructed-predicate.mjs'),runnerSha256:m.runnerSha256,
  scope:'Original solo UI-built save reloaded by the native engine. Production predicate counts the new building while the old completion flag is cleared, excludes both when both flags are cleared, and restores both before the next tick. No cooperative outcome or browser qualification.'};
 await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({qualified:true,kind:m.kind,newBuilding:521,cooperativeChapterQualified:false}));
}
main().catch(e=>{console.error(JSON.stringify({qualified:false,error:e.message.slice(0,350)}));process.exitCode=1;});
