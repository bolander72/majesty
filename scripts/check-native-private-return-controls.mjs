#!/usr/bin/env node
// Corrupt only disposable copied profiles/manifests; never launch the game.
import {readFile,writeFile,mkdtemp,mkdir,copyFile,open} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyPrivateReturn} from './check-native-private-return.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [manifestName,output]=process.argv.slice(2);
if(!manifestName||!output||process.argv.length!==4)throw Error('Usage: <terminal private-return manifest> <fresh output>');
const baseline=await verifyPrivateReturn(manifestName),m=baseline.fixture,sha=b=>createHash('sha256').update(b).digest('hex');
const capsule=JSON.parse(await readFile(m.privateReturnPacket.returnReport,'utf8'));
const receipt=JSON.parse(await readFile(m.selectedRevisionExport.receipt,'utf8')),
  markerName=join(receipt.revisionDirectory,'Frontier_Revision.checkpoint'),marker=await readFile(markerName);
async function changeWord(profile,name,at,value) {
  const f=await open(join(profile,name),'r+'),bytes=Buffer.alloc(4);bytes.writeUInt32LE(value>>>0);
  try{await f.write(bytes,0,4,at);}finally{await f.close();}
}
async function editLog(r,fn){const s=await readFile(r.log,'utf8');await writeFile(r.log,fn(s));}
const cases=[
  ['unfinished native process',async r=>{r.nativeSessionTerminal=false;}],
  ['unsuccessful native exit',async r=>{r.nativeExitCode=1;}],
  ['missing capsule binding',async r=>{delete r.privateReturnPacket;}],
  ['changed capsule digest',async r=>{r.privateReturnPacket.returnReportSha256='0'.repeat(64);} ],
  ['invented complete return',async r=>{r.privateReturnPacket.nativeReturnQualified=true;}],
  ['stale selected receipt',async r=>{r.privateReturnPacket.receipt+='.old';}],
  ['changed plan digest',async r=>{r.privateReturnPacket.planSha256='0'.repeat(64);} ],
  ['missing native source provenance',async r=>{r.nativeSourceSha256={};}],
  ['wrong exporter provenance',async r=>{r.privateReturnPacket.sourceSha256='0'.repeat(64);} ],
  ['allocation differs from live counter',async r=>{await editLog(r,s=>s.replace('source-agent=79 unit=2142 agent=72','source-agent=79 unit=2143 agent=72'));}],
  ['wrong live timer age',async r=>{await changeWord(r.profile,'Return_GPL_Observed.bin',57,4000);}],
  ['wrong receiving ground',async r=>{await changeWord(r.profile,'Return_Unit_Observed.bin',68,74421);}],
  ['retired leader reference',async r=>{await changeWord(r.profile,'Return_GPL_Observed.bin',816,2);}],
  ['premature private native ID',async r=>{await changeWord(r.profile,'Return_Unit_Input.bin',36,2142);}],
  ['changed authenticated packet edit',async r=>{
    const name='Native_Return_Packet.bin',p=join(r.profile,name),b=await readFile(p);
    b.writeUInt32LE(99,44+375+1428+588+16);await writeFile(p,b);
    r.privateReturnPacket.sha256=sha(b);r.inputHashes[name]=sha(b);
  }],
  ['missing registry cleanup',async r=>{await editLog(r,s=>s.replace('script-equal=1 absent=1 groups=1','script-equal=1 absent=1 groups=0'));}],
  ['false actor activation claim',async r=>{await editLog(r,s=>s.replace('active=0 result=pass','active=1 result=pass'));}],
];
if(baseline.commandsRestored) {
  const path=capsule.plan.navigation.find(n=>n.kind===4),shift=(baseline.commands.collisionValidatedWaypoints-path.count)*8,
    follow=capsule.plan.entries.find(e=>e.kind===6),move=capsule.plan.entries.find(e=>e.kind===2);
  cases.push(
    ['wrong command mode',async r=>{r.restoreReturnCommands=false;}],
    ['missing original resolver choice',async r=>{await editLog(r,s=>s.replace('observed=1 original=1','observed=0 original=1'));}],
    ['reuse occupied requested endpoint',async r=>{await editLog(r,s=>s.replace(/resolved=\d+,\d+/,'resolved=360,135'));}],
    ['missing waypoint collision qualification',async r=>{await editLog(r,s=>s.replace('validated=38','validated=37'));}],
    ['native order storage still owned',async r=>{await editLog(r,s=>s.replace('all-extents-freed=1 result=pass','all-extents-freed=0 result=pass'));}],
    ['wrong Move destination',async r=>{await changeWord(r.profile,'Return_Orders_Observed.bin',move.offset+104,3768320);}],
    ['lost command dispatch age',async r=>{await changeWord(r.profile,'Return_Orders_Observed.bin',36,4000);}],
    ['stale Follow unit target',async r=>{await changeWord(r.profile,'Return_Orders_Observed.bin',follow.offset+100+shift,497);}],
    ['retained source waypoint',async r=>{await changeWord(r.profile,'Return_Orders_Observed.bin',path.pathOffset,115);}],
  );
}
const results=[];
for(const [name,change] of cases) {
  const root=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-original-source-return-controls-')),
    profile=join(root,'frontier_0_0'),r=structuredClone(m);await mkdir(profile);
  const files=new Set([...Object.keys(m.inputHashes),'Documents/My Games/MajestyHD/SaveGame/Joint_Departed_Reload.GMP',
    ...['Unit','GPL'].flatMap(k=>['Input','Observed'].map(p=>`Return_${k}_${p}.bin`))]);
  if(baseline.commandsRestored)files.add('Return_Orders_Observed.bin');
  for(const file of files){await mkdir(dirname(join(profile,file)),{recursive:true});await copyFile(join(m.profile,file),join(profile,file));}
  r.profile=profile;r.fixture=root;r.log=join(root,'Owned_Native_Log.txt');await copyFile(m.log,r.log);
  const valid=join(root,'Owned_Valid_Manifest.json');await writeFile(valid,JSON.stringify(r)+'\n',{flag:'wx'});
  const accepted=await verifyPrivateReturn(valid);assert.equal(accepted.qualified,true);
  await change(r);const copy=join(root,'Owned_Native_Manifest.json');await writeFile(copy,JSON.stringify(r)+'\n',{flag:'wx'});
  let reason='';try{await verifyPrivateReturn(copy);}catch(e){reason=e.message;}
  assert.ok(reason,`Control was accepted: ${name}`);assert.deepEqual(await readFile(markerName),marker);
  results.push({name,unchangedCopyAccepted:true,rejected:true,reason:reason.slice(0,240),selectedManifestUnchanged:true});
}
await writeFile(output,JSON.stringify({qualified:true,sourceManifest:resolve(manifestName),sourceManifestSha256:sha(await readFile(manifestName)),
  rejected:results.length,cases:results,selectedManifestUnchanged:true,nativeProcessesStarted:0,browserUsed:false,
  sourceSha256:sha(await readFile(new URL(import.meta.url)))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:results.length,selectedManifestUnchanged:true}));
