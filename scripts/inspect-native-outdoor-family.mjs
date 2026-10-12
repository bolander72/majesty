#!/usr/bin/env node
// Independent stopped record comparison. The actors were never scheduled.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks,checkpointAgentRecord,checkpointAgentRecordValues,
  checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from './lib/native-crossing-order-entries.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const memory=b=>({size:b.length,async readAt(at,n){assert(n<=4096&&at>=0&&at+n<=b.length);return Uint8Array.from(b.subarray(at,at+n));}});
function chunk(tag,data=Buffer.alloc(0),version=0,count=0){const h=Buffer.alloc(16);h.write(tag);h.writeUInt32LE(data.length,4);h.writeUInt32LE(version,8);h.writeUInt32LE(count,12);return Buffer.concat([h,data]);}
function attachment(tag,id,payload){const h=Buffer.alloc(4);h.writeUInt32LE(id);return Buffer.concat([h,chunk(tag,chunk('PRIM',payload,tag==='ORDR'?2:1),0,1)]);}
function unitWorld(records){return Buffer.concat([chunk('VERS',Buffer.alloc(256),1),...['BLDG','VHCL','GRND','RWRD','MSGF','OFMP'].map(t=>chunk(t,t==='VHCL'?Buffer.concat(records):undefined,0,t==='VHCL'?records.length:0))]);}
export async function inspectNativeOutdoorFamily(manifestName){
  const m=await json(manifestName);
  assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.outdoorFamilyTrialCompleted,m.stopReason],
    [true,false,true,0,true,null]);
  try {process.kill(m.nativePid,0);throw Error('Native producer remains live');}
  catch(error){if(error.code!=='ESRCH')throw error;}
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-outdoor-family-');
  assert.equal(m.worldRoot,join(fixture,'native-world-outdoor-family'));assert.equal(m.profile,join(m.worldRoot,'frontier_1_0'));
  assert.equal(await hash(m.buildReport),m.buildReportSha256);const build=await json(m.buildReport);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await hash(build.log),build.logSha256);
  let sources=0;for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256']){
    assert.deepEqual(m[group],build[group]);for(const[n,h]of Object.entries(m[group])){assert.equal(await hash(join(workspace,n)),h);++sources;}
  }
  assert.equal(sources,20);assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  assert.equal(await hash('scripts/run-native-outdoor-family.py'),m.runnerSha256);
  assert.equal(await hash(m.preparation),m.preparationSha256);const prep=await json(m.preparation);
  assert.equal(prep.outdoorFamilyPreparationQualified,true);assert.deepEqual([prep.sourceClockMs,prep.destinationClockMs],[57650,24250]);
  for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(n),h);
  for(const key of ['sourceProof','pairPublication','effectClockProof'])assert.equal(await hash(prep[key]),prep[`${key}Sha256`]);
  assert.equal(await hash(prep.source.filename),prep.source.sha256);assert.equal(m.source,prep.destination.filename);
  assert.equal(await hash(m.source),prep.destination.sha256);assert.equal(await hash(m.sourceCopy),prep.destination.sha256);
  for(const flag of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged','proposalsUnchanged','donorUnchanged'])assert.equal(m[flag],true);
  assert.equal(m.proposals.length,11);for(const r of prep.records){
    const p=m.proposals.find(p=>p.source===r.filename);assert(p);assert.equal(p.copied,join(m.profile,basename(r.filename)));
    assert.equal(p.sha256,r.sha256);assert.equal(p.bytes,r.bytes);assert.equal(await hash(p.source),p.sha256);assert.equal(await hash(p.copied),p.sha256);
  }
  for(const[n,h]of Object.entries(prep.inputHashes))assert.equal(await hash(join(prep.settingsProfile,n)),h);
  assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),'wait 12000\ndump outdoor_family_completed\n');
  assert.equal(await hash(m.log),m.logSha256);assert((await stat(m.log)).size<=1024*1024);
  const log=await readFile(m.log,'utf8');assert(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
  assert(!/result=fail|SIGSEGV|abort from|Family allocation refused/.test(log));
  const lines=log.split('\n').filter(l=>l.startsWith('[streaming] Family '));assert.equal(lines.length,10);
  const sourceIds=[504,527,528,529],requested=[454,202,161,161],requests=[14,10,9,9],sizes=[300,208,128,128];
  for(let i=0;i<4;++i){
    assert.equal(lines[i*2],`[streaming] Family unit stage source=${sourceIds[i]} status=00000000 complete=1 failure=0`);
    assert.equal(lines[i*2+1],`[streaming] Family orders restored requests=${requests[i]} requested-bytes=${requested[i]} payload-bytes=${sizes[i]} exact=1 transferred=1 result=pass`);
  }
  const row=lines[8].match(/^\[streaming\] Family records hero=(\d+) effects=(\d+),(\d+),(\d+) agent=(\d+) clock=24250 exact=1 internal-links=3 home-proxy=45 home-native=0 scheduled=0 finalization=0 owner-published=0 result=pass$/);
  assert(row);const [heroId,...rest]=row.slice(1).map(Number),ids=[heroId,...rest.slice(0,3)],agentId=rest[3];
  assert(ids.every((id,i)=>id===heroId+i&&id>0&&id<0x7ffffffe));assert(agentId>45&&agentId<0x7ffffffe);
  assert.equal(lines[9],'[streaming] Family cleanup requests=42 original-removal=1 aliases-absent=1 registry-preserved=1 proxy-preserved=1 queues-preserved=1 hooks-removed=1 result=pass');
  assert.equal(m.records.length,27);const names=new Set();for(const r of m.records){
    assert.equal(r.filename,join(m.profile,basename(r.filename)));assert(!names.has(r.filename));names.add(r.filename);
    const actual=await hashNativeFile(r.filename,{maximum:65536});assert.equal(actual.sha256,r.sha256);assert.equal(actual.bytes,r.bytes);
  }
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
  return {version:1,originalOutdoorFamilyRecordsRestored:true,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),
    nativePid:m.nativePid,nativeExecutableSha256:m.nativeExecutableSha256,heroId,effectIds:ids.slice(1),agentId,
    completeUnitRecordBytes:observed.map(b=>b.length),completeScriptRecordBytes:expected.length,referencePatches,
    internalAttachmentLinks:3,originalOrderRequestsFreed:42,requestedOrderBytes:978,
    deferredHome:prep.deferredHome,queueGuildTarget:{sourceRegion:'0_0',sourceUnitId:469,cProcId:4099,destinationBindingQualified:false},
    maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),
    sourceSha256:{'scripts/inspect-native-outdoor-family.mjs':await hash('scripts/inspect-native-outdoor-family.mjs')},
    scope:'Original receiving-world UNIT/SECD/GPL/order readers and writers restore four registered unscheduled actors with fresh aliases and internal child links; original removal frees all command reservations. Home native routing, spatial activation, script clock migration and regional owner publication remain unqualified.',
    dormantHomeRoutingQualified:false,destinationActivationQualified:false,heroTransferred:false,browserUsed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const [manifestName,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const result=await inspectNativeOutdoorFamily(manifestName);await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({originalOutdoorFamilyRecordsRestored:true,heroId:result.heroId,effectIds:result.effectIds,
    agentId:result.agentId,originalOrderRequestsFreed:42,heroTransferred:false,browserUsed:false}));
}
