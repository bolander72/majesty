#!/usr/bin/env node
// Independent stopped-save comparison for the actual northbound linked hero.
// Original registry probes are corroboration; ownership remains unpublished.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentValues,
  checkpointAgentQueues,checkpointContainerEntries,checkpointAbsentAgentReferences,checkpointNextAgentId,checkpointChunks} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {ownedDirectory} from './lib/stopped-entity-io.mjs';
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const ids=[481,492,494,495],agents=[17,21],guild=469,guildAgent=7;
async function records(source){
  const rows=new Map();
  const add=(key,r)=>{assert.ok(!rows.has(key),'Duplicate stopped record');assert.ok(rows.size<4096);rows.set(key,r);};
  for await(const u of checkpointUnits(source))add('UNIT:'+u.primary.words[1],u);
  for await(const a of checkpointAgents(source))add('GPL:'+a.agentId,a);
  for await(const a of checkpointAttachments(source))add(a.kind+':'+a.unitId,a);
  return rows;
}
async function exact(a,ar,b,br,key){
  assert.equal(br.size,ar.size,key);
  for(let at=0;at<ar.size;at+=4096){const n=Math.min(4096,ar.size-at);
    assert.deepEqual(await b.readAt(br.offset+at,n),await a.readAt(ar.offset+at,n),`${key} byte ${at}`);}
}
async function rosterPatch(a,ar,b,br,drop,patches,key){
  // Two bounded roster records only. Preserve every other byte, including
  // names, functions and opaque fields; only envelope sizes/counts change.
  assert.ok(ar.size<=4096&&drop>=0&&drop+8<=ar.size);
  const original=await a.readAt(ar.offset,ar.size),expected=new Uint8Array(ar.size-8);
  expected.set(original.subarray(0,drop));expected.set(original.subarray(drop+8),drop);
  const view=new DataView(expected.buffer);
  for(const [offset,delta]of patches){assert.ok(offset+4<=drop);view.setUint32(offset,view.getUint32(offset,true)+delta,true);}
  assert.equal(br.size,expected.length);assert.deepEqual(await b.readAt(br.offset,br.size),expected,key);
}
export async function inspectNativeHaloSourceRetirement(manifestName){
  const m=await json(manifestName),prep=await json(m.preparation);
  assert.equal(m.nativeSourceRetirementRequested,true);assert.equal(m.nativeSourceRetirementTrialCompleted,true);
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
  assert.equal(m.stopReason,null);assert.equal(m.nativeActivationRequested,false);assert.equal(m.nativeReloadRequested,false);
  assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);assert.equal(m.region,'0_0');
  try{process.kill(m.nativePid,0);throw Error('Native evidence process is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
  assert.equal(m.sourceCheckpointUnchanged,true);assert.equal(m.privateNativeExecutableUnchanged,true);
  assert.deepEqual(m.preservedBefore,m.preservedAfter);
  assert.equal(await hash(m.preparation),m.preparationSha256);
  assert.equal(await hash(m.buildReport),m.buildReportSha256);
  assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);
  for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(n),h);
  for(const[n,h]of [['scripts/run-native-halo-bundle.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
  const archive=await json(m.qualifiedDestinationArchive.filename);
  assert.equal(await hash(m.qualifiedDestinationArchive.filename),m.qualifiedDestinationArchive.sha256);
  assert.equal(archive.nativeFreshHaloReloadQualified,true);assert.equal(archive.evolvedClock,1000);
  for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
  // Reader preparation used the prior frozen JS parser. Kind13 support was
  // added after the producer stopped, based on independent original writers.
  // Bind those historical inputs to immutable archive rows, never waive SHA.
  for(const[n,h]of Object.entries(prep.sourceSha256)){
    if(await hash(n)===h)continue;
    assert.equal(n,'web/world/order-entries.mjs','Unexpected preparation source drift');
    const old=archive.sources.find(r=>r.original===resolve(n)&&r.sha256===h);assert.ok(old);
    assert.equal(await hash(old.preserved),h);
  }
  const auditName='output/native-inherited-order-001-observed.json',audit=await json(auditName);
  assert.equal(audit.inheritedFramingQualified,true);assert.equal(audit.fixedBytes,188);assert.equal(audit.completedCalls,2);
  for(const[n,h]of Object.entries(audit.sourceSha256))assert.equal(await hash(n),h);
  assert.equal(await hash(m.log),m.logSha256);const log=await readFile(m.log,'utf8');
  assert.ok(log.includes('Halo source retired clock=60650 units=481,492,494,495 agents=17,21 home=469/7 aliases-absent=1 roster-empty=1 other-registry-preserved=1 other-queues-preserved=1 original-removal=1 before-after-saved=1 original-pause=1 owner-published=0 result=pass'));
  assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
  assert.ok(!/result=fail|abort from/.test(log));
  const snapshots=[m.sourceCheckpoint,m.sourceBeforeCheckpoint,m.retiredSourceCheckpoint],worlds=[];
  for(const r of snapshots){assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);worlds.push(await stoppedFileSource(r.filename));}
  for(const w of worlds)assert.equal(await checkpointSavedClock(w),60650);
  const [input,before,after]=worlds,maps=await Promise.all(worlds.map(records));
  assert.deepEqual([...maps[0].keys()].sort(),[...maps[1].keys()].sort());
  for(const [key,r]of maps[0])await exact(input,r,before,maps[1].get(key),'load '+key);
  const removed=[...ids.map(id=>'UNIT:'+id),...agents.map(id=>'GPL:'+id),...ids.map(id=>'ORDR:'+id),'CONT:481','CONT:492'];
  assert.deepEqual([...maps[2].keys()].sort(),[...maps[1].keys()].filter(k=>!removed.includes(k)).sort());
  for(const key of removed){assert.ok(maps[1].has(key),key);assert.equal(maps[2].has(key),false,key);}
  let unchangedRecords=0;
  for(const [key,r]of maps[2])if(key!=='GPL:'+guildAgent&&key!=='CONT:'+guild){
    await exact(before,maps[1].get(key),after,r,key);unchangedRecords++;
  }
  const homeValues=[];for await(const v of checkpointAgentValues(before,guildAgent))if(v.attribute==='members')homeValues.push(v);
  assert.equal(homeValues.length,2);const child=homeValues.find(v=>v.path.length),root=homeValues.find(v=>!v.path.length);
  assert.deepEqual(child.path,[0]);assert.equal(child.type,5);assert.equal(child.targetAgentId,17);
  assert.equal(root.type,4);assert.equal(root.childCount,1);
  const guildBefore=maps[1].get('GPL:'+guildAgent),guildAfter=maps[2].get('GPL:'+guildAgent),list=root.typeOffset-guildBefore.offset;
  assert.equal(guildAfter.unitId,guild);assert.equal(guildAfter.deleted,false);
  await rosterPatch(before,guildBefore,after,guildAfter,child.typeOffset-guildBefore.offset,
    [[0,-8],[8,-8],[list+4,-8],[list+12,-1]],'Guild script changes only one members entry');
  const values=[];for await(const v of checkpointAgentValues(after,guildAgent))if(v.attribute==='members')values.push(v);
  assert.equal(values.length,1);assert.equal(values[0].type,4);assert.equal(values[0].childCount,0);
  const membership=[];for await(const c of checkpointContainerEntries(before))if(c.unitId===guild&&c.groupKind===100)membership.push(c);
  assert.equal(membership.length,2);const group=membership.find(c=>c.type==='group'),member=membership.find(c=>c.type==='member');
  assert.equal(group.memberCount,1);assert.equal(group.groupOwnerUnitId,guild);assert.equal(member.targetUnitId,481);assert.equal(member.flags,1);
  const cont=maps[1].get('CONT:'+guild),contAfter=maps[2].get('CONT:'+guild);
  await rosterPatch(before,cont,after,contAfter,member.offset-cont.offset,
    [[8,-8],[cont.primary.offset-cont.offset+4,-8],[group.offset-cont.offset+4,-1]],'Guild container changes only one member');
  for await(const u of checkpointUnits(after))assert.ok(!ids.includes(u.primary.words[6]),'Dangling physical parent');
  for await(const c of checkpointContainerEntries(after))assert.ok(!ids.includes(c.unitId)&&!ids.includes(c.groupOwnerUnitId)&&!ids.includes(c.targetUnitId),'Dangling container membership');
  for(const id of agents)assert.equal((await checkpointAbsentAgentReferences(after,id)).sites.length,0,'Dangling script reference');
  let orderReferencesChecked=0;
  for(const [key,r]of maps[2])if(key.startsWith('ORDR:'))for await(const ref of checkpointActorOrderUnitReferences(after,r.unitId)){
    assert.ok(!ids.includes(ref.targetUnitId),'Dangling typed order reference');orderReferencesChecked++;
  }
  async function queues(w){const rows=[];for await(const q of checkpointAgentQueues(w))rows.push(q.type==='queued-agent'?{type:q.type,queue:q.queue,agentId:q.agentId}:{type:q.type,activeQueue:q.activeQueue});return rows;}
  const beforeQueues=await queues(before);for(const id of agents)assert.equal(beforeQueues.filter(q=>q.agentId===id).length,1);
  assert.deepEqual(await queues(after),beforeQueues.filter(q=>!agents.includes(q.agentId)));
  assert.equal(m.frames.length,2);for(const f of m.frames){assert.equal(await hash(f.filename),f.sha256);assert.equal(f.bytes,1440015);}
  assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.finishedAtMs-m.startedAtMs<37000);
  assert.ok(m.resourceSamples.length);for(const s of m.resourceSamples)assert.ok(s.rssBytes<=m.rssCeilingBytes);
  const sourceSha256={};for(const name of ['scripts/inspect-native-halo-source-retirement.mjs','scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs','web/world/order-unit-bindings.mjs','web/world/order-entries.mjs','scripts/audit-native-inherited-order.py','scripts/check-native-order-writers.py','tests/order-entries.test.mjs'])sourceSha256[name]=await hash(name);
  return {version:1,nativeHaloSourceRetirementQualified:true,scope:'Actual stopped crossing source; exact unrelated records and only original guild roster departure. No owner publication or browser qualification.',
    manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,
    sourceClock:60650,removedUnitIds:ids,removedAgentIds:agents,registeredGuild:{unitId:guild,agentId:guildAgent},
    sourceWorld:m.sourceCheckpoint,beforeWorld:m.sourceBeforeCheckpoint,retiredWorld:m.retiredSourceCheckpoint,
    allLoadedRecordsExact:true,unchangedRecords,typedOrderReferencesChecked:orderReferencesChecked,
    guildOnlyExpectedRosterChanges:true,remainingQueuesExact:true,noIncomingTypedReferences:true,
    qualifiedDestinationArchive:m.qualifiedDestinationArchive,inheritedOrderAudit:{filename:resolve(auditName),sha256:await hash(auditName)},nativeSessionTerminal:true,nativeExitCode:0,
    sourceRetired:true,ownerPublished:false,browserUsed:false,goalComplete:false};
}
// The selected-hero driver uses the same original removal methods, following
// the production accepted crossing/save boundary rather than the old fixture.
export async function inspectSelectedSourceRetirement(manifestName){
  const m=await json(manifestName);
  assert.equal(m.retireSource,true);assert.equal(m.selectedHeroBindingTrialQualified,true);
  assert.equal(m.nativeSelectedHeroCrossingQualified,true);assert.equal(m.nativeHeroHeldCaptureQualified,true);
  assert.equal(m.nativeSourceRetirementBoundaryObserved,true);assert.equal(m.nativeHeroSaveHandshakeQualified,false);
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
  assert.equal(m.stopReason,null);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
  for(const key of ['sourceCheckpointUnchanged','copiedCheckpointUnchanged','startupFixtureUnchanged','nativeExecutableUnchanged'])assert.equal(m[key],true);
  try{process.kill(m.nativePid,0);assert.fail('Retirement producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const bound=async r=>{assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);};
  await bound(m.build);await bound(m.startup);await bound(m.sourceCheckpoint);await bound(m.heldSave.checkpoint);await bound(m.heldSave.marker);
  for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(n),h);
  assert.equal(Object.keys(m.compiledSourceSha256).length,54);
  let runner='scripts/run-native-hero-binding.py';
  if(m.postprocessingRequalification){
    const p=m.postprocessingRequalification;assert.equal(p.version,1);assert.equal(p.genericHomeReadyEvents,3);assert.equal(p.nativeProcessesStarted,0);
    await bound(p.original);await bound(p.runtimeRunner);await bound(p.tool);const original=await json(p.original.filename);
    assert.deepEqual(m,{...original,bindingBoundaryObserved:true,selectedHeroBindingTrialQualified:true,postprocessingRequalification:p});
    assert.equal(p.runtimeRunner.sha256,m.runnerSha256);runner=p.runtimeRunner.filename;
  }
  assert.equal(await hash(runner),m.runnerSha256);
  assert.equal(await hash('scripts/lib/native_pair_guard.py'),m.guardSha256);
  assert.equal(await hash('scripts/run-native-regional-home.py'),m.supervisorSha256);
  assert.equal(await hash(m.log),m.logSha256);await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
  const binding=m.runtimeBinding.split('|');assert.equal(binding.length,12);assert.equal(binding[7],'native');
  const hero=Number(binding[3]),agent=Number(binding[4]),home=Number(binding[8]),guild=Number(binding[9]),clock=m.nativeCrossing.clock;
  assert.deepEqual([m.nativeCrossing.unitId,m.nativeCrossing.agentId],[hero,agent]);assert.equal(m.nativeCrossing.region,'0_0');
  assert.equal(m.nativeCrossing.target,'1_0');assert.equal(m.heldSave.clock,clock);
  const refs=[m.heldSave.checkpoint,...['Hero_Source_Before','Hero_Source_Refused','Hero_Source_Retired'].map(n=>m.sourceRetirementSaves[n])];
  const sources=[],maps=[],states=[];for(const r of refs){await bound(r);
    assert.equal(r.filename.startsWith(join(m.fixture,'frontier_0_0','Documents/My Games/MajestyHD/SaveGame')+'/'),true);
    const s=await stoppedFileSource(r.filename);sources.push(s);maps.push(await records(s));states.push(await connectedWorldState(r.filename));
    assert.equal(await checkpointSavedClock(s),clock);}
  let unchangedRecords=0;
  for(let i=1;i<=2;i++){assert.deepEqual([...maps[i].keys()].sort(),[...maps[0].keys()].sort());
    for(const[key,r]of maps[0]){await exact(sources[0],r,sources[i],maps[i].get(key),key);unchangedRecords++;}
    assert.deepEqual(states[i].roots,states[0].roots);}
  const before=sources[2],after=sources[3],old=maps[2],now=maps[3],removed=['UNIT:'+hero,'GPL:'+agent,'CONT:'+hero,'ORDR:'+hero];
  for(const key of removed)assert.ok(old.has(key),key);
  assert.deepEqual([...now.keys()].sort(),[...old.keys()].filter(k=>!removed.includes(k)).sort());
  for(const[key,r]of now)if(key!=='GPL:'+guild&&key!=='CONT:'+home){await exact(before,old.get(key),after,r,key);unchangedRecords++;}
  const values=[];for await(const v of checkpointAgentValues(before,guild))if(v.attribute==='members')values.push(v);
  const root=values.find(v=>!v.path.length),children=values.filter(v=>v.path.length&&v.targetAgentId===agent);
  assert.ok(root&&root.type===4&&root.childCount>0);assert.equal(children.length,1);const child=children[0];assert.equal(child.type,5);
  const ga=old.get('GPL:'+guild),gb=now.get('GPL:'+guild),list=root.typeOffset-ga.offset;
  await rosterPatch(before,ga,after,gb,child.typeOffset-ga.offset,[[0,-8],[8,-8],[list+4,-8],[list+12,-1]],'Only selected guild member is removed');
  const memberships=[];for await(const c of checkpointContainerEntries(before))if(c.unitId===home&&c.groupKind===100)memberships.push(c);
  const group=memberships.find(c=>c.type==='group'),members=memberships.filter(c=>c.type==='member'&&c.targetUnitId===hero);
  assert.ok(group&&group.memberCount>0);assert.equal(members.length,1);assert.equal(members[0].flags,1);
  const ca=old.get('CONT:'+home),cb=now.get('CONT:'+home);
  await rosterPatch(before,ca,after,cb,members[0].offset-ca.offset,[[8,-8],[ca.primary.offset-ca.offset+4,-8],[group.offset-ca.offset+4,-1]],'Only selected native guild member is removed');
  for await(const u of checkpointUnits(after))assert.notEqual(u.primary.words[6],hero,'Dangling physical parent');
  for await(const c of checkpointContainerEntries(after))for(const key of ['unitId','groupOwnerUnitId','targetUnitId'])assert.notEqual(c[key],hero,'Dangling container member');
  assert.equal((await checkpointAbsentAgentReferences(after,agent)).sites.length,0);
  let orderReferencesChecked=0;for(const[key,r]of now)if(key.startsWith('ORDR:'))for await(const ref of checkpointActorOrderUnitReferences(after,r.unitId)){
    assert.notEqual(ref.targetUnitId,hero,'Dangling order target');orderReferencesChecked++;}
  const queueRows=async s=>{const out=[];for await(const q of checkpointAgentQueues(s))out.push(q.type==='queued-agent'?{type:q.type,queue:q.queue,agentId:q.agentId}:{type:q.type,activeQueue:q.activeQueue});return out;};
  const queues=await queueRows(before);assert.equal(queues.filter(q=>q.agentId===agent).length,1);
  assert.deepEqual(await queueRows(after),queues.filter(q=>q.agentId!==agent));
  assert.equal(await checkpointNextAgentId(after),await checkpointNextAgentId(before));
  for(const key of ['clock','rng','gameplayRng','rawTerrainSha256'])assert.equal(states[3][key],states[2][key]);
  assert.deepEqual(states[3].roots.filter(r=>!['GPL ','VHCL','CONT','ORDR','ORLS'].includes(r.tag)),states[2].roots.filter(r=>!['GPL ','VHCL','CONT','ORDR','ORLS'].includes(r.tag)));
  // Compare every byte of each changed root, including opaque manager
  // envelopes. Only original record/roster/queue removal and length/count
  // fields may change. All reads remain bounded; no kingdom buffer is kept.
  const roots=async s=>{const rows=new Map();for await(const r of checkpointChunks(s))if(['GPL ','VHCL','CONT','ORDR','ORLS'].includes(r.tag)){assert.ok(!rows.has(r.tag));rows.set(r.tag,r);}return rows;};
  const br=await roots(before),ar=await roots(after);
  async function changedRoot(tag,removals,changes){
    const b=br.get(tag),a=ar.get(tag);assert.ok(b&&a);assert.equal(a.version,b.version);
    const drops=removals.map(r=>({at:r.offset-b.offset,size:r.size})).sort((x,y)=>x.at-y.at);
    const delta=drops.reduce((n,r)=>n+r.size,0);assert.equal(a.size,b.size-delta);
    const patches=[];for(const[offset,increment]of [[b.offset+4,-delta],...changes]){
      const bytes=Buffer.from(await before.readAt(offset,4));bytes.writeUInt32LE(bytes.readUInt32LE(0)+increment,0);patches.push({at:offset-b.offset,bytes});}
    let at=0,to=0,index=0;while(at<b.size+16){
      if(index<drops.length&&at===drops[index].at){at+=drops[index++].size;continue;}
      const n=Math.min(4096,b.size+16-at,index<drops.length?drops[index].at-at:Infinity);assert.ok(n>0);
      const bytes=Uint8Array.from(await before.readAt(b.offset+at,n));
      for(const p of patches)for(let j=0;j<4;j++)if(p.at+j>=at&&p.at+j<at+n)bytes[p.at+j-at]=p.bytes[j];
      assert.deepEqual(await after.readAt(a.offset+to,n),bytes,tag+' byte '+at);at+=n;to+=n;
    }
    assert.equal(index,drops.length);assert.equal(to,a.size+16);
  }
  for(const[tag,key]of [['VHCL','UNIT:'+hero],['ORDR','ORDR:'+hero]]){
    assert.equal(ar.get(tag).count,br.get(tag).count-1);
    await changedRoot(tag,[old.get(key)],[[br.get(tag).offset+12,-1]]);
  }
  const guildDrop={offset:child.typeOffset,size:8},memberDrop={offset:members[0].offset,size:8};
  assert.equal(ar.get('CONT').count,br.get('CONT').count-1);
  await changedRoot('CONT',[old.get('CONT:'+hero),memberDrop],[[br.get('CONT').offset+12,-1],
    [ca.offset+8,-8],[ca.primary.offset+4,-8],[group.offset+4,-1]]);
  const qs=[];for await(const q of checkpointAgentQueues(before))if(q.agentId===agent)qs.push(q);
  assert.equal(qs.length,1);const q=qs[0],gr=br.get('GPL '),agentRows=[];
  for await(const a of checkpointAgents(before))agentRows.push(a);
  const removedAgent=old.get('GPL:'+agent),gplDelta=removedAgent.size+4+8+4;
  assert.equal(Buffer.from(await before.readAt(removedAgent.offset-4,4)).readUInt32LE(0),agent);
  assert.equal(ar.get('GPL ').count,gr.count);
  await changedRoot('GPL ',[{offset:removedAgent.offset-4,size:removedAgent.size+4},guildDrop,{offset:q.offset,size:4}],
    [[gr.offset+16,-gplDelta],[gr.offset+28,-gplDelta],[agentRows[0].offset-8,-1],
     [ga.offset,-8],[ga.offset+8,-8],[root.typeOffset+4,-8],[root.typeOffset+12,-1],[q.offset-(q.index+1)*4,-1]]);
  const or=br.get('ORLS'),registrationIds=[];assert.equal(or.version,1);assert.equal(or.size,(or.count+1)*4);
  for(let at=0;at<or.size;at+=4096){const b=Buffer.from(await before.readAt(or.offset+16+at,Math.min(4096,or.size-at)));
    for(let j=0;j<b.length;j+=4)registrationIds.push({id:b.readUInt32LE(j),offset:or.offset+16+at+j});}
  assert.equal(registrationIds.shift().id,0x5244524f);assert.equal(new Set(registrationIds.map(r=>r.id)).size,registrationIds.length);
  const removedRegistration=registrationIds.filter(r=>r.id===hero);assert.equal(removedRegistration.length,1);
  assert.equal(ar.get('ORLS').count,or.count-1);
  await changedRoot('ORLS',[{offset:removedRegistration[0].offset,size:4}],[[or.offset+12,-1]]);
  const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/result=fail|abort from|GplException/.test(log));
  assert.ok(log.includes('undeliverable calls: none')&&log.includes('all expectations met'));
  const resource=[...log.matchAll(/Selected hero retired unit=(\d+) agent=(\d+) home=(\d+)\/(\d+) clock=(\d+) .*released-bytes=(\d+) released-blocks=(\d+) released-crt=(\d+) owner-published=0 result=pass/g)];
  assert.equal(resource.length,m.repeatReturn?4:m.repeatDeparture?3:m.retireRemoteSource?2:1);
  const initialResource=resource.filter(r=>Number(r[1])===hero&&Number(r[2])===agent);assert.equal(initialResource.length,1);
  assert.deepEqual(initialResource[0].slice(1,6).map(Number),[hero,agent,home,guild,clock]);
  const released=initialResource[0].slice(6).map(Number);assert.ok(released.every(n=>n>0));
  let paging;
  if(m.destinationPreparation){
    assert.equal(m.nativeSelectedHeroPagingBoundaryObserved,true);assert.equal(m.sourceUnloaded,true);
    assert.equal(m.destinationCopiedUnchanged,true);assert.equal(m.ownerTransferred,m.nativeSelectedHeroResumeBoundaryObserved===true);
    for(const row of [m.destinationPreparation,m.destinationOriginal,m.destinationCopied,m.heldDestination])await bound(row);
    const targetInput=await connectedWorldState(m.destinationCopied.filename,{unscheduledAgents:[34]});
    const targetHeld=await connectedWorldState(m.heldDestination.filename,{unscheduledAgents:[34]});
    const comparison=compareConnectedWorlds(targetInput,targetHeld);
    assert.equal(targetHeld.clock,m.destinationClock);assert.equal(targetHeld.counts.units,targetInput.counts.units);
    const oldWorld=[...log.matchAll(/^\[frontier\] Session released serial=1 region=0_0 roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288 heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) clock=0$/gm)];
    const observer=[...log.matchAll(/^\[frontier\] Session release observer removed serial=1 hooks=\d+ retained-roots=0$/gm)];
    const attached=[...log.matchAll(/^\[frontier\] Session attached serial=1 region=1_0 mode=saved .*$/gm)];
    const held=[...log.matchAll(/^\[frontier\] Hero travel target held serial=1 region=1_0 clock=4050 .*$/gm)];
    assert.equal(oldWorld.length,1);assert.equal(observer.length,1);assert.equal(attached.length,1);assert.equal(held.length,1);
    assert.ok(oldWorld[0].index<observer[0].index&&observer[0].index<attached[0].index&&attached[0].index<held[0].index);
    const memory=oldWorld[0].slice(1).map(Number);assert.ok(memory[0]>memory[1]&&memory[2]>memory[3]);
    assert.ok(log.includes('saved metadata reset original-destructor=00436680 original-constructor=004365f0 retained-names=0 world-null=1 result=pass'));
    paging={sourceRegion:'0_0',destinationRegion:'1_0',sourceRootsFreed:8,sourceRootsClearedBeforeTargetLoad:true,
      sourceReleasedHeapBytes:memory[0]-memory[1],sourceReleasedHeapBlocks:memory[2]-memory[3],
      savedDestination:m.destinationCopied,heldDestination:m.heldDestination,destinationClock:targetHeld.clock,
      destinationActorCount:targetHeld.counts.units,destinationOriginalGameplayPreserved:true,metadataOwnershipResetQualified:true,
      ...comparison,destinationPausedBeforeFirstTick:true,heroImported:false};
  }
  return {version:1,nativeSelectedSourceRetirementQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
    removedUnitId:hero,removedAgentId:agent,registeredGuild:{unitId:home,agentId:guild},clock,sourceWorld:m.heldSave.checkpoint,
    retiredWorld:refs[3],allRefusalsPreserveGameplay:true,unchangedRecords,orderReferencesChecked,
    guildOnlyExpectedRosterChanges:true,completeChangedRootsQualified:true,remainingQueuesExact:true,noIncomingTypedReferences:true,capturedRecoveryPreserved:true,
    releasedBytes:released[0],releasedBlocks:released[1],releasedCrtAllocations:released[2],
    nativeSessionTerminal:true,ownedProducerAbsent:true,sourceRetired:true,sourceUnloaded:!!paging,nativeSelectedHeroPagingQualified:!!paging,paging,
    ownerPublished:false,browserUsed:false,goalComplete:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [manifestName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
  assert.match(outputName,/^output\/native-(?:halo|selected)-source-retirement-\d{3}-observed\.json$/);
  await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
  const report=outputName.includes('/native-selected-')?await inspectSelectedSourceRetirement(manifestName):await inspectNativeHaloSourceRetirement(manifestName);
  await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({nativeHaloSourceRetirementQualified:report.nativeHaloSourceRetirementQualified===true,nativeSelectedSourceRetirementQualified:report.nativeSelectedSourceRetirementQualified===true,nativeSelectedHeroPagingQualified:report.nativeSelectedHeroPagingQualified===true,unchangedRecords:report.unchangedRecords,ownerPublished:false}));
}
