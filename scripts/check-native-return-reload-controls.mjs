#!/usr/bin/env node
// Fresh-reload refusal evidence on a single serial disposable copied profile.
import {readFile,writeFile,mkdtemp,mkdir,copyFile,open,readdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyReturnedReload} from './check-native-return-reload.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [manifestName,output]=process.argv.slice(2);
if(!manifestName||!output||process.argv.length!==4)throw Error('Usage: <terminal returned reload manifest> <fresh output>');
const baseline=await verifyReturnedReload(manifestName),m=baseline.fixture,sha=b=>createHash('sha256').update(b).digest('hex');
const producer=JSON.parse(await readFile(m.sourceReturnReport,'utf8')),receipt=JSON.parse(await readFile(producer.fixture.selectedRevisionExport.receipt,'utf8')),
  selectedFiles=(await readdir(receipt.revisionDirectory)).sort(),selectedHashes={};
for(const file of selectedFiles)selectedHashes[file]=sha(await readFile(join(receipt.revisionDirectory,file)));
const root=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-return-reload-controls-')),
  profile=join(root,'frontier_0_0'),logName=join(root,'Owned_Log.txt');await mkdir(profile);
const evolved='Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP',input='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP',
  files=new Set([...Object.keys(m.inputHashes),evolved,...['Unit','GPL','Orders'].map(k=>`Joint_Reload_${k}.bin`)]);
