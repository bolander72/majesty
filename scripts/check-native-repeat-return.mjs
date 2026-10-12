#!/usr/bin/env node
// Independent stopped proof of the next original native private restoration.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRepeatCrossingCapsule} from './prepare-native-repeat-crossing.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=65536) {
  const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Repeat evidence exceeds bound');
  const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;
}
export async function repeatReceivingMembership(name,retired=null,{unscheduledAgents=[]}={}) {
  assert.ok(Array.isArray(unscheduledAgents)&&unscheduledAgents.length<=32);
  assert.equal(new Set(unscheduledAgents).size,unscheduledAgents.length);
  assert.ok(unscheduledAgents.every(id=>Number.isInteger(id)&&id>0&&id<=0xffffffff));
  const s=await stoppedFileSource(name),records={units:{},agents:{},attachments:{}},counts={};
  for(const [kind,iterator,key] of [['units',checkpointUnits(s),r=>r.primary.words[1]],['agents',checkpointAgents(s),r=>r.agentId],
    ['attachments',checkpointAttachments(s),r=>r.kind+':'+r.unitId]]) {
    let n=0;
    for await(const r of iterator) {
      const id=key(r);if(++n>5000||records[kind][id])throw Error('Invalid receiving membership');
      const h=createHash('sha256');for(let at=0;at<r.size;at+=4096)h.update(await s.readAt(r.offset+at,Math.min(4096,r.size-at)));
      records[kind][id]={bytes:r.size,sha256:h.digest('hex')};
    }
    counts[kind]=n;
  }
  if(retired&&(records.units[retired.unitId]||records.agents[retired.agentId]||records.attachments['ORDR:'+retired.unitId]))throw Error('Retired receiving NPC reappeared');
  const queues=[[],[]],seen=new Set();let activeQueue;
  for await(const q of checkpointAgentQueues(s)) {
    if(q.type==='queue-selector'){if(activeQueue!==undefined)throw Error('Duplicate selector');activeQueue=q.activeQueue;}
    else {if(seen.has(q.agentId)||!records.agents[q.agentId])throw Error('Invalid receiving queue');seen.add(q.agentId);queues[q.queue].push(q.agentId);}
  }
  const unscheduled=Object.keys(records.agents).map(Number).filter(id=>!seen.has(id)).sort((a,b)=>a-b);
  if(activeQueue===undefined)throw Error('Incomplete receiving queues');
  assert.deepEqual(unscheduled,[...unscheduledAgents].sort((a,b)=>a-b),'Incomplete receiving queues');
  return {filename:name,bytes:s.size,sha256:await hashCheckpointSource(s),counts,records,queues,activeQueue};
}
export async function verifyRepeatRestoration(manifestName,{active=false}={}) {
  const manifest=await bounded(manifestName),m=JSON.parse(manifest),sources=await verifiedNativeSources(m);
  if(m.repeatReturn!==true||m.restoreReturnCommands!==true||m.activateReturnedNpc!==active||m.observeMotion!==active||
    (active&&(m.observeReturnMotion!==true||m.captureReturnEvolved!==true))||
    m.reloadDepartedNpc!==true||m.clockMode!==(active?'monotonic':'pinned')||m.physicalGridExtent!==256)throw Error('Require isolated repeated private restore');
  const profile=await ownedDirectory(m.profile,'actor-arrival-fixture-joint-reload-');
  if(profile!==join(m.fixture,'frontier_0_0'))throw Error('Invalid isolated receiving profile');
  const packetProof=m.privateReturnPacket;
  if(packetProof.version!==2||packetProof.nativeReturnQualified!==false)throw Error('Wrong repeat packet version');
  await verifyRepeatCrossingCapsule(packetProof.returnReport,{requireCurrent:false});
  const capsuleBytes=await bounded(packetProof.returnReport,32768),capsule=JSON.parse(capsuleBytes),p=capsule.plan;
  assert.equal(sha(capsuleBytes),packetProof.returnReportSha256);assert.equal(capsule.planSha256,packetProof.planSha256);
  assert.equal(p.sourceWorld,packetProof.sourceWorld);assert.equal(p.destinationWorld,packetProof.destinationWorld);assert.equal(p.receipt,packetProof.receipt);
  assert.equal(p.revision,5);assert.equal(p.sourceSide,0);assert.equal(p.destinationSide,1);
  const selected=await verifyRevisionExport(p.receipt,1,p.destinationWorld,{requireCurrent:false});assert.deepEqual(m.selectedRevisionExport,selected);
  const pub=JSON.parse(await bounded(p.publicationReport)),pairBytes=await bounded(pub.reloadReport,1024*1024),pair=JSON.parse(pairBytes),producer=pair.absent.fixture;
  assert.equal(sha(pairBytes),pub.reloadReportSha256);assert.equal(m.producerManifest,pair.absent.sourceManifest);
  const producerBytes=await bounded(m.producerManifest);assert.equal(sha(producerBytes),m.producerManifestSha256);assert.deepEqual(JSON.parse(producerBytes),producer);
  assert.notEqual(m.nativePid,producer.nativePid);assert.notEqual(profile,producer.profile);
  const buildBytes=await bounded(m.buildReport),build=JSON.parse(buildBytes);assert.equal(sha(buildBytes),m.buildReportSha256);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert.deepEqual(build.nativeSourceSha256,sources);
  assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256AtLaunch);
  const exporter='scripts/export-native-repeat-return-packet.mjs';sources[exporter]=sha(await readFile(join(workspace,exporter)));
  assert.equal(packetProof.sourceSha256,sources[exporter]);
  const settings=['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav'],worldName='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP';
  assert.deepEqual(Object.keys(m.inputHashes).sort(),[...settings,worldName,'Joint_Reload_Expected.bin','Native_Return_Packet.bin'].sort());
  const evidence={};
  for(const [name,digest] of Object.entries(m.inputHashes)) {
    const file=join(profile,name),s=await stoppedFileSource(file);assert.equal(await hashCheckpointSource(s),digest);evidence[file]=digest;
    if(settings.includes(name))assert.equal(digest,producer.inputHashes[name]);
  }
  assert.equal(m.inputHashes[worldName],p.destinationWorld);
  const expectedHeader=await bounded(join(profile,'Joint_Reload_Expected.bin'),16);assert.equal(expectedHeader.length,16);
  assert.deepEqual(Array.from({length:4},(_,i)=>expectedHeader.readUInt32LE(i*4)),[0x31524a4e,2,p.retiredDestinationAlias.unitId,p.retiredDestinationAlias.agentId]);
  const before=await repeatReceivingMembership(join(profile,worldName),p.retiredDestinationAlias),roundtrip=await repeatReceivingMembership(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Departed_Reload.GMP'),p.retiredDestinationAlias);
  assert.equal(before.sha256,p.destinationWorld);assert.equal(before.bytes,selected.bytes);
  for(const key of ['counts','records','queues','activeQueue'])assert.deepEqual(roundtrip[key],before[key]);
  const log=(await bounded(m.log,1024*1024)).toString('utf8');
  if(!log.includes('all expectations met')||/result=fail|SIGSEGV|exception e06d7363|undeliverable call(?!s: none)/i.test(log)||
    /^\[streaming\] (Joint departure|Joint scheduled reload)/m.test(log)||
    (!active&&/^\[streaming\] (Return active|Joint motion)/m.test(log)))throw Error('Failed or wrong repeat activation mode');
  const loaded=[...log.matchAll(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=\d+ sample-bytes=\d+$/gm)];
  assert.equal(loaded.length,1);assert.equal(Number(loaded[0][1]),before.counts.units);
  const absent=[...log.matchAll(/^\[streaming\] Joint departed reload unit=(\d+) agent=(\d+) unit-absent=1 agent-absent=1 entries=(\d+) queued=(\d+) groups=1 queues-same=1 counters-same=1 native-counter=(\d+) script-counter=(\d+) hooks-same=1 roundtrip-saved=1 result=pass$/gm)];
  assert.equal(absent.length,1);const [oldUnit,oldAgent,entries,queued,nativeCounter,scriptCounter]=absent[0].slice(1).map(Number);
  assert.deepEqual([oldUnit,oldAgent,entries,queued],[p.retiredDestinationAlias.unitId,p.retiredDestinationAlias.agentId,before.counts.agents,before.counts.agents]);
  const completed=[...log.matchAll(/^\[streaming\] Private return completed source-unit=(\d+) source-agent=(\d+) unit=(\d+) agent=(\d+) clock=(\d+) unit-equal=1 script-equal=1 absent=1 groups=1 queues=1 entries=(\d+) hooks=1 commands-restored=1 active=0 result=pass$/gm)];
  let sourceUnit,sourceAgent,unitId,agentId,clock,finalEntries;
  if(active) {
    assert.equal(completed.length,0);
    const activated=[...log.matchAll(/^\[streaming\] Return active unit=(\d+) agent=(\d+) clock=(\d+) physical=1 footprint=([1-9]\d*) drawing=1 others-preserved=1 queued=1 queues-preserved=1 counters=1 hooks=1 ready-saved=1 active-writers=1 commands=1 retained=1 result=pass$/gm)];
    assert.equal(activated.length,1);[unitId,agentId,clock]=activated[0].slice(1,4).map(Number);
    sourceUnit=p.sourceAlias.unitId;sourceAgent=p.sourceAlias.agentId;finalEntries=entries;
    if(/^\[streaming\] Return commands cleanup/m.test(log)||log.indexOf('[streaming] Joint departed reload ')>=log.indexOf('[streaming] Return active ')||
      log.indexOf('[streaming] Return active ')>=log.indexOf('[streaming] Joint motion begin '))throw Error('Invalid retained activation sequence');
  } else {assert.equal(completed.length,1);[sourceUnit,sourceAgent,unitId,agentId,clock,finalEntries]=completed[0].slice(1).map(Number);} 
  assert.deepEqual([sourceUnit,sourceAgent,unitId,agentId,finalEntries],[p.sourceAlias.unitId,p.sourceAlias.agentId,nativeCounter+1,scriptCounter,entries]);
  if(unitId<=oldUnit||agentId<=oldAgent)throw Error('Receiving IDs reused');
  const once=line=>assert.equal(log.split('\n').filter(l=>l===line).length,1,'Missing original native stage');
  once(`[streaming] Private return writers unit=${unitId} agent=${agentId} links=1 unit-equal=1 script-equal=1`);
  const stages=[...log.matchAll(/^\[streaming\] Private return stage unit=[0-9a-f]{8} status=00000000 script=(\d+) clock=(\d+) applied=(\d+)$/gm)];
  assert.equal(stages.length,1);assert.deepEqual(stages[0].slice(1).map(Number),[agentId,clock,p.edits.filter(e=>e.record!=='Orders').length]);
  const raw={};for(const kind of ['Unit','GPL','Orders'])raw[kind]=await bounded(join(capsule.directory,kind+'.bin'),2048);
  const packet=await bounded(join(profile,'Native_Return_Packet.bin'),8192),leader=p.referenceBindings[0].destination,grid=p.geometry.to.widthCells*2;
  assert.equal(grid,256);assert.equal(grid,p.geometry.to.heightCells*2);assert.deepEqual(packetProof.receivingLeader,leader);assert.equal(packetProof.physicalGridExtent,grid);
  assert.equal(packet.length,packetProof.bytes);assert.equal(sha(packet),packetProof.sha256);
  assert.deepEqual(Array.from({length:14},(_,i)=>packet.readUInt32LE(i*4)),[0x3154524e,2,sourceUnit,sourceAgent,oldUnit,oldAgent,p.sourceClock,...Object.values(raw).map(b=>b.length),p.edits.length,leader.unitId,leader.agentId,grid]);
  let at=56;for(const b of Object.values(raw)){assert.deepEqual(packet.subarray(at,at+b.length),b);at+=b.length;}
  const expected={Unit:Buffer.from(raw.Unit),GPL:Buffer.from(raw.GPL)},inputs={Unit:Buffer.from(raw.Unit),GPL:Buffer.from(raw.GPL)},patched=Buffer.from(raw.Orders);
  for(const e of p.edits) {
    let kind=0,value=e.after,nonzero=0;
    if(value==='fresh-unit-id'){kind=1;value=0;}else if(value==='fresh-agent-id'){kind=2;value=0;}
    else if(typeof value==='object'){kind=3;nonzero=Number(value.rejectZero);value=value.destinationClockMinusElapsed;}
    assert.deepEqual(Array.from({length:6},(_,i)=>packet.readUInt32LE(at+i*4)),[['Unit','GPL','Orders'].indexOf(e.record),e.offset,e.before,kind,value,nonzero]);at+=24;
    const after=(kind===1?unitId:kind===2?agentId:kind===3?clock-value:value)>>>0;if(nonzero&&!after)throw Error('Zero dispatch/context stamp');
    if(e.record==='Orders')patched.writeUInt32LE(after,e.offset);
    else {expected[e.record].writeUInt32LE(after,e.offset);inputs[e.record].writeUInt32LE(kind===1?0:after,e.offset);}
  }
  assert.equal(at,packet.length);
  for(const kind of ['Unit','GPL'])for(const [phase,wanted] of [['Input',inputs[kind]],['Observed',expected[kind]]]) {
    const file=join(profile,`Return_${kind}_${phase}.bin`),bytes=await bounded(file,2048);assert.deepEqual(bytes,wanted);evidence[file]=sha(bytes);
  }
  const path=p.navigation.find(n=>n.kind===4),move=p.navigation.find(n=>n.kind===2),pathEntry=p.entries.find(e=>e.kind===4),moveEntry=p.entries.find(e=>e.kind===2),
    goals=[...log.matchAll(/^\[streaming\] Return route goal requested=(\d+),(\d+) resolved=(\d+),(\d+) observed=1 original=1$/gm)],
    routes=[...log.matchAll(/^\[streaming\] Composed route points warm=0 trial=0 count=(\d+) values=([\d,;]+)$/gm)];
  assert.equal(goals.length,1);assert.equal(routes.length,1);
  const [gx,gy,rx,ry]=goals[0].slice(1).map(Number),count=Number(routes[0][1]),points=routes[0][2].split(';').map(pair=>pair.split(',').map(Number));
  if(count<2||count>=128||count>path.capacity||points.length!==count||points.some(p=>p.length!==2||p.some(v=>!Number.isInteger(v)||v<0||v>=grid)))throw Error('Invalid receiving route extent');
  assert.deepEqual(points[0],[p.position.physicalCells.x,p.position.physicalCells.y]);assert.deepEqual(points.at(-1),[rx,ry]);
  for(let i=1;i<count;++i){const dx=Math.abs(points[i][0]-points[i-1][0]),dy=Math.abs(points[i][1]-points[i-1][1]);if(dx>1||dy>1||!dx&&!dy)throw Error('Nonadjacent route');}
  assert.deepEqual([gx,gy],[Math.trunc(patched.readInt32LE(pathEntry.offset+104)/16),Math.trunc(patched.readInt32LE(pathEntry.offset+108)/16)]);
  const routeProof=[...log.matchAll(/^\[streaming\] Composed route warm=0 trial=0 count=(\d+) validated=(\d+) capacity=128 expansion-limit=512 used-nodes=(\d+) node-capacity=8192 redzones=1 scratch-clear=1 lists-empty=1 caches-retired=1 pool-same=1 preserved=1 retained-bytes=0 retained-blocks=0 result=pass$/gm)];
  assert.equal(routeProof.length,1);assert.deepEqual(routeProof[0].slice(1,3).map(Number),[count,count]);
  if(Number(routeProof[0][3])<1||Number(routeProof[0][3])>4097)throw Error('Unbounded original route search');
  const requests=p.sourceOrderAllocations.requests.length,reservedBytes=p.sourceOrderAllocations.plan.allocationRequestBytes,outputBytes=raw.Orders.length-path.pathBytes+count*8;
  once(`[streaming] Return commands read complete=1 claimed=1 requests=${requests} bytes=${raw.Orders.length} failure=0`);
  once(`[streaming] Return commands restored requests=${requests} reserved-bytes=${reservedBytes} source-bytes=${raw.Orders.length} output-bytes=${outputBytes} old-count=${path.count} old-cursor=${path.cursor} count=${count} cursor=0 capacity=${path.capacity} grid=${grid} move-goal=${move.goalAfter.x},${move.goalAfter.y},${move.goalAfter.z} writer-equal=1 transferred=1 result=pass`);
  if(!active)once(`[streaming] Return commands cleanup requests=${requests} all-extents-freed=1 result=pass`);
  for(let axis=0;axis<3;++axis)patched.writeInt32LE(move.goalAfter[['x','y','z'][axis]],moveEntry.offset+104+axis*4);
  patched.writeUInt32LE(0,pathEntry.offset+120);patched.writeUInt32LE(count,pathEntry.offset+136);
  const route=Buffer.alloc(count*8);points.forEach((p,i)=>p.forEach((v,j)=>route.writeUInt32LE(v,i*8+j*4)));
  const wanted=Buffer.concat([patched.subarray(0,path.pathOffset),route,patched.subarray(path.pathOffset+path.pathBytes)]),ordersFile=join(profile,'Return_Orders_Observed.bin'),orders=await bounded(ordersFile,2048);
  assert.equal(orders.length,outputBytes);assert.deepEqual(orders,wanted);evidence[ordersFile]=sha(orders);
  for(const name of ['scripts/check-native-repeat-return.mjs','scripts/run-native-repeat-return.py','scripts/lib/native-generation.mjs'])sources[name]=sha(await readFile(join(workspace,name)));
  return {qualified:true,scope:active?'Next original native restoration/retained activation gate on a256 grid. Further original motion, AI, full saves, outgoing removal and paired handoff require independent qualification.':'Next isolated private restoration from actual revision5 continuation in a256 grid: original fresh IDs, exact UNIT/GPL/Orders, original receiving route, preserved dispatch ages and known leader links, owned command/cache/registry/queue cleanup. Activation, outgoing removal, paired handoff, repeated gameplay and browser resource bounds unqualified.',
    sourceManifest:resolve(manifestName),sourceManifestSha256:sha(manifest),fixture:m,identity:{unitId,agentId},clock,sourceClock:p.sourceClock,
    receivingWorld:{counts:before.counts,recordsPreserved:Object.values(before.counts).reduce((a,b)=>a+b,0),inputSha256:before.sha256,roundtripSha256:roundtrip.sha256},
    originalPrivateRestorationQualified:true,originalFreshIdsQualified:true,exactWriterRecords:3,receivingGrid:grid,routePoints:count,sourceRoutePointsDiscarded:path.count,
    dispatchAgesPreserved:true,knownLeaderBinding:leader,commandRequests:requests,commandReservationBytes:reservedBytes,allCommandExtentsFreed:!active,routeCachesRetired:true,
    actorActivated:active,pairedOwnershipHandoffQualified:false,repeatedGameplayCrossingsQualified:false,wholeBrowserMemoryBoundQualified:false,
    browserUsed:false,nativeProcessesStarted:0,sourceSha256:sources,evidenceSha256:{...evidence,[resolve(manifestName)]:sha(manifest),[m.log]:sha(Buffer.from(log)),[roundtrip.filename]:roundtrip.sha256}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [manifest,output]=process.argv.slice(2);if(!manifest||!output||process.argv.length!==4)throw Error('Usage: <terminal repeat manifest> <fresh output|--stdout>');
  const r=await verifyRepeatRestoration(manifest);
  if(output==='--stdout')console.log(JSON.stringify(r));else {await writeFile(output,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,identity:r.identity,routePoints:r.routePoints,receivingGrid:r.receivingGrid,exactWriterRecords:r.exactWriterRecords,allCommandExtentsFreed:r.allCommandExtentsFreed}));}
}
