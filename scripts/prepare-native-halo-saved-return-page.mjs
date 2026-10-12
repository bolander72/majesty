#!/usr/bin/env node
// Validate both paused sides before original east retirement and home reload.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname,basename,relative} from 'node:path';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointUnits,checkpointContainerEntries,checkpointIncomingAgentReferences} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
const [trialName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-saved-return-page-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const producerBytes=await readFile(trialName),m=JSON.parse(producerBytes),p=await json(m.preparation);
assert.ok(producerBytes.length<256*1024);assert.equal(m.nativeOnly,true);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
assert.equal(m.savedActorReturnPageRequested,true);assert.equal(m.nativeSessionTerminal,false);assert.equal(m.nativeExitCode,null);
process.kill(m.nativePid,0);assert.equal(execFileSync('/bin/ps',['-p',String(m.nativePid),'-o','comm='],{encoding:'utf8',maxBuffer:2048}).trim(),m.privateNativeExecutable);
assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);
await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-session-');assert.equal(m.root,join(m.fixture,'native-world-halo'));
assert.equal(await hash(m.preparation),m.preparationSha256);assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024);
const rows=[...log.matchAll(/Halo saved continuation crossed hero=(\d+) agent=(\d+) proxy=34 clock=(\d+) previous-clock=/g)];assert.equal(rows.length,1);
const alias={unitId:Number(rows[0][1]),agentId:Number(rows[0][2])},clock=Number(rows[0][3]),homeAlias={kind:'proxy',unitId:0,agentId:34};assert.equal(clock,4050);
assert.ok(log.includes('Halo saved continuation held serial=1 key=1_0 clock=4050 phase=3 pending=7'));
const filename=join(m.root,'frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Saved_Continuation_Crossed_1.GMP');
const crossed={filename,...await hashNativeFile(filename,{maximum:2*1024*1024})},source=await stoppedFileSource(filename);
assert.equal(await checkpointSavedClock(source),clock);
await verifyEntitySnapshot(p.identity,alias,source,true,homeAlias);await verifyRegisteredHeroSnapshot(p.identity,alias,homeAlias,source,true,'1_0');
for await(const u of checkpointUnits(source))assert.notEqual(u.primary.words[6],alias.unitId,'Undeclared physical child');
for(const r of (await checkpointIncomingAgentReferences(source,alias.agentId)).sites)assert.equal(r.agentId,alias.agentId,'External script refers to returning hero');
for await(const r of checkpointContainerEntries(source))if(r.type==='member'){
 assert.notEqual(r.targetUnitId,alias.unitId,'External native membership refers to returning hero');
 assert.notEqual(r.unitId,alias.unitId,'Returning hero has undeclared native membership');
}
const marker=join(m.root,'frontier_0_0/Frontier_0_0.checkpoint'),lines=(await readFile(marker,'utf8')).split('\n');
assert.equal(lines.length,6);assert.equal(lines[0],'checkpoint-v1');assert.ok(['0','1'].includes(lines[1]));assert.equal(lines[5],'');
assert.equal(lines[4],`654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:${m.nativeExecutableSha256}`);
const homeName=join(m.root,'frontier_0_0/Documents/My Games/MajestyHD/SaveGame',`Frontier_0_0${lines[1]==='1'?'_Recovery':''}.GMP`),
 homeWorld={filename:homeName,...await hashNativeFile(homeName,{maximum:2*1024*1024})},home=await stoppedFileSource(homeName);
assert.equal(String(homeWorld.bytes),lines[2]);assert.equal(homeWorld.sha256,lines[3]);assert.equal(await checkpointSavedClock(home),103500);
assert.equal(m.actorHeldRequest.clock,103500);
await verifyEntitySnapshot(p.identity,{unitId:508,agentId:25},home,false,{kind:'native',unitId:469,agentId:7});
await verifyRegisteredHeroSnapshot(p.identity,{unitId:508,agentId:25},{kind:'native',unitId:469,agentId:7},home,false,'0_0');
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
const sourceSha256={},pending=[resolve('scripts/prepare-native-halo-saved-return-page.mjs')];
while(pending.length){const name=pending.pop(),rel=relative(workspace,name);if(sourceSha256[rel])continue;
 assert.ok(!rel.startsWith('..')&&!rel.startsWith('/')&&Object.keys(sourceSha256).length<128);assert.ok((await lstat(name)).size<256*1024);
 const text=await readFile(name,'utf8');sourceSha256[rel]=await hash(name);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(name),match[1]));
}
for(const r of [crossed,homeWorld])assert.equal(await hash(r.filename),r.sha256);process.kill(m.nativePid,0);await mkdir(directory);
const producer=join(directory,'Producer.before.json');await writeFile(producer,producerBytes,{flag:'wx'});
const text=`halo-session-saved-return-page-v1\n1\n1_0\n0_0\n4050\n103500\n${crossed.sha256}\n`,packet=join(directory,'Halo_Session_Saved_Return_Page.txt');await writeFile(packet,text,{flag:'wx'});
const report={version:1,nativeSavedActorReturnPagePrepared:true,producer:{filename:producer,sha256:await hash(producer)},crossed,homeWorld,
 alias,homeAlias,sourceClock:4050,destinationClock:103500,packet:{filename:packet,...await hashNativeFile(packet)},sourceSha256,
 compiledSourceSha256:m.compiledSourceSha256,nativeProcessesStarted:0,browserUsed:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSavedActorReturnPagePrepared:true,hero:alias.unitId,agent:alias.agentId,sourceClock:4050,destinationClock:103500}));
