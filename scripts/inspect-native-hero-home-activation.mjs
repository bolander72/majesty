#!/usr/bin/env node
// Verify original native-guild activation in the actual connected journey:
// every actor record stays exact, with precisely one scheduler append.
import assert from 'node:assert/strict';
import {heroCapturedJournalView} from './lib/hero-captured-journal-view.mjs';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {checkpointChunks,checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentQueues,checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';

const [manifestName,importName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-home-activation-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bound(v){assert.equal((await lstat(v.filename)).size,v.bytes);assert.equal(await hash(v.filename),v.sha256);}
const m=await json(manifestName),q=await json(importName);
assert.equal(q.nativeConnectedHeroHomeImportQualified,true);assert.equal(q.manifest.filename,resolve(manifestName));assert.equal(q.manifest.sha256,await hash(manifestName));
for(const [n,digest]of Object.entries(q.sourceSha256))assert.equal(await hash(n),digest);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.activateHome,true);assert.equal(m.nativeSelectedHeroHomeActivationBoundaryObserved,true);
assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.publicationWorkerTerminal,true);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.publicationWorkerAbsent,true);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
const input=m.homeArrivalWorlds.Hero_Return_Home_Imported,refused=m.homeActivationWorlds.Hero_Return_Home_Activation_Refused,active=m.homeActivationWorlds.Hero_Return_Home_Active;
for(const row of [input,refused,active,m.publication,m.secondPublication])await bound(row);
const first=await json(m.publication.filename),second=await json(m.secondPublication.filename);
const {unitId:hero,agentId:agent}=q.actualAlias;assert.deepEqual(m.homeImportedAliases,[hero,agent]);
const worlds=[],states=[],maps=[];
async function records(s){const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
for(const [i,row]of [input,refused,active].entries()){
 const s=await stoppedFileSource(row.filename);worlds.push(s);maps.push(await records(s));
 states.push(await connectedWorldState(row.filename,{unscheduledAgents:i===2?[]:[agent]}));
 assert.equal(states[i].clock,103500);
 await verifyRegisteredHeroSnapshot(first.identity,q.actualAlias,q.homeAlias,s,true,'0_0');
 assert.equal(await checkpointNextAgentId(s),agent+1);
}
await verifyEntitySnapshot(first.identity,q.actualAlias,worlds[2],true,q.homeAlias);
compareConnectedWorlds(states[0],states[1]);assert.deepEqual(states[0].roots,states[1].roots);
let exactActivationRecords=0,refusalRecords=0;
for(const map of maps.slice(1))assert.deepEqual([...map.keys()].sort(),[...maps[0].keys()].sort());
for(const [key,row]of maps[0])for(const i of [1,2]){const now=maps[i].get(key);assert.equal(now.size,row.size,key);
 for(let at=0;at<row.size;at+=4096){const n=Math.min(4096,row.size-at);assert.deepEqual(await worlds[i].readAt(now.offset+at,n),await worlds[0].readAt(row.offset+at,n),key);}
 if(i===1)refusalRecords++;else exactActivationRecords++;
}
for(const key of ['clock','rng','gameplayRng','rawTerrainSha256'])assert.equal(states[2][key],states[0][key]);
assert.deepEqual(states[2].roots.filter(r=>r.tag!=='GPL '),states[0].roots.filter(r=>r.tag!=='GPL '));
const queueRows=[];
for(const s of [worlds[0],worlds[2]]){const rows=[];for await(const v of checkpointAgentQueues(s)){assert.ok(rows.length<8192);rows.push(v);}queueRows.push(rows);}
const queued=queueRows[1].filter(v=>v.agentId===agent);assert.equal(queued.length,1);assert.equal(queued[0].type,'queued-agent');
assert.ok(!queueRows[0].some(v=>v.agentId===agent));
const semantic=v=>v.type==='queued-agent'?{type:v.type,queue:v.queue,index:v.index,agentId:v.agentId}:{type:v.type,activeQueue:v.activeQueue};
assert.deepEqual(queueRows[1].filter(v=>v.agentId!==agent).map(semantic),queueRows[0].map(semantic));
async function root(s,tag){let result;for await(const c of checkpointChunks(s))if(c.tag===tag){assert.equal(result,undefined);result=c;}assert.ok(result);return result;}
const b=await root(worlds[0],'GPL '),a=await root(worlds[2],'GPL '),item=queued[0],insertion=item.offset-a.offset;
assert.equal(a.size,b.size+4);assert.equal(a.version,b.version);assert.equal(a.count,b.count);
assert.equal(item.index,queueRows[0].filter(v=>v.type==='queued-agent'&&v.queue===item.queue).length);
assert.ok(insertion>=32&&insertion<b.size+16);
const patches=[];
for(const [at,increment,expected]of [[4,4,b.size],[16,4,b.size],[28,4,null],
 [item.offset-(item.index+1)*4-a.offset,1,item.index]]){
 const old=Buffer.from(await worlds[0].readAt(b.offset+at,4)).readUInt32LE(0);if(expected!==null)assert.equal(old,expected);
 const bytes=Buffer.alloc(4);bytes.writeUInt32LE(old+increment);patches.push({at,bytes});
}
assert.equal(Buffer.from(await worlds[2].readAt(a.offset+insertion,4)).readUInt32LE(0),agent);
for(let at=0;at<b.size+16;){const n=Math.min(4096,b.size+16-at,at<insertion?insertion-at:Infinity),bytes=Uint8Array.from(await worlds[0].readAt(b.offset+at,n));
 for(const patch of patches)for(let j=0;j<4;j++){const i=patch.at+j-at;if(i>=0&&i<n)bytes[i]=patch.bytes[j];}
 assert.deepEqual(await worlds[2].readAt(a.offset+at+(at>=insertion?4:0),n),bytes,'Complete original pending scheduler append');at+=n;
}
const log=await readFile(m.log,'utf8');assert.equal(await hash(m.log),m.logSha256);
assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from/.test(log));
const activation=`[streaming] Hero native home activated hero=${hero} agent=${agent} home=469/7 clock=103500 footprint=4 drawing=1 queued=1 orders-admitted=1 original-collision=1 original-postload=1 completed-model-step-cached=1 native-ai-ungated=1 owner-published=0 result=pass`;
const held=`[frontier] Hero return home activation held serial=2 region=0_0 hero=${hero} agent=${agent} home=469/7 clock=103500 wrong-alias-refused=1 wrong-clock-refused=1 duplicate-refused=1 remote-route-refused=1 fresh-native-binding=1 ordinary-ticks=0 phase=7 pending=0 owner-published=0 result=pass`;
assert.equal(log.split(activation).length-1,1);assert.equal(log.split(held).length-1,1);assert.ok(log.indexOf(activation)<log.indexOf(held));
const capturedJournal=await heroCapturedJournalView(m,second);
assert.deepEqual((await readdir(capturedJournal)).sort(),Object.keys(second.journalSha256).sort());
for(const [n,digest]of Object.entries(second.journalSha256))assert.equal(await hash(join(capturedJournal,n)),digest);
assert.equal(await hash(second.captured.filename),second.captured.sha256);assert.equal(await hash(second.marker.filename),second.marker.sha256);
const sourceSha256={...q.sourceSha256},pending=[resolve('scripts/inspect-native-hero-home-activation.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);
 const digest=await hash(n);if(sourceSha256[name])assert.equal(sourceSha256[name],digest);sourceSha256[name]=digest;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,capturedJournalIsHistorical:m.publishHome===true,nativeConnectedHeroHomeActivationQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 importQualification:{filename:resolve(importName),sha256:await hash(importName)},sourceSha256,actualAlias:q.actualAlias,homeAlias:q.homeAlias,
 importedWorld:input,refusedWorld:refused,activeWorld:active,homeClock:103500,exactActivationRecords,refusalRecords,
 completeScriptRootQualified:true,otherWorldRootsAndRngExact:true,originalCollisionAndPostloadQualified:true,
 nativeAIGuardInstalled:false,remoteRouteRefused:true,freshNativeBindingQualified:true,originalAIScheduled:true,homePausedBeforeFirstTick:true,
 nativeSessionTerminal:true,ownedProducerAbsent:true,publicationWorkerTerminal:true,publicationWorkerAbsent:true,
 journalUnchanged:true,selectedJournalRevision:3,returnOwnerTransferred:false,retiredPairPublished:false,homewardGameplayResumed:false,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeAndPublisherRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),
 browserUsed:false,realOPFSDurabilityQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedHeroHomeActivationQualified:true,exactActivationRecords,refusalRecords,originalAIScheduled:true,homewardGameplayResumed:false}));
