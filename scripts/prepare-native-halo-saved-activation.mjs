#!/usr/bin/env node
// Bind the production home route to this live, paused original import only.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname,basename,relative} from 'node:path';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {checkpointHaloHomeLeg} from '../web/world/halo-home-route.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const [trialName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-saved-activation-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const producerBytes=await readFile(trialName),m=JSON.parse(producerBytes),p=await json(m.preparation);
assert.ok(producerBytes.length<256*1024);assert.equal(m.nativeOnly,true);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
assert.equal(m.savedActorActivationRequested,true);assert.equal(m.nativeSessionTerminal,false);assert.equal(m.nativeExitCode,null);
process.kill(m.nativePid,0);assert.equal(execFileSync('/bin/ps',['-p',String(m.nativePid),'-o','comm='],{encoding:'utf8',maxBuffer:2048}).trim(),m.privateNativeExecutable);
assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);
await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-session-');assert.equal(m.root,join(m.fixture,'native-world-halo'));
assert.equal(await hash(m.preparation),m.preparationSha256);assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024);
const rows=[...log.matchAll(/Halo saved arrival saved serial=1 key=1_0 hero=(\d+) agent=(\d+) clock=3750 records=4 source-retired=1 original-writer=1 scheduled=0 activation=0 owner-published=0 result=pass/g)];
assert.equal(rows.length,1);const alias={unitId:Number(rows[0][1]),agentId:Number(rows[0][2])},homeAlias={kind:'proxy',unitId:0,agentId:34};
const filename=join(m.root,'frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Saved_Arrival_Imported_1.GMP');
const imported={filename,...await hashNativeFile(filename,{maximum:2*1024*1024})},source=await stoppedFileSource(filename);
assert.equal(await checkpointSavedClock(source),3750);
const route=await checkpointHaloHomeLeg(source,{identity:p.identity,alias,homeAlias,region:'1_0'});
assert.equal(route.nextRegion,'0_0');assert.deepEqual(route.movementPoint,{x:32,y:272});assert.equal(route.taskPreserved,true);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
const sourceSha256={},pending=[resolve('scripts/prepare-native-halo-saved-activation.mjs')];
while(pending.length){const name=pending.pop(),rel=relative(workspace,name);if(sourceSha256[rel])continue;
 assert.ok(!rel.startsWith('..')&&!rel.startsWith('/')&&Object.keys(sourceSha256).length<128);assert.ok((await lstat(name)).size<256*1024);
 const text=await readFile(name,'utf8');sourceSha256[rel]=await hash(name);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(name),match[1]));
}
assert.equal(await hash(filename),imported.sha256);process.kill(m.nativePid,0);await mkdir(directory);
const producer=join(directory,'Producer.before.json');await writeFile(producer,producerBytes,{flag:'wx'});
const text=`halo-session-saved-activate-v1\n1\n1_0\n3750\n32\n272\n0_0\n${imported.sha256}\n`,packet=join(directory,'Halo_Session_Saved_Activate.txt');await writeFile(packet,text,{flag:'wx'});
const report={version:1,nativeSavedActorActivationPrepared:true,producer:{filename:producer,sha256:await hash(producer)},imported,
 route,packet:{filename:packet,...await hashNativeFile(packet)},sourceSha256,compiledSourceSha256:m.compiledSourceSha256,
 nativeProcessesStarted:0,browserUsed:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSavedActorActivationPrepared:true,hero:alias.unitId,agent:alias.agentId,nextRegion:route.nextRegion}));
