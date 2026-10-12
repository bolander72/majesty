#!/usr/bin/env node
// Independently recreate the actual return projection and account for every
// imported record, reciprocal roster byte and changed saved-world root.
import assert from 'node:assert/strict';
import {heroCapturedJournalView} from './lib/hero-captured-journal-view.mjs';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {checkpointChunks,checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentValues,
 checkpointContainerEntries,checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';

const [manifestName,pagingName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-home-import-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bound(v){assert.equal((await lstat(v.filename)).size,v.bytes);assert.equal(await hash(v.filename),v.sha256);}
async function small(n){const s=await stoppedFileSource(n);assert.ok(s.size<=65536);const b=Buffer.alloc(s.size);
 for(let at=0;at<s.size;at+=4096)b.set(await s.readAt(at,Math.min(4096,s.size-at)),at);return b;}
const m=await json(manifestName),q=await json(pagingName);
assert.equal(q.nativeConnectedHeroHomePagingQualified,true);assert.equal(q.manifest.filename,resolve(manifestName));assert.equal(q.manifest.sha256,await hash(manifestName));
for(const [n,h]of Object.entries(q.sourceSha256))assert.equal(await hash(n),h);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.importHome,true);assert.equal(m.nativeSelectedHeroHomeImportBoundaryObserved,true);
assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.publicationWorkerTerminal,true);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.publicationWorkerAbsent,true);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
for(const row of [m.homePageInput,m.publication,m.secondPublication,...Object.values(m.homeArrivalWorlds)])await bound(row);
const h=await json(m.homePageInput.filename),first=await json(m.publication.filename),second=await json(m.secondPublication.filename),p=h.returnArrival;
await bound(p.pack);await bound(h.homeSource);await bound(second.captured);
assert.equal(h.ownerManifest,second.ownerManifest);assert.equal(h.journal,second.journal);
const source=await stoppedFileSource(second.captured.filename),home=await stoppedFileSource(h.homeSource.filename);
const options={unitId:second.owner.unitId,freshUnitId:100000,freshAgentId:1000,unitBindings:[],attachedUnitBindings:[],
 sourceClockMs:4350,destinationClockMs:103500,haloRegions:{version:'halo-v1',sourceRegion:'1_0',destinationRegion:'0_0'}};
const context={identity:first.identity,regions:['1_0','0_0'],ownerSide:0,
 aliases:[{unitId:538,agentId:39},{unitId:100000,agentId:1000}],
 homeAliases:[{kind:'proxy',unitId:0,agentId:38},{kind:'native',unitId:469,agentId:7}],referenceBindings:[]};
assert.deepEqual(p.options,options);assert.deepEqual(p.context,context);
const repeated=await prepareCheckpointRegisteredHeroArrival(source,home,options,context);
assert.deepEqual(JSON.parse(JSON.stringify(repeated.plan)),p.plan);
const ordered=[['unit',0],['agent',1],['container',2],['order',3]],words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;};
const total=Object.values(repeated.records).reduce((n,b)=>n+b.length,0);
const pack=Buffer.concat([words([0x3141484d,1,4,4350,103500,538,39,7,100000,1000,0,total]),
 ...ordered.flatMap(([name,kind])=>[words([kind,538,repeated.records[name].length]),Buffer.from(repeated.records[name])])]);
