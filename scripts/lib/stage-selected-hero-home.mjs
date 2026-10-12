// Stage only the journal's actual selected dormant home in the owned native
// fixture after published capture and completed remote retirement. No journal
// mutation, hero import, native resume or browser durability claim occurs.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,open,rename} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedHeroRouteStorage} from './stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';
import {prepareSelectedHeroHomeArrival} from './prepare-selected-hero-home-arrival.mjs';
import {publishHeldHeroHomeArrival} from './publish-held-hero-home-arrival.mjs';
import {stageSelectedHeroBrowserInput} from './stage-selected-hero-browser-input.mjs';

export async function stageSelectedHeroHome(m,first,second,{beforeDeparture=false}={}){
 assert.equal(m.pageHome,true);assert.equal(m.retireRemoteSource,true);process.kill(m.nativePid,0);
 const output=join(m.fixture,'home-page-input.json');await assert.rejects(lstat(output),e=>e.code==='ENOENT');
 const stats={},io=await stoppedHeroRouteStorage(second.journal,stats),store=new HeroRouteStore(io,first.identity,first.identity.contentDigest);
 const profile=join(m.fixture,'frontier_0_0'),save=join(profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP');
 async function stream(path,source){const temp=path+'.tmp',f=await open(temp,'wx');
  try{for(let at=0;at<source.size;at+=4096){const bytes=await source.readAt(at,Math.min(4096,source.size-at));
    let offset=0;while(offset<bytes.length){const w=await f.write(bytes,offset,bytes.length-offset,at+offset);assert.ok(w.bytesWritten);offset+=w.bytesWritten;}}
   await f.sync();}finally{await f.close();}await rename(temp,path);
  const d=await open(dirname(path),'r');try{await d.sync();}finally{await d.close();}}
 let homeEntry,homeClock,escaped,returnArrival;
 await store.withDestination('0_0',null,async v=>{
  assert.equal(v.record.manifest,second.ownerManifest);assert.equal(v.owner.region,'1_0');assert.deepEqual(v.entries[0].alias,second.owner&&{unitId:second.owner.unitId,agentId:second.owner.agentId});
  homeEntry=v.entries[1];assert.equal(homeEntry.region,'0_0');assert.equal(homeEntry.homeAlias.kind,'native');
  assert.equal(homeEntry.homeAlias.unitId,first.identity.registeredHome.home.unitId);assert.equal(homeEntry.homeAlias.agentId,first.identity.registeredHome.home.agentId);
  assert.equal(homeEntry.world.sha256,first.retired.sha256);assert.equal(homeEntry.world.size,first.retired.bytes);
  homeClock=await checkpointSavedClock(v.sources[1]);
  if(m.importHome){
   const prepared=await prepareSelectedHeroHomeArrival(first.identity,v,second.crossing),packName=join(profile,'Frontier_Hero_Arrival.pack');
   const {pack,...plan}=prepared;
   await stream(packName,{size:pack.length,async readAt(at,n){return new Uint8Array(pack.subarray(at,at+n));}});
   let preservedPack=packName;
   if(m.importRepeatHome){preservedPack=join(profile,'Hero_First_Return_Arrival.pack');await stream(preservedPack,{size:pack.length,async readAt(at,n){return new Uint8Array(pack.subarray(at,at+n));}});}
   returnArrival={...plan,pack:{filename:preservedPack,...await hashNativeFile(preservedPack)}};
  }
  await stream(join(profile,'Hero_Travel_Home_Input.GMP'),v.sources[1]);await stream(save,v.sources[1]);escaped=v.sources[1];
 });await assert.rejects(escaped.readAt(0,16),/lease ended/);
 const homeSource={filename:join(profile,'Hero_Travel_Home_Input.GMP'),...await hashNativeFile(join(profile,'Hero_Travel_Home_Input.GMP'))};
 assert.equal(homeSource.sha256,homeEntry.world.sha256);assert.equal(homeSource.bytes,homeEntry.world.size);
 const nativeManifest=['checkpoint-v1','0',homeSource.bytes,homeSource.sha256,
  '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n');
 const marker=join(profile,'Frontier_0_0.checkpoint');
 const bytes=Buffer.from(nativeManifest);await stream(marker,{size:bytes.length,async readAt(at,n){return new Uint8Array(bytes.subarray(at,at+n));}});
 let inputMarker=marker;
 if(m.publishHome){inputMarker=join(profile,'Hero_Travel_Home_Input.checkpoint');await stream(inputMarker,{size:bytes.length,async readAt(at,n){return new Uint8Array(bytes.subarray(at,at+n));}});}
 const stagedSlot=await hashNativeFile(save);assert.equal(stagedSlot.sha256,homeSource.sha256);assert.equal(stagedSlot.bytes,homeSource.bytes);
 const request=`majesty-hero-home-ready-v1|2|0_0|${homeClock}|${homeSource.bytes}|${homeSource.sha256}\n`;
 const report={version:1,selectedHeroHomeStaged:true,nativePid:m.nativePid,fixture:m.fixture,journal:second.journal,
  ownerManifest:second.ownerManifest,homeEntry,homeClock,homeSource,nativeInputSlotPreservedForContinuedSave:m.saveHome===true,nativeSlot:m.saveHome?homeSource:{filename:save,...await hashNativeFile(save)},
  nativeMarker:{filename:inputMarker,...await hashNativeFile(inputMarker)},nativeManifest,request,stats,destinationReaderRevoked:true,
  capturedSourceMarker:{filename:join(profile,'Hero_Travel_Source_Capture.checkpoint'),...await hashNativeFile(join(profile,'Hero_Travel_Source_Capture.checkpoint'))},
  journalUnchanged:true,heroImported:false,ownerTransferred:false,browserUsed:false,goalComplete:false};
 if(returnArrival){
  const a=returnArrival;
  report.returnArrival=a;
  report.returnArrivalRequest=`majesty-hero-home-arrival-v1|2|0_0|${homeClock}|${homeEntry.homeAlias.unitId}|${homeEntry.homeAlias.agentId}|${a.options.sourceClockMs}|${a.pack.bytes}|${a.pack.sha256}\n`;
  const data=Buffer.from(report.returnArrivalRequest);
  await stream(join(profile,'Frontier_Hero_Home_Arrival.txt'),{size:data.length,async readAt(at,n){return new Uint8Array(data.subarray(at,at+n));}});
  a.browserInput=await stageSelectedHeroBrowserInput(m,second,{region:'0_0',clock:homeClock,
    homeAlias:homeEntry.homeAlias,nativeManifest},a);
  if(m.importRepeatHome){
    const preserved=join(profile,'Hero_First_Return_Travel_Input.json');await stream(preserved,
      {size:Buffer.byteLength(a.browserInput.staged.inputManifest),async readAt(at,n){return new Uint8Array(Buffer.from(a.browserInput.staged.inputManifest).subarray(at,at+n));}});
    a.browserInput.manifest={filename:preserved,...await hashNativeFile(preserved)};
  }
 }
 for(const[n,h]of Object.entries(second.journalSha256))assert.equal((await hashNativeFile(join(second.journal,n))).sha256,h);
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 if(beforeDeparture){assert.equal(m.publicTravel,true);return report;}
 // Report and all staged save/marker writes precede the native page request.
 const ready=Buffer.from(request);await stream(join(m.fixture,'frontier_1_0/Frontier_Hero_Home_Ready.txt'),{
  size:ready.length,async readAt(at,n){return new Uint8Array(ready.subarray(at,at+n));}});
 console.log(JSON.stringify({selectedHeroHomeStaged:true,homeClock,heroImported:false,journalUnchanged:true}));
 if(m.publishHome)await publishHeldHeroHomeArrival(m,first,second);
}
