// Fresh import, original full reload, placement and paused ownership in one
// native process. Check actual inputs; a prepared-world replay is insufficient.
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {deriveNativeSessionHomeImport} from '../prepare-native-session-home-import.mjs';
import {workspace,stoppedFileSource} from './stopped-entity-io.mjs';
import {hashNativeFile} from './native-generation.mjs';
import {checkpointChunks,checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,checkpointAgentValues,checkpointAgentQueues,
  checkpointActorRecords,checkpointContainerEntries} from '../../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
export async function nativeSavedSeeds(source){
  let gpl,game;for await(const c of checkpointChunks(source)){
    if(c.tag==='GPL '){assert.equal(gpl,undefined);assert.equal(c.version,1);assert(c.size>=40);
      const b=Buffer.from(await source.readAt(c.offset+16,12));assert.equal(b.readUInt32LE(0),c.size);assert.equal(b.readUInt32LE(4),3);gpl=b.readUInt32LE(8);}
    if(c.tag==='SVGD'){assert.equal(game,undefined);assert.equal(c.version,10);assert(c.size<=1024);
      const b=Buffer.from(await source.readAt(c.offset+16,c.size)),first=b.indexOf(0),second=b.indexOf(0,first+1);
      assert(first>0&&first<128&&second>first+1&&second-first<128&&second+33<=b.length);game=b.readUInt32LE(second+29);}
  }assert(gpl>0&&game>0);return {gpl,game};
}
async function rows(source,iterator,key){const out=new Map();for await(const r of iterator(source)){assert(!out.has(key(r)));out.set(key(r),r);}return out;}
async function bytes(s,r){assert(r&&r.size<=65536);const b=Buffer.alloc(r.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(r.offset+at,Math.min(4096,b.length-at)),at);return b;}
async function exact(a,b,iterator,key,omit=new Set(),sameCount=false){const before=await rows(a,iterator,key),after=await rows(b,iterator,key);if(sameCount)assert.equal(before.size,after.size);
  let count=0;for(const[id,r]of before)if(!omit.has(id)){assert(after.has(id));assert.deepEqual(await bytes(a,r),await bytes(b,after.get(id)));count++;}return count;}
