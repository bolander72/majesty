import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,lstat,mkdir,readdir,writeFile,realpath} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {workspace,ownedDirectory,stoppedFileSource} from '../scripts/lib/stopped-entity-io.mjs';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';
import {NativeRealmStore} from '../web/world/realm-store.mjs';
import {opfsNativeRealmStorage,nativeRealmRelativePath} from '../web/world/realm-profile.mjs';
import {inspectHeroEnrollment,enrollHeroJourney} from '../web/world/hero-route-launcher.mjs';
import {startNativeWorldPlayer} from '../web/world/realm-session.mjs';
import {parseHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointPlacements} from '../web/world/checkpoint.mjs';

const preparationName=process.env.MAJESTY_HERO_CROSSING_SOURCE_PREPARATION;
test('preserved original outdoor hero is independently enrolled through current halo startup',
  {skip:!preparationName,timeout:60000},async()=>{
    const hash=async path=>(await hashNativeFile(path)).sha256;
    async function json(path){assert.ok((await lstat(path)).size<256*1024);return JSON.parse(await readFile(path,'utf8'));}
    async function descriptor(value){
      const path=resolve(value.filename);assert.equal(await realpath(path),path);
      assert.equal(await hash(path),value.sha256);
      if(value.bytes!==undefined)assert.equal((await lstat(path)).size,value.bytes);
      return path;
    }
    const preparation=await json(preparationName);
    assert.equal(preparation.homewardSessionPrepared,true);assert.equal(preparation.selectedRevision,6);
    const publication=await json(await descriptor(preparation.publicationProof));
    assert.equal(publication.journalOriginalHaloHomewardPublished,true);
    assert.equal(publication.selectedManifest,preparation.selectedManifest);
    const activation=await json(await descriptor(publication.nativeProof));
    assert.equal(activation.nativeHaloHomewardActivationQualified,true);
    assert.equal(activation.homewardGameplayResumed,true);
    assert.deepEqual([activation.actualNativeUnitId,activation.actualAgentId],[508,25]);
    const terminalName=await descriptor({filename:activation.manifest,sha256:activation.manifestSha256});
    const terminal=await json(terminalName);
    assert.equal(terminal.nativeSessionTerminal,true);assert.equal(terminal.ownedProducerAbsent,true);
    assert.equal(terminal.nativeExitCode,0);assert.equal(terminal.stopReason,null);
    try{process.kill(terminal.nativePid,0);assert.fail('Original native producer still live');}
    catch(error){if(error.code!=='ESRCH')throw error;}
    const producer=await ownedDirectory(terminal.fixture,'actor-arrival-fixture-halo-world-homeward-');
    const original=activation.worlds.find(w=>basename(w.filename)==='Halo_Homeward_Evolved.GMP');
    assert.ok(original&&resolve(original.filename).startsWith(producer+'/'));
    await descriptor(original);
    assert.ok(terminal.activationWorlds.some(w=>w.filename===original.filename&&w.sha256===original.sha256&&w.bytes===original.bytes));
    const selected=preparation.worlds.find(w=>w.region==='0_0');
    assert.equal(resolve(selected.filename),join(dirname(resolve(preparationName)),'Region_0_0.GMP'));
    await descriptor(selected);assert.equal(selected.sha256,original.sha256);assert.equal(selected.bytes,original.bytes);
    assert.deepEqual([selected.clock,selected.entry.alias.unitId,selected.entry.alias.agentId],[94550,508,25]);
    const source=await stoppedFileSource(selected.filename);assert.equal(await checkpointSavedClock(source),94550);
    let savedActor;
    for await(const actor of checkpointPlacements(source))if(actor.unitId===508){assert.equal(savedActor,undefined);savedActor=actor;}
    assert.ok(savedActor);assert.equal(savedActor.parentUnitId,0);assert.equal(savedActor.stateFlags&4,0);
    assert.equal(savedActor.requiresParentPosition,false);
    assert.deepEqual(savedActor.fixedPosition,{x:7273079,y:557056,z:139839});

    const output=resolve(process.env.MAJESTY_HERO_CROSSING_SOURCE_REPORT);
    assert.equal(dirname(output),join(workspace,'output'));assert.match(basename(output),/^hero-crossing-source-original-\d{3}\.json$/);
    const fixture=output.slice(0,-5),world=basename(fixture),lockName='majesty-pair-native-world-'+world;
    for(const path of [output,fixture])await assert.rejects(lstat(path),e=>e.code==='ENOENT');
    await mkdir(join(fixture,'majesty/profile'),{recursive:true});
    let held=false;const lockCalls=[];
    const locks={async request(name,options,consume){assert.equal(name,lockName);assert.equal(options.ifAvailable,true);
      assert.ok(['shared','exclusive'].includes(options.mode));lockCalls.push({name,...options});
      if(held)return consume(null);held=true;try{return await consume({});}finally{held=false;}}};
    const io=fileProfileStorage(fixture,()=>held),profiles=io.directory(join(fixture,'majesty/profile'));
    const content='a'.repeat(64)+':'+'b'.repeat(64);
    const native=new NativeRealmStore(opfsNativeRealmStorage(profiles,world,locks),{content});
    await native.commit('0_0',{source,sha256:selected.sha256,expectedManifest:null});
    const proposal=await inspectHeroEnrollment(profiles,world,'0_0',{locks});
    assert.equal(proposal.clock,94550);assert.deepEqual(proposal.choices.map(c=>[c.guildUnitId,c.heroUnitId]),[[469,508]]);
    const enrollment=await enrollHeroJourney(profiles,world,{content,region:'0_0',expectedNativeManifest:proposal.nativeManifest,
      guildUnitId:469,heroUnitId:508},{locks});
    const worldId=enrollment.worldId;assert.notEqual(worldId,preparation.identity.registeredHome.worldId);
    const route=join(fixture,'majesty/profile','native-world-'+world,'hero-route'),routeHashes={};
    for(const name of await readdir(route))routeHashes[name]=await hash(join(route,name));
    const search='?'+new URLSearchParams({world,profile:'frontier_0_0',RECOMP_RULE_FRONTIER_REGION:'0_0',
      RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
      'hero-world':worldId,'hero-entity':enrollment.entityId,'hero-layout':'halo-v1'});
    let receipt;const writes=io.stats.writes;
    await assert.rejects(startNativeWorldPlayer(async(profile,retain,prepare)=>{
      assert.equal(profile,'native-world-'+world+'/frontier_0_0');
      receipt=await prepare(content,{signal:new AbortController().signal});
      const binding=parseHeroRuntimeBinding(receipt.runtimeBinding);
      assert.deepEqual([binding.clock,binding.unitId,binding.agentId,binding.homeUnitId,binding.homeAgentId],[94550,508,25,469,7]);
      assert.equal(receipt.sha256,selected.sha256);assert.equal(receipt.size,selected.bytes);assert.equal(receipt.ownerRevision,0);
      assert.equal(receipt.haloLayout.verifiedVertices,16641);assert.equal(receipt.haloLayout.sharedVertices,2480);
      assert.equal(receipt.haloBinding,'majesty-hero-halo-v1|0_0|'+selected.sha256);
      assert.equal(await hash(join(fixture,'majesty/profile','native-world-'+world,...nativeRealmRelativePath('Frontier_0_0.GMP'))),selected.sha256);
      throw Error('verified stop before graphics');
    },{search,locks,storage:io.storage,events:{addEventListener(){},removeEventListener(){}}}),/verified stop before graphics/);
    assert.equal(held,false);assert.equal(io.stats.activeIO,0);assert.equal(io.stats.peakIO,1);
    assert.ok(io.stats.largestRead<=4096&&io.stats.largestWrite<=4096);
    for(const [name,digest]of Object.entries(routeHashes))assert.equal(await hash(join(route,name)),digest);
    await descriptor(selected);await descriptor(original);
    const sourceSha256={};
    for(const name of ['hero-route-launch','hero-route-restore','hero-route-store','hero-route-profile','realm-session',
      'hero-home','realm-store','realm-profile','hero-route-native-save','hero-route-launcher','hero-runtime-binding',
      'hero-save-session','halo-checkpoint-layout','hero-travel-boundary','native','checkpoint',
      'remote-home','remote-home-cache','entity-home-ownership','saved-clock',
      'hero-home-arrival-package','hero-arrival-staging','hero-dormant-home-restore']){
      const filename='web/world/'+name+'.mjs';sourceSha256[filename]=await hash(join(workspace,filename));
    }
    for(const filename of ['tests/hero-crossing-source-original.test.mjs','tests/fixtures/file-profile-storage.mjs',
      'scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs'])sourceSha256[filename]=await hash(join(workspace,filename));
    await writeFile(output,JSON.stringify({version:1,originalSelectedCrossingSourceStartupQualified:true,
      preparation:{filename:resolve(preparationName),sha256:await hash(preparationName)},
      publication:preparation.publicationProof,nativeActivation:publication.nativeProof,
      terminalAttempt:{filename:terminalName,sha256:await hash(terminalName),producerAbsent:true},
      sourceCheckpoint:selected,producerOriginalCheckpoint:original,sourceCheckpointUnchanged:true,
      fixture,worldId,content,enrollment,receipt,routeHashes,savedActor,sourceSha256,lockCalls,stats:io.stats,
      projectionWrites:io.stats.writes-writes,originalHaloStartupLayoutQualified:true,independentlyEnrolled:true,
      contentFingerprintControlled:true,realOPFSDurabilityQualified:false,browserUsed:false,nativeProcessesStarted:0,
      nativeCrossingQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
  });
