#!/usr/bin/env node
// Bind four actual stopped-source command payloads for the original native reader.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointAttachments} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from './lib/native-crossing-order-entries.mjs';
const hash = async n => (await hashNativeFile(n)).sha256;
const preparations = ['output/native-queue-entry-preparation-001/prepared.json',
  'output/native-outdoor-marker-clock-preparation-001/prepared.json',
  'output/native-wait-effect-clock-preparation-002/prepared.json'];
const preps = await Promise.all(preparations.map(async n => JSON.parse(await readFile(n,'utf8'))));
for(const prep of preps) {
  assert.equal(await hash(prep.source.filename),prep.source.sha256);
  assert.equal(await hash(prep.sourceProof),prep.sourceProofSha256);
  for(const [name,digest] of Object.entries(prep.sourceSha256)) assert.equal(await hash(name),digest);
  assert.deepEqual(prep.source,preps[0].source);
}
const proof=JSON.parse(await readFile(preps[0].sourceProof,'utf8'));
assert.equal(proof.originalHeroOutdoorDepartureStateQualified,true);
assert.equal(await hash(proof.manifest),proof.manifestSha256);
const manifest=JSON.parse(await readFile(proof.manifest,'utf8'));
assert.equal(manifest.nativeSessionTerminal,true); assert.equal(manifest.nativeExitCode,0);
try {process.kill(manifest.nativePid,0); throw Error('Source native process remains live');}
catch(error) {if(error.code!=='ESRCH') throw error;}
const source=await stoppedFileSource(preps[0].source.filename), rows=[], attachments=new Map();
for await(const a of checkpointAttachments(source)) if(a.kind==='ORDR'&&[504,527,528,529].includes(a.unitId)) {
  assert(!attachments.has(a.unitId)); attachments.set(a.unitId,a);
}
const files=[preps[0].orderPayload,preps[1].orderPayload,...preps[2].effects.map(e=>e.orderPayload)];
const ids=[504,527,528,529], kinds=[[4,7],[5],[9],[9]], requested=[454,202,161,161];
const parts=[Buffer.from('NOP1'),Buffer.from([4,0,0,0])];
for(let i=0;i<ids.length;++i) {
  const id=ids[i],a=attachments.get(id); assert(a); assert.equal(a.components.length,1);
  const payload=Buffer.from(await source.readAt(a.primary.offset+16,a.primary.size));
  assert.equal(payload.length,files[i].bytes); assert.equal(await hash(files[i].filename),files[i].sha256);
  assert.deepEqual(payload,await readFile(files[i].filename));
  const entries=[]; for await(const e of checkpointActorOrderEntries(source,id)) if(e.type==='entry') entries.push(e);
  assert.deepEqual(entries.map(e=>e.kind),kinds[i]);
  const header=Buffer.alloc(4); header.writeUInt32LE(payload.length); parts.push(header,payload);
  rows.push({unitId:id,payload:files[i],kinds:kinds[i],requestedBytes:requested[i],
    entries:entries.map(e=>({bank:e.bank,index:e.index,kind:e.kind,bodyOffset:e.offset-(a.primary.offset+16)}))});
}
const output='output/native-outdoor-order-payloads-001.bin';
await writeFile(output,Buffer.concat(parts),{flag:'wx'});
const result={version:1,actualSourcePayloadsQualified:true,source:preps[0].source,sourceProof:preps[0].sourceProof,
  sourceProofSha256:preps[0].sourceProofSha256,preparations:Object.fromEntries(await Promise.all(preparations.map(async n=>[n,await hash(n)]))),
  payloads:rows,fixture:{filename:output,sha256:await hash(output),bytes:Buffer.concat(parts).length},
  sourceSha256:Object.fromEntries(await Promise.all(['scripts/prepare-native-outdoor-order-payloads.mjs',
    'scripts/lib/native-crossing-order-entries.mjs'].map(async n=>[n,await hash(n)]))),
  nativeReaderExecuted:false,heroTransferred:false,browserUsed:false};
await writeFile('output/native-outdoor-order-payloads-001-prepared.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({actualSourcePayloadsQualified:true,payloads:rows.map(r=>({unitId:r.unitId,kinds:r.kinds,requestedBytes:r.requestedBytes}))}));
