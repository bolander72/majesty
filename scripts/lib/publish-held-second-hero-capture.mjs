// One supervised live native producer, already paused at its next original
// checkpoint. The serial owned filesystem adapter does not qualify OPFS or
// competing writers. All saved-world reads and journal writes stay bounded.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdtemp,open,readdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './stopped-hero-route-io.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../../web/world/hero-route-store.mjs';
import {selectedHeroRuntimeBinding} from '../../web/world/hero-runtime-binding.mjs';
import {requireCheckpointHeroCrossing} from '../../web/world/hero-travel-boundary.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';
import {verifyRegisteredHeroSnapshot} from '../../web/world/entity-home-ownership.mjs';
import {acknowledgeHeldHeroRetirement} from './ack-held-hero-retirement.mjs';

const operation=value=>createHash('sha256').update(JSON.stringify(value)+'\n').digest('hex');
const descriptor=async filename=>({filename,...await hashNativeFile(filename)});

export async function publishHeldSecondHeroCapture(m,publication){
 assert.equal(m.publishSecondCapture,true);assert.equal(m.nativeSessionTerminal,false);
 await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
 const output=join(m.fixture,'second-publication.json');await assert.rejects(lstat(output),e=>e.code==='ENOENT');
 const p=publication,receipt=p.publicationReceipt,alias=receipt.owner,home=receipt.home;
 const stats={},io=await stoppedHeroRouteStorage(p.journal,stats),store=new HeroRouteStore(io,p.identity,p.identity.contentDigest);
 const selected=await store.withOwner(async v=>{
  assert.equal(v.record.manifest,receipt.ownerManifest);assert.deepEqual(v.entry.alias,alias);assert.deepEqual(v.entry.homeAlias,home);
  assert.equal(await checkpointSavedClock(v.source),receipt.clock);
  return {entry:v.entry,manifest:v.record.manifest,runtimeBinding:selectedHeroRuntimeBinding(p.identity,v.entry,receipt.clock)};
 });
 let log,crossing,held;
 for(let i=0;i<160;i++){
  process.kill(m.nativePid,0);assert.ok((await lstat(m.log)).size<m.logCeilingBytes);log=await readFile(m.log,'utf8');
  const crosses=[...log.matchAll(/^\[frontier\] Hero crossing serial=2 region=1_0 target=(\S+) previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) phase=3 pending=7 original-tick=1 native-cells=4$/gm)];
  const saves=[...log.matchAll(/^\[frontier\] Hero save held serial=2 region=1_0 clock=(\d+) slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) phase=7 pending=0$/gm)];
  assert.ok(crosses.length<=1&&saves.length<=1);
  if(crosses.length&&saves.length){
   const c=crosses[0],h=saves[0],pose=text=>Object.fromEntries(text.split(',').map((v,i)=>[['x','y','z'][i],Number(v)]));
   crossing={serial:2,region:'1_0',target:c[1],previousClock:Number(c[2]),clock:Number(c[3]),unitId:Number(c[4]),agentId:Number(c[5]),previous:pose(c[6]),accepted:pose(c[7])};
   held={serial:2,region:'1_0',clock:Number(h[1]),slot:Number(h[2]),size:Number(h[3]),sha256:h[4]};
   assert.ok(c.index<h.index);break;
  }
  await new Promise(r=>setTimeout(r,50));
 }
 assert.ok(crossing&&held,'Second original held capture missing');assert.equal(crossing.target,'0_0');assert.equal(held.clock,crossing.clock);
 assert.deepEqual({unitId:crossing.unitId,agentId:crossing.agentId},alias);assert.ok(crossing.previousClock>=receipt.clock);
 const profile=join(m.fixture,'frontier_1_0'),name='Frontier_1_0'+(held.slot?'_Recovery':'');
 let captured=await descriptor(join(profile,'Documents/My Games/MajestyHD/SaveGame',name+'.GMP'));
 assert.equal(captured.bytes,held.size);assert.equal(captured.sha256,held.sha256);
 let marker=await descriptor(join(profile,'Frontier_1_0.checkpoint'));
 const nativeManifest=await readFile(marker.filename,'utf8');
 assert.equal(nativeManifest,['checkpoint-v1',held.slot,held.size,held.sha256,
  '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
 if(m.pageRepeatNeighbor){
  // Re-entering this region replaces canonical slot0 and its marker. Keep
  // the earlier actual capture independently verifiable before that happens.
  for(const [row,target]of [[captured,join(profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Remote_Capture_Accepted.GMP')],
    [marker,join(profile,'Hero_Remote_Capture_Accepted.checkpoint')]]){
   const f=await open(target,'wx');let at=0;
   try{const result=await hashNativeFile(row.filename,{sink:async bytes=>{
    for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
   }});assert.equal(result.sha256,row.sha256);await f.sync();}finally{await f.close();}
  }
  captured=await descriptor(join(profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Remote_Capture_Accepted.GMP'));
  marker=await descriptor(join(profile,'Hero_Remote_Capture_Accepted.checkpoint'));
 }
 const source=await stoppedFileSource(captured.filename);
 const travel=await requireCheckpointHeroCrossing(source,selected.runtimeBinding,crossing);
 await verifyRegisteredHeroSnapshot(p.identity,alias,home,source,true,held.region);
 // Preserve the exact revision2 view for independent verification of the
 // earlier receipt gate. Never substitute this copy for the live journal.
 const beforeJournal=await mkdtemp(join(dirname(p.journal),'actor-arrival-fixture-hero-route-before-second-'));
 assert.deepEqual((await readdir(p.journal)).sort(),Object.keys(p.journalSha256).sort());
 for(const[n,h]of Object.entries(p.journalSha256)){
  const input=await descriptor(join(p.journal,n));assert.equal(input.sha256,h);
  const src=await stoppedFileSource(input.filename),dest=await open(join(beforeJournal,n),'wx');
  try{for(let at=0;at<src.size;at+=4096){const bytes=await src.readAt(at,Math.min(4096,src.size-at));
    let offset=0;while(offset<bytes.length){const w=await dest.write(bytes,offset,bytes.length-offset,at+offset);assert.ok(w.bytesWritten);offset+=w.bytesWritten;}}
   await dest.sync();}finally{await dest.close();}
  assert.equal((await hashNativeFile(join(beforeJournal,n))).sha256,h);
 }
 const dir=await open(beforeJournal,'r');try{await dir.sync();}finally{await dir.close();}
 const request={kind:'save',operationId:operation(['native-held-second-hero-capture-v1',selected.manifest,nativeManifest]),
  expectedManifest:selected.manifest,regions:[held.region],aliases:[alias],homeAliases:[home],worlds:[{source,sha256:captured.sha256}]};
 const controls=[];
 for(const [kind,run]of [
  ['old-native-alias',()=>store.commit({...request,aliases:[{unitId:508,agentId:25}]})],
  ['old-native-home',()=>store.commit({...request,homeAliases:[{kind:'native',unitId:469,agentId:7}]})],
  ['stale-manifest',()=>store.commit({...request,expectedManifest:p.capturedManifest})],
  ['wrong-held-clock',()=>requireCheckpointHeroCrossing(source,selected.runtimeBinding,{...crossing,clock:crossing.clock+50})],
  ['wrong-held-position',()=>requireCheckpointHeroCrossing(source,selected.runtimeBinding,{...crossing,accepted:{...crossing.accepted,y:crossing.accepted.y+1}})]
 ]){
  const writes=stats.writes??0;await assert.rejects(run);assert.equal(stats.writes??0,writes);
  assert.equal(await readFile(join(p.journal,HERO_ROUTE_HEAD),'utf8'),selected.manifest);
  controls.push({kind,refused:true,writes:0});
 }
 process.kill(m.nativePid,0);
 const result=await store.commit(request);assert.equal(result.revision,3);assert.equal(result.idempotent,false);
 const writes=stats.writes,retry=await store.commit(request);assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
 const opened=[],realOpen=io.open;io.open=async n=>{opened.push(n);return realOpen(n);};let escaped,owner;
 await store.withOwner(async v=>{
  assert.equal(v.record.manifest,result.manifest);assert.deepEqual(v.entry.alias,alias);assert.deepEqual(v.entry.homeAlias,home);
  assert.equal(v.entry.world.sha256,captured.sha256);assert.equal(await checkpointSavedClock(v.source),held.clock);
  owner=v.owner;escaped=v.source;
 });await assert.rejects(escaped.readAt(0,16),/lease ended/);
 assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_1_0_1.GMP']);
 assert.equal((await descriptor(captured.filename)).sha256,captured.sha256);assert.equal((await descriptor(marker.filename)).sha256,marker.sha256);
 process.kill(m.nativePid,0);log=await readFile(m.log,'utf8');
 assert.ok(!/Hero save (?:released|resumed|abandoned) serial=2/.test(log));
 const journalSha256={};for(const n of (await readdir(p.journal)).sort())journalSha256[n]=(await hashNativeFile(join(p.journal,n))).sha256;
 const report={version:1,nativeHeldSecondHeroCapturePublished:true,nativePid:m.nativePid,fixture:m.fixture,
  firstPublication:{filename:join(m.fixture,'publication.json'),sha256:(await hashNativeFile(join(m.fixture,'publication.json'))).sha256},
  beforeJournal,beforeJournalSha256:p.journalSha256,journal:p.journal,journalSha256,selectedBinding:selected.runtimeBinding,
  expectedManifest:selected.manifest,ownerManifest:result.manifest,ownerRevision:result.revision,owner,homeAlias:home,
  crossing,held,captured,marker,nativeManifest,travel,controls,stats,exactRetryWrites:0,
  ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,capturedWhileNativeHeld:true,nativeResumeAcknowledged:false,
  sourceRetired:false,secondDestinationLoaded:false,browserUsed:false,realOPFSDurabilityQualified:false,goalComplete:false};
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({nativeHeldSecondHeroCapturePublished:true,ownerRevision:3,clock:held.clock,controls:controls.length,nativeKeptHeld:true}));
 if(m.retireRemoteSource)await acknowledgeHeldHeroRetirement(m,p,report);
}
