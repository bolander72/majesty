#!/usr/bin/env node
// Independent original-record comparison for ordinary native remote-home holds.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks,checkpointAgentRecord,checkpointAgentRecordValues,
  checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {encodeHomeRecord} from '../web/world/hero-home.mjs';
import {Sha256} from '../web/world/sha256.mjs';
import {checkpointActorOrderEntries} from './lib/native-crossing-order-entries.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const memory=b=>({size:b.length,async readAt(at,n){assert(n<=4096&&at>=0&&at+n<=b.length);return Uint8Array.from(b.subarray(at,at+n));}});
function chunk(tag,data=Buffer.alloc(0),version=0,count=0){const h=Buffer.alloc(16);h.write(tag);h.writeUInt32LE(data.length,4);h.writeUInt32LE(version,8);h.writeUInt32LE(count,12);return Buffer.concat([h,data]);}
function attachment(tag,id,payload){const h=Buffer.alloc(4);h.writeUInt32LE(id);return Buffer.concat([h,chunk(tag,chunk('PRIM',payload,tag==='ORDR'?2:1),0,1)]);}
function unitWorld(records){return Buffer.concat([chunk('VERS',Buffer.alloc(256),1),...['BLDG','VHCL','GRND','RWRD','MSGF','OFMP'].map(t=>chunk(t,t==='VHCL'?Buffer.concat(records):undefined,0,t==='VHCL'?records.length:0))]);}
export async function inspectNativeOutdoorFamilyHomeRoute(manifestName,{snapshots=false}={}){
  const m=await json(manifestName);
  assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.outdoorFamilyTrialCompleted,m.stopReason],
    [true,false,true,0,true,null]);
  try {process.kill(m.nativePid,0);throw Error('Native producer remains live');}
  catch(error){if(error.code!=='ESRCH')throw error;}
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-outdoor-family-');
  if(snapshots){assert.equal(m.remoteSnapshots,true);assert.equal(m.phase,'remote-home-snapshots');
    await ownedDirectory(m.fixture,'actor-arrival-fixture-outdoor-family-snapshot-');}
  assert.equal(m.worldRoot,snapshots?fixture:join(fixture,'native-world-outdoor-family'));assert.equal(m.profile,join(m.worldRoot,'frontier_1_0'));
  assert.equal(await hash(m.buildReport),m.buildReportSha256);const build=await json(m.buildReport);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await hash(build.log),build.logSha256);
  let sources=0;for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256']){
    assert.deepEqual(m[group],build[group]);for(const[n,h]of Object.entries(m[group])){assert.equal(await hash(join(workspace,n)),h);++sources;}
  }
  assert.equal(sources,20);assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  assert.equal(await hash(snapshots?'scripts/run-native-outdoor-family-snapshots.py':'scripts/run-native-outdoor-family-home-route.py'),m.runnerSha256);
  assert.equal(await hash(m.preparation),m.preparationSha256);const prep=await json(m.preparation);
  assert.equal(prep.outdoorFamilyPreparationQualified,true);assert.deepEqual([prep.sourceClockMs,prep.destinationClockMs],[57650,24250]);
  for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(n),h);
  for(const key of ['sourceProof','pairPublication','effectClockProof'])assert.equal(await hash(prep[key]),prep[`${key}Sha256`]);
  assert.equal(await hash(prep.source.filename),prep.source.sha256);assert.equal(m.source,prep.destination.filename);
  assert.equal(await hash(m.source),prep.destination.sha256);assert.equal(await hash(m.sourceCopy),prep.destination.sha256);
  for(const flag of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged','proposalsUnchanged','donorUnchanged'])assert.equal(m[flag],true);
  assert.equal(m.proposals.length,13);for(const r of prep.records){
    const p=m.proposals.find(p=>p.source===r.filename);assert(p);assert.equal(p.copied,join(m.profile,basename(r.filename)));
    assert.equal(p.sha256,r.sha256);assert.equal(p.bytes,r.bytes);assert.equal(await hash(p.source),p.sha256);assert.equal(await hash(p.copied),p.sha256);
  }
  for(const[n,h]of Object.entries(prep.inputHashes))assert.equal(await hash(join(prep.settingsProfile,n)),h);
  assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),'wait 20000\ndump outdoor_family_completed\n');
  assert.equal(await hash(m.log),m.logSha256);assert((await stat(m.log)).size<=1024*1024);
  const log=await readFile(m.log,'utf8');assert(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
  assert(!/result=fail|SIGSEGV|abort from|Family allocation refused/.test(log));
  const lines=log.split('\n').filter(l=>l.startsWith('[streaming] Family '));assert.equal(lines.length,13);
  const sourceIds=[504,527,528,529],requested=[454,202,161,161],requests=[14,10,9,9],sizes=[300,208,128,128];
  for(let i=0;i<4;++i){
    assert.equal(lines[i*2],`[streaming] Family unit stage source=${sourceIds[i]} status=00000000 complete=1 failure=0`);
    assert.equal(lines[i*2+1],`[streaming] Family orders restored requests=${requests[i]} requested-bytes=${requested[i]} payload-bytes=${sizes[i]} exact=1 transferred=1 result=pass`);
  }
  const row=lines[8].match(/^\[streaming\] Family records hero=(\d+) effects=(\d+),(\d+),(\d+) agent=(\d+) clock=24250 exact=1 internal-links=3 home-proxy=45 home-native=0 scheduled=0 finalization=0 owner-published=0 result=pass$/);
  assert(row);const [heroId,...rest]=row.slice(1).map(Number),ids=[heroId,...rest.slice(0,3)],agentId=rest[3];
  assert(ids.every((id,i)=>id===heroId+i&&id>0&&id<0x7ffffffe));assert(agentId>45&&agentId<0x7ffffffe);
  assert.equal(m.homeRouteFixture,true);
  assert.equal(lines[9],`[streaming] Family route armed hero=${heroId} agent=${agentId} clock=24250 queued=1 orders-admitted=4 guards=2 proxy-exact=1 other-queues-preserved=1 finalization=0 owner-published=0 result=pass`);
  const requestRow=lines[10].match(/^\[streaming\] Family route requested hero=(\d+) agent=(\d+) proxy=45 home=0_0\/469\/7 clock=(\d+) pause-anchor=24250 ordinary-ai=1 before-native-lookup=1 owner-published=0 result=pass$/);
  assert(requestRow);assert.equal(Number(requestRow[1]),heroId);assert.equal(Number(requestRow[2]),agentId);
  const heldRow=lines[11].match(/^\[streaming\] Family route held clock=(\d+) elapsed=(\d+) agent-held=(\d+) commands-held=(\d+),(\d+),(\d+),(\d+) other-ai=(\d+) other-commands=(\d+) records-exact=11 pause-anchor=24250 result=pass$/);
  assert(heldRow);const held=heldRow.slice(1).map(Number);
  assert.equal(held[0]-Number(requestRow[3]),held[1]);assert(held[1]>=1000&&held[1]<=6000);
  assert(held.slice(2).every(n=>n>0&&n<=65536));
  assert.equal(lines[12],'[streaming] Family route cleanup requests=42 original-removal=1 aliases-absent=1 registry-preserved=1 proxy-preserved=1 queues-preserved=1 hooks-removed=1 owner-published=0 result=pass');
  assert.equal(m.records.length,54);const names=new Set();for(const r of m.records){
    assert.equal(r.filename,join(m.profile,basename(r.filename)));assert(!names.has(r.filename));names.add(r.filename);
    const actual=await hashNativeFile(r.filename,{maximum:65536});assert.equal(actual.sha256,r.sha256);assert.equal(actual.bytes,r.bytes);
  }
  const admissions=log.split('\n').filter(l=>l.startsWith('[streaming] Route order admission '));
  assert.equal(admissions.length,4);admissions.forEach((line,i)=>assert.equal(line,`[streaming] Route order admission index=${i} unit=${ids[i]} before=1 after=1 other-members-preserved=1 result=pass`));
  const record=async name=>{const n=join(m.profile,name);assert(names.has(n));return readFile(n);};
  const observed=[];
  for(let i=0;i<4;++i){
    const original=await record(`Family_Proposal_${sourceIds[i]}.UNIT`),expected=Buffer.from(original);
    expected.writeUInt32LE(0,36);expected.writeUInt32LE(i?heroId:0,56);
    if(!i){
      let at=92+(expected.readUInt32LE(80)?16:0);assert.equal(expected.readUInt32LE(at),1);
      const count=expected.readUInt32LE(at+4);at+=8;let found=0;
      for(let k=0;k<count;++k,at+=8)if(expected.readUInt32LE(at)===0x4541){assert.equal(expected.readUInt32LE(at+4),28);expected.writeUInt32LE(agentId,at+4);++found;}
      assert.equal(found,1);
    }
    assert.deepEqual(await record(`Family_Input_${sourceIds[i]}.UNIT`),expected);
    expected.writeUInt32LE(ids[i],36);const bytes=await record(`Family_Observed_${sourceIds[i]}.UNIT`);
    assert.deepEqual(bytes,expected);observed.push(bytes);
    assert.deepEqual(await record(`Family_Observed_${sourceIds[i]}_Orders.bin`),await record(`Family_Proposal_${sourceIds[i]}_Orders.bin`));
  }
  const world=unitWorld(observed),typedUnits=[];for await(const u of checkpointUnitAgentLinks(memory(world)))typedUnits.push(u);
  assert.deepEqual(typedUnits.map(u=>[u.unitId,u.agentId,u.parentUnitId]),[[heroId,agentId,0],...ids.slice(1).map(id=>[id,0,heroId])]);
  const script=await record('Family_Proposal_Agent.GPL'),expected=Buffer.from(script),originalRecord=await checkpointAgentRecord(memory(script));
  assert.equal(originalRecord.agentId,28);assert.equal(originalRecord.unitId,504);
  const referencePatches=[];for await(const v of checkpointAgentRecordValues(memory(script)))if(v.type===5&&v.targetAgentId){
    assert([7,28].includes(v.targetAgentId));const after=v.targetAgentId===28?agentId:45;
    expected.writeUInt32LE(after,v.offset);referencePatches.push({offset:v.offset,before:v.targetAgentId,after});
  }
  const identityAt=script.length-24-Buffer.byteLength(originalRecord.name),nativeAt=script.length-19;
  assert.equal(script.readUInt32LE(identityAt),28);assert.equal(script.readUInt32LE(nativeAt),504);
  expected.writeUInt32LE(agentId,identityAt);expected.writeUInt32LE(heroId,nativeAt);
  assert.deepEqual(await record('Family_Input_Agent.GPL'),expected);assert.deepEqual(await record('Family_Observed_Agent.GPL'),expected);
  const values=[];for await(const v of checkpointAgentRecordValues(memory(expected)))values.push(v);
  const home=values.find(v=>v.attribute==='home'&&!v.path.length);assert.equal(home.type,5);assert.equal(home.targetAgentId,45);
  const internal=await record('Family_Proposal_Container.bin'),bound=Buffer.from(internal);
  bound.writeUInt32LE(heroId,20);ids.slice(1).forEach((id,i)=>bound.writeUInt32LE(id,24+i*8));
  assert.deepEqual(await record('Family_Input_Container.bin'),bound);assert.deepEqual(await record('Family_Observed_Container.bin'),bound);
  const orders=await Promise.all(sourceIds.map(async(id,i)=>attachment('ORDR',ids[i],await record(`Family_Observed_${id}_Orders.bin`))));
  const family=memory(Buffer.concat([world,chunk('ORDR',Buffer.concat(orders),1,4),chunk('CONT',attachment('CONT',heroId,bound),1,1)]));
  const containers=[];for await(const c of checkpointContainerEntries(family))containers.push(c);
  assert.deepEqual(containers.filter(c=>c.type==='member').map(c=>[c.groupKind,c.groupOwnerUnitId,c.targetUnitId]),ids.slice(1).map(id=>[1,heroId,id]));
  const entries=[];for(const id of ids)for await(const e of checkpointActorOrderEntries(family,id))if(e.type==='entry')entries.push(e);
  assert.deepEqual(entries.map(e=>[e.unitId,e.kind,e.words[5]]),[[heroId,4,24250],[heroId,7,24250],[ids[1],5,24200],[ids[2],9,23950],[ids[3],9,23950]]);
  const queue=entries.find(e=>e.kind===7);assert.equal(queue.words[9],469);assert.equal(queue.words[10],4099);
  const pendingHome=await record('Family_Source_Container.bin');assert.equal(pendingHome.length,72);assert.equal(pendingHome.readUInt32LE(24),469);
  assert(m.resourceSamples.length&&m.resourceSamples.every(s=>s.pid===m.nativePid&&s.rssBytes<=m.rssCeilingBytes));
  assert.equal(prep.homeRoutePreparationQualified,true);
  assert.equal(await hash(prep.basePreparation),prep.basePreparationSha256);
  assert.equal(new Sha256().update(encodeHomeRecord(prep.registeredHome.record)).hex(),prep.registeredHome.sha256);
  const proxy=await record('Family_Route_Proxy_Proposal.GPL');
  await verifyRemoteHomeAgent(memory(proxy),prep.registeredHome,45);
  assert.deepEqual(await record('Family_Route_Bound_Proxy.GPL'),proxy);
  assert.deepEqual(await record('Family_Route_Cleaned_Proxy.GPL'),proxy);
  const binding=await record('Family_Route_Binding.bin');assert.equal(binding.length,320);
  assert.deepEqual(Array.from({length:8},(_,i)=>binding.readUInt32LE(i*4)),[0x31485246,1,469,7,45,0x31564241,0,0]);
  const pair=await json(prep.pairPublication),homeRecord=prep.registeredHome.record;
  [pair.identity.entityId,homeRecord.guildEntityId,homeRecord.worldId,homeRecord.contentDigest].forEach((s,i)=>{
    assert.match(s,/^[0-9a-f]{64}$/);assert.equal(binding.subarray(32+i*64,96+i*64).toString('ascii'),s);
  });
  const regionBytes=Buffer.alloc(32);regionBytes.write('1_0');regionBytes.write('0_0',16);assert.deepEqual(binding.subarray(288),regionBytes);
  const request=JSON.parse((await record('Family_Home_Request.json')).toString('utf8'));
  assert.deepEqual(request,{version:1,kind:'registered-home-go_home',entityId:pair.identity.entityId,
    guildEntityId:homeRecord.guildEntityId,worldId:homeRecord.worldId,contentDigest:homeRecord.contentDigest,
    receivingRegion:'1_0',homeRegion:'0_0',heroId,agentId,homeUnitId:469,homeAgentId:7,proxyAgentId:45,proxyNativeId:0,
    pauseAnchorClockMs:24250,requestClockMs:Number(requestRow[3]),ownerPublished:false});
  for(let i=0;i<4;++i){
    const admitted=Buffer.from(observed[i]);
    assert.deepEqual(await record(`Family_Route_Before_${sourceIds[i]}.UNIT`),admitted);
    assert.deepEqual(await record(`Family_Route_After_${sourceIds[i]}.UNIT`),admitted);
    const orders=await record(`Family_Observed_${sourceIds[i]}_Orders.bin`);
    assert.deepEqual(await record(`Family_Route_Before_${sourceIds[i]}_Orders.bin`),orders);
    assert.deepEqual(await record(`Family_Route_After_${sourceIds[i]}_Orders.bin`),orders);
  }
  for(const [suffix,b]of [['Agent.GPL',expected],['Proxy.GPL',proxy],['Container.bin',bound]]){
    assert.deepEqual(await record(`Family_Route_Before_${suffix}`),b);
    assert.deepEqual(await record(`Family_Route_After_${suffix}`),b);
  }
  return {version:1,originalOutdoorFamilyRecordsRestored:true,ordinaryAiHomeHoldQualified:true,
    ordinaryCommandHomeHoldQualified:true,heldWorldElapsedMs:held[1],ordinaryAgentHeld:held[2],
    ordinaryCommandsHeld:held.slice(3,7),otherAiDelegated:held[7],otherCommandsDelegated:held[8],
    registeredHome:prep.registeredHome,homeRequest:request,completeRoutingQualified:false,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),
    nativePid:m.nativePid,nativeExecutableSha256:m.nativeExecutableSha256,heroId,effectIds:ids.slice(1),agentId,
    completeUnitRecordBytes:observed.map(b=>b.length),completeScriptRecordBytes:expected.length,referencePatches,
    internalAttachmentLinks:3,originalOrderRequestsFreed:42,requestedOrderBytes:978,
    deferredHome:prep.deferredHome,queueGuildTarget:{sourceRegion:'0_0',sourceUnitId:469,cProcId:4099,destinationBindingQualified:false},
    maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),
    sourceSha256:{'scripts/inspect-native-outdoor-family-home-route.mjs':await hash('scripts/inspect-native-outdoor-family-home-route.mjs')},
    scope:'Actual restored outdoor hero and three effects are admitted to original AI/ORDR queues; guards hold both ordinary ingress paths for at least1000ms with11 complete writer records identical and other actors delegated. One request binds the canonical registered home with the original pause clock. Spatial activation, script clock migration, home-region loading and selected owner publication remain unqualified.',
    dormantHomeRoutingQualified:false,destinationActivationQualified:false,heroTransferred:false,browserUsed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const [manifestName,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const result=await inspectNativeOutdoorFamilyHomeRoute(manifestName);await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({ordinaryAiHomeHoldQualified:true,ordinaryCommandHomeHoldQualified:true,heroId:result.heroId,effectIds:result.effectIds,
    agentId:result.agentId,originalOrderRequestsFreed:42,heroTransferred:false,browserUsed:false}));
}
