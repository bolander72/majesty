#!/usr/bin/env node
// Inspect current state saved after original AI/movement, without running a game.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointActorRecords,
  checkpointPlacements,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
const run=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
const [manifestName,output]=process.argv.slice(2);
if(!manifestName||!output||process.argv.length!==4)throw Error('Usage: <terminal capture manifest> <fresh report|--stdout>');
const bytes=await readFile(manifestName),m=JSON.parse(bytes);
if(m.captureEvolvedNpc!==true||m.observeMotion!==true||m.nativeOnly!==true||m.browserUsed!==false||m.nativeSessionTerminal!==true||m.nativeExitCode!==0)
  throw Error('Require terminal original evolved-state capture');
const profile=resolve(m.profile);
if(!profile.startsWith(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-joint-reload-'))||!profile.endsWith('/frontier_0_0'))throw Error('Require owned copied evolved profile');
const code="import importlib.util,json;from pathlib import Path;s=importlib.util.spec_from_file_location('m','scripts/check-native-joint-motion.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps(m.verify(Path(__import__('sys').argv[1]).resolve())))";
const {stdout}=await run('python3',['-c',code,resolve(manifestName)],{cwd:workspace,maxBuffer:2*1024*1024});
const motion=JSON.parse(stdout);
if(motion.originalAiExecutionQualified!==true||motion.observedTicks!==240)throw Error('Require original AI execution and complete motion');
const log=await readFile(m.log,'utf8');
const rows=[...log.matchAll(/^\[streaming\] Joint evolved checkpoint unit=(\d+) agent=(\d+) ticks=240 clock=(\d+) fixed=(-?\d+),(-?\d+) queued=1 saved=1 state-same=1 hooks-same=1 result=pass$/gm)];
if(rows.length!==1)throw Error('Missing safe original evolved full checkpoint');
const [unitId,agentId,clock,x,y]=rows[0].slice(1).map(Number),last=motion.motionSamples.at(-1);
if(unitId!==m.unitId||agentId!==m.agentId||clock!==last[1]||x!==last[2]||y!==last[3])throw Error('Evolved save differs from final observed actor');
async function inspect(label) {
  const filename=join(profile,'Documents/My Games/MajestyHD/SaveGame',label+'.GMP'),source=await stoppedFileSource(filename);
  const counts={},records={},ranges={};
  for(const [kind,iterator,key] of [['units',checkpointUnits(source),r=>r.primary.words[1]],
    ['agents',checkpointAgents(source),r=>r.agentId],['attachments',checkpointAttachments(source),r=>r.kind+':'+r.unitId]]) {
    const seen=new Set();
    for await(const r of iterator) {
      const id=key(r);if(seen.size>=5000||seen.has(id))throw Error('Invalid evolved record membership');seen.add(id);
      if(kind==='attachments'&&id==='ORDR:'+unitId)ranges.Orders={offset:r.primary.offset+16,size:r.primary.size};
    }
    counts[kind]=seen.size;
  }
  const {unit,agent}=await checkpointActorRecords(source,unitId);
  if(unit.agentId!==agentId||agent.agentId!==agentId||agent.unitId!==unitId||unit.parentUnitId||unit.stateFlags&4)throw Error('Evolved actor identity/link/deletion state differs');
  ranges.Unit={offset:unit.offset,size:unit.size};ranges.GPL={offset:agent.offset,size:agent.size};
  for(const [kind,r] of Object.entries(ranges)) {
    if(r.size<1||r.size>2048)throw Error('Unsupported evolved actor writer extent');
    records[kind]={...r,sha256:sha(await source.readAt(r.offset,r.size))};
  }
  if(Object.keys(records).length!==3)throw Error('Missing evolved actor writers');
  let position,queued=0;const queues=[[],[]];let activeQueue;
  for await(const r of checkpointPlacements(source))if(r.unitId===unitId)position=r.fixedPosition;
  for await(const r of checkpointAgentQueues(source)) {
    if(r.type==='queue-selector')activeQueue=r.activeQueue;
    else {queues[r.queue].push(r.agentId);queued+=r.agentId===agentId;}
  }
  if(queued!==1||!position)throw Error('Evolved actor missing placement or unique schedule');
  const orderEntries=[];
  for await(const r of checkpointActorOrderEntries(source,unitId))if(r.type==='entry')orderEntries.push({bank:r.bank,index:r.index,kind:r.kind});
  return {filename,size:source.size,sha256:await hashCheckpointSource(source),counts,
    actor:{family:unit.family,description:unit.description,playerNumber:unit.playerNumber,unitId,agentId,position},records,queued,queues,activeQueue,orderEntries};
}
const before=await inspect('Joint_Reload'),after=await inspect('Joint_Evolved');
if(before.sha256!==m.inputHashes['Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP']||after.sha256===before.sha256)
  throw Error('Evolved full save is unchanged or loaded input differs');
if(after.actor.position.x!==x||after.actor.position.y!==y||before.actor.position.x===x&&before.actor.position.y===y)
  throw Error('Evolved checkpoint rolled actor position back');
for(const key of ['family','description','playerNumber','unitId','agentId'])if(before.actor[key]!==after.actor[key])throw Error('Evolved actor descriptor changed');
const changedActorWriters=Object.keys(after.records).filter(k=>after.records[k].sha256!==before.records[k].sha256);
if(!changedActorWriters.includes('Unit'))throw Error('Moved actor state not persisted');
const result={qualified:true,scope:'One original full save after 240 original AI/movement ticks, with evolved position/native/script/command ranges and one queued actor; fresh evolved reload, repeated crossings and browser resources unqualified.',
  sourceManifest:resolve(manifestName),sourceManifestSha256:sha(bytes),fixture:m,unitId,agentId,clock,before,after,
  changedActorWriters,observedTicks:240,originalContextActions:motion.originalContextActions,originalPathCalls:motion.originalPathCalls,
  originalEvolvedFullSaveQualified:true,saveDoesNotMutateObservedStateQualified:true,
  freshEvolvedWorldReloadQualified:false,repeatedGameplayCrossingsQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,
  sourceSha256:{'scripts/check-native-npc-evolved.mjs':sha(await readFile(new URL(import.meta.url))),...m.nativeSourceSha256}};
if(output==='--stdout')console.log(JSON.stringify(result));else {
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,changedActorWriters,counts:after.counts,position:after.actor.position,originalEvolvedFullSaveQualified:true}));
}
