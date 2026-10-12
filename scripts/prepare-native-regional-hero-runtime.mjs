#!/usr/bin/env node
// Present the independently checked capsule to the original family readers.
// Identity proposals stay proposals; original constructors reserve real IDs.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const [checkedName,reportName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async p=>(await hashNativeFile(p)).sha256;
const checked=JSON.parse(await readFile(checkedName,'utf8'));
assert.equal(checked.originalOutdoorHeroCapsuleBytesQualified,true);
assert.equal(await hash(checked.preparation),checked.preparationSha256);
assert.equal(await hash(checked.audit),checked.auditSha256);
for(const [n,h]of Object.entries(checked.sourceSha256))assert.equal(await hash(n),h);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-regional-hero-input-'));
const recheck=join(directory,'recheck.json');
const run=spawnSync(process.execPath,['scripts/check-native-regional-hero.mjs',checked.preparation,checked.audit,recheck],
  {cwd:workspace,encoding:'utf8',timeout:20000,maxBuffer:65536});
assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);
const p=JSON.parse(await readFile(checked.preparation,'utf8')),regional=JSON.parse(await readFile(p.regionalProof,'utf8'));
const native=JSON.parse(await readFile(regional.sourceManifest,'utf8'));
assert.equal(await hash(regional.sourceManifest),regional.sourceManifestSha256);
assert.equal(native.ownedProducerAbsent,true);assert.equal(native.nativeSessionTerminal,true);assert.equal(native.nativeExitCode,0);
try{process.kill(native.nativePid,0);throw Error('Generated-region producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
const records=[];
async function emit(name,key,body=false){
  const original=p.records[key];assert.equal(await hash(original.filename),original.sha256);
  const raw=await readFile(original.filename),b=body?raw.subarray(36):raw;
  if(body){assert.equal(raw.readUInt32LE(16),1);assert.equal(raw.toString('ascii',20,24),'PRIM');assert.equal(raw.readUInt32LE(24),b.length);}
  const filename=join(directory,name);await writeFile(filename,b,{flag:'wx'});
  records.push({filename,bytes:b.length,sha256:await hash(filename),capsuleRecord:key,capsuleSha256:original.sha256});
}
for(const id of [504,527,528,529]){
  await emit(`Family_Proposal_${id}.UNIT`,id===504?'unit':`attached_${id}`);
  await emit(`Family_Proposal_${id}_Orders.bin`,id===504?'order':`attached_order_${id}`,true);
}
await emit('Family_Proposal_Agent.GPL','agent');await emit('Family_Proposal_Container.bin','container',true);
assert.deepEqual(records.map(r=>r.bytes),[442,300,151,208,151,128,151,128,1850,64]);
const report={version:1,regionalHeroRuntimeInputsPrepared:true,directory,records,checkedCapsule:resolve(checkedName),
  checkedCapsuleSha256:await hash(checkedName),capsulePreparation:checked.preparation,capsulePreparationSha256:checked.preparationSha256,
  originalSource:p.source,destination:p.destination,region:p.plan.registeredHome.destinationRegion,destinationClockMs:p.plan.destinationClockMs,
  homeAgentId:p.registeredHomeAgentId,settingsProfile:native.settingsProfile,inputHashes:native.inputHashes,
  originalGeneratedManifest:regional.sourceManifest,originalGeneratedManifestSha256:regional.sourceManifestSha256,
  sourceSha256:{...p.sourceSha256,'scripts/prepare-native-regional-hero-runtime.mjs':await hash(new URL(import.meta.url).pathname)},
  nativeActivationQualified:false,continuousPositionQualified:false,ownerPublished:false,browserUsed:false,nativeProcessesStarted:0,goalComplete:false};
await writeFile(reportName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({regionalHeroRuntimeInputsPrepared:true,region:report.region,clock:report.destinationClockMs,homeAgentId:report.homeAgentId,records:records.length}));
