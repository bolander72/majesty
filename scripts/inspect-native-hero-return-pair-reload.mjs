#!/usr/bin/env node
// Original reload and normal AI continuation of both committed return worlds.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,checkpointAgentQueues,
 checkpointActorRecords,checkpointAgentValues,checkpointContainerEntries,checkpointAbsentAgentReferences,
 checkpointInventory} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const digest=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function ranges(f,iterator,key){const out=new Map();for await(const r of iterator(f)){const id=key(r);assert.ok(!out.has(id));out.set(id,r);}return out;}
async function exact(a,b,iterator,key){const input=await ranges(a,iterator,key),output=await ranges(b,iterator,key);
 assert.deepEqual([...output.keys()],[...input.keys()]);for(const [id,r]of input){const s=output.get(id);assert.equal(s.size,r.size,'Loaded record size differs: '+id);
  for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await a.readAt(r.offset+at,n),await b.readAt(s.offset+at,n),'Loaded record differs: '+id);}}
 return output;}
async function rest(f){const actor=await checkpointActorRecords(f,504);assert.deepEqual([actor.unit.family,actor.unit.description,actor.unit.agentId,actor.unit.parentUnitId,actor.unit.stateFlags],['VHCL',0x314c5641,28,469,514]);
 const fields=new Map();for await(const v of checkpointAgentValues(f,28))if(!v.path.length&&['home','target','taskname','activescript'].includes(v.attribute))fields.set(v.attribute,v);
 for(const n of ['home','target'])assert.equal(fields.get(n).targetAgentId,7);assert.equal(fields.get('taskname').stringBytes,0);
 const context=fields.get('activescript');assert.equal(context.type,8);assert.deepEqual(context.functions.map(v=>[v.slot,v.name]),[[0,'Rest_at_guild']]);
 const b=await f.readAt(context.stateOffset,16);assert.deepEqual(Array.from({length:4},(_,i)=>new DataView(b.buffer,b.byteOffset,16).getUint32(i*4,true)),[30000,26750,2,0]);
 const members=[];for await(const c of checkpointContainerEntries(f))if(c.type==='member'&&((c.unitId===469&&c.targetUnitId===504)||(c.unitId===504&&c.targetUnitId===469)))members.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
 assert.deepEqual(members,[[469,100,504,1],[469,2,504,1],[504,101,469,1]]);return actor;}
