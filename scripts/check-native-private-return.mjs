#!/usr/bin/env node
// Independent stopped-file check of the native UNIT/GPL return boundary.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import assert from 'node:assert/strict';
import {verifyReturnCapsule} from './prepare-native-entity-return.mjs';
import {verifyDepartedReload} from './check-native-npc-departed-reload.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,maximum) {
  const source=await stoppedFileSource(name);
  if(source.size>maximum)throw Error('Private return evidence exceeds bound');
  const b=Buffer.alloc(source.size);
  for(let at=0;at<b.length;at+=4096)b.set(await source.readAt(at,Math.min(4096,b.length-at)),at);
  return b;
}
export async function verifyReturnRestoration(manifestName,{active=false}={}) {
  const manifest=await bounded(manifestName,65536),m=JSON.parse(manifest),packetProof=m.privateReturnPacket;
  if(m.restoreReturnCommands!==undefined&&typeof m.restoreReturnCommands!=='boolean')throw Error('Invalid command restoration mode');
  const restoreCommands=m.restoreReturnCommands===true;
  if(active ? m.activateReturnedNpc!==true||!restoreCommands||m.observeReturnMotion!==true||m.captureReturnEvolved!==true :
    m.activateReturnedNpc===true||m.observeReturnMotion===true||m.captureReturnEvolved===true)
    throw Error('Return activation mode differs from restoration qualification');
  if(!packetProof||m.nativeOnly!==true||m.browserUsed!==false||m.nativeSessionTerminal!==true||m.nativeExitCode!==0||
    m.reloadDepartedNpc!==true||m.originalSourceWorld!==true||m.observeMotion!==false||m.departNpc!==false||
    m.scheduleNpc!==false||m.reloadScheduledNpc!==false||m.clockMode!==(active?'monotonic':'pinned'))throw Error('Require terminal isolated return');
  if(!Number.isInteger(m.nativePid)||m.nativePid<=0)throw Error('Invalid private return PID');
  try{process.kill(m.nativePid,0);throw Error('Private return process is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const profile=await ownedDirectory(m.profile,'actor-arrival-fixture-original-source-');
  if(!profile.endsWith('/frontier_0_0'))throw Error('Require copied return profile');
  // This is stopped native evidence. Historical receipt reconstruction must
  // survive a later ownership commit; packet export remains current-only.
  await verifyReturnCapsule(packetProof.returnReport,{requireCurrent:false});
  const capsuleBytes=await bounded(packetProof.returnReport,32768),capsule=JSON.parse(capsuleBytes),p=capsule.plan;
  if(sha(capsuleBytes)!==packetProof.returnReportSha256||packetProof.nativeReturnQualified!==false||packetProof.version!==1||
     p.receipt!==packetProof.receipt||p.receipt!==m.selectedRevisionExport?.receipt||packetProof.planSha256!==capsule.planSha256||
     p.destinationWorld!==packetProof.destinationWorld||p.destinationWorld!==m.selectedRevisionExport.sha256||
     p.sourceWorld!==packetProof.sourceWorld)throw Error('Return capsule/selected world binding differs');
  const sources=await verifiedNativeSources(m);
  const exporter='scripts/export-native-entity-return-packet.mjs';
  sources[exporter]=sha(await readFile(join(workspace,exporter)));
  if(packetProof.sourceSha256!==sources[exporter])throw Error('Return packet exporter provenance differs');
  const base=await verifyDepartedReload(manifestName,{beforeReturnActivation:active});
  if(base.originalBrashnardSourceReloadQualified!==true||base.unchangedSurvivingEntityRecords!==2111||base.originalLoadedUnits!==1959)
    throw Error('Missing original receiving-world reload qualification');
  const log=(await bounded(m.log,1024*1024)).toString('utf8');
  let sourceUnit,sourceAgent,unitId,agentId,clock,entries,commandBit;
  if(active) {
    const rows=[...log.matchAll(/^\[streaming\] Return active unit=(\d+) agent=(\d+) clock=(\d+) physical=1 footprint=([1-9]\d*) drawing=1 others-preserved=1 queued=1 queues-preserved=1 counters=1 hooks=1 ready-saved=1 active-writers=1 commands=1 retained=1 result=pass$/gm)];
    if(rows.length!==1||/^\[streaming\] Private return completed/m.test(log)||/^\[streaming\] Return commands cleanup/m.test(log))throw Error('Missing retained original return activation');
    [unitId,agentId,clock]=rows[0].slice(1,4).map(Number);
    sourceUnit=p.sourceAlias.unitId;sourceAgent=p.sourceAlias.agentId;entries=70;commandBit=1;
  } else {
    const rows=[...log.matchAll(/^\[streaming\] Private return completed source-unit=(\d+) source-agent=(\d+) unit=(\d+) agent=(\d+) clock=(\d+) unit-equal=1 script-equal=1 absent=1 groups=1 queues=1 entries=(\d+) hooks=1 commands-restored=([01]) active=0 result=pass$/gm)];
    if(rows.length!==1)throw Error('Missing exact native return/cleanup evidence');
    [sourceUnit,sourceAgent,unitId,agentId,clock,entries,commandBit]=rows[0].slice(1).map(Number);
  }
  if(commandBit!==Number(restoreCommands))throw Error('Command restoration mode differs from native evidence');
  if(sourceUnit!==p.sourceAlias.unitId||sourceAgent!==p.sourceAlias.agentId||unitId!==base.nativeCounters.nativeCounter+1||
     agentId!==base.nativeCounters.scriptCounter||unitId<=p.retiredDestinationAlias.unitId||agentId<=p.retiredDestinationAlias.agentId||entries!==70)
    throw Error('Fresh original IDs do not match receiving counters');
  const stage=[...log.matchAll(/^\[streaming\] Private return stage unit=[0-9a-f]{8} status=00000000 script=(\d+) clock=(\d+) applied=(\d+)$/gm)];
  const applied=p.edits.filter(e=>e.record!=='Orders').length;
  if(stage.length!==1||stage[0].slice(1).map(Number).join(',')!==[agentId,clock,applied].join(',')||
    log.split('\n').filter(l=>l===`[streaming] Private return writers unit=${unitId} agent=${agentId} links=1 unit-equal=1 script-equal=1`).length!==1)
    throw Error('Missing original private readers/writers');
  const raw={};for(const kind of ['Unit','GPL','Orders'])raw[kind]=await bounded(join(capsule.directory,kind+'.bin'),4096);
  const packet=await bounded(join(profile,'Native_Return_Packet.bin'),8192),expectedHeader=[0x3154524e,1,sourceUnit,sourceAgent,
    p.retiredDestinationAlias.unitId,p.retiredDestinationAlias.agentId,p.sourceClock,...Object.values(raw).map(b=>b.length),p.edits.length];
  if(packetProof.bytes!==packet.length||packetProof.edits!==p.edits.length||packetProof.sha256!==sha(packet)||
    expectedHeader.some((v,i)=>packet.readUInt32LE(i*4)!==v))throw Error('Native return packet header differs');
  let at=44;
  for(const b of Object.values(raw)){assert.deepEqual(packet.subarray(at,at+b.length),b);at+=b.length;}
  for(const e of p.edits) {
    let kind=0,value=e.after,nonzero=0;
    if(value==='fresh-unit-id'){kind=1;value=0;}else if(value==='fresh-agent-id'){kind=2;value=0;}
    else if(typeof value==='object'){kind=3;nonzero=Number(value.rejectZero);value=value.destinationClockMinusElapsed;}
    assert.deepEqual(Array.from({length:6},(_,i)=>packet.readUInt32LE(at+i*4)),[['Unit','GPL','Orders'].indexOf(e.record),e.offset,e.before,kind,value,nonzero]);at+=24;
  }
  if(at!==packet.length)throw Error('Trailing native return packet data');
  const expected={Unit:Buffer.from(raw.Unit),GPL:Buffer.from(raw.GPL)},privateInput={Unit:Buffer.from(raw.Unit),GPL:Buffer.from(raw.GPL)};
  for(const e of p.edits) {
    if(e.record==='Orders')continue;
    let value=e.after;
    if(value==='fresh-unit-id')value=unitId;else if(value==='fresh-agent-id')value=agentId;
    else if(typeof value==='object'){value=(clock-value.destinationClockMinusElapsed)>>>0;if(e.after.rejectZero&&!value)throw Error('Forbidden zero context stamp');}
    expected[e.record].writeUInt32LE(value>>>0,e.offset);
    privateInput[e.record].writeUInt32LE(e.after==='fresh-unit-id'?0:value>>>0,e.offset);
  }
  const evidence={};
  for(const kind of ['Unit','GPL'])for(const phase of ['Input','Observed']) {
    const name=join(profile,`Return_${kind}_${phase}.bin`),b=await bounded(name,4096);
    assert.deepEqual(b,(phase==='Input'?privateInput:expected)[kind],`Original ${kind} ${phase} differs from independently applied capsule`);
    evidence[name]=sha(b);
  }
  let commands=null;
  if(restoreCommands) {
    const move=p.navigation.find(n=>n.kind===2),path=p.navigation.find(n=>n.kind===4),pathEntry=p.entries.find(e=>e.kind===4),moveEntry=p.entries.find(e=>e.kind===2);
    if(!move||!path||!pathEntry||!moveEntry)throw Error('Missing current command navigation plan');
    const goals=[...log.matchAll(/^\[streaming\] Return route goal requested=(\d+),(\d+) resolved=(\d+),(\d+) observed=1 original=1$/gm)];
    const routeRows=[...log.matchAll(/^\[streaming\] Composed route points warm=0 trial=0 count=(\d+) values=([\d,;]+)$/gm)];
    if(goals.length!==1||routeRows.length!==1)throw Error('Missing original receiving goal resolver/route');
    const [requestedX,requestedY,resolvedX,resolvedY]=goals[0].slice(1).map(Number),count=Number(routeRows[0][1]),
      points=routeRows[0][2].split(';').map(pair=>pair.split(',').map(Number));
    if(count<=1||count>=64||count>path.capacity||count!==points.length||points.some(pair=>pair.length!==2||pair.some(v=>!Number.isInteger(v)||v<0||v>=512)))
      throw Error('Invalid bounded original receiving route');
    assert.deepEqual(points[0],[p.position.physicalCells.x,p.position.physicalCells.y]);
    assert.deepEqual(points.at(-1),[resolvedX,resolvedY]);
    for(let i=1;i<count;++i) {
      const dx=Math.abs(points[i][0]-points[i-1][0]),dy=Math.abs(points[i][1]-points[i-1][1]);
      if(dx>1||dy>1||!dx&&!dy)throw Error('Nonadjacent receiving route');
    }
    const requests=p.sourceOrderAllocations.requests.length,reservedBytes=p.sourceOrderAllocations.plan.allocationRequestBytes,
      outputBytes=raw.Orders.length-path.pathBytes+count*8;
    const summary=`[streaming] Return commands restored requests=${requests} reserved-bytes=${reservedBytes} source-bytes=${raw.Orders.length} output-bytes=${outputBytes} old-count=${path.count} old-cursor=${path.cursor} count=${count} cursor=0 capacity=${path.capacity} grid=512 move-goal=${move.goalAfter.x},${move.goalAfter.y},${move.goalAfter.z} writer-equal=1 transferred=1 result=pass`;
    const graphRead=`[streaming] Return commands read complete=1 claimed=1 requests=${requests} bytes=${raw.Orders.length} failure=0`;
    const cleanup=`[streaming] Return commands cleanup requests=${requests} all-extents-freed=1 result=pass`;
    for(const line of [summary,graphRead,...(active?[]:[cleanup])])if(log.split('\n').filter(l=>l===line).length!==1)throw Error('Missing original command readers/writer/extent cleanup');
    const routeProof=[...log.matchAll(/^\[streaming\] Composed route warm=0 trial=0 count=(\d+) validated=(\d+) capacity=64 expansion-limit=512 used-nodes=(\d+) node-capacity=8192 redzones=1 scratch-clear=1 lists-empty=1 caches-retired=1 pool-same=1 preserved=1 retained-bytes=0 retained-blocks=0 result=pass$/gm)];
    if(routeProof.length!==1||Number(routeProof[0][1])!==count||Number(routeProof[0][2])!==count||Number(routeProof[0][3])<1||Number(routeProof[0][3])>4097)
      throw Error('Missing collision/owned path cache retirement evidence');
    const patched=Buffer.from(raw.Orders);
    for(const e of p.edits.filter(e=>e.record==='Orders')) {
      assert.equal(patched.readUInt32LE(e.offset),e.before);
      const after=typeof e.after==='object'?(clock-e.after.destinationClockMinusElapsed)>>>0:e.after;
      patched.writeUInt32LE(after,e.offset);
    }
    assert.deepEqual([requestedX,requestedY],[Math.trunc(patched.readInt32LE(pathEntry.offset+104)/16),Math.trunc(patched.readInt32LE(pathEntry.offset+108)/16)]);
    for(let axis=0;axis<3;++axis)patched.writeInt32LE(move.goalAfter[['x','y','z'][axis]],moveEntry.offset+104+axis*4);
    patched.writeUInt32LE(0,pathEntry.offset+120);patched.writeUInt32LE(count,pathEntry.offset+136);
    const route=Buffer.alloc(count*8);points.forEach((pair,i)=>pair.forEach((v,j)=>route.writeUInt32LE(v,i*8+j*4)));
    const wanted=Buffer.concat([patched.subarray(0,path.pathOffset),route,patched.subarray(path.pathOffset+path.pathBytes)]);
    const ordersName=join(profile,'Return_Orders_Observed.bin'),actual=await bounded(ordersName,2048);
    assert.equal(actual.length,outputBytes);assert.deepEqual(actual,wanted,'Original return command writer differs from independently rebuilt state');
    evidence[ordersName]=sha(actual);
    commands={originalReaderQualified:true,exactWriterQualified:true,originalGoalResolverObserved:true,requestedGoal:[requestedX,requestedY],resolvedGoal:[resolvedX,resolvedY],
      collisionValidatedWaypoints:count,sourceWaypointsDiscarded:path.count,pathCursor:0,pathCapacity:path.capacity,moveGoal:move.goalAfter,
      commandDispatchAgesPreserved:true,ownedReservations:requests,initialReservationBytes:reservedBytes,originalBankCleanupQualified:!active,allOwnedExtentsFreed:!active,
      writerBytes:outputBytes,pathCachesRetired:true,actorActivated:active,inFlightMoveLinkExecutionQualified:false};
  } else if(/^\[streaming\] Return commands/m.test(log))throw Error('Unexpected command restoration');
  evidence[resolve(manifestName)]=sha(manifest);evidence[m.log]=sha(Buffer.from(log));evidence[join(profile,'Native_Return_Packet.bin')]=sha(packet);
  const identity={unitId,agentId,nativeCounterBefore:base.nativeCounters.nativeCounter,scriptCounterBefore:base.nativeCounters.scriptCounter};
  return {qualified:true,scope:active?'Native UNIT/GPL/command restoration and original retained activation gate. Movement, AI execution and returned full-save contents require the active-return verifier; no cleanup or paired ownership claim.':restoreCommands?'One isolated native private UNIT/GPL/command return restoration, original ID reservation, rebuilt receiving route, exact original writer bytes and owned command/registry/queue cleanup. No actor activation, outgoing removal or handoff publication.':'One isolated native private UNIT/GPL return restoration, original ID reservation, exact writer bytes, known leader rebinding and registry/queue cleanup. No command restoration, activation, outgoing removal or handoff publication.',
    sourceManifest:resolve(manifestName),sourceManifestSha256:sha(manifest),fixture:m,receivingWorld:{originalLoadedUnits:base.originalLoadedUnits,unchangedSurvivingEntityRecordsBeforePrivateStage:base.unchangedSurvivingEntityRecords,
      snapshot:{filename:base.roundtrip.filename,bytes:base.roundtrip.bytes,sha256:base.roundtrip.sha256}},
    identity,clock,appliedEdits:applied,pendingCommandEdits:restoreCommands?0:p.edits.length-applied,commands,recordBytes:{Unit:raw.Unit.length,GPL:raw.GPL.length,Orders:raw.Orders.length},packetBytes:packet.length,
    originalPrivateReturnReadersQualified:true,originalFreshIdentityReservationQualified:true,exactReturnUnitAndScriptWritersQualified:true,knownLeaderRebindingQualified:true,
    originalRegistryAndQueueCleanupQualified:!active,commandsRestored:restoreCommands,actorActivated:active,completeNativeReturnQualified:false,sourceDestinationOwnershipHandoffQualified:false,
    continuousPagingQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,sourceSha256:{...sources,'scripts/check-native-private-return.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:evidence};
}
export async function verifyPrivateReturn(manifestName) {return verifyReturnRestoration(manifestName);}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [manifest,output]=process.argv.slice(2);if(!manifest||!output||process.argv.length!==4)throw Error('Usage: <terminal native manifest> <fresh output|--stdout>');
  const report=await verifyPrivateReturn(manifest);
  if(output==='--stdout')console.log(JSON.stringify(report));
  else{await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,identity:report.identity,clock:report.clock,appliedEdits:report.appliedEdits,completeNativeReturnQualified:false}));}
}