for(const name of files){await mkdir(dirname(join(profile,name)),{recursive:true});await copyFile(join(m.profile,name),join(profile,name));}
const log=await readFile(m.log,'utf8'),changed=new Set();
async function word(name,at,value){changed.add(name);const f=await open(join(profile,name),'r+'),b=Buffer.alloc(4);b.writeUInt32LE(value>>>0);try{await f.write(b,0,4,at);}finally{await f.close();}}
async function logEdit(before,after){assert.ok(log.includes(before),'Control anchor missing');await writeFile(logName,log.replace(before,after));}
const cases=[
  ['unfinished native process',r=>{r.nativeSessionTerminal=false;}],
  ['unsuccessful native exit',r=>{r.nativeExitCode=6;}],
  ['returned reload disabled',r=>{r.reloadReturnedNpc=false;}],
  ['motion disabled',r=>{r.observeMotion=false;}],
  ['saved scheduling disabled',r=>{r.reloadScheduledNpc=false;}],
  ['new queue insertion enabled',r=>{r.scheduleNpc=true;}],
  ['new return activation enabled',r=>{r.activateReturnedNpc=true;}],
  ['private capsule replay enabled',r=>{r.privateReturnPacket={};}],
  ['pinned presentation clock',r=>{r.clockMode='pinned';}],
  ['wrong physical grid bound',r=>{r.physicalGridExtent=256;}],
  ['same producer native process',r=>{r.nativePid=producer.fixture.nativePid;}],
  ['changed producer proof digest',r=>{r.sourceReturnReportSha256='0'.repeat(64);}],
  ['forged producer record with refreshed digest',async r=>{const p=structuredClone(producer);p.after.records.Unit.sha256='0'.repeat(64);const b=Buffer.from(JSON.stringify(p)),name=join(root,'Forged_Return_Proof.json');await writeFile(name,b);r.sourceReturnReport=name;r.sourceReturnReportSha256=sha(b);}],
  ['another qualified producer binding',r=>{r.sourceManifest+='.old';}],
  ['retired identity reused',r=>{r.unitId=2101;}],
  ['different native source',r=>{r.nativeSourceSha256={};}],
  ['different native executable',r=>{r.nativeExecutableSha256AtLaunch='0'.repeat(64);}],
  ['missing complete original load',()=>logEdit(`visits=${baseline.originalLoadedUnits} retained=`,`visits=${baseline.originalLoadedUnits-1} retained=`)],
  ['queue mutated on reload',()=>logEdit('queued=1 queue-mutated=0','queued=1 queue-mutated=1')],
  ['original commands differ on reload',()=>logEdit('commands-equal=1 scratch-released=1','commands-equal=0 scratch-released=1')],
  ['hidden new insertion',()=>logEdit('all expectations met','[streaming] Return active unit=2142 agent=72\nall expectations met')],
  ['wrong current UNIT writer',()=>word('Joint_Reload_Unit.bin',60,12156928)],
  ['wrong current script clock',()=>word('Joint_Reload_GPL.bin',57,3900)],
  ['wrong current Orders writer',()=>word('Joint_Reload_Orders.bin',36,4000)],
  ['expected old record with refreshed local digest',async r=>{const name='Script_Composed_Unit_2101_0.bin';await word(name,60,12156928);r.inputHashes[name]=sha(await readFile(join(profile,name)));}],
  ['wrong loaded position with refreshed input digest',async r=>{await word(input,baseline.before.records.Unit.offset+60,12156928);r.inputHashes[input]=sha(await readFile(join(profile,input)));}],
  ['lost saved clock continuity',()=>logEdit('frame=0 clock=16000 fixed=','frame=0 clock=4000 fixed=')],
  ['incomplete resumed movement',()=>logEdit(log.split('\n').find(l=>l.startsWith('[streaming] Joint motion sample elapsed=240 '))+'\n','')],
  ['missing resumed Path dispatch',()=>logEdit(`leaf-returns=${baseline.originalLeafCalls} path=${baseline.originalPathCalls}`,`leaf-returns=${baseline.originalLeafCalls} path=0`)],
  ['no original AI execution',()=>logEdit(`executed=${baseline.originalContextActions} hooks-removed=1`,'executed=0 hooks-removed=1')],
  ['second save altered live state',()=>logEdit('saved=1 state-same=1 hooks-same=1','saved=1 state-same=0 hooks-same=1')],
  ['evolved position rolled back',()=>word(evolved,baseline.after.records.Unit.offset+60,baseline.before.actor.position.x)],
  ['evolved script identity changed',()=>word(evolved,baseline.after.records.GPL.offset,m.agentId+1)],
  ['second save rolled back',async()=>{changed.add(evolved);await copyFile(join(profile,input),join(profile,evolved));}],
];
const results=[];
for(let i=0;i<cases.length;++i) {
  for(const name of changed)await copyFile(join(m.profile,name),join(profile,name));changed.clear();
  await writeFile(logName,log);const r={...structuredClone(m),profile,fixture:root,log:logName},copy=join(root,`Control_${i}.json`);
  await writeFile(copy,JSON.stringify(r)+'\n');assert.equal((await verifyReturnedReload(copy)).qualified,true);
  await cases[i][1](r);await writeFile(copy,JSON.stringify(r)+'\n');
  let reason='';try{await verifyReturnedReload(copy);}catch(e){reason=e.message;}assert.ok(reason,`Accepted reload corruption: ${cases[i][0]}`);
  results.push({name:cases[i][0],unchangedCopyAccepted:true,rejected:true,reason:reason.slice(0,240)});
}
assert.deepEqual((await readdir(receipt.revisionDirectory)).sort(),selectedFiles);
for(const file of selectedFiles)assert.equal(sha(await readFile(join(receipt.revisionDirectory,file))),selectedHashes[file]);
await writeFile(output,JSON.stringify({qualified:true,sourceManifest:resolve(manifestName),sourceManifestSha256:sha(await readFile(manifestName)),
  rejected:results.length,cases:results,selectedFiles:selectedFiles.length,selectedStoreUnchanged:true,disposableProfile:profile,nativeProcessesStarted:0,
  browserUsed:false,sourceSha256:sha(await readFile(new URL(import.meta.url)))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:results.length,selectedFiles:selectedFiles.length,selectedStoreUnchanged:true,nativeProcessesStarted:0,browserUsed:false}));
