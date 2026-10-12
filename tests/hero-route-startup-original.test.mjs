import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,lstat,readdir,writeFile,mkdir,open,rename,rm} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {opfsHeroRouteStorage} from '../web/world/hero-route-profile.mjs';
import {nativeHeroContentDigest} from '../web/world/hero-route-launch.mjs';
import {publishNativeHeroOwnerSave} from '../web/world/hero-route-native-save.mjs';
import {inspectHeroEnrollment,enrollHeroJourney,inspectSavedHeroJourney,prepareSavedHeroJourney,heroJourneyURL} from '../web/world/hero-route-launcher.mjs';
import {nativeHeroRestoreConfig} from '../web/world/hero-route-launch.mjs';
import {parseHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {startNativeWorldPlayer} from '../web/world/realm-session.mjs';
import {NativeRealmStore} from '../web/world/realm-store.mjs';
import {opfsNativeRealmStorage,nativeRealmRelativePath} from '../web/world/realm-profile.mjs';
import {registerCheckpointGuildHome} from '../web/world/hero-home.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {pairedLockName} from '../web/world/transfer-store.mjs';
import {ownedDirectory,stoppedFileSource,workspace} from '../scripts/lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from '../scripts/lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';

const publicationName=process.env.MAJESTY_HERO_STARTUP_ORIGINAL_PUBLICATION;
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
test('selected original kingdom is separately enrolled and prepared by production startup without changing its native journal',
  {skip:!publicationName,timeout:60000},async()=>{
    const attemptName=process.env.MAJESTY_HERO_STARTUP_ORIGINAL_ATTEMPT;
    const launcherMode=process.env.MAJESTY_HERO_STARTUP_ORIGINAL_LAUNCHER==='1';
    const haloLayout=process.env.MAJESTY_HERO_STARTUP_ORIGINAL_HALO_LAYOUT==='1';
    const output=resolve(process.env.MAJESTY_HERO_STARTUP_ORIGINAL_REPORT);
    assert.equal(dirname(output),join(workspace,'output'));
    assert.match(basename(output),/^hero-route-startup-original-\d{3}\.json$/);
    const fixture=output.slice(0,-5);
    for(const name of [output,fixture])await assert.rejects(lstat(name),error=>error.code==='ENOENT');
    const hash=async name=>(await hashNativeFile(name)).sha256;
    async function json(name){assert.ok((await lstat(name)).size<256*1024);return JSON.parse(await readFile(name,'utf8'));}
    const proof=await json(publicationName),attempt=await json(attemptName);
    assert.equal(proof.journalOriginalSavedRoundtripPublished,true);assert.equal(proof.selectedRevision,8);
    assert.equal(attempt.nativeSessionTerminal,true);assert.equal(attempt.nativeExitCode,0);
    assert.equal(attempt.stopReason,null);assert.equal(attempt.ownedProducerAbsent,true);
    try{process.kill(attempt.nativePid,0);assert.fail('Native fixture producer is live');}
    catch(error){if(error.code!=='ESRCH')throw error;}
    assert.equal(await hash(attempt.preparation),attempt.preparationSha256);
    const preparation=await json(attempt.preparation);
    assert.equal(resolve(preparation.journal),resolve(proof.journal));
    assert.equal(preparation.ownerManifest,proof.selectedManifest);
    const journal=await ownedDirectory(proof.journal,'actor-arrival-fixture-hero-route-');
    async function unchanged(){
      assert.deepEqual((await readdir(journal)).sort(),Object.keys(proof.journalSha256).sort());
      for(const [name,digest]of Object.entries(proof.journalSha256))assert.equal(await hash(join(journal,name)),digest,name);
    }
    await unchanged();await mkdir(fixture);await mkdir(join(fixture,'majesty'));await mkdir(join(fixture,'majesty','profile'));
    const world=basename(fixture),lockName=pairedLockName('native-world-'+world);
    const lockCalls=[],capturedFiles=[],stats={reads:0,writes:0,largestRead:0,largestWrite:0,activeIO:0,peakIO:0};let held=false;
    const locks={async request(name,options,consume){
      assert.equal(name,lockName);assert.ok(['shared','exclusive'].includes(options.mode));assert.equal(options.ifAvailable,true);
      lockCalls.push({name,...options});if(held)return consume(null);
      held=true;try{return await consume({});}finally{held=false;}
    }};
    function member(name){assert.equal(typeof name,'string');assert.ok(name.length&&name!=='.'&&name!=='..'&&!/[\\/\0]/.test(name));return name;}
    const missing=()=>Object.assign(Error('missing'),{name:'NotFoundError'});
    async function measured(kind,size,operation){
      assert.ok(held);assert.ok(size<=4096);stats[kind]++;stats[kind==='reads'?'largestRead':'largestWrite']=
        Math.max(stats[kind==='reads'?'largestRead':'largestWrite'],size);
      ++stats.activeIO;stats.peakIO=Math.max(stats.peakIO,stats.activeIO);
      try{return await operation();}finally{--stats.activeIO;}
    }
    function directory(path){return {
      async getDirectoryHandle(name,options){
        assert.ok(held);const next=join(path,member(name));
        try{const info=await lstat(next);assert.ok(info.isDirectory());}
        catch(error){if(error.code!=='ENOENT')throw error;if(!options?.create)throw missing();await mkdir(next);}
        return directory(next);
      },
      async getFileHandle(name,options){
        assert.ok(held);const filename=join(path,member(name));
        try{assert.ok((await lstat(filename)).isFile());}
        catch(error){if(error.code!=='ENOENT')throw error;if(!options?.create)throw missing();await writeFile(filename,'',{flag:'wx'});}
        return {
          async getFile(){
            assert.ok(held);const size=(await lstat(filename)).size;
            capturedFiles.push(filename.slice(fixture.length+1));
            const source=size?await stoppedFileSource(filename):null;
            return {size,slice(at,end){return {async arrayBuffer(){
              return measured('reads',end-at,async()=>{
                assert.ok(source);const bytes=await source.readAt(at,end-at);
                return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
              });
            }};}};
          },
          async createWritable(){
            assert.ok(held);const temporary=filename+'.pending-'+randomUUID(),stream=await open(temporary,'wx');
            let position=0,closed=false;
            return {
              async write(bytes){return measured('writes',bytes.length,async()=>{
                assert.ok(!closed&&bytes instanceof Uint8Array);
                for(let at=0;at<bytes.length;){const {bytesWritten}=await stream.write(bytes,at,bytes.length-at,position);
                  assert.ok(bytesWritten);at+=bytesWritten;position+=bytesWritten;}
              });},
              async close(){assert.ok(held&&!closed);await stream.close();closed=true;await rename(temporary,filename);},
              async abort(){if(!closed){await stream.close();closed=true;}await rm(temporary,{force:true});},
            };
          },
        };
      },
      async removeEntry(name){assert.ok(held);await rm(join(path,member(name)));},
    };}
    const profiles=directory(join(fixture,'majesty','profile'));
    // Deliberately controlled content fingerprint. This test qualifies original
    // save bytes, not compatibility with a browser installation's current mods.
    const content='a'.repeat(64)+':'+'b'.repeat(64),contentDigest=nativeHeroContentDigest(content);
    assert.notEqual(contentDigest,proof.identity.contentDigest);
    let worldId=sha(['isolated-original-browser-startup-v1',proof.selectedManifest,world]);
    assert.notEqual(worldId,proof.identity.registeredHome.worldId);
    const originalStats={},original=new HeroRouteStore(await stoppedHeroRouteStorage(journal,originalStats),proof.identity,proof.identity.contentDigest);
    let enrollment,receipt,nativeRecord,routeHashes,startupMetrics,projectionStats,continuation=null,launcher=null;
    await original.withOwner(async selected=>{
      assert.deepEqual(selected.owner,proof.selectedOwner);assert.equal(selected.record.manifest,proof.selectedManifest);
      if(launcherMode){
        const native=new NativeRealmStore(opfsNativeRealmStorage(profiles,world,locks),{content});
        await native.commit('0_0',{source:selected.source,sha256:selected.entry.world.sha256,expectedManifest:null});
        const proposal=await inspectHeroEnrollment(profiles,world,'0_0',{locks});
        assert.equal(proposal.choices.length,1);assert.deepEqual(proposal.choices.map(c=>[c.guildUnitId,c.heroUnitId]),[[469,513]]);
        const choice=proposal.choices[0],registered=await enrollHeroJourney(profiles,world,{content,region:'0_0',
          expectedNativeManifest:proposal.nativeManifest,guildUnitId:choice.guildUnitId,heroUnitId:choice.heroUnitId},{locks});
        worldId=registered.worldId;assert.notEqual(worldId,proof.identity.registeredHome.worldId);
        launcher={proposal,registered};
      }
      const registration=await registerCheckpointGuildHome(selected.source,{worldId,contentDigest,region:'0_0',guildUnitId:469});
      assert.deepEqual(registration.members.map(m=>[m.unitId,m.agentId]),[[513,29]]);
      assert.equal(registration.home.originCheckpointSha256,selected.entry.world.sha256);
      const identity={version:2,entityId:registration.members[0].entityId,contentDigest,regions:['0_0','1_0'],
        actor:{...proof.identity.actor},registeredHome:registration};
      const route=new HeroRouteStore(opfsHeroRouteStorage(profiles,world,identity.entityId,locks),identity,contentDigest);
      enrollment=launcherMode?(await route.read()).record:await route.commit({kind:'seed',operationId:sha(['original-startup-enrollment-v1',worldId]),expectedManifest:null,
        regions:['0_0'],aliases:[{unitId:513,agentId:29}],homeAliases:[{kind:'native',unitId:469,agentId:7}],
        worlds:[{source:selected.source,sha256:selected.entry.world.sha256}]});
      const routeDirectory=join(fixture,'majesty','profile','native-world-'+world,'hero-route');
      routeHashes={};for(const name of await readdir(routeDirectory))routeHashes[name]=await hash(join(routeDirectory,name));
      const search='?'+new URLSearchParams({world,profile:'frontier_0_0',RECOMP_RULE_FRONTIER_REGION:'0_0',
        RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1','hero-world':worldId,'hero-entity':identity.entityId,
        ...(haloLayout?{'hero-layout':'halo-v1'}:{})});
      const signal=new AbortController().signal,events={addEventListener(){},removeEventListener(){}};
      const storage={getDirectory:async()=>directory(fixture)};
      const order=[],lockCount=lockCalls.length,readsBefore=stats.reads,writesBefore=stats.writes,capturesBefore=capturedFiles.length;
      await assert.rejects(startNativeWorldPlayer(async(profile,retain,prepare)=>{
        assert.equal(profile,'native-world-'+world+'/frontier_0_0');order.push('content');
        receipt=await prepare(content,{signal});order.push('prepared');
        const filename=join(fixture,'majesty','profile','native-world-'+world,...nativeRealmRelativePath('Frontier_0_0.GMP'));
        assert.equal(await hash(filename),selected.entry.world.sha256);
        assert.equal((await lstat(filename)).size,selected.entry.world.size);
        assert.equal(receipt.clock,113500);assert.equal(receipt.ownerRevision,0);
        assert.deepEqual([receipt.owner.unitId,receipt.owner.agentId],[513,29]);
        const binding=parseHeroRuntimeBinding(receipt.runtimeBinding);
        assert.deepEqual([binding.unitId,binding.agentId,binding.homeUnitId,binding.homeAgentId],[513,29,469,7]);
        assert.equal(binding.clock,113500);assert.equal(binding.sha256,selected.entry.world.sha256);
        if(haloLayout){assert.equal(receipt.haloLayout.verifiedVertices,16641);assert.equal(receipt.haloLayout.sharedVertices,2480);}
        order.push('graphics-boundary');
        // Stop before GPU/WASM. The production startup must release the lock
        // only after the completed projection, and revoke its preparation cap.
        throw Error('terminal verification stop before graphics');
      },{search,locks,events,storage}),/terminal verification stop before graphics/);
      assert.equal(held,false);assert.equal(lockCalls.length,lockCount+1);
      assert.deepEqual(order,['content','prepared','graphics-boundary']);
      const startupCaptures=capturedFiles.slice(capturesBefore);
      assert.equal(startupCaptures.filter(name=>name.endsWith('/hero-route/Frontier_Hero_Route_0_0_0.GMP')).length,1);
      startupMetrics={reads:stats.reads-readsBefore,writes:stats.writes-writesBefore,capturedFiles:startupCaptures};
      const native=new NativeRealmStore(opfsNativeRealmStorage(profiles,world,locks),{content});
      nativeRecord=await native.withRegions(['0_0'],async checkpoints=>{
        const checkpoint=checkpoints.get('0_0');
        assert.equal(await checkpointSavedClock(checkpoint.source),113500);return checkpoint.record;
      });
      assert.equal(nativeRecord.sha256,selected.entry.world.sha256);
      assert.deepEqual((await readdir(routeDirectory)).sort(),Object.keys(routeHashes).sort());
      for(const [name,digest]of Object.entries(routeHashes))assert.equal(await hash(join(routeDirectory,name)),digest);
      projectionStats={...stats};
      const continuationName=process.env.MAJESTY_HERO_STARTUP_ORIGINAL_CONTINUATION;
      if(continuationName){
        const observed=await json(continuationName);
        assert.equal(observed.nativeSelectedHaloSavedHomeOwnerQualified,true);
        assert.equal(resolve(observed.manifest),resolve(attemptName));assert.equal(observed.manifestSha256,await hash(attemptName));
        assert.deepEqual([observed.startClock,observed.endClock,observed.originalTicks],[113500,114000,10]);
        assert.deepEqual([observed.actualNativeUnitId,observed.actualAgentId],[513,29]);
        const producer=await ownedDirectory(attempt.fixture,'actor-arrival-fixture-halo-world-saved-home-owner-');
        const evolved=attempt.worlds.find(w=>basename(w.filename)==='Halo_Saved_Home_Owner_Evolved.GMP');
        assert.ok(evolved&&resolve(evolved.filename).startsWith(producer+'/'));
        assert.equal(await hash(evolved.filename),evolved.sha256);assert.equal((await lstat(evolved.filename)).size,evolved.bytes);
        const source=await stoppedFileSource(evolved.filename);assert.equal(await checkpointSavedClock(source),114000);
        const saved=await native.commit('0_0',{source,sha256:evolved.sha256,expectedManifest:nativeRecord.manifest});
        const request={worldId,entityId:identity.entityId,content,region:'0_0',expectedOwnerManifest:enrollment.manifest,
          expectedNativeManifest:saved.manifest,operationId:sha(['original-continued-owner-save-v1',worldId,evolved.sha256])};
        let launchRequest,prepared;
        if(launcherMode){
          const summary=await inspectSavedHeroJourney(profiles,world,{locks,signal});
          assert.equal(summary.ownerClock,113500);assert.equal(summary.nativeClock,114000);
          launchRequest={worldId:summary.worldId,entityId:summary.entityId,region:summary.region,
            content:summary.content,ownerManifest:summary.ownerManifest,nativeManifest:summary.nativeManifest};
          prepared=await prepareSavedHeroJourney(profiles,world,launchRequest,{locks,signal});
        }
        const published=launcherMode?prepared.publication:await publishNativeHeroOwnerSave(profiles,world,request,{locks,signal});
        assert.equal(published.ownerRevision,1);assert.equal(published.clock,114000);assert.equal(published.sha256,evolved.sha256);
        const beforeRetry=stats.writes,retry=launcherMode?(await prepareSavedHeroJourney(profiles,world,launchRequest,{locks,signal})).publication:
          await publishNativeHeroOwnerSave(profiles,world,request,{locks,signal});
        assert.equal(retry.idempotent,true);assert.equal(retry.ownerRevision,1);assert.equal(stats.writes,beforeRetry);
        const owner=await route.withOwner(async value=>({owner:value.owner,clock:await checkpointSavedClock(value.source),
          record:value.record,sha256:value.entry.world.sha256}));
        assert.equal(owner.record.manifest,published.ownerManifest);assert.equal(owner.clock,114000);
        assert.equal(owner.sha256,evolved.sha256);assert.deepEqual([owner.owner.unitId,owner.owner.agentId],[513,29]);
        let resumed;const beforeResume=stats.writes;
        await assert.rejects(startNativeWorldPlayer(async(profile,retain,prepare)=>{
          resumed=await prepare(content,{signal});assert.equal(resumed.clock,114000);assert.equal(resumed.ownerRevision,1);
          assert.equal(resumed.sha256,evolved.sha256);assert.equal(resumed.idempotent,true);
          assert.equal(parseHeroRuntimeBinding(resumed.runtimeBinding).clock,114000);
          if(haloLayout){assert.equal(resumed.haloLayout.verifiedVertices,16641);assert.equal(resumed.haloLayout.sharedVertices,2480);}
          throw Error('terminal verification stop before graphics');
        },{search,locks,events,storage}),/terminal verification stop before graphics/);
        assert.equal(held,false);assert.equal(stats.writes,beforeResume);
        assert.equal(await hash(evolved.filename),evolved.sha256);
        const updatedHashes={};for(const name of await readdir(routeDirectory))updatedHashes[name]=await hash(join(routeDirectory,name));
        assert.equal(Object.keys(updatedHashes).filter(name=>name.endsWith('.GMP')).length,2);
        continuation={observation:{filename:resolve(continuationName),sha256:await hash(continuationName)},
          evolved,published,retry,owner,resumed,updatedHashes,nativeSourceUnchanged:true,retryWrites:0,resumeWrites:0};
        if(launcherMode){
          const url=heroJourneyURL(prepared,'http://localhost:8000/world/?world='+world);
          const config=nativeHeroRestoreConfig(url.search);assert.equal(config.worldId,worldId);assert.equal(config.entityId,owner.owner.entityId);
          launcher={...launcher,prepared,resumeURL:url.href,resumeConfig:config,originalContinuedSavePrepared:true};
        }
      }
    });
    await unchanged();assert.equal(stats.activeIO,0);assert.equal(stats.peakIO,1);
    assert.ok(originalStats.largestRead<=4096&&originalStats.peakReads===1);assert.equal(originalStats.writes??0,0);
    let comparison=null;
    const baselineName=process.env.MAJESTY_HERO_STARTUP_ORIGINAL_BASELINE;
    if(baselineName){
      const baseline=await json(baselineName);assert.equal(baseline.originalCheckpointStartupProjectionQualified,true);
      assert.equal(baseline.receipt.sha256,receipt.sha256);assert.equal(baseline.receipt.size,receipt.size);
      assert.equal(baseline.content,content);assert.equal(baseline.originalJournalUnchanged,true);
      assert.ok(projectionStats.reads<baseline.stats.reads);
      comparison={filename:resolve(baselineName),sha256:await hash(baselineName),scope:'enrollment plus startup plus native-slot inspection',
        previousReads:baseline.stats.reads,currentReads:projectionStats.reads,readsRemoved:baseline.stats.reads-projectionStats.reads};
    }
    const sourceSha256={};for(const name of ['web/world/hero-route-launch.mjs','web/world/hero-route-restore.mjs',
      'web/world/hero-route-store.mjs','web/world/hero-route-profile.mjs','web/world/realm-session.mjs',
      'web/world/hero-home.mjs','web/world/realm-store.mjs','web/world/realm-profile.mjs','web/world/hero-route-native-save.mjs',
      'web/world/hero-route-launcher.mjs','web/world/hero-runtime-binding.mjs','web/world/hero-save-session.mjs',
      'web/world/halo-checkpoint-layout.mjs','web/world/hero-travel-boundary.mjs','web/world/native.mjs','tests/hero-route-startup-original.test.mjs'])sourceSha256[name]=await hash(name);
    await writeFile(output,JSON.stringify({version:1,originalCheckpointStartupProjectionQualified:true,
      publication:{filename:resolve(publicationName),sha256:await hash(publicationName)},
      terminalAttempt:{filename:resolve(attemptName),sha256:await hash(attemptName),producerAbsent:true},
      originalSelectedRevision:8,originalSelectedOwner:proof.selectedOwner,originalJournalUnchanged:true,
      fixture,worldId,content,contentDigest,contentFingerprintControlled:true,legacyContentDigest:proof.identity.contentDigest,
      independentlyEnrolled:true,enrollment,receipt,nativeRecord,enrolledJournalUnchangedAfterStartup:true,
      originalHaloStartupLayoutQualified:haloLayout,
      routeHashes,stats,projectionStats,startupMetrics,comparison,continuation,launcher,originalStats,lockCalls,sourceSha256,nativeProcessesStarted:0,browserUsed:false,
      originalEngineLoadQualified:false,installedBrowserContentQualified:false,realOPFSDurabilityQualified:false,
      liveHeroTravelQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
  });
