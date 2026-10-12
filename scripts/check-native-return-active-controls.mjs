#!/usr/bin/env node
// Serial stopped-file controls. One disposable profile; no engine/browser launch.
import {readFile,writeFile,mkdtemp,mkdir,copyFile,open,readdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyActiveReturn} from './check-native-return-active.mjs';
import {verifyPrivateReturn} from './check-native-private-return.mjs';
import {verifyDepartedReload} from './check-native-npc-departed-reload.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits} from '../web/world/checkpoint.mjs';
const [manifestName,output]=process.argv.slice(2);
if(!manifestName||!output||process.argv.length!==4)throw Error('Usage: <terminal active-return manifest> <fresh report>');
const baseline=await verifyActiveReturn(manifestName),m=baseline.fixture,sha=b=>createHash('sha256').update(b).digest('hex');
const root=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-original-source-active-controls-')),
  profile=join(root,'frontier_0_0'),logName=join(root,'Owned_Log.txt');await mkdir(profile);
const files=new Set([...Object.keys(m.inputHashes),'Documents/My Games/MajestyHD/SaveGame/Joint_Departed_Reload.GMP',
  'Documents/My Games/MajestyHD/SaveGame/Joint_Return_Ready.GMP','Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP',
  'Return_Orders_Observed.bin',...['Unit','GPL'].flatMap(k=>['Input','Observed'].map(p=>`Return_${k}_${p}.bin`)),
  ...['Unit','GPL','Orders'].map(k=>`Return_Active_${k}.bin`)]);
for(const file of files){await mkdir(dirname(join(profile,file)),{recursive:true});await copyFile(join(m.profile,file),join(profile,file));}
const receipt=JSON.parse(await readFile(m.selectedRevisionExport.receipt,'utf8')),
  selectedFiles=(await readdir(receipt.revisionDirectory)).sort(),selectedHashes={};
