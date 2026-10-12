import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,lstat,readdir,mkdir,copyFile,writeFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,basename,join} from 'node:path';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from '../scripts/lib/stopped-entity-io.mjs';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {nativeRealmRelativePath} from '../web/world/realm-profile.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {nativeHeroContentDigest} from '../web/world/hero-route-launch.mjs';
import {openNativeHeroRouteStore} from '../web/world/hero-route-profile.mjs';
import {HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointPlacements} from '../web/world/checkpoint.mjs';
import {publishNativeHeroCurrentOwnerSave} from '../web/world/hero-route-native-save.mjs';
import {NativeHeroSaveSession} from '../web/world/hero-save-session.mjs';
import {startNativeWorldPlayer,confirmNativeHeroGameReady,queueNativeHeroGameSave,
  publishNativeHeroGameSave,endNativeHeroGameSave,inspectNativeHeroTravelDestination,prepareNativeHeroTravel} from '../web/world/realm-session.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';

const attemptName=process.env.MAJESTY_HERO_LIVE_SAVE_NATIVE_ATTEMPT;
test('original paused native checkpoint advances the production live journal and retains the same hero after resuming',
  {skip:!attemptName,timeout:60000},async()=>{
    const hash=async path=>(await hashNativeFile(path)).sha256;
    async function json(path){assert.ok((await lstat(path)).size<256*1024);return JSON.parse(await readFile(path,'utf8'));}
    const attempt=await json(attemptName);
    assert.equal(attempt.selectedHeroBindingTrialQualified,true);assert.equal(attempt.nativeHeroSaveHandshakeQualified,true);
    assert.equal(attempt.nativeSessionTerminal,true);assert.equal(attempt.nativeExitCode,0);assert.equal(attempt.stopReason,null);
    assert.equal(attempt.ownedProducerAbsent,true);assert.equal(attempt.publicationResult,'saved');
    try{process.kill(attempt.nativePid,0);assert.fail('Producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
    const nativeRoot=await ownedDirectory(attempt.fixture,'actor-arrival-fixture-hero-binding-');
    assert.ok(resolve(attempt.heldSave.checkpoint.filename).startsWith(nativeRoot+'/'));
    assert.equal(await hash(attempt.log),attempt.logSha256);
    assert.equal(await hash(attempt.heldSave.checkpoint.filename),attempt.heldSave.sha256);
    const pausedSource=await stoppedFileSource(attempt.heldSave.checkpoint.filename);
    assert.equal(await checkpointSavedClock(pausedSource),attempt.heldSave.clock);
    const startupName=process.env.MAJESTY_HERO_LIVE_SAVE_STARTUP_CURRENT_REPORT||attempt.startup.filename;
    const startup=await json(startupName);assert.equal(await hash(attempt.startup.filename),attempt.startup.sha256);
    const sourceOnly=startup.originalSelectedCrossingSourceStartupQualified===true;
    if(sourceOnly){
      assert.equal(attempt.crossingTrial,true);assert.equal(attempt.initialOwner,true);
      assert.equal(startup.sourceCheckpointUnchanged,true);assert.equal(startup.independentlyEnrolled,true);
      assert.equal(await hash(startup.sourceCheckpoint.filename),startup.sourceCheckpoint.sha256);
      assert.equal(await hash(startup.producerOriginalCheckpoint.filename),startup.sourceCheckpoint.sha256);
    }else{assert.equal(startup.originalCheckpointStartupProjectionQualified,true);assert.equal(startup.originalJournalUnchanged,true);}
    const starting=attempt.initialOwner?startup.receipt:startup.continuation.resumed;
    const heroUnitId=starting.owner.unitId,heroAgentId=starting.owner.agentId;
    assert.deepEqual([heroUnitId,heroAgentId],sourceOnly?[508,25]:[513,29]);
    assert.equal(starting.runtimeBinding,attempt.runtimeBinding);
    assert.equal(starting.sha256,attempt.sourceCheckpoint.sha256);
    for(const [name,digest] of Object.entries(startup.sourceSha256))assert.equal(await hash(join(workspace,name)),digest,name);
    for(const [name,digest] of Object.entries(attempt.compiledSourceSha256))assert.equal(await hash(join(workspace,name)),digest,name);
    assert.equal(attempt.heldSave.clock>starting.clock,true);
    const sourceFixture=resolve(startup.fixture);assert.equal(dirname(sourceFixture),join(workspace,'output'));
    assert.match(basename(sourceFixture),sourceOnly?/^hero-crossing-source-original-\d{3}$/:/^hero-route-startup-original-\d{3}$/);
    assert.equal(await realpath(sourceFixture),sourceFixture);
    const originalRoute=join(sourceFixture,'majesty/profile','native-world-'+(sourceOnly?starting.world:startup.continuation.resumed.world),'hero-route');
    const originalHashes=sourceOnly?startup.routeHashes:startup.continuation.updatedHashes;
    async function unchanged(){for(const [name,digest] of Object.entries(originalHashes))assert.equal(await hash(join(originalRoute,name)),digest);}
    await unchanged();
    const report=resolve(process.env.MAJESTY_HERO_LIVE_SAVE_ORIGINAL_REPORT);assert.equal(dirname(report),join(workspace,'output'));
    assert.match(basename(report),/^hero-live-save-original-\d{3}\.json$/);
    const fixture=report.slice(0,-5),world=basename(fixture),root='native-world-'+world;
    for(const path of [report,fixture])await assert.rejects(lstat(path),e=>e.code==='ENOENT');
    const profile=join(fixture,'majesty/profile',root),route=join(profile,'hero-route');await mkdir(route,{recursive:true});
    assert.deepEqual((await readdir(originalRoute)).sort(),Object.keys(originalHashes).sort());
    for(const name of Object.keys(originalHashes))await copyFile(join(originalRoute,name),join(route,name));
    // This fresh private fixture can select the separately verified seed used
    // by an initial-owner native trial. Never rewind the original journal or a
    // live player profile; all input files still pass their preserved hashes.
    if(attempt.initialOwner){
      const seed=sourceOnly?startup.enrollment.ownerManifest:startup.enrollment.manifest;
      assert.equal(starting.ownerManifest,seed);assert.equal(starting.ownerRevision,0);
      await writeFile(join(route,HERO_ROUTE_HEAD),seed);
    }
    const content=startup.content,lockName='majesty-pair-'+root;let held=false,lockCalls=0;
    const locks={async request(name,options,consume){assert.equal(name,lockName);assert.equal(options.ifAvailable,true);++lockCalls;
      if(held)return consume(null);held=true;try{return await consume({});}finally{held=false;}}};
    const io=fileProfileStorage(fixture,()=>held),entered={};entered.promise=new Promise(r=>entered.resolve=r);
    const search='?'+new URLSearchParams({world,profile:'frontier_0_0',RECOMP_RULE_FRONTIER_REGION:'0_0',
      RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
      'hero-world':startup.worldId,'hero-entity':starting.owner.entityId,
      ...(startup.originalHaloStartupLayoutQualified?{'hero-layout':'halo-v1'}:{})});
    let receipt;
    const lifetime=startNativeWorldPlayer(async(_profile,retain,prepare)=>{
      receipt=await prepare(content,{signal:new AbortController().signal});retain();entered.resolve();
    },{search,locks,storage:io.storage,events:{addEventListener(){},removeEventListener(){}}});
    await entered.promise;void lifetime;
    assert.equal(receipt.clock,starting.clock);assert.equal(receipt.runtimeBinding,attempt.runtimeBinding);
    const session=new NativeHeroSaveSession(receipt.runtimeBinding,{haloBinding:receipt.haloBinding}),log=await readFile(attempt.log,'utf8');
    const line=prefix=>{const lines=log.split('\n').filter(l=>l.startsWith(prefix));assert.equal(lines.length,1);return lines[0];};
    assert.equal(session.message(line('[frontier] Selected hero bound ')).kind,'bound');
    assert.equal(session.message('[frontier] Region 0_0 ready').kind,'ready');confirmNativeHeroGameReady(world,receipt.runtimeBinding);
    if(attempt.crossingTrial){
      assert.equal(attempt.nativeSelectedHeroCrossingQualified,true);
      const requested=session.message(line('[frontier] Hero crossing '));assert.equal(requested.kind,'crossing');
      assert.deepEqual(requested.crossing,attempt.nativeCrossing);assert.equal(session.poll('frontier-hero-save'),null);
      queueNativeHeroGameSave(world,requested.serial,{crossing:requested.crossing});
    }else{session.queue();const requested=session.poll('frontier-hero-save');queueNativeHeroGameSave(world,requested.serial);}
    // Install an isolated copy of the actual native output. Content metadata is
    // explicitly controlled for this test; the producer's files stay unchanged.
    const names=realmFiles('0_0'),nativeSlot=join(profile,...nativeRealmRelativePath(names.slots[1]));
    await copyFile(attempt.heldSave.checkpoint.filename,nativeSlot);
    const nativeManifest=['checkpoint-v1',1,attempt.heldSave.size,attempt.heldSave.sha256,content,''].join('\n');
    const marker=join(profile,...nativeRealmRelativePath(names.marker));await writeFile(marker,nativeManifest);
    // An actual captured save must refuse a fabricated position before any
    // custody publication, whether attached to a guild or crossing outdoors.
    let actualSavedPose,actualSavedPlacement;
    for await(const unit of checkpointPlacements(pausedSource))if(unit.unitId===heroUnitId){assert.equal(actualSavedPose,undefined);
      actualSavedPose=unit.fixedPosition;actualSavedPlacement=unit;}
    assert.ok(actualSavedPose);
    if(attempt.crossingTrial){assert.equal(actualSavedPlacement.parentUnitId,0);assert.equal(actualSavedPlacement.stateFlags&4,0);
      assert.equal(actualSavedPlacement.requiresParentPosition,false);assert.deepEqual(actualSavedPose,attempt.nativeCrossing.accepted);
    }else{assert.equal(actualSavedPlacement.parentUnitId,469);assert.equal(actualSavedPlacement.requiresParentPosition,true);
      assert.equal(actualSavedPlacement.stateFlags,514);}
    const crossing={serial:1,region:'0_0',target:'1_0',previousClock:attempt.heldSave.clock-50,clock:attempt.heldSave.clock,
      unitId:heroUnitId,agentId:heroAgentId,previous:{x:4032*2048-1,y:731*2048+13,z:821},accepted:{x:4032*2048+1,y:731*2048+13,z:821}};
    if(['x','y','z'].every(k=>crossing.accepted[k]===actualSavedPose[k])){crossing.previous.z++;crossing.accepted.z++;}
    const beforeCrossingWrites=io.stats.closed.length,crossingLocks={async request(name,options,consume){
      assert.equal(name,lockName);assert.ok(held&&['shared','exclusive'].includes(options.mode)&&options.ifAvailable===true);return consume({});
    }};
    await assert.rejects(publishNativeHeroCurrentOwnerSave(io.directory(join(fixture,'majesty/profile')),world,
      {worldId:startup.worldId,entityId:receipt.owner.entityId,content,region:'0_0',expectedNativeManifest:nativeManifest,
        operationId:'1'.repeat(64),expectedClock:crossing.clock,expectedOwner:{unitId:heroUnitId,agentId:heroAgentId},
        expectedHome:{kind:'native',unitId:469,agentId:7}},
      {locks:crossingLocks,crossing}),attempt.crossingTrial?/accepted position/:/living outdoor saved actor/);
    assert.equal(io.stats.closed.length,beforeCrossingWrites);
    const crossingRefusal={forgedCrossingPublicationRefused:true,physicalParentRefusalQualified:!attempt.crossingTrial,
      savedPositionRefusalQualified:!!attempt.crossingTrial,
      refusalReason:attempt.crossingTrial?'requested position differs from the actual original crossing save':'selected hero is physically attached to its native guild',additionalWrites:0,
      actualSavedPlacement,actualSavedPose,requestedCrossing:crossing};
    const beforeWrites=io.stats.closed.length,heldTransition=session.message(line('[frontier] Hero save held '));
    const publication=await publishNativeHeroGameSave(world,heldTransition.boundary,{storage:io.storage});
    if(attempt.crossingTrial){assert.equal(publication.travel.savedActorPositionVerified,true);
      assert.deepEqual(publication.travel.crossing,attempt.nativeCrossing);assert.equal(publication.travel.handoff.destinationRegion,'1_0');
      assert.equal(publication.travel.handoff.ownerPublished,false);assert.equal(publication.travel.handoff.sourceRetired,false);}
    assert.equal(publication.clock,attempt.heldSave.clock);assert.equal(publication.sha256,attempt.heldSave.sha256);assert.equal(publication.ownerRevision,starting.ownerRevision+1);
    assert.ok(io.stats.closed.slice(beforeWrites).every(path=>path.startsWith(route+'/')));
    let travel=null,homePreparation=null;
    const travelPublicationName=process.env.MAJESTY_HERO_LIVE_SAVE_TRAVEL_ORIGINAL_PUBLICATION;
    if(travelPublicationName){
      const originalPair=await json(travelPublicationName);assert.equal(originalPair.journalOriginalSavedRoundtripPublished,true);
      const neighbor=originalPair.sourceWorld;
      assert.ok(resolve(neighbor.filename).startsWith(join(workspace,'output/native-halo-saved-home-activation-generation-297')+'/'));
      assert.equal(await realpath(neighbor.filename),resolve(neighbor.filename));
      assert.equal(await hash(neighbor.filename),neighbor.sha256);assert.equal((await lstat(neighbor.filename)).size,neighbor.bytes);
      assert.equal(await checkpointSavedClock(await stoppedFileSource(neighbor.filename)),4050);
      const targetNames=realmFiles('1_0'),targetFile=join(profile,...nativeRealmRelativePath(targetNames.slots[0])),
        targetMarker=join(profile,...nativeRealmRelativePath(targetNames.marker));
      await mkdir(dirname(targetFile),{recursive:true});await copyFile(neighbor.filename,targetFile);
      const targetManifest=['checkpoint-v1',0,neighbor.bytes,neighbor.sha256,content,''].join('\n');await writeFile(targetMarker,targetManifest);
      const writesBefore=io.stats.writes;
      const prepareHome=process.env.MAJESTY_HERO_LIVE_SAVE_PREPARE_HOME==='1';
      const admission=await (prepareHome?prepareNativeHeroTravel:inspectNativeHeroTravelDestination)(world,1,'1_0',{layout:'halo-v1',storage:io.storage});
      assert.equal(admission.kind,'saved');assert.equal(admission.sourceOwnerManifest,publication.ownerManifest);
      assert.equal(admission.sourceNativeManifest,nativeManifest);assert.equal(admission.destinationNativeManifest,targetManifest);
      if(attempt.crossingTrial){assert.deepEqual(admission.travel,publication.travel);assert.equal(admission.travel.savedActorPositionVerified,true);}
      for(const layout of [admission.layout,admission.destinationLayout]){
        assert.equal(layout.verifiedVertices,16641);assert.equal(layout.sharedVertices,2480);assert.equal(layout.largestTerrainRead,1161);
      }
      assert.equal(io.stats.writes,writesBefore);assert.equal(await hash(targetFile),neighbor.sha256);
      assert.equal(await readFile(targetMarker,'utf8'),targetManifest);assert.equal(await hash(neighbor.filename),neighbor.sha256);
      const {home:preparedHome,...checkedAdmission}=admission;
      travel={publication:{filename:resolve(travelPublicationName),sha256:await hash(travelPublicationName)},neighbor,admission:checkedAdmission,
        originalNativeHeldPairLayoutQualified:true,additionalWrites:0,originalNeighborUnchanged:true};
      if(prepareHome){
        assert.equal(attempt.crossingTrial,true);assert.equal(sourceOnly,true);
        const writes=io.stats.writes,prepared={...checkedAdmission,home:preparedHome};
        assert.equal(prepared.sourceOwnerManifest,publication.ownerManifest);assert.equal(prepared.destinationNativeManifest,targetManifest);
        assert.equal(prepared.home.kind,'proposal');assert.equal(prepared.home.clock,4050);
        assert.equal(prepared.home.plan.worldId,startup.worldId);assert.equal(prepared.home.plan.contentDigest,nativeHeroContentDigest(content));
        assert.equal(prepared.home.plan.home.unitId,469);assert.equal(prepared.home.plan.home.agentId,7);
        assert.equal(prepared.home.plan.nativeHomeProjectionQualified,false);assert.ok(prepared.home.size<=1024);
        const bytes=prepared.home.record;
        assert.equal(createHash('sha256').update(bytes).digest('hex'),prepared.home.sha256);
        const scoped={async request(name,options,consume){assert.equal(name,lockName);assert.ok(held&&options.mode==='shared');return consume({});}};
        const store=await openNativeHeroRouteStore(io.directory(join(fixture,'majesty/profile')),world,
          {worldId:startup.worldId,entityId:receipt.owner.entityId,contentDigest:nativeHeroContentDigest(content)},{locks:scoped});
        const checked=await verifyRemoteHomeAgent({size:bytes.length,async readAt(at,n){return bytes.slice(at,at+n);}},registeredHeroHome(store.identity),prepared.home.agentId);
        assert.equal(checked.guildEntityId,prepared.home.plan.guildEntityId);
        assert.equal(io.stats.writes,writes);assert.equal(await hash(targetFile),neighbor.sha256);
        bytes.fill(0);assert.equal(createHash('sha256').update(prepared.home.record).digest('hex'),prepared.home.sha256);
        const {record,...home}=prepared.home;
        homePreparation={home,sourceNativeManifest:prepared.sourceNativeManifest,sourceOwnerManifest:prepared.sourceOwnerManifest,
          destinationNativeManifest:prepared.destinationNativeManifest,correctRegisteredGuildVerified:true,originalNeighborPreserved:true,
          additionalWrites:0,sourceRetired:false,destinationActivated:false,ownerTransferred:false};
      }
    }
    session.finish(true);assert.equal(session.poll('frontier-hero-save-finish').kind,'finish-ready');
    assert.equal(session.poll('frontier-hero-save-saved-1').kind,'acknowledged');
    assert.equal(session.message(line('[frontier] Hero save released ')).kind,'released');
    assert.equal(session.message(line('[frontier] Hero save resumed ')).saved,true);await endNativeHeroGameSave(world,1);
    assert.equal(lockCalls,1,'live publication does not reacquire the exclusive engine lease');
    const scoped={async request(name,options,consume){assert.equal(name,lockName);assert.ok(held);return consume({});}};
    const profiles=io.directory(join(fixture,'majesty/profile'));
    const journal=await openNativeHeroRouteStore(profiles,world,{worldId:startup.worldId,entityId:receipt.owner.entityId,
      contentDigest:nativeHeroContentDigest(content)},{locks:scoped});
    const selected=await journal.withOwner(async value=>({record:value.record,owner:value.owner,clock:await checkpointSavedClock(value.source)}));
    assert.equal(selected.clock,attempt.heldSave.clock);assert.equal(selected.record.manifest,publication.ownerManifest);
    assert.deepEqual([selected.owner.unitId,selected.owner.agentId],[heroUnitId,heroAgentId]);
    // An independent normal startup must remain denied while the current game
    // owns the lease, including after its save has completely resumed.
    await assert.rejects(startNativeWorldPlayer(()=>assert.fail('second injection'),{search,locks,storage:io.storage,
      events:{addEventListener(){},removeEventListener(){}}}),/busy/);
    assert.ok(held);assert.equal(io.stats.activeIO,0);assert.equal(io.stats.peakIO,1);
    assert.equal(await hash(nativeSlot),attempt.heldSave.sha256);assert.equal(await readFile(marker,'utf8'),nativeManifest);
    await unchanged();assert.equal(await hash(attempt.heldSave.checkpoint.filename),attempt.heldSave.sha256);
    await writeFile(report,JSON.stringify({version:1,originalNativeHeldCheckpointLivePublicationQualified:true,
      nativeAttempt:{filename:resolve(attemptName),sha256:await hash(attemptName)},startup:{filename:resolve(startupName),sha256:await hash(startupName)},
      fixture,receipt,publication,selected,travel,homePreparation,crossingRefusal,stats:io.stats,worldLeaseRetained:true,originalFilesUnchanged:true,
      isolatedStartingRevision:starting.ownerRevision,privateVerifiedSeedSelected:!!attempt.initialOwner,
      originalNativeCrossingCapturePublicationQualified:!!attempt.crossingTrial,
      contentFingerprintControlled:true,realOPFSDurabilityQualified:false,browserUsed:false,nativeProcessesStarted:0,
      browserLiveSaveQualified:false,liveHeroCrossingQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
  });
