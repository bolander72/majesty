// Restore the actual selected dormant home after the second remote retirement.
// Only private native input files change; the selected recovery journal stays put.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,open,rename,unlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedHeroRouteStorage} from './stopped-hero-route-io.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {HeroRouteStore} from '../../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';
import {prepareSelectedHeroHomeArrival} from './prepare-selected-hero-home-arrival.mjs';
import {publishHeldHeroRepeatHomeArrival} from './publish-held-hero-repeat-home-arrival.mjs';
import {stageSelectedHeroBrowserInput} from './stage-selected-hero-browser-input.mjs';

export async function stageSelectedHeroRepeatHome(m,first,capture,{beforeDeparture=false}={}){
 assert.equal(m.pageRepeatHome,true);assert.equal(m.repeatReturn,true);process.kill(m.nativePid,0);
 const output=join(m.fixture,'repeat-home-page-input.json');await assert.rejects(lstat(output),e=>e.code==='ENOENT');
 let completed=beforeDeparture;assert.ok(!beforeDeparture||m.publicTravel===true);
 for(let i=0;i<160;i++){
  process.kill(m.nativePid,0);assert.ok((await lstat(m.log)).size<m.logCeilingBytes);
  if(completed||(await readFile(m.log,'utf8')).includes('[frontier] Hero remote source retirement completed serial=6 region=1_0 ')){completed=true;break;}
  await new Promise(r=>setTimeout(r,50));
 }
 assert.equal(completed,true,'Second remote retirement must complete before loading home');
 const stats={},io=await stoppedHeroRouteStorage(capture.journal,stats),store=new HeroRouteStore(io,first.identity,first.identity.contentDigest);
 const profile=join(m.fixture,'frontier_0_0'),save=join(profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0_Recovery.GMP');
 async function stream(path,source){const temp=path+'.tmp',f=await open(temp,'wx');
  try{for(let at=0;at<source.size;at+=4096){const bytes=await source.readAt(at,Math.min(4096,source.size-at));
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at+i);assert.ok(bytesWritten);i+=bytesWritten;}}
   await f.sync();}finally{await f.close();}await rename(temp,path);
  const d=await open(dirname(path),'r');try{await d.sync();}finally{await d.close();}}
 const neighbor=JSON.parse(await readFile(join(m.fixture,'repeat-neighbor-publication.json'),'utf8'));
 assert.equal(neighbor.nativeHeldHeroRepeatNeighborPairPublished,true);assert.equal(neighbor.nativePid,m.nativePid);assert.equal(neighbor.fixture,m.fixture);
 let entry,clock,escaped,returnArrival;
 await store.withDestination(capture.crossing.target,null,async v=>{
  assert.equal(v.record.manifest,capture.publicationReceipt.ownerManifest);assert.equal(v.record.revision,9);
  assert.equal(v.owner.region,'1_0');assert.deepEqual(v.entries[0].alias,capture.publicationReceipt.owner);
  assert.equal(await checkpointSavedClock(v.sources[0]),capture.crossing.clock);
  entry=v.entries[1];assert.equal(entry.region,'0_0');assert.deepEqual(entry.homeAlias,{kind:'native',unitId:first.identity.registeredHome.home.unitId,agentId:first.identity.registeredHome.home.agentId});
  assert.equal(entry.world.sha256,neighbor.retired.sha256);assert.equal(entry.world.size,neighbor.retired.bytes);
  clock=await checkpointSavedClock(v.sources[1]);assert.equal(clock,await checkpointSavedClock(await stoppedFileSource(neighbor.retired.filename)));
  if(m.importRepeatHome){
   const prepared=await prepareSelectedHeroHomeArrival(first.identity,v,capture.crossing),packName=join(profile,'Frontier_Hero_Arrival.pack');
   const {pack,...plan}=prepared;await stream(packName,{size:pack.length,async readAt(at,n){return new Uint8Array(pack.subarray(at,at+n));}});
   returnArrival={...plan,pack:{filename:packName,...await hashNativeFile(packName)}};
  }
  await stream(join(profile,'Hero_Repeat_Return_Home_Input.GMP'),v.sources[1]);await stream(save,v.sources[1]);escaped=v.sources[1];
 });await assert.rejects(escaped.readAt(0,16),/lease ended/);
 const target={filename:join(profile,'Hero_Repeat_Return_Home_Input.GMP'),...await hashNativeFile(join(profile,'Hero_Repeat_Return_Home_Input.GMP'))};
 assert.equal(target.sha256,entry.world.sha256);assert.equal(target.bytes,entry.world.size);
 const nativeSlot={filename:save,...await hashNativeFile(save)};assert.equal(nativeSlot.sha256,target.sha256);assert.equal(nativeSlot.bytes,target.bytes);
 const nativeManifest=['checkpoint-v1','1',target.bytes,target.sha256,
  '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n');
 const marker=join(profile,'Frontier_0_0.checkpoint'),bytes=Buffer.from(nativeManifest);
 await stream(marker,{size:bytes.length,async readAt(at,n){return new Uint8Array(bytes.subarray(at,at+n));}});
 let inputMarker=marker;const firstReturnObserved={};let firstReturnAcknowledgement,firstRepeatCaptureAcknowledgement;
 if(m.publishRepeatHome){inputMarker=join(profile,'Hero_Repeat_Return_Home_Input.checkpoint');await stream(inputMarker,{size:bytes.length,async readAt(at,n){return new Uint8Array(bytes.subarray(at,at+n));}});}
 if(m.importRepeatHome){
  for(const name of ['Hero_Arrival_Arrival_Unit_Observed.UNIT','Hero_Arrival_Arrival_Agent_Observed.GPL',
   'Hero_Arrival_Arrival_Container_Observed.bin','Hero_Arrival_Arrival_Orders_Observed.bin']){
   const copy=join(profile,'First_Return_'+name);await stream(copy,await stoppedFileSource(join(profile,name)));
   firstReturnObserved[name]={filename:copy,...await hashNativeFile(copy)};
  }
  const a=returnArrival;returnArrival.request=`majesty-hero-home-arrival-v1|6|0_0|${clock}|${entry.homeAlias.unitId}|${entry.homeAlias.agentId}|${a.options.sourceClockMs}|${a.pack.bytes}|${a.pack.sha256}\n`;
  const request=Buffer.from(returnArrival.request);await stream(join(profile,'Frontier_Hero_Repeat_Home_Arrival.txt'),{size:request.length,async readAt(at,n){return new Uint8Array(request.subarray(at,at+n));}});
  returnArrival.browserInput=await stageSelectedHeroBrowserInput(m,capture,{region:'0_0',clock,
    homeAlias:entry.homeAlias,nativeManifest},returnArrival);
 }
 if(m.publishRepeatHome){
  const old=join(profile,'Frontier_Hero_Travel_Published.txt'),previous=JSON.parse(await readFile(join(m.fixture,'home-publication.json'),'utf8'));
  assert.equal(previous.nativePid,m.nativePid);assert.equal(await readFile(old,'utf8'),previous.publicationReceipt.acknowledgement);
  const copy=join(profile,'Hero_First_Return_Home_Published.txt');await stream(copy,await stoppedFileSource(old));
  firstReturnAcknowledgement={filename:copy,...await hashNativeFile(copy)};await unlink(old);
 }
 if(m.saveRepeatHome){
  const old=join(profile,'Frontier_Hero_Capture_Published.txt'),previous=JSON.parse(await readFile(join(m.fixture,'repeat-departure-publication.json'),'utf8'));
  assert.equal(previous.nativePid,m.nativePid);assert.equal(await readFile(old,'utf8'),previous.acknowledgement);
  const copy=join(profile,'Hero_First_Repeat_Departure_Published.txt');await stream(copy,await stoppedFileSource(old));
  firstRepeatCaptureAcknowledgement={filename:copy,...await hashNativeFile(copy)};await unlink(old);
 }
 for(const[n,h]of Object.entries(capture.journalSha256))assert.equal((await hashNativeFile(join(capture.journal,n))).sha256,h);
 assert.equal(stats.writes??0,0);
 const request=`majesty-hero-home-ready-v1|6|0_0|${clock}|${target.bytes}|${target.sha256}\n`;
 const report={version:1,selectedHeroRepeatHomeStaged:true,nativePid:m.nativePid,fixture:m.fixture,journal:capture.journal,
  ownerManifest:capture.publicationReceipt.ownerManifest,targetEntry:entry,targetClock:clock,target,nativeSlot:m.saveRepeatHome?target:nativeSlot,
  nativeInputSlotPreservedForContinuedSave:m.saveRepeatHome===true,
  nativeMarker:{filename:inputMarker,...await hashNativeFile(inputMarker)},nativeManifest,request,stats,destinationReaderRevoked:true,
  journalUnchanged:true,heroImported:false,ownerTransferred:false,browserUsed:false,goalComplete:false};
 if(returnArrival)Object.assign(report,{returnArrival,firstReturnObserved});
 if(firstReturnAcknowledgement)report.firstReturnAcknowledgement=firstReturnAcknowledgement;
 if(firstRepeatCaptureAcknowledgement)report.firstRepeatCaptureAcknowledgement=firstRepeatCaptureAcknowledgement;
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 if(beforeDeparture)return report;
 const ready=Buffer.from(request);await stream(join(m.fixture,'frontier_1_0/Frontier_Hero_Repeat_Home_Ready.txt'),{
  size:ready.length,async readAt(at,n){return new Uint8Array(ready.subarray(at,at+n));}});
 console.log(JSON.stringify({selectedHeroRepeatHomeStaged:true,targetClock:clock,journalUnchanged:true}));
 if(m.publishRepeatHome)await publishHeldHeroRepeatHomeArrival(m,first,capture);
}