for(const file of selectedFiles)selectedHashes[file]=sha(await readFile(join(receipt.revisionDirectory,file)));
const log=await readFile(m.log,'utf8'),ready='Documents/My Games/MajestyHD/SaveGame/Joint_Return_Ready.GMP',evolved='Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP';
let otherDescriptionOffset;
for await(const r of checkpointUnits(await stoppedFileSource(baseline.before.filename)))if(r.primary.words[1]!==baseline.identity.unitId){otherDescriptionOffset=r.components.find(p=>p.tag==='PRIM').offset+32;break;}
const changed=new Set();
async function word(name,at,value){changed.add(name);const f=await open(join(profile,name),'r+'),b=Buffer.alloc(4);b.writeUInt32LE(value>>>0);try{await f.write(b,0,4,at);}finally{await f.close();}}
async function logEdit(before,after){assert.ok(log.includes(before),'Control anchor missing');await writeFile(logName,log.replace(before,after));}
const cases=[
  ['unfinished native process',r=>{r.nativeSessionTerminal=false;}],
  ['unsuccessful native exit',r=>{r.nativeExitCode=6;}],
  ['activation disabled',r=>{r.activateReturnedNpc=false;}],
  ['observation disabled',r=>{r.observeReturnMotion=false;}],
  ['evolved capture disabled',r=>{r.captureReturnEvolved=false;}],
  ['commands disabled',r=>{r.restoreReturnCommands=false;}],
  ['short pinned-clock run',r=>{r.clockMode='pinned';}],
  ['missing capsule binding',r=>{delete r.privateReturnPacket;}],
  ['stale selected binding',r=>{r.privateReturnPacket.receipt+='.old';}],
  ['wrong native provenance',r=>{r.nativeSourceSha256={};}],
  ['forged packet edit with refreshed digest',async r=>{const name='Native_Return_Packet.bin',b=await readFile(join(profile,name));b.writeUInt32LE(99,44+375+1428+588+16);changed.add(name);await writeFile(join(profile,name),b);r.privateReturnPacket.sha256=sha(b);r.inputHashes[name]=sha(b);}],
  ['fresh ID counter mismatch',()=>logEdit('Return active unit=2142 agent=72','Return active unit=2143 agent=72')],
  ['lost physical insertion',()=>logEdit('clock=4000 physical=1 footprint=6','clock=4000 physical=0 footprint=6')],
  ['lost queue preservation',()=>logEdit('queued=1 queues-preserved=1','queued=1 queues-preserved=0')],
  ['wrong restored script age',()=>word('Return_GPL_Observed.bin',57,4000)],
  ['wrong receiving Move goal',()=>word('Return_Orders_Observed.bin',120,3768320)],
  ['missing original goal resolution',()=>logEdit('observed=1 original=1','observed=0 original=1')],
  ['missing full observation',()=>logEdit(log.split('\n').find(l=>l.startsWith('[streaming] Joint motion sample elapsed=240 '))+'\n','')],
  ['lost original Path execution',()=>logEdit('leaf-returns=192 path=37','leaf-returns=192 path=0')],
  ['unbalanced original delegation',()=>logEdit('calls=482 returns=482','calls=482 returns=481')],
  ['incomplete footprint during movement',()=>logEdit('elapsed=128 clock=10400 fixed=11796480,5136384 cells=360,156 physical=1','elapsed=128 clock=10400 fixed=11796480,5136384 cells=360,156 physical=0')],
  ['missing original AI action',()=>logEdit('executed=40 hooks-removed=1','executed=0 hooks-removed=1')],
  ['observer hooks retained',()=>logEdit('clock-advanced=1 hooks-removed=1','clock-advanced=1 hooks-removed=0')],
  ['save altered live state',()=>logEdit('saved=1 state-same=1 hooks-same=1','saved=1 state-same=0 hooks-same=1')],
  ['wrong active writer',()=>word('Return_Active_Unit.bin',60,3768320)],
  ['wrong saved initial position',()=>word(ready,baseline.before.records.Unit.offset+60,3768320)],
  ['unrelated initial record changed',()=>word(ready,otherDescriptionOffset,99)],
  ['wrong evolved position',()=>word(evolved,baseline.after.records.Unit.offset+60,12156928)],
  ['wrong evolved GPL identity',()=>word(evolved,baseline.after.records.GPL.offset,73)],
  ['evolved save rolled back',async()=>{changed.add(evolved);await copyFile(join(profile,ready),join(profile,evolved));}],
];
const results=[];
for(let i=0;i<cases.length;++i) {
  for(const name of changed)await copyFile(join(m.profile,name),join(profile,name));changed.clear();
  await writeFile(logName,log);const r={...structuredClone(m),profile,fixture:root,log:logName},copy=join(root,`Control_${i}.json`);
  await writeFile(copy,JSON.stringify(r)+'\n');assert.equal((await verifyActiveReturn(copy)).qualified,true);
  await cases[i][1](r);await writeFile(copy,JSON.stringify(r)+'\n');
  let reason='';try{await verifyActiveReturn(copy);}catch(e){reason=e.message;}assert.ok(reason,`Accepted corruption: ${cases[i][0]}`);
  results.push({name:cases[i][0],unchangedCopyAccepted:true,rejected:true,reason:reason.slice(0,240)});
}
for(const [name,verify] of [['private cleanup checker',verifyPrivateReturn],['departed-only checker',verifyDepartedReload]]) {
  await assert.rejects(()=>verify(manifestName));results.push({name,rejected:true,reason:'Explicitly refuses active-return mode'});
}
assert.deepEqual((await readdir(receipt.revisionDirectory)).sort(),selectedFiles);
for(const file of selectedFiles)assert.equal(sha(await readFile(join(receipt.revisionDirectory,file))),selectedHashes[file]);
await writeFile(output,JSON.stringify({qualified:true,sourceManifest:resolve(manifestName),sourceManifestSha256:sha(await readFile(manifestName)),
  rejected:results.length,cases:results,selectedFiles:selectedFiles.length,selectedStoreUnchanged:true,disposableProfile:profile,
  nativeProcessesStarted:0,browserUsed:false,sourceSha256:sha(await readFile(new URL(import.meta.url)))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:results.length,selectedFiles:selectedFiles.length,selectedStoreUnchanged:true,nativeProcessesStarted:0,browserUsed:false}));
