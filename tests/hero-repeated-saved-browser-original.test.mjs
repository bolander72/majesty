// Replay verified original saved-world trips through the real browser APIs and
// optionally the real controller source over copied files and a controlled DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {runInNewContext} from 'node:vm';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';
import {NativeHeroSaveSession} from '../web/world/hero-save-session.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {nativeHeroContentDigest,nativeHeroRestoreConfig,completedHeroRestoreURL,prepareNativeHeroStartup} from '../web/world/hero-route-launch.mjs';
import {parseNativeHeroArrivalReady} from '../web/world/hero-travel-publication.mjs';
import {openNativeHeroRouteStore} from '../web/world/hero-route-profile.mjs';
import {selectedRegion,atlasURL,neighboringRegionURL} from '../web/world/region.mjs';
import {selectedWorld} from '../web/world/world-name.mjs';
import * as realmAPI from '../web/world/realm-session.mjs';

const manifestName=process.env.MAJESTY_HERO_SAVED_BROWSER_NATIVE;
const observedName=process.env.MAJESTY_HERO_SAVED_BROWSER_OBSERVED;
const controllerMode=process.env.MAJESTY_HERO_SAVED_BROWSER_CONTROLLER==='1';
test('one browser game capability survives eight original saved-world crossings and repeated destination reuse',
 {skip:!manifestName||!observedName,timeout:60000},async()=>{
 const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
 const descriptor=async filename=>{const {bytes,sha256}=await hashNativeFile(filename);return {filename:resolve(filename),bytes,sha256};};
 async function bound(row){const {filename,bytes,sha256}=row;assert.deepEqual(await descriptor(filename),{filename,bytes,sha256});}
 const m=await json(manifestName),observed=await json(observedName);assert.equal(m.nativeRemoteRoundtripQualified,true);
 assert.equal(observed.nativeRemoteRoundtripQualified,true);await bound(observed.manifest);assert.equal(observed.manifest.filename,resolve(manifestName));
 assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);
 for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
 await bound(m.roundtrip);await bound(m.preparation);
 const proof=await json(m.roundtrip.filename),prep=await json(m.preparation.filename);assert.equal(proof.cycles.length,8);
 for(const row of m.originalInputs)await bound(row);
 const identity=await json(prep.identity.filename),parent=await json(prep.producer.filename);await bound(parent.preparation);
 const originalPrep=await json(parent.preparation.filename);await bound(originalPrep.producer);
 const originalProducer=await json(originalPrep.producer.filename);await bound(originalProducer.startup);
 const startup=await json(originalProducer.startup.filename),content=startup.content;
 assert.equal(nativeHeroContentDigest(content),identity.contentDigest);
 const inputRows=[];for(const c of proof.cycles)for(const row of [c.captured,c.destinationFile,c.retired,c.active,c.playedCheckpoint,c.pack,c.proxyRecord]){
  await bound(row);inputRows.push(row);
 }
 const log=await readFile(m.log,'utf8');assert.equal((await descriptor(m.log)).sha256,m.logSha256);
 const lines=log.split('\n'),line=prefix=>{const rows=lines.filter(s=>s.startsWith(prefix));assert.equal(rows.length,1,prefix);return rows[0];};
 const out=resolve(process.env.MAJESTY_HERO_SAVED_BROWSER_REPORT);assert.equal(dirname(out),resolve('output'));
 assert.match(basename(out),/^hero-repeated-saved-browser-original-\d{3}\.json$/);
 const fixture=out.slice(0,-5);for(const n of [out,fixture])await assert.rejects(lstat(n),e=>e.code==='ENOENT');
 const world='saved-revisit-browser-'+basename(fixture).slice(-3),root='native-world-'+world,
  profile=join(fixture,'majesty/profile',root),journal=join(profile,'hero-route');await mkdir(journal,{recursive:true});
 const originalJournalHashes={};for(const name of await readdir(prep.sourceJournal)){
  originalJournalHashes[name]=(await descriptor(join(prep.sourceJournal,name))).sha256;await copyFile(join(prep.sourceJournal,name),join(journal,name));
 }
 let held=false,lockCalls=0;const lockName='majesty-pair-'+root,locks={async request(name,options,consume){
  assert.equal(name,lockName);assert.equal(options.ifAvailable,true);lockCalls++;
  if(held)return consume(null);held=true;try{return await consume({});}finally{held=false;}
 }};
 const adapter=fileProfileStorage(fixture,()=>held),search='?'+new URLSearchParams({world,profile:'frontier_-5_-1',
  RECOMP_RULE_FRONTIER_REGION:'-5_-1',RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
  'hero-world':identity.registeredHome.worldId,'hero-entity':identity.entityId,'hero-layout':'halo-v1'});
 let receipt,entered,rejected;const ready=new Promise((r,j)=>{entered=r;rejected=j;});
 realmAPI.startNativeWorldPlayer(async(_profile,retain,prepare)=>{
  receipt=await prepare(content,{signal:new AbortController().signal});retain();entered();
 },{search,locks,storage:adapter.storage,events:{addEventListener(){},removeEventListener(){}}}).catch(rejected);
 await ready;assert.equal(receipt.ownerRevision,17);assert.equal(receipt.runtimeBinding,prep.runtimeBinding);
 const controls=controllerMode?await mountRealNativeControls({world,search,receipt,content,storage:adapter.storage}):null,
  session=controls?null:new NativeHeroSaveSession(receipt.runtimeBinding,{haloBinding:receipt.haloBinding}),
  emit=text=>controls?controls.emit(text):session.message(text);
 emit(line('[frontier] Selected hero bound '));emit('[frontier] Region -5_-1 ready');
 if(!controls)realmAPI.confirmNativeHeroGameReady(world,receipt.runtimeBinding);
 async function install(region,row,slot){
  const folder=join(profile,'frontier_'+region),save=join(folder,'Documents/My Games/MajestyHD/SaveGame'),names=realmFiles(region);
  await mkdir(save,{recursive:true});await copyFile(row.filename,join(save,names.slots[slot]));
  await writeFile(join(folder,names.marker),['checkpoint-v1',slot,row.bytes,row.sha256,content,''].join('\n'));
 }
 const results=[];let previousRequest,fresh;
 for(const c of proof.cycles){
  const serial=c.serial,source=c.crossing.region,target=c.crossing.target,options={layout:'halo-v1',storage:adapter.storage};
  const crossing=emit(line(`[frontier] Hero crossing serial=${serial} `));
  if(!controls){assert.equal(crossing.kind,'crossing');assert.deepEqual(crossing.crossing,c.crossing);realmAPI.queueNativeHeroGameSave(world,serial,{crossing:crossing.crossing});}
  const sourceSlot=Number(JSON.parse(c.browserInput.staged.inputManifest).sourceNativeManifest.split('\n')[1]);
  await install(source,c.captured,sourceSlot);const heldEvent=emit(line(`[frontier] Hero save held serial=${serial} `));
  let prepared,staged,request;
  if(controls){
   await controls.until(()=>!controls.button('Travel to the neighboring kingdom').disabled,'saved crossing controls');
   assert.equal(controls.result('publishNativeHeroGameSave',serial).ownerRevision,17+2*serial-1);
   prepared=controls.result('prepareNativeHeroTravelArrival',serial);staged=controls.result('stageNativeHeroTravelArrival',serial);
   controls.button('Travel to the neighboring kingdom').onclick();
   await controls.until(()=>controls.poll(`frontier-hero-travel-${serial}`),'saved travel action');
   request=controls.result('stageNativeHeroTravelDeparture',serial);
  }else{
   assert.equal(heldEvent.kind,'held');const capture=await realmAPI.publishNativeHeroGameSave(world,heldEvent.boundary,{storage:adapter.storage});
   assert.equal(capture.ownerRevision,17+2*serial-1);
   const restored=await realmAPI.restoreNativeHeroTravelHome(world,serial,target,options);assert.equal(restored.regionRestored,true);
   assert.equal(restored.sha256,c.destinationFile.sha256);
   prepared=await realmAPI.prepareNativeHeroTravelArrival(world,serial,target,options);
   staged=await realmAPI.stageNativeHeroTravelArrival(world,serial,prepared,{storage:adapter.storage});
   request=await realmAPI.stageNativeHeroTravelDeparture(world,serial,prepared,{storage:adapter.storage});
   session.queueTravel(request);assert.equal(session.poll(request.nativeAction).serial,serial);
  }
  assert.equal(prepared.kind,'saved');assert.equal(prepared.home.plan.admission,'reuse-existing');
  assert.equal(prepared.home.sha256,c.proxyRecord.sha256);assert.equal(prepared.arrival.sha256,c.pack.sha256);
  assert.equal(staged.packageSha256,c.pack.sha256);assert.equal(prepared.arrival.destinationClock,c.destinationClock);
  if(previousRequest){const writes=adapter.stats.writes;
   assert.throws(()=>realmAPI.confirmNativeHeroTravelDeparture(world,serial,previousRequest,line(`[frontier] Hero departure request consumed serial=${serial} `)),/departure/i);
   assert.equal(adapter.stats.writes,writes);
  }
  const departure=emit(line(`[frontier] Hero departure request consumed serial=${serial} `));
  if(!controls){assert.equal(departure.kind,'travel-departed');realmAPI.confirmNativeHeroTravelDeparture(world,serial,request,departure.line);}
  const nativeRecovery=join(profile,'frontier_'+source+'/Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Source_Retired.GMP');
  await copyFile(c.retired.filename,nativeRecovery);await install(target,c.active,Number(c.acceptedManifest.split('\n')[1]));
  const arrival=emit(`[frontier] Hero travel publication held receipt=${c.ready} phase=7 pending=0 ordinary-ticks=0`);let published;
  if(controls){await controls.until(()=>controls.result('publishNativeHeroTravelArrival',serial),'saved arrival publication');published=controls.result('publishNativeHeroTravelArrival',serial);}
  else{assert.equal(arrival.kind,'travel-held');published=await realmAPI.publishNativeHeroTravelArrival(world,serial,request,arrival.ready,{storage:adapter.storage});session.acceptTravelPublication(published);}
  assert.equal(published.ownerRevision,17+2*serial);
  const originalResume=line(`[frontier] Hero travel resumed serial=${serial} `),resumed=originalResume.replace(c.receipt.ownerManifestSha256,published.ownerManifestSha256);
  assert.notEqual(resumed,originalResume);const resumeEvent=emit(resumed);
  if(controls){await controls.until(()=>controls.result('confirmNativeHeroTravelResume',serial),'saved fresh rebind');fresh=controls.result('confirmNativeHeroTravelResume',serial);
   assert.equal(new URL(controls.location.href).searchParams.get('profile'),'frontier_'+target);assert.equal(controls.elementCount(),controls.initialElementCount);
   assert.equal(controls.Module.ENV.RECOMP_FRONTIER_HERO_BINDING,fresh.runtimeBinding);
  }else{assert.equal(resumeEvent.kind,'travel-resumed');fresh=realmAPI.confirmNativeHeroTravelResume(world,serial,request,resumed);session.completeTravel(fresh);}
  const nativeReady=parseNativeHeroArrivalReady(c.ready);assert.equal(fresh.owner.unitId,nativeReady.unitId);assert.equal(fresh.owner.agentId,nativeReady.agentId);
  assert.equal(fresh.home.agentId,nativeReady.homeAgentId);assert.equal(fresh.owner.region,target);
  assert.equal(lockCalls,1);assert.equal(held,true);assert.equal(adapter.stats.activeIO,0);
  results.push({serial,source,target,ownerRevision:published.ownerRevision,clock:nativeReady.clock,owner:fresh.owner,home:fresh.home,
   preparedPackageSha256:prepared.arrival.sha256,preparedHomeSha256:prepared.home.sha256});previousRequest=request;
 }
 const borrowed={async request(name,options,consume){assert.ok(held);assert.equal(name,lockName);return consume({});}},
  top=await adapter.storage.getDirectory(),game=await top.getDirectoryHandle('majesty'),profiles=await game.getDirectoryHandle('profile'),
  store=await openNativeHeroRouteStore(profiles,world,{worldId:identity.registeredHome.worldId,entityId:identity.entityId,contentDigest:identity.contentDigest},{locks:borrowed});
 const final=proof.cycles.at(-1);await store.withOwner(async s=>{assert.equal(s.record.revision,33);assert.equal(s.entry.region,'-5_-1');assert.equal(s.entry.world.sha256,final.active.sha256);});
 for(const old of proof.dormantBefore)await store.withDestination(old.region,null,async s=>assert.deepEqual(s.entries[1],old));
 await store.withDestination('-4_-1',null,async s=>assert.equal(s.entries[1].world.sha256,final.retired.sha256));
 const restoreURL=new URL(controls?controls.link('Restore previous checkpoint').href:'http://localhost:8000/majesty/'+search),config=nativeHeroRestoreConfig(restoreURL.search),writes=adapter.stats.writes;
 const restored=await prepareNativeHeroStartup(profiles,config,content,{locks:borrowed,signal:new AbortController().signal});
 assert.equal(restored.ownerRevision,33);assert.equal(restored.runtimeBinding,fresh.runtimeBinding);assert.equal(restored.sha256,final.active.sha256);
 assert.equal(adapter.stats.writes,writes);
 await assert.rejects(prepareNativeHeroStartup(profiles,{...config,region:'-4_-1'},content,{locks:borrowed,signal:new AbortController().signal}),/owner changed/);
 assert.equal(adapter.stats.writes,writes);
 if(controls){controls.button('Save hero journey').onclick();assert.equal(controls.poll('frontier-hero-save'),true);assert.equal(controls.lastQueueSerial(),9);}
 else{assert.equal(session.queue(),9);assert.equal(session.poll('frontier-hero-save').serial,9);realmAPI.queueNativeHeroGameSave(world,9);}
 assert.equal(lockCalls,1);assert.equal(adapter.stats.activeIO,0);assert.equal(adapter.stats.peakIO,1);
 assert.ok(adapter.stats.largestRead<=4096&&adapter.stats.largestWrite<=4096);
 for(const row of inputRows)await bound(row);
 for(const [name,hash]of Object.entries(originalJournalHashes))assert.equal((await descriptor(join(prep.sourceJournal,name))).sha256,hash);
 const sourceSha256={},pending=[resolve('tests/hero-repeated-saved-browser-original.test.mjs'),resolve('web/world/native.mjs')];
 while(pending.length){const filename=pending.pop();if(sourceSha256[filename])continue;
  const source=await readFile(filename,'utf8');sourceSha256[filename]=(await descriptor(filename)).sha256;
  for(const match of source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"](\.[^'"]+)['"]/g))pending.push(resolve(dirname(filename),match[1]));}
 await writeFile(out,JSON.stringify({version:1,originalRepeatedSavedBrowserAPIReplayQualified:true,sourceSha256,manifest:await descriptor(manifestName),
  independentNativeInspection:await descriptor(observedName),nativeSnapshot:await descriptor(m.roundtrip.filename),journeys:results,
  finalOwnerRevision:33,nextSaveSerial:9,oneInjectedGameLease:true,lockCalls,adapterStats:adapter.stats,
  packagesExactlyMatchAllOriginalImporterInputs:true,homesExactlyMatchAllOriginalRegisteredInputs:true,sevenDormantWorldsUnchanged:true,
  departedWorldSelectedCorrectly:true,finalPublishedArrivalRestoreReadOnly:true,staleDestinationRestoreRefused:true,staleDepartureRequestsRefused:7,
  originalInputsUnchanged:true,sourceJournalUnchanged:true,controlledContentLabels:true,controlledPublicationDigestSubstitution:true,
  actualBrowserControllerSourceQualified:!!controls,controlledDOM:!!controls,panelElements:controls?.elementCount(),
  browserUsed:false,liveOPFSQualified:false,nativeNewReceiptConsumed:false,sustainedBrowserMemoryQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
});

async function mountRealNativeControls({world,search,receipt,content,storage}){
 const elements=[],events=new Map(),globalEvents=new Map(),calls=[];
 function element(tag){const e={tag,children:[],style:{},disabled:false,hidden:false,
  appendChild(child){this.children.push(child);return child;},setAttribute(){}};elements.push(e);return e;}
 const document={body:element('body'),createElement:element,addEventListener(name,fn){events.set(name,fn);}};
 let current=new URL('http://localhost:8000/majesty/'+search);
 const location={get href(){return current.href;},get search(){return current.search;},replace(){assert.fail('travel reloaded the game');}};
 const history={replaceState(_state,_title,url){current=new URL(url);}};
 const Module={ENV:{RECOMP_FRONTIER_HERO_BINDING:receipt.runtimeBinding,RECOMP_FRONTIER_HERO_HALO_BINDING:receipt.haloBinding,
  RECOMP_FRONTIER_HERO_OWNER_MANIFEST:receipt.ownerManifest,RECOMP_CONTENT_IDENTITY:content}};
 const context={URL,URLSearchParams,AbortController,document,location,history,Module,console,
  addEventListener(name,fn){globalEvents.set(name,fn);},selectedRegion,atlasURL,neighboringRegionURL,selectedWorld,
  nativeHeroRestoreConfig,completedHeroRestoreURL,NativeHeroSaveSession,
  NativeRegionSession:class{constructor(){assert.fail('Unexpected coordinate session');}},
  async recordJourney(){},async recordJourneyArrival(){},async checkNativeDestination(){assert.fail('Unexpected coordinate admission');},
  nativeRegionSessionMode:realmAPI.nativeRegionSessionMode,advanceNativeWorldRegion:realmAPI.advanceNativeWorldRegion,
 };
 const asyncAPIs=['publishNativeHeroGameSave','restoreNativeHeroTravelHome','prepareNativeHeroTravelArrival',
  'stageNativeHeroTravelGeneration','prepareNativeHeroGeneratedArrival','stageNativeHeroTravelArrival',
  'stageNativeHeroTravelDeparture','publishNativeHeroTravelArrival'];
 for(const name of asyncAPIs)context[name]=async(...args)=>{
  const options=args.length-1;args[options]={...args[options],storage};
  // Every call uses the explicit final options supplied by the controller;
  // only its storage handle is injected, using this owned fixture.
  const result=await realmAPI[name](...args);calls.push({name,serial:name==='publishNativeHeroGameSave'?args[1].serial:args[1],result});return result;
 };
 for(const name of ['confirmNativeHeroGameReady','queueNativeHeroGameSave','endNativeHeroGameSave',
  'confirmNativeHeroGenerationDeparture','confirmNativeHeroTravelDeparture','confirmNativeHeroTravelResume'])context[name]=(...args)=>{
   const result=realmAPI[name](...args);calls.push({name,serial:args[1],result});return result;
  };
 const source=await readFile('web/world/native.mjs','utf8');
 runInNewContext(source.replace(/^import .*;\n/gm,''),context,{filename:'web/world/native.mjs',timeout:2000});
 const button=text=>{const e=elements.find(e=>e.tag==='button'&&e.textContent===text);assert.ok(e,text);return e;};
 const link=text=>{const e=elements.find(e=>e.tag==='a'&&e.textContent===text);assert.ok(e,text);return e;};
 const result=(name,serial)=>calls.find(r=>r.name===name&&r.serial===serial)?.result;
 const emit=detail=>events.get('recomp-runtime-message')({detail});
 const poll=name=>{const detail={name,pending:false};events.get('recomp-action-poll')({detail});return detail.pending;};
 async function until(condition,label){const started=Date.now();
  while(Date.now()-started<10000){const value=condition();if(value)return value;
   const status=elements.find(e=>e.tag==='output')?.textContent;assert.ok(!/unavailable|failed|refused|could not/.test(status),status);
   await new Promise(r=>setTimeout(r,5));
  }assert.fail(label+' was not reached');
 }
 return {location,Module,button,link,result,emit,poll,until,elementCount:()=>elements.length,initialElementCount:elements.length,
  lastQueueSerial:()=>calls.filter(r=>r.name==='queueNativeHeroGameSave').at(-1)?.serial};
}
