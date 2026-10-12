// Replay successive original native journeys through the actual browser API state
// machine. Only content labels and publication-head digests are substituted.
// Real GMP bytes, actor identities, paths, clocks and receipt events stay exact.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {runInNewContext} from 'node:vm';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {NativeHeroSaveSession} from '../web/world/hero-save-session.mjs';
import {parseNativeHeroArrivalReady} from '../web/world/hero-travel-publication.mjs';
import {readNativeHeroRouteIdentity,openNativeHeroRouteStore} from '../web/world/hero-route-profile.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import * as realmAPI from '../web/world/realm-session.mjs';
import {selectedRegion,atlasURL,neighboringRegionURL} from '../web/world/region.mjs';
import {selectedWorld} from '../web/world/world-name.mjs';
import {nativeHeroRestoreConfig,completedHeroRestoreURL,prepareNativeHeroStartup} from '../web/world/hero-route-launch.mjs';
import {startNativeWorldPlayer,confirmNativeHeroGameReady,queueNativeHeroGameSave,publishNativeHeroGameSave,
 prepareNativeHeroTravelArrival,stageNativeHeroTravelGeneration,confirmNativeHeroGenerationDeparture,
 prepareNativeHeroGeneratedArrival,stageNativeHeroTravelArrival,publishNativeHeroTravelArrival,confirmNativeHeroTravelResume} from '../web/world/realm-session.mjs';

