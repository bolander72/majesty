#!/usr/bin/env node
// Original timed effects from the real outdoor hero; no actor edits/import.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks,checkpointAttachments} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from './lib/native-crossing-order-entries.mjs';
const [proofName,directory]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async n=>(await hashNativeFile(n)).sha256,digest=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const proof=await json(proofName);assert.equal(proof.originalHeroOutdoorDepartureStateQualified,true);
assert.equal(await hash('scripts/inspect-native-region-session.mjs'),proof.sourceSha256['scripts/inspect-native-region-session.mjs']);
const m=await json(proof.manifest);assert.equal(await hash(proof.manifest),proof.manifestSha256);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
const capture=m.snapshotCaptures[0];assert.equal(capture.clock,57650);assert.equal(capture.region,'0_0');
assert.equal(await hash(capture.file),capture.sha256);assert.equal(await hash(m.log),m.logSha256);
const source=await stoppedFileSource(capture.file),units=new Map(),attachments=new Map();
for await(const u of checkpointUnitAgentLinks(source))if([528,529].includes(u.unitId))units.set(u.unitId,u);
for await(const a of checkpointAttachments(source))if([528,529].includes(a.unitId)){
  assert.equal(a.kind,'ORDR');assert.ok(!attachments.has(a.unitId));attachments.set(a.unitId,a);
}
const out=resolve(directory);await mkdir(out);const effects=[];
for(const id of [528,529]){
  const unit=units.get(id),order=attachments.get(id),interval=id===528?1000:3000;
  assert.equal(unit.parentUnitId,504);assert.equal(unit.agentId,0);assert.equal(unit.stateFlags,544);
  assert.equal(unit.description,id===528?0x31475241:0x33475241);assert.equal(unit.size,151);
  assert.equal(order.size,164);assert.equal(order.primary.size,128);
  const banks=[],entries=[];for await(const r of checkpointActorOrderEntries(source,id)){
    if(r.type==='bank')banks.push([r.bank,r.version,r.count]);else if(r.type==='entry')entries.push(r);
  }
  assert.deepEqual(banks,[[0,1,0],[1,1,1],[2,1,0]]);assert.equal(entries.length,1);
  const entry=entries[0];assert.equal(entry.kind,9);assert.equal(entry.size,96);
  const expected=Array(24).fill(0);for(const [i,v]of [[0,1],[1,1],[2,2],[3,9],[4,interval],[5,57350],[6,interval],[10,4109]])expected[i]=v;
  assert.deepEqual([...entry.words],expected);
  const payload=await source.readAt(order.primary.offset+16,128),filename=join(out,`Wait_Input_${id}.bin`);
  await writeFile(filename,payload,{flag:'wx'});effects.push({unitId:id,parentUnitId:504,description:unit.description,
    unitSha256:digest(await source.readAt(unit.offset,unit.size)),interval,when:57350,elapsed:300,
    orderPayload:{filename,bytes:payload.length,sha256:digest(payload)}});
}
const settings=Object.fromEntries(await Promise.all(Object.entries(m.inputHashes).map(async ([n,h])=>{
  assert.equal(await hash(join(m.originalSettings,n)),h);return [n,h];})));
const report={version:1,waitEffectClockPreparationQualified:true,sourceClockMs:57650,destinationClockMs:24250,
  source:{filename:capture.file,bytes:capture.size,sha256:capture.sha256},effects,
  sourceProof:resolve(proofName),sourceProofSha256:await hash(proofName),settingsProfile:m.originalSettings,inputHashes:settings,
  sourceSha256:{'scripts/prepare-native-wait-effect-clock.mjs':await hash(new URL(import.meta.url).pathname),
    'scripts/lib/native-crossing-order-entries.mjs':await hash('scripts/lib/native-crossing-order-entries.mjs')},
  browserUsed:false,nativeProcessesStarted:0,effectLifetimeQualified:false,heroTransferred:false};
await writeFile(join(out,'prepared.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({waitEffectClockPreparationQualified:true,effects:effects.length}));
