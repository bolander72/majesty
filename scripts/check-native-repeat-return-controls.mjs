#!/usr/bin/env node
// Qualify a copied real positive fixture before every evidence mutation.
import {readFile,writeFile,copyFile,mkdtemp,mkdir,readdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRepeatRestoration} from './check-native-repeat-return.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const [manifestName,out]=process.argv.slice(2);if(!manifestName||!out||process.argv.length!==4)throw Error('Usage: <real terminal private manifest> <fresh controls report>');
const original=JSON.parse(await readFile(manifestName)),positive=await verifyRepeatRestoration(manifestName),capsule=JSON.parse(await readFile(original.privateReturnPacket.returnReport)),
  receipt=JSON.parse(await readFile(capsule.plan.receipt));
const canonical={};for(const name of await readdir(receipt.revisionDirectory))canonical[name]=await hashCheckpointSource(await stoppedFileSource(join(receipt.revisionDirectory,name)));
assert.equal(Object.keys(canonical).length,8);
const fixture=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-joint-reload-')),profile=join(fixture,'frontier_0_0');await mkdir(profile);
const files=[...Object.keys(original.inputHashes),'Return_Unit_Input.bin','Return_Unit_Observed.bin','Return_GPL_Input.bin','Return_GPL_Observed.bin','Return_Orders_Observed.bin',
  'Documents/My Games/MajestyHD/SaveGame/Joint_Departed_Reload.GMP'];
const manifest=join(fixture,'controls-manifest.json'),log=join(fixture,'controls-native.log'),sha=b=>createHash('sha256').update(b).digest('hex'),results=[];
const cases=[
  ['wrong-packet-version',async m=>{m.privateReturnPacket.version=1;}],
  ['legacy-leader-in-header',async m=>{await packetEdit(m,44,2073);}],
  ['legacy-agent-in-header',async m=>{await packetEdit(m,48,12);}],
  ['wrong-grid-in-header',async m=>{await packetEdit(m,52,512);}],
  ['stale-source-alias-in-header',async m=>{await packetEdit(m,8,510);}],
  ['truncated-route-claim',async()=>{const s=await readFile(log,'utf8');await writeFile(log,s.replace('count=65 values=','count=64 values='));}],
  ['retired-unit-in-original-writer',async()=>{const file=join(profile,'Return_Unit_Observed.bin'),b=await readFile(file);b.writeUInt32LE(510,36);await writeFile(file,b);}],
  ['missing-command-cleanup',async()=>{const s=await readFile(log,'utf8');await writeFile(log,s.replace(/^\[streaming\] Return commands cleanup.*\n/m,''));}],
];
async function packetEdit(m,at,value) {
  const file=join(profile,'Native_Return_Packet.bin'),bytes=await readFile(file);bytes.writeUInt32LE(value,at);await writeFile(file,bytes);
  // Keep the claimed hashes consistent: semantic plan/header checks must refuse.
  m.inputHashes['Native_Return_Packet.bin']=sha(bytes);m.privateReturnPacket.sha256=sha(bytes);
}
for(const [name,mutate] of cases) {
  for(const file of files){const dest=join(profile,file);await mkdir(dirname(dest),{recursive:true});await copyFile(join(original.profile,file),dest);}
  await copyFile(original.log,log);
  const m=structuredClone(original);m.fixture=fixture;m.profile=profile;m.log=log;
  await writeFile(manifest,JSON.stringify(m));const copied=await verifyRepeatRestoration(manifest);
  assert.deepEqual(copied.identity,positive.identity);assert.equal(copied.routePoints,positive.routePoints);
  await mutate(m);await writeFile(manifest,JSON.stringify(m));let refused=false,reason;
  try{await verifyRepeatRestoration(manifest);}catch(e){refused=true;reason=String(e.message).slice(0,160);}
  assert.equal(refused,true,`Accepted mutated native evidence ${name}`);results.push({name,unchangedCopyQualifiedBeforeMutation:true,refused,reason});
  console.log(JSON.stringify({completed:results.length,total:cases.length,name,refused}));
}
for(const [name,digest] of Object.entries(canonical))assert.equal(await hashCheckpointSource(await stoppedFileSource(join(receipt.revisionDirectory,name))),digest);
assert.equal((await readdir(receipt.revisionDirectory)).length,8);
await writeFile(out,JSON.stringify({qualified:true,scope:'Eight corruptions of real next-crossing private restoration evidence, with an independently qualified unchanged copied fixture before every refusal; all eight canonical revision files unchanged.',
  sourceManifest:resolve(manifestName),negativeControls:results,canonicalFilesUnchanged:8,browserUsed:false,nativeProcessesStarted:0,
  repeatedGameplayCrossingsQualified:false},null,2)+'\n',{flag:'wx'});