export async function inspectNativeHeroReturnPairReload(homeName,remoteName){
 const names=[homeName,remoteName].map(n=>resolve(n)),manifests=[];for(const n of names)manifests.push(await json(n));
 assert.equal(manifests[0].receipt,manifests[1].receipt);assert.equal(manifests[0].publicationManifest,manifests[1].publicationManifest);
 assert.equal(manifests[0].buildReport,manifests[1].buildReport);assert.equal(manifests[0].nativeExecutableSha256,manifests[1].nativeExecutableSha256);
 assert.deepEqual(manifests[0].nativeSourceSha256,manifests[1].nativeSourceSha256);
 const receipt=await json(manifests[0].receipt),publication=await json(manifests[0].publicationManifest),selected=[];
 assert.equal(receipt.state.revision,2);assert.equal(receipt.state.ownerSide,0);assert.equal(receipt.owner.region,'0_0');
 for(let side=0;side<2;side++)selected.push(await verifyRevisionExport(manifests[0].receipt,side,receipt.worlds[side].sha256));
 const loaded=[],evolved=[],sides=[];
 for(const [side,m]of manifests.entries()){
  assert.deepEqual([m.version,m.phase,m.side,m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.heroReturnPairReloadTrialCompleted,m.stopReason],
   [1,'return-pair-reload',side,true,false,true,0,true,null]);
  const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-return-pair-reload-');assert.equal(m.profile,join(directory,side?'frontier_1_0':'frontier_0_0'));
  assert.equal(await hash(m.receipt),m.receiptSha256);assert.equal(await hash(m.publicationManifest),m.publicationManifestSha256);
  assert.equal(m.publicationManifest,receipt.revisionReport);assert.equal(m.publicationManifestSha256,receipt.revisionReportSha256);
  assert.deepEqual(m.selectedRevisionExports,selected);assert.equal(m.source,selected[side].filename);assert.equal(m.sourceSha256,selected[side].sha256);
  const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);
  assert.equal(await hash(build.log),build.logSha256);await verifyConnectedNativeArtifact(m,build);assert.ok(build.finishedAtMs<=m.startedAtMs);assert.equal(m.nativeSymbolsSha256,build.nativeSymbolsSha256);
  const previous=await json(m.previousManifest);assert.equal(await hash(m.previousManifest),m.previousManifestSha256);
  assert.equal(m.previousManifest,publication[side?'departureManifest':'liveManifest']);assert.equal(m.previousManifestSha256,publication[side?'departureManifestSha256':'liveManifestSha256']);
  assert.equal(m.settingsProfile,previous.profile);assert.deepEqual(m.inputHashes,previous.inputHashes);
  for(const [n,h]of Object.entries(m.inputHashes)){assert.equal(await hash(join(m.settingsProfile,n)),h);assert.equal(await hash(join(m.profile,n)),h);}
  for(const n of ['originalSourceUnchanged','sourceCopyUnchanged','identityUnchanged','originalSettingsUnchanged','publicationUnchanged','receiptUnchanged'])assert.equal(m[n],true);
  const ids=Buffer.alloc(16);[0x32504852,side,side?554:504,side?48:28].forEach((n,i)=>ids.writeUInt32LE(n,i*4));
  assert.equal(m.identity,join(m.profile,'Hero_Return_Pair_Identity.bin'));assert.deepEqual(await readFile(m.identity),ids);assert.equal(await hash(m.identity),m.identitySha256);
  assert.equal(m.script,join(directory,'load-hero-return-pair-reload.script'));assert.equal(await hash(m.script),m.scriptSha256);
  assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');
  assert.ok(log.includes('all expectations met'));assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
  const rows=log.split('\n').filter(l=>l.startsWith('[streaming] Hero return pair '));assert.equal(rows.length,2);
  assert.equal(rows[0],`[streaming] Hero return pair loaded side=${side} clock=${side?24250:31800} hero=${side?554:504} agent=${side?48:28} present=${side?0:1} home=${side?45:7} parent=${side?0:469} queued=${side?0:1} grid-matches=0 original-full-load=1 loaded-saved=1 result=pass`);
  const pattern=new RegExp(`^\\[streaming\\] Hero return pair evolved side=${side} clock=${side?30250:37800} elapsed=6000 hero-returned=(\\d+) other-returned=(\\d+) present=${side?0:1} home=${side?45:7} parent=${side?0:469} queued=${side?0:1} original-ai=1 gate-used=0 evolved-saved=1 hooks-removed=1 travel-qualified=0 result=pass$`),match=rows[1].match(pattern);assert.ok(match);
  const heroCalls=Number(match[1]),otherCalls=Number(match[2]);assert.ok(heroCalls<=65536&&otherCalls>0&&otherCalls<=65536);assert.ok(side?heroCalls===0:heroCalls>0);
  assert.equal(m.saves.length,3);assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Return_Pair_Input.GMP'));assert.equal(await hash(m.sourceCopy),m.sourceSha256);
  const copied=m.saves.find(r=>r.filename===m.sourceCopy);assert.deepEqual([copied.bytes,copied.sha256],[selected[side].bytes,selected[side].sha256]);
  const saves={};for(const label of ['Loaded','Evolved']){const filename=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Return_Pair_'+label+'_'+(side?'Destination':'Source')+'.GMP'),r=m.saves.find(r=>r.filename===filename);assert.ok(r);
   assert.deepEqual(await hashNativeFile(filename),{bytes:r.bytes,sha256:r.sha256,largestRead:4096});saves[label]={record:r,source:await stoppedFileSource(filename)};}
  const a=await stoppedFileSource(m.source),b=saves.Loaded.source,c=saves.Evolved.source;
  assert.equal(await checkpointSavedClock(a),side?24250:31800);assert.equal(await checkpointSavedClock(b),side?24250:31800);assert.equal(await checkpointSavedClock(c),side?30250:37800);
  const units=await exact(a,b,checkpointUnitAgentLinks,r=>r.unitId),agents=await exact(a,b,checkpointAgents,r=>r.agentId),attachments=await exact(a,b,checkpointAttachments,r=>r.kind+':'+r.unitId);
  // Normal original AI added an ORDR before publication; compare the evolved input, not Ready's count.
  assert.deepEqual([units.size,agents.size,attachments.size],side?[443,47,20]:[448,27,28]);
  const queues=async f=>{const out=[];for await(const q of checkpointAgentQueues(f))if(q.type==='queued-agent')out.push([q.queue,q.agentId]);return out;};assert.deepEqual(await queues(b),await queues(a));
  if(!side){await rest(b);await rest(c);assert.equal((await queues(c)).filter(q=>q[1]===28).length,1);}
  else{const afterAgents=await ranges(c,checkpointAgents,r=>r.agentId),afterUnits=await ranges(c,checkpointUnitAgentLinks,r=>r.unitId);
   assert.ok(!afterAgents.has(48)&&!afterUnits.has(554)&&!afterUnits.has(555));assert.equal((await queues(c)).filter(q=>[45,48].includes(q[1])).length,0);
   assert.equal((await checkpointAbsentAgentReferences(c,48)).sites.length,0);
   for(const u of afterUnits.values())assert.notEqual(u.parentUnitId,554);
   for await(const member of checkpointContainerEntries(c))if(member.type==='member')assert.notEqual(member.targetUnitId,554);
   for await(const item of checkpointInventory(c))assert.notEqual(item.ownerUnitId,554);
   const proxy=agents.get(45),after=afterAgents.get(45);assert.equal(proxy.size,453);assert.equal(after.size,453);assert.deepEqual(await b.readAt(proxy.offset,453),await c.readAt(after.offset,453));}
  assert.equal(m.records.length,side?1:2);for(const [name,id]of [['Home',side?45:7],...(!side?[['Agent',28]]:[])]){
   const filename=join(m.profile,'Hero_Return_Pair_'+name+'.GPL'),r=m.records.find(r=>r.filename===filename),expected=agents.get(id);assert.ok(r&&expected&&expected.size<=4096);
   assert.equal(r.bytes,expected.size);assert.equal(r.sha256,digest(await b.readAt(expected.offset,expected.size)));assert.deepEqual(await hashNativeFile(filename),{bytes:r.bytes,sha256:r.sha256,largestRead:r.bytes});}
  assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=18);
  for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
  assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=35000);
  loaded.push({source:b});evolved.push({source:c});sides.push({side,sourceManifest:names[side],sourceManifestSha256:await hash(names[side]),
   loadedWorld:saves.Loaded.record,evolvedWorld:saves.Evolved.record,typedUnitsExact:units.size,typedAgentsExact:agents.size,attachmentsExact:attachments.size,
   originalHeroCalls:heroCalls,originalOtherCalls:otherCalls,startClockMs:side?24250:31800,endClockMs:side?30250:37800,
   maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),nativePid:m.nativePid});
 }
 assert.notEqual(sides[0].nativePid,sides[1].nativePid);assert.ok(manifests[0].finishedAtMs<=manifests[1].startedAtMs);
 for(const pair of [loaded,evolved])await verifyEntityOwnership(receipt.identity,receipt.state.aliases,receipt.state.referenceBindings,pair,0,receipt.state.homeAliases);
 return {version:1,actualRegisteredHeroReturnFreshPairedNativeReloadQualified:true,actualRegisteredHeroReturnPairedOriginalAiContinuationQualified:true,
  scope:'Actual committed revision2 reloads through two sequential fresh original loaders. Every typed UNIT/GPL/ORDR/CONT record and queue matches before updates. Home504/GPL28 resumes original Rest_at_guild inside registered469/GPL7 with reciprocal rosters and one queue. Remote554/GPL48 stays absent and pure45 stays inert/exact. Both worlds advance6000ms under original agent methods; one observer delegates unchanged and is removed. Actual Loaded/Evolved pairs pass single-owner checks. No full rest completion, continuous seam, browser loading, full campaign or repeated resource bound.',
  receipt:manifests[0].receipt,receiptSha256:manifests[0].receiptSha256,publication:manifests[0].publicationManifest,publicationSha256:manifests[0].publicationManifestSha256,
  selectedOwner:receipt.owner,revision:2,sides,nativeExecutableSha256:manifests[0].nativeExecutableSha256,nativeSourceSha256:manifests[0].nativeSourceSha256,nativeSymbolsSha256:manifests[0].nativeSymbolsSha256,
  fullRestCompletionQualified:false,heroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0,maximumSampledRssBytes:Math.max(...sides.map(s=>s.maximumSampledRssBytes))};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [home,remote,out]=process.argv.slice(2);assert.equal(process.argv.length,5,'Usage: <home reload> <remote reload> <fresh proof>');
 const r=await inspectNativeHeroReturnPairReload(home,remote);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualRegisteredHeroReturnFreshPairedNativeReloadQualified:true,actualRegisteredHeroReturnPairedOriginalAiContinuationQualified:true,
  revision:2,ownerRegion:'0_0',exactTypedUnits:r.sides.map(s=>s.typedUnitsExact),heroCrossingQualified:false,browserUsed:false}));
}
