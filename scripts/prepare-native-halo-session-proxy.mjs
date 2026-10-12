#!/usr/bin/env node
// Prepare one inert immutable-home proposal against the actual held neighbour.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {prepareRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const[trialName]=process.argv.slice(2);assert.equal(process.argv.length,3);
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const hash=async n=>(await hashNativeFile(n)).sha256;
const m=await json(trialName),p=await json(m.preparation);
assert.ok(['actor-proxy','actor-epoch','actor-arrival','actor-activation'].includes(m.mode));assert.equal(m.nativeOnly,true);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-session-');assert.equal(m.root,join(m.fixture,'native-world-halo'));
assert.equal(await hash(m.preparation),m.preparationSha256);assert.equal(m.actorPagingRequest.destination,'1_0');
for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(n),h);
const expectedClock=m.mode==='actor-proxy'?0:50;
const profile=join(m.root,'frontier_1_0'),heldName=join(profile,'Documents/My Games/MajestyHD/SaveGame',expectedClock?'Halo_Session_Destination_Epoch_1.GMP':'Halo_Session_Destination_Held_1.GMP');
const held={filename:heldName,...await hashNativeFile(heldName,{maximum:2*1024*1024})},destination=await stoppedFileSource(heldName);
assert.equal(await checkpointSavedClock(destination),expectedClock);
const registered=registeredHeroHome(p.identity),prepared=await prepareRemoteHomeAgent(destination,registered,
 {worldId:registered.record.worldId,contentDigest:registered.record.contentDigest,destinationRegion:'1_0',freshAgentId:1000});
assert.equal(prepared.record.length,453);assert.equal(await hash(heldName),held.sha256);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
const proposalName=join(profile,'Halo_Session_Home_Proposal.GPL'),packetName=join(m.root,'Halo_Session_Home_Proxy.txt'),reportName=join(m.fixture,'Home_Proxy.preparation.json');
for(const n of [proposalName,packetName,reportName])await assert.rejects(lstat(n),e=>e.code==='ENOENT');
await writeFile(proposalName,prepared.record,{flag:'wx'});const proposal={filename:proposalName,...await hashNativeFile(proposalName)};
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-session-proxy.mjs','web/world/remote-home.mjs','web/world/entity-home-ownership.mjs','web/world/hero-home.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeSessionHomeProxyPrepared:true,trial:resolve(trialName),held,clock:expectedClock,registered,proposal,plan:prepared.plan,sourceSha256,
 sourceUnchanged:true,actualJournalUnchanged:true,heroImported:false,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(reportName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const packet=`halo-session-home-proxy-v1\n1\n1_0\n${expectedClock}\n${held.sha256}\n${proposal.sha256}\n${proposal.bytes}\n`;
await writeFile(packetName+'.tmp',packet,{flag:'wx'});await rename(packetName+'.tmp',packetName);
console.log(JSON.stringify({nativeSessionHomeProxyPrepared:true,bytes:proposal.bytes,report:reportName}));