export async function verifyNativeSessionHomeImport(m,prep,log,{interruptedBeforeResume=false}={}){
  assert.equal(typeof interruptedBeforeResume,"boolean");
  assert(m.liveImport&&m.liveOwner);const live=m.liveImport,receipt=live.preparation;assert(receipt);
  assert.equal(receipt.filename,join(m.fixture,'Fresh_Home_Import_Prepared.json'));assert.equal(await hash(receipt.filename),receipt.sha256);assert.equal(receipt.nativeAliveAfterPreparation,true);
  const report=JSON.parse(await readFile(receipt.filename,'utf8')),derived=await deriveNativeSessionHomeImport(m);
  assert.deepEqual([report.version,report.currentSessionHomeImportPrepared,report.nativePid,report.nativeAliveBeforeAndAfterPreparation,report.browserUsed],[1,true,m.nativePid,true,false]);
  for(const[n,h]of Object.entries(report.sourceSha256))assert.equal(await hash(join(workspace,n)),h);
  for(const key of ['held','captured','templatePreparation','templatePreparationSha256','sourceManifest','sourceUnitIds','sourceAgentId','pauseAnchorClockMs','homeClockMs'])assert.deepEqual(report[key],derived[key]);
  assert.deepEqual(report.records,derived.records.map(r=>({...r,filename:join(m.profiles['0_0'],r.name),bytes:r.bytes.length})));
  const names=new Set();for(const r of live.records){assert.equal(r.filename,join(m.profiles['0_0'],basename(r.filename)));assert(!names.has(r.filename));names.add(r.filename);assert.equal(await hash(r.filename),r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);}
  for(const r of derived.records){const name=join(m.profiles['0_0'],r.name);assert(names.has(name));assert.equal(await hash(name),r.sha256);assert.deepEqual(await readFile(name),r.bytes);}
  const expectedInput=prep.worlds[0],homeInput=m.inputs.find(r=>r.region==='0_0');assert.equal(homeInput.source,expectedInput.filename);assert.equal(homeInput.sourceSha256,expectedInput.sha256);
  const input=await stoppedFileSource(expectedInput.filename),unitsBefore=await rows(input,checkpointUnitAgentLinks,r=>r.unitId),agentsBefore=await rows(input,checkpointAgents,r=>r.agentId);
  for(const id of [504,527,528,529,530,531,532,533])assert(!unitsBefore.has(id));for(const id of [28,31])assert(!agentsBefore.has(id));
  assert.equal(await checkpointSavedClock(input),57650);const saves={};assert.equal(live.saves.length,2);
  for(const r of live.saves){const phase=basename(r.filename).match(/^Family_Return_(Departed|Ready)\.GMP$/)?.[1];assert(phase&&!saves[phase]);
    assert.equal(r.filename,join(m.profiles['0_0'],'Documents/My Games/MajestyHD/SaveGame',`Family_Return_${phase}.GMP`));assert.equal(await hash(r.filename),r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);
    const source=await stoppedFileSource(r.filename);assert.equal(await checkpointSavedClock(source),57650);saves[phase]={...r,source};}
  const unitKey=r=>r.unitId,agentKey=r=>r.agentId,attachmentKey=r=>`${r.kind}:${r.unitId}`;
  const dormantUnitsExact=await exact(input,saves.Departed.source,checkpointUnitAgentLinks,unitKey,new Set(),true);
  const dormantAgentsExact=await exact(input,saves.Departed.source,checkpointAgents,agentKey,new Set(),true);
  const dormantAttachmentsExact=await exact(input,saves.Departed.source,checkpointAttachments,attachmentKey,new Set(),true);
  const paused=await stoppedFileSource(m.liveOwner.pausedCapture.filename);
  const fullReloadUnitsExact=await exact(saves.Ready.source,paused,checkpointUnitAgentLinks,unitKey,new Set(),true);
  const fullReloadAgentsExact=await exact(saves.Ready.source,paused,checkpointAgents,agentKey,new Set(),true);
  const fullReloadAttachmentsExact=await exact(saves.Ready.source,paused,checkpointAttachments,attachmentKey,new Set(),true);
  const readyUnits=await rows(paused,checkpointUnitAgentLinks,unitKey),readyAgents=await rows(paused,checkpointAgents,agentKey);
  assert.equal(readyUnits.size,unitsBefore.size+4);assert.equal(readyAgents.size,agentsBefore.size+1);
  const otherImportedUnitsExact=await exact(input,paused,checkpointUnitAgentLinks,unitKey,new Set([469]));
  const otherImportedAgentsExact=await exact(input,paused,checkpointAgents,agentKey,new Set([7]));
  for(const id of [504,527,528,529])assert(!readyUnits.has(id));assert(!readyAgents.has(28));
  const ids=[530,531,532,533];for(let i=0;i<4;++i){const u=readyUnits.get(ids[i]);assert(u);assert.equal(u.parentUnitId,i?530:0);assert.equal(u.agentId,i?0:31);
    assert.deepEqual(await bytes(paused,u),await readFile(join(m.profiles['0_0'],`Family_Observed_${[504,527,528,529][i]}.UNIT`)));
    let a;for await(const r of checkpointAttachments(paused))if(r.kind==='ORDR'&&r.unitId===ids[i]){assert(!a);a=r;}assert(a);
    const orders=await readFile(join(m.profiles['0_0'],`Family_Proposal_${[504,527,528,529][i]}_Orders.bin`));assert.deepEqual(Buffer.from(await paused.readAt(a.primary.offset+16,a.primary.size)),orders);}
  assert.deepEqual(await bytes(paused,readyAgents.get(31)),await readFile(join(m.profiles['0_0'],'Family_Observed_Agent.GPL')));
  let active;const members=[];for await(const v of checkpointAgentValues(paused,31))if(v.attribute==='activescript'&&!v.path.length)active=v;
  assert(active&&active.functions.some(f=>f.name==='travel_to'));for await(const v of checkpointAgentValues(paused,7))if(v.attribute==='members'&&v.type===5)members.push(v.targetAgentId);assert.deepEqual(members,[31]);
  const physical=[];for await(const c of checkpointContainerEntries(paused))if(c.type==='member'&&((c.unitId===469&&c.targetUnitId===530)||(c.unitId===530&&c.targetUnitId===469)))physical.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
  assert.deepEqual(physical,[[469,100,530,1],[530,101,469,1]]);let queued=0;for await(const q of checkpointAgentQueues(paused))if(q.type==='queued-agent'&&q.agentId===31)queued++;assert.equal(queued,1);
  const at=[];function ordered(text){const i=log.indexOf(text);assert(i>=0,text);assert(!at.length||i>at.at(-1));at.push(i);}
  ordered('[frontier] Region 0_0 ready');
  ordered('[streaming] Family return dormant home=469/7 clock=57650 aliases-absent=1 roster-empty=1 source-already-retired=1 original-removal=0 saved=1 result=pass');
  const stages=[...log.matchAll(/\[streaming\] Family unit stage source=(\d+) status=00000000 complete=1 failure=0/g)];assert.deepEqual(stages.map(r=>Number(r[1])),[504,527,528,529]);
  ordered('[streaming] Family return restored hero=530 effects=531,532,533 agent=31 clock=57650 exact=1 internal-links=3 home=469/7 source-retired=1 owner-published=0 result=pass');
  ordered('[streaming] Family return prepared hero=530 agent=31 guild=469/7 clock=57650 finalized=4 physical=0 drawing=1 native-roster=1 script-roster=1 queued=1 full-load-required=1 ordinary-updates=0 saved=1 owner-published=0 result=pass');
  ordered('[streaming] Family return prepared-cleanup requests=42 original-removal=1 aliases-absent=1 roster-empty=1 other-queues-preserved=1 hooks-preserved=1 saved-ready-retained=1 result=pass');
  ordered(`[frontier] Session home import reload serial=1 region=0_0 saved-clock=57650 prepared-hash=${saves.Ready.sha256} source-clock=${m.snapshotCaptures[0].clock} ordinary-ticks=0`);
  ordered('[frontier] Session released serial=1 region=0_0 roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288');
  ordered('[frontier] Session unloaded serial=1 source=0_0 target=0_0 world-null=1');
  const start=at.at(-1);assert(log.indexOf('[frontier] Session release observer removed serial=1 hooks=1 retained-roots=0',start)>start);
  const seeds=await nativeSavedSeeds(saves.Ready.source);
  const rng=`[frontier] Session rng restored region=0_0 gpl=${seeds.gpl} game=${seeds.game} clock=57650`;
  assert(log.indexOf(rng,start)>start);
  ordered('[streaming] Session home import ready hero=530 effects=531,532,533 agent=31 clock=57650 physical=4 drawing=1 native-home=469/7 script-roster=1 queued=1 new-this-session=1 ordinary-ticks=0 result=pass');
  ordered('[frontier] Owner paused serial=1 region=0_0 clock=57650');
  if(interruptedBeforeResume){assert(!log.includes('[frontier] Owner resumed'));assert(!log.includes('[frontier] Session checkpoint serial=2'));}
  else{ordered('[frontier] Owner resumed serial=1 region=0_0 clock=57650 revision=6');ordered('[frontier] Session checkpoint serial=2');}
  return {freshHomeActorImportQualified:true,source:'current-session-held-original-writer-records',nativeConstructorStages:4,
    dormantUnitsExact,dormantAgentsExact,dormantAttachmentsExact,fullReloadUnitsExact,fullReloadAgentsExact,fullReloadAttachmentsExact,
    otherImportedUnitsExact,otherImportedAgentsExact,ownedOrderRequestsReleased:42,additionalTrackedWorldRootsFreed:8,
    restoredPhysicalCells:4,ordinaryTicksBeforeOwnershipPublication:0,preparation:receipt.filename,preparationSha256:receipt.sha256};
}