assert.deepEqual(await small(p.pack.filename),pack);assert.equal(pack.length,3016);assert.equal(total,2920);
const log=await readFile(m.log,'utf8');assert.equal(await hash(m.log),m.logSha256);
assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from/.test(log));
const imported=[...log.matchAll(/Hero native home arrival imported source=538\/39 hero=(\d+) agent=(\d+) home=469\/7 clock=103500 records=4 commands=3 exact=1 native-roster=1 script-roster=1 registry-preserved=1 queues-preserved=1 drawing-preserved=1 original-readers=1 scheduled=0 activation=0 owner-published=0 result=pass/g)];
assert.equal(imported.length,1);const [hero,agent]=imported[0].slice(1).map(Number);assert.deepEqual(m.homeImportedAliases,[hero,agent]);
assert.ok(log.includes('payload-bytes=508 exact=1 transferred=1 result=pass'));
const profile=join(m.fixture,'frontier_0_0'),nativeMap=new Map([[100000,hero],[469,469]]),agentMap=new Map([[1000,agent],[7,7]]),expected=new Map(),standalone=[];
for(const [name]of ordered){const bytes=Buffer.from(repeated.records[name]),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.length);
 const put=(at,map)=>{const value=v.getUint32(at,true);assert.ok(map.has(value));v.setUint32(at,map.get(value),true);};
 let key,observed,payload=bytes;
 if(name==='unit'){put(36,nativeMap);for(const e of repeated.plan.edits)if(e.record==='unit'&&e.reason==='native script association')put(e.offset-repeated.plan.ranges.unit.offset,agentMap);
  key='UNIT:'+hero;observed='Hero_Arrival_Arrival_Unit_Observed.UNIT';
 }else if(name==='agent'){for(const e of repeated.plan.edits)if(e.record==='agent'){
   if(e.reason==='script identity'||e.reason.startsWith('script:'))put(e.offset-repeated.plan.ranges.agent.offset,agentMap);
   else if(e.reason==='script native association')put(e.offset-repeated.plan.ranges.agent.offset,nativeMap);}
  key='GPL:'+agent;observed='Hero_Arrival_Arrival_Agent_Observed.GPL';
 }else if(name==='container'){put(0,nativeMap);let at=44;assert.equal(v.getUint32(40,true),2);
  for(let group=0;group<2;group++){const count=v.getUint32(at+4,true);put(at+12,nativeMap);at+=16;
   for(let i=0;i<count;i++,at+=8){put(at,nativeMap);assert.equal(v.getUint32(at+4,true),1);}}
  assert.equal(at,bytes.length);key='CONT:'+hero;observed='Hero_Arrival_Arrival_Container_Observed.bin';payload=bytes.subarray(36);
 }else{put(0,nativeMap);key='ORDR:'+hero;observed='Hero_Arrival_Arrival_Orders_Observed.bin';payload=bytes.subarray(36);}
 let filename=join(profile,observed);
 if(m.importRepeatHome){await bound(m.repeatHomePageInput);const stage=await json(m.repeatHomePageInput.filename);
  assert.equal(stage.nativePid,m.nativePid);assert.equal(stage.fixture,m.fixture);const copy=stage.firstReturnObserved[observed];await bound(copy);filename=copy.filename;}
 assert.deepEqual(await small(filename),payload,name);
 expected.set(key,bytes);standalone.push({filename,...await hashNativeFile(filename)});
}
async function records(s){const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
async function exact(a,ar,b,br,key){assert.equal(br.size,ar.size,key);for(let at=0;at<ar.size;at+=4096){const n=Math.min(4096,ar.size-at);assert.deepEqual(await b.readAt(br.offset+at,n),await a.readAt(ar.offset+at,n),key);}}
async function root(s,tag){let result;for await(const c of checkpointChunks(s))if(c.tag===tag){assert.equal(result,undefined);result=c;}assert.ok(result);return result;}
const names=['Hero_Return_Home_Before','Hero_Return_Home_Refused','Hero_Return_Home_Imported'];
const worlds=[],states=[],maps=[];
for(const [i,name]of names.entries()){const row=m.homeArrivalWorlds[name];worlds.push(await stoppedFileSource(row.filename));
 states.push(await connectedWorldState(row.filename,{unscheduledAgents:i===2?[agent]:[]}));maps.push(await records(worlds[i]));assert.equal(states[i].clock,103500);}
compareConnectedWorlds(states[0],states[1]);assert.deepEqual(states[0].roots,states[1].roots);
assert.deepEqual([...maps[2].keys()].sort(),[...maps[0].keys(),...expected.keys()].sort());
let unchangedRecords=0,refusalRecords=0;
for(const [key,row]of maps[0]){await exact(worlds[0],row,worlds[1],maps[1].get(key),key);refusalRecords++;
 if(!['GPL:7','CONT:469'].includes(key)){await exact(worlds[0],row,worlds[2],maps[2].get(key),key);unchangedRecords++;}}
for(const [key,bytes]of expected){const row=maps[2].get(key);assert.equal(row.size,bytes.length);assert.deepEqual(await worlds[2].readAt(row.offset,row.size),new Uint8Array(bytes),key);}
// Exactly one guild script-list insertion and one reciprocal native member.
async function inserted(row,key,at,values,patches){assert.ok(row.size+8<=4096);const old=await worlds[0].readAt(row.offset,row.size),bytes=new Uint8Array(old.length+8);
 bytes.set(old.subarray(0,at));bytes.set(old.subarray(at),at+8);const v=new DataView(bytes.buffer);
 values.forEach((n,i)=>v.setUint32(at+i*4,n,true));for(const [offset,delta]of patches)v.setUint32(offset,v.getUint32(offset,true)+delta,true);
 const now=maps[2].get(key);assert.equal(now.size,bytes.length);assert.deepEqual(await worlds[2].readAt(now.offset,now.size),bytes,key);}
let memberRoot;for await(const v of checkpointAgentValues(worlds[0],7))if(v.attribute==='members'&&!v.path.length)memberRoot=v;
assert.equal(memberRoot.type,4);assert.equal(memberRoot.childCount,0);const guild=maps[0].get('GPL:7'),list=memberRoot.typeOffset-guild.offset;
await inserted(guild,'GPL:7',list+16,[5,agent],[[0,8],[8,8],[list+4,8],[list+12,1]]);
let group;for await(const c of checkpointContainerEntries(worlds[0]))if(c.unitId===469&&c.groupKind===100&&c.type==='group')group=c;
assert.equal(group.memberCount,0);const cont=maps[0].get('CONT:469'),at=group.offset-cont.offset;
await inserted(cont,'CONT:469',at+16,[hero,1],[[8,8],[cont.primary.offset-cont.offset+4,8],[at+4,1]]);
await verifyRegisteredHeroSnapshot(first.identity,{unitId:hero,agentId:agent},{kind:'native',unitId:469,agentId:7},worlds[2],true,'0_0');
assert.equal(await checkpointNextAgentId(worlds[0]),agent);assert.equal(await checkpointNextAgentId(worlds[2]),agent+1);
assert.equal(states[2].rng,states[0].rng);assert.equal(states[2].gameplayRng,states[0].gameplayRng);assert.equal(states[2].rawTerrainSha256,states[0].rawTerrainSha256);
assert.deepEqual(states[2].queues,states[0].queues);assert.equal(states[2].activeQueue,states[0].activeQueue);
const changed=['MAP ','GPL ','VHCL','ORDR','CONT','ORLS'];assert.deepEqual(states[2].roots.filter(r=>!changed.includes(r.tag)),states[0].roots.filter(r=>!changed.includes(r.tag)));
const mb=await root(worlds[0],'MAP '),ma=await root(worlds[2],'MAP ');assert.equal(mb.size,56);assert.equal(ma.size,56);
const mapBytes=Buffer.from(await worlds[0].readAt(mb.offset+16,56));assert.equal(mapBytes.readUInt32LE(48)+1,hero);mapBytes.writeUInt32LE(hero,48);
assert.deepEqual(Buffer.from(await worlds[2].readAt(ma.offset+16,56)),mapBytes);
// Reconstruct the entire GPL root, including otherwise opaque envelopes.
const bg=await root(worlds[0],'GPL '),ag=await root(worlds[2],'GPL '),agents=[];
for await(const a of checkpointAgents(worlds[0]))agents.push(a);
const following=agents.find(a=>a.agentId>agent),position=following?following.offset-4:agents.at(-1).offset+agents.at(-1).size;
const entry=Buffer.concat([words([agent]),expected.get('GPL:'+agent)]),member=words([5,agent]);
const insertions=[{at:position-bg.offset,bytes:entry},{at:memberRoot.typeOffset+16-bg.offset,bytes:member}].sort((a,b)=>a.at-b.at);
const delta=entry.length+member.length,patches=[];
async function patch(at,increment){const b=Buffer.from(await worlds[0].readAt(bg.offset+at,4));b.writeUInt32LE(b.readUInt32LE()+increment);patches.push({at,bytes:b});}
for(const at of [4,16,28])await patch(at,delta);await patch(agents[0].offset-8-bg.offset,1);await patch(bg.end-12-bg.offset,1);
for(const [at,n]of [[0,8],[8,8],[list+4,8],[list+12,1]])await patch(guild.offset-bg.offset+at,n);
assert.equal(ag.size,bg.size+delta);let written=0;
for(let at=0;at<bg.size+16;){for(const ins of insertions.filter(r=>r.at===at)){assert.deepEqual(Buffer.from(await worlds[2].readAt(ag.offset+written,ins.bytes.length)),ins.bytes);written+=ins.bytes.length;}
 const next=insertions.find(r=>r.at>at)?.at??bg.size+16,n=Math.min(4096,next-at,bg.size+16-at),bytes=Uint8Array.from(await worlds[0].readAt(bg.offset+at,n));assert.ok(n>0);
 for(const p of patches)for(let i=0;i<4;i++){const j=p.at+i-at;if(j>=0&&j<n)bytes[j]=p.bytes[i];}
 assert.deepEqual(await worlds[2].readAt(ag.offset+written,n),bytes,'Complete GPL root');at+=n;written+=n;
}assert.equal(written,ag.size+16);
for(const [tag,key]of [['VHCL','UNIT:'+hero],['ORDR','ORDR:'+hero],['CONT','CONT:'+hero]]){const b=await root(worlds[0],tag),a=await root(worlds[2],tag);
 assert.equal(a.version,b.version);assert.equal(a.count,b.count+1);assert.equal(a.size,b.size+expected.get(key).length+(tag==='CONT'?8:0));}
async function registrations(s){const c=await root(s,'ORLS');assert.equal(c.version,1);assert.equal(c.size,(c.count+1)*4);assert.ok(c.size<=4096);
 const b=Buffer.from(await s.readAt(c.offset+16,c.size)),ids=Array.from({length:c.count+1},(_,i)=>b.readUInt32LE(i*4));assert.equal(ids.shift(),0x5244524f);return ids;}
assert.deepEqual(await registrations(worlds[2]),[...await registrations(worlds[0]),hero]);
const capturedJournal=await heroCapturedJournalView(m,second);
assert.deepEqual((await readdir(capturedJournal)).sort(),Object.keys(second.journalSha256).sort());
for(const [n,digest]of Object.entries(second.journalSha256))assert.equal(await hash(join(capturedJournal,n)),digest);
const sourceSha256={...q.sourceSha256},pending=[resolve('scripts/inspect-native-hero-home-import.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);
 const digest=await hash(n);if(sourceSha256[name])assert.equal(sourceSha256[name],digest);sourceSha256[name]=digest;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,capturedJournalIsHistorical:m.publishHome===true,nativeConnectedHeroHomeImportQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 pagingQualification:{filename:resolve(pagingName),sha256:await hash(pagingName)},sourceSha256,actualAlias:{unitId:hero,agentId:agent},
 homeAlias:{kind:'native',unitId:469,agentId:7},sourceClock:4350,destinationClock:103500,importedRecords:4,standalone,
 unchangedRecords,refusalRecords,completeScriptRootQualified:true,reciprocalGuildMembershipQualified:true,
 otherWorldRootsAndRngExact:true,originalThreeCommandBanksPreserved:true,journalUnchanged:true,homePausedBeforeFirstTick:true,
 homeActivated:false,returnOwnerTransferred:false,retiredPairPublished:false,homewardGameplayResumed:false,
 nativeSessionTerminal:true,ownedProducerAbsent:true,publicationWorkerTerminal:true,publicationWorkerAbsent:true,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeAndPublisherRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),
 browserUsed:false,realOPFSDurabilityQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedHeroHomeImportQualified:true,actualAlias:report.actualAlias,unchangedRecords,refusalRecords,homeActivated:false}));