const archiveName=process.env.MAJESTY_HERO_REPEATED_BROWSER_ARCHIVE;
const controllerMode=process.env.MAJESTY_HERO_REPEATED_BROWSER_CONTROLLER==='1';
test('one injected browser lease survives successive original generated journeys and retains every dormant kingdom',
 {skip:!archiveName,timeout:45000},async()=>{
 const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
 const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
 async function bound(row){
  // This intentionally empty orphan was rejected during native admission.
  // Preserve its negative-control evidence without treating it as a GMP.
  if(row.bytes===0){
   assert.equal(basename(row.filename),'Hero_Generation_Orphan_Preserved.GMP');
   const info=await lstat(row.filename);assert.ok(info.isFile());assert.equal(info.size,0);
   assert.equal(row.sha256,'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');return;
  }
  const current=await descriptor(row.filename);assert.equal(current.bytes,row.bytes);assert.equal(current.sha256,row.sha256);
 }
 const archive=await json(archiveName);assert.equal(archive.nativeRepeatedGeneratedNeighborArrivalQualified,true);
 const journeyCount=archive.generatedRegions;assert.ok(Number.isInteger(journeyCount)&&journeyCount>=2&&journeyCount<=8);
 if(journeyCount>=3)assert.equal(archive.nativeThreeGeneratedNeighborArrivalsQualified,true);
 async function evidence(name){const row=archive.evidence.find(r=>r.source===resolve(name));assert.ok(row,name);
  assert.equal((await descriptor(row.preserved)).sha256,row.sha256);return json(row.preserved);}
 async function qualifiedEvidence(pattern,qualification){
  const matches=[];
  for(const row of archive.evidence)if(pattern.test(basename(row.source))){
   const record=await evidence(row.source);if(record[qualification]===true)matches.push(record);
  }
  assert.equal(matches.length,1,qualification);return matches[0];
 }
 const qualification=journeyCount>=3?'nativeThreeGeneratedNeighborArrivalsQualified':'nativeRepeatedGeneratedNeighborArrivalQualified';
 const m=await qualifiedEvidence(/^native-hero-binding-attempt-\d{3}(?:-recovered)?\.json$/,qualification),startup=await evidence(m.startup.filename),
  observed=await qualifiedEvidence(/^native-hero-generation-\d{3}-observed\.json$/,qualification);
 await bound(observed.manifest);
 if(m.stoppedCompletionChecksRecovered){
  await bound(m.recoveryOriginal);await bound(m.recoveryArchive);
  assert.equal(m.recoveryGameProcessesStarted,0);
  const original=await json(m.recoveryOriginal.filename);
  for(const [key,value]of Object.entries(original))assert.deepEqual(m[key],value,key);
 }
 assert.equal(m.nativeRepeatedGeneratedNeighborArrivalQualified,true);assert.equal(m.nativeSessionTerminal,true);
 assert.equal(observed.nativeRepeatedGeneratedNeighborArrivalQualified,true);assert.equal(observed.repeatedGeneration.qualified,true);
 assert.equal((await descriptor(m.log)).sha256,m.logSha256);await bound(m.freshGeneration);
 for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
 for(const row of archive.references)await bound(row);
 const g=await json(m.freshGeneration.filename),second=g.repeatedGeneration;
 const legs=[{...g,...g.arrival,initialized:g.generated}, {...second,initialized:second.generated},
  ...(g.additionalGenerations??[]).map(leg=>({...leg,initialized:leg.generated}))];
 assert.equal(legs.length,journeyCount);
 const final=legs.at(-1),finalReady=parseNativeHeroArrivalReady(final.ready),finalRegion=final.crossing.target;
 const lines=(await readFile(m.log,'utf8')).split('\n');
 function line(prefix){const found=lines.filter(v=>v.startsWith(prefix));assert.equal(found.length,1,prefix);return found[0];}
 function heldLine(serial){const found=lines.filter(v=>v.startsWith('[frontier] Hero travel publication held receipt=')&&
  parseNativeHeroArrivalReady(v.split('receipt=')[1].split(' ')[0]).serial===serial);assert.equal(found.length,1);return found[0];}
 const out=resolve(process.env.MAJESTY_HERO_REPEATED_BROWSER_REPORT);assert.equal(dirname(out),resolve('output'));
 assert.match(basename(out),/^hero-repeated-generated-browser-original-\d{3}\.json$/);
 const fixture=out.slice(0,-5);for(const name of [out,fixture])await assert.rejects(lstat(name),e=>e.code==='ENOENT');
 const world='hero-repeat-browser-'+basename(fixture).slice(-3),root='native-world-'+world,profile=join(fixture,'majesty/profile',root),journal=join(profile,'hero-route');
 await mkdir(journal,{recursive:true});
 const seed=join(startup.fixture,'majesty/profile','native-world-'+startup.receipt.world,'hero-route');
 for(const [name,hash] of Object.entries(startup.routeHashes)){
  assert.ok(!name.includes('/'));assert.equal((await descriptor(join(seed,name))).sha256,hash);await copyFile(join(seed,name),join(journal,name));
 }
 let held=false,lockCalls=0;
 const lockName='majesty-pair-'+root,locks={async request(name,options,consume){
  assert.equal(name,lockName);assert.equal(options.ifAvailable,true);++lockCalls;
  if(held)return consume(null);held=true;try{return await consume({});}finally{held=false;}
 }};
 const adapter=fileProfileStorage(fixture,()=>held);let entered,rejected,receipt;
 const ready=new Promise((r,j)=>{entered=r;rejected=j;}),content=startup.content;
 const search='?'+new URLSearchParams({world,profile:'frontier_0_0',RECOMP_RULE_FRONTIER_REGION:'0_0',
  RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
  'hero-world':startup.worldId,'hero-entity':startup.receipt.owner.entityId,'hero-layout':'halo-v1'});
 startNativeWorldPlayer(async(_profile,retain,prepare)=>{receipt=await prepare(content,{signal:new AbortController().signal});retain();entered();},
  {search,locks,storage:adapter.storage,events:{addEventListener(){},removeEventListener(){}}}).catch(rejected);
 await ready;assert.equal(receipt.runtimeBinding,m.runtimeBinding);
 const controls=controllerMode?await mountRealNativeControls({world,search,receipt,content,storage:adapter.storage}):null;
 const session=controls?null:new NativeHeroSaveSession(receipt.runtimeBinding,{haloBinding:receipt.haloBinding});
 const emit=text=>controls?controls.emit(text):session.message(text);
 emit(line('[frontier] Selected hero bound '));emit('[frontier] Region 0_0 ready');
 if(!controls)confirmNativeHeroGameReady(world,receipt.runtimeBinding);
 async function install(region,row,slot){
  const folder=join(profile,'frontier_'+region),save=join(folder,'Documents/My Games/MajestyHD/SaveGame'),names=realmFiles(region);
  await mkdir(save,{recursive:true});await copyFile(row.filename,join(save,names.slots[slot]));
  await writeFile(join(folder,names.marker),['checkpoint-v1',slot,row.bytes,row.sha256,content,''].join('\n'));
 }
 const results=[];let previousRequest,previousInitialized,fresh;
 for(const [index,leg]of legs.entries()){
  const serial=index+1,source=leg.crossing.region,target=leg.crossing.target;
  const crossing=emit(line(`[frontier] Hero crossing serial=${serial} `));
  if(!controls){assert.equal(crossing.kind,'crossing');assert.deepEqual(crossing.crossing,leg.crossing);queueNativeHeroGameSave(world,serial,{crossing:crossing.crossing});}
  await install(source,leg.captured,1);
  const event=emit(line(`[frontier] Hero save held serial=${serial} `));
  let request;
  if(controls){
   await controls.until(()=>!controls.button('Travel to the neighboring kingdom').disabled,'crossing controls');
   assert.equal(controls.result('publishNativeHeroGameSave',serial).ownerRevision,serial*2-1);
   assert.equal(controls.result('prepareNativeHeroTravelArrival',serial).kind,'new');
   controls.button('Travel to the neighboring kingdom').onclick();
   await controls.until(()=>controls.poll(`frontier-hero-generate-${serial}`),'generation action');
   request=controls.result('stageNativeHeroTravelGeneration',serial);
  }else{
   assert.equal(event.kind,'held');const saved=await publishNativeHeroGameSave(world,event.boundary,{storage:adapter.storage});assert.equal(saved.ownerRevision,serial*2-1);
   const unexplored=await prepareNativeHeroTravelArrival(world,serial,target,{layout:'halo-v1',storage:adapter.storage});assert.equal(unexplored.kind,'new');
   request=await stageNativeHeroTravelGeneration(world,serial,unexplored,{storage:adapter.storage});
  }
  if(previousRequest){
   const writes=adapter.stats.writes;
   if(!controls)assert.throws(()=>session.queueTravel(previousRequest),/Travel/);
   assert.throws(()=>confirmNativeHeroGenerationDeparture(world,serial,previousRequest,line(`[frontier] Hero generation request consumed serial=${serial} `)),/Generation departure/);
   assert.equal(adapter.stats.writes,writes);
  }
  if(!controls){session.queueTravel(request);assert.equal(session.poll(request.nativeAction).serial,serial);}
  const consumed=emit(line(`[frontier] Hero generation request consumed serial=${serial} `));
  if(!controls){assert.equal(consumed.kind,'generation-departed');confirmNativeHeroGenerationDeparture(world,serial,request,consumed.line);}
  await install(target,leg.coldGenerated,0);
  const cold=line(`[frontier] Hero generation held serial=${serial} `);
  const writes=adapter.stats.writes;
  assert.equal(emit(cold),controls?undefined:null);
  assert.throws(()=>prepareNativeHeroGeneratedArrival(world,serial,request,cold,{storage:adapter.storage}),/initialization/);
  if(previousInitialized){
   assert.equal(emit(previousInitialized),controls?undefined:null);
   assert.throws(()=>prepareNativeHeroGeneratedArrival(world,serial,request,previousInitialized,{storage:adapter.storage}),/initialization/);
  }
  assert.equal(adapter.stats.writes,writes);
  await install(target,leg.initialized,1);
  const initializedLine=line(`[frontier] Hero generation initialized serial=${serial} `),initialized=emit(initializedLine);
  let prepared,staged;
  if(controls){
   await controls.until(()=>controls.result('stageNativeHeroTravelArrival',serial),'generated arrival staging');
   prepared=controls.result('prepareNativeHeroGeneratedArrival',serial);staged=controls.result('stageNativeHeroTravelArrival',serial);
  }else{
   assert.equal(initialized.kind,'generation-held');prepared=await prepareNativeHeroGeneratedArrival(world,serial,request,initializedLine,{layout:'halo-v1',storage:adapter.storage});
   session.acceptGeneratedPreparation(prepared);staged=await stageNativeHeroTravelArrival(world,serial,prepared,{storage:adapter.storage});
  }
  const nativeReady=parseNativeHeroArrivalReady(leg.ready);
  assert.equal(prepared.kind,'generated');assert.equal(prepared.sourceRetired,true);assert.equal(prepared.arrival.destinationClock,nativeReady.clock);
  assert.equal(prepared.home.sha256,leg.home.sha256);assert.equal(prepared.arrival.sha256,leg.pack.sha256);
  assert.equal(staged.packageSha256,leg.pack.sha256);
  const sourceRecovery=join(profile,'frontier_'+source+'/Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Source_Retired.GMP');
  await copyFile(leg.retired.filename,sourceRecovery);await install(target,leg.active,0);
  const arrival=emit(heldLine(serial));let published;
  if(controls){await controls.until(()=>controls.result('publishNativeHeroTravelArrival',serial),'paired publication');published=controls.result('publishNativeHeroTravelArrival',serial);}
  else{assert.equal(arrival.kind,'travel-held');assert.equal(arrival.ready,leg.ready);
   published=await publishNativeHeroTravelArrival(world,serial,request,arrival.ready,{storage:adapter.storage});assert.equal(session.acceptTravelPublication(published),null);}
  assert.equal(published.ownerRevision,serial*2);
  const originalResume=line(`[frontier] Hero travel resumed serial=${serial} `),resumed=originalResume.replace(leg.published.ownerManifestSha256,published.ownerManifestSha256);
  assert.notEqual(resumed,originalResume);const resumedEvent=emit(resumed);
  if(controls){await controls.until(()=>controls.result('confirmNativeHeroTravelResume',serial),'fresh rebind');fresh=controls.result('confirmNativeHeroTravelResume',serial);
   assert.equal(new URL(controls.location.href).searchParams.get('profile'),'frontier_'+target);assert.equal(controls.elementCount(),controls.initialElementCount);
   assert.equal(controls.Module.ENV.RECOMP_FRONTIER_HERO_BINDING,fresh.runtimeBinding);
  }else{assert.equal(resumedEvent.kind,'travel-resumed');fresh=confirmNativeHeroTravelResume(world,serial,request,resumed);assert.deepEqual(session.completeTravel(fresh),[]);}
  assert.equal(fresh.owner.unitId,nativeReady.unitId);assert.equal(fresh.owner.agentId,nativeReady.agentId);
  assert.equal(fresh.home.agentId,nativeReady.homeAgentId);assert.equal(fresh.owner.region,target);
  assert.equal(held,true);assert.equal(lockCalls,1);assert.equal(adapter.stats.activeIO,0);assert.equal(adapter.stats.peakIO,1);
  results.push({serial,source,target,sourceClock:leg.crossing.clock,initializedClock:nativeReady.clock,ownerRevision:published.ownerRevision,
   owner:fresh.owner,home:fresh.home,stagedPackageSha256:staged.packageSha256,homeSha256:prepared.home.sha256,
   consumedPathPrefixes:prepared.arrival.plan?.heroOrders?.haloNavigation?.consumedPathPrefixes});
  previousRequest=request;previousInitialized=initializedLine;
 }
 // Inspect the browser publisher's final journal rather than trusting its
 // completion objects. The actual older GMPs must still be selected as retired.
 const borrowed={async request(name,options,consume){assert.ok(held);assert.equal(name,lockName);return consume({});}};
 const top=await adapter.storage.getDirectory(),game=await top.getDirectoryHandle('majesty'),profiles=await game.getDirectoryHandle('profile');
 const identity=await readNativeHeroRouteIdentity(profiles,world,{locks:borrowed}),store=await openNativeHeroRouteStore(profiles,world,
  {worldId:identity.registeredHome.worldId,entityId:identity.entityId,contentDigest:identity.contentDigest},{locks:borrowed});
 await store.withOwner(async selected=>{assert.equal(selected.owner.region,finalRegion);assert.equal(selected.entry.world.sha256,final.active.sha256);});
 const dormant=[];
 for(const leg of legs)await store.withDestination(leg.crossing.region,null,async selected=>{
  assert.deepEqual(selected.regions,[finalRegion,leg.crossing.region]);assert.equal(selected.entries[1].world.sha256,leg.retired.sha256);
  assert.equal(await checkpointSavedClock(selected.sources[1]),leg.crossing.clock);dormant.push(leg.crossing.region);
 });
 const restoreURL=new URL(controls?controls.link('Restore previous checkpoint').href:'http://localhost:8000/majesty/'+search);
 if(!controls){restoreURL.searchParams.set('RECOMP_RULE_FRONTIER_REGION',finalRegion);restoreURL.searchParams.set('profile','frontier_'+finalRegion);}
 const restoreConfig=nativeHeroRestoreConfig(restoreURL.search);assert.equal(restoreConfig.region,finalRegion);
 assert.equal(restoreConfig.entityId,startup.receipt.owner.entityId);assert.equal(restoreConfig.worldId,startup.worldId);
 const writesBeforeRestore=adapter.stats.writes,restored=await prepareNativeHeroStartup(profiles,restoreConfig,content,
  {locks:borrowed,signal:new AbortController().signal});
 assert.equal(restored.idempotent,true);assert.equal(restored.ownerRevision,journeyCount*2);assert.equal(restored.clock,finalReady.clock);
 assert.equal(restored.runtimeBinding,fresh.runtimeBinding);assert.equal(restored.haloBinding,fresh.haloBinding);
 assert.equal(restored.sha256,final.active.sha256);assert.equal(adapter.stats.writes,writesBeforeRestore);
 for(const region of dormant)await assert.rejects(prepareNativeHeroStartup(profiles,{...restoreConfig,region},content,
  {locks:borrowed,signal:new AbortController().signal}),/owner changed/);
 assert.equal(adapter.stats.writes,writesBeforeRestore);
 if(controls){controls.button('Save hero journey').onclick();assert.equal(controls.poll('frontier-hero-save'),true);assert.equal(controls.lastQueueSerial(),journeyCount+1);}
 else{assert.equal(session.queue(),journeyCount+1);assert.equal(session.poll('frontier-hero-save').serial,journeyCount+1);queueNativeHeroGameSave(world,journeyCount+1);}
 assert.equal(held,true);assert.equal(lockCalls,1);assert.equal(adapter.stats.activeIO,0);
 assert.ok(adapter.stats.largestRead<=4096&&adapter.stats.largestWrite<=4096);
 for(const row of archive.references)await bound(row);
 const sourceSha256={},pendingSources=[resolve('tests/hero-repeated-generated-browser-original.test.mjs'),resolve('web/world/native.mjs')];
 while(pendingSources.length){const filename=pendingSources.pop();if(Object.hasOwn(sourceSha256,filename))continue;
  const source=await readFile(filename,'utf8');sourceSha256[filename]=(await descriptor(filename)).sha256;
  for(const match of source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"](\.[^'"]+)['"]/g))
   pendingSources.push(resolve(dirname(filename),match[1]));
 }
 await writeFile(out,JSON.stringify({version:1,originalRepeatedGeneratedBrowserAPIReplayQualified:true,sourceSha256,
  archive:await descriptor(archiveName),nativeEvidence:await descriptor(m.freshGeneration.filename),journeys:results,dormantRegions:dormant,
  originalGMPsUnchanged:true,packagesExactlyMatchAllOriginalImporterInputs:true,homesExactlyMatchAllOriginalRegisteredInputs:true,
  selectedActiveAndAllDormantWorldsVerified:true,staleRequestAndInitializedReceiptRefused:true,coldReceiptRefused:true,
  journeyCount,originalThreeGeneratedBrowserAPIReplayQualified:journeyCount>=3,
  oneInjectedGameLease:true,lockCalls,nextSaveSerial:journeyCount+1,adapterStats:adapter.stats,
  actualBrowserControllerSourceQualified:!!controls,controlledDOM:!!controls,controlledAtlasMetadata:!!controls,
  panelElements:controls?.elementCount(),panelElementCountUnchangedAcrossJourneys:!!controls,
  finalSavedOwnerStartupPrepared:true,restorePreparationReadOnly:true,staleSourceRegionRestoreRefused:true,
  staleDormantRegionRestoresRefused:dormant,
  restoredOwnerRevision:restored.ownerRevision,restoredRuntimeBinding:restored.runtimeBinding,
  controlledContentLabels:true,controlledPublicationDigestSubstitution:true,browserUsed:false,liveOPFSQualified:false,
  nativeNewReceiptConsumed:false,sustainedBrowserMemoryQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
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
