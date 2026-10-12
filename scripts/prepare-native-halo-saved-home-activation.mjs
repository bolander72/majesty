#!/usr/bin/env node
// Bind original home activation to the actual live, paused return import.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname,basename,relative} from 'node:path';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/family-order-entries.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const [trialName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-saved-home-activation-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const producerBytes=await readFile(trialName),m=JSON.parse(producerBytes),p=await json(m.preparation);
assert.ok(producerBytes.length<256*1024);assert.equal(m.nativeOnly,true);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
assert.equal(m.savedActorHomeActivationRequested,true);assert.equal(m.nativeSessionTerminal,false);assert.equal(m.nativeExitCode,null);
process.kill(m.nativePid,0);assert.equal(execFileSync('/bin/ps',['-p',String(m.nativePid),'-o','comm='],{encoding:'utf8',maxBuffer:2048}).trim(),m.privateNativeExecutable);
assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);
await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-session-');assert.equal(m.root,join(m.fixture,'native-world-halo'));
assert.equal(await hash(m.preparation),m.preparationSha256);assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024);
const rows=[...log.matchAll(/Halo saved home arrival saved serial=2 key=0_0 hero=(\d+) agent=(\d+) clock=103500 records=4 original-writer=1 scheduled=0 activation=0 owner-published=0 result=pass/g)];
assert.equal(rows.length,1);const alias={unitId:Number(rows[0][1]),agentId:Number(rows[0][2])},homeAlias={kind:'native',unitId:469,agentId:7};
const filename=join(m.root,'frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Saved_Home_Imported_2.GMP');
const imported={filename,...await hashNativeFile(filename,{maximum:2*1024*1024})},source=await stoppedFileSource(filename);
assert.equal(await checkpointSavedClock(source),103500);
const natives=[],agents=[];let queued=0;
for await(const u of checkpointUnitAgentLinks(source))if(u.unitId===alias.unitId)natives.push(u);
for await(const a of checkpointAgents(source))if(a.agentId===alias.agentId)agents.push(a);
for await(const q of checkpointAgentQueues(source))if(q.type==='queued-agent'&&q.agentId===alias.agentId)++queued;
assert.equal(natives.length,1);assert.equal(agents.length,1);assert.equal(queued,0);
const native=natives[0],agent=agents[0];assert.equal(native.agentId,alias.agentId);assert.equal(native.parentUnitId,0);assert.equal(native.stateFlags&4,0);
assert.equal(native.family,p.identity.actor.family);assert.equal(native.description,p.identity.actor.description);assert.equal(native.playerNumber,p.identity.actor.playerNumber);
assert.equal(agent.unitId,alias.unitId);assert.equal(agent.deleted,false);
await verifyRegisteredHeroSnapshot(p.identity,alias,homeAlias,source,true,'0_0');
const kinds=[];for await(const e of checkpointActorOrderEntries(source,alias.unitId))if(e.type==='entry')kinds.push(e.kind);assert.deepEqual(kinds,[2,4,7]);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
const sourceSha256={},pending=[resolve('scripts/prepare-native-halo-saved-home-activation.mjs')];
while(pending.length){const name=pending.pop(),rel=relative(workspace,name);if(sourceSha256[rel])continue;
 assert.ok(!rel.startsWith('..')&&!rel.startsWith('/')&&Object.keys(sourceSha256).length<128);assert.ok((await lstat(name)).size<256*1024);
 const text=await readFile(name,'utf8');sourceSha256[rel]=await hash(name);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(name),match[1]));
}
assert.equal(await hash(filename),imported.sha256);process.kill(m.nativePid,0);await mkdir(directory);
const producer=join(directory,'Producer.before.json');await writeFile(producer,producerBytes,{flag:'wx'});
const text=`halo-session-saved-home-activate-v1\n2\n0_0\n103500\n113500\n${imported.sha256}\n`,packet=join(directory,'Halo_Session_Saved_Home_Activate.txt');await writeFile(packet,text,{flag:'wx'});
const report={version:1,nativeSavedHomeActivationPrepared:true,producer:{filename:producer,sha256:await hash(producer)},imported,
 alias,homeAlias,ticks:200,packet:{filename:packet,...await hashNativeFile(packet)},sourceSha256,compiledSourceSha256:m.compiledSourceSha256,
 nativeProcessesStarted:0,browserUsed:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSavedHomeActivationPrepared:true,hero:alias.unitId,agent:alias.agentId,ticks:200}));
