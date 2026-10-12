import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,lstat,readdir,writeFile} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {openNativeHeroRouteStore,heroRouteDirectory,heroRouteFilename} from '../web/world/hero-route-profile.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {pairedLockName} from '../web/world/transfer-store.mjs';
import {ownedDirectory,stoppedFileSource,workspace} from '../scripts/lib/stopped-entity-io.mjs';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';

const publicationName=process.env.MAJESTY_HERO_ROUTE_ORIGINAL_PUBLICATION;
test('browser custody adapter reads the selected original round-trip owner and saved east without changing either',
  {skip:!publicationName},async()=>{
    const attemptName=process.env.MAJESTY_HERO_ROUTE_ORIGINAL_ATTEMPT;
    const output=resolve(process.env.MAJESTY_HERO_ROUTE_ORIGINAL_REPORT);
    assert.equal(dirname(output),join(workspace,'output'));
    assert.match(basename(output),/^hero-route-profile-original-\d{3}\.json$/);
    await assert.rejects(lstat(output),error=>error.code==='ENOENT');
    async function json(name){assert.ok((await lstat(name)).size<256*1024);return JSON.parse(await readFile(name,'utf8'));}
    const hash=async name=>(await hashNativeFile(name)).sha256;
    const proof=await json(publicationName),attempt=await json(attemptName);
    assert.equal(proof.journalOriginalSavedRoundtripPublished,true);assert.equal(proof.selectedRevision,8);
    assert.equal(attempt.nativeSessionTerminal,true);assert.equal(attempt.nativeExitCode,0);
    assert.equal(attempt.stopReason,null);assert.equal(attempt.ownedProducerAbsent,true);
    try{process.kill(attempt.nativePid,0);assert.fail('Native fixture producer is live');}catch(error){if(error.code!=='ESRCH')throw error;}
    assert.equal(await hash(attempt.preparation),attempt.preparationSha256);
    const preparation=await json(attempt.preparation);
    assert.equal(resolve(preparation.journal),resolve(proof.journal));assert.equal(preparation.ownerManifest,proof.selectedManifest);
    const journal=await ownedDirectory(proof.journal,'actor-arrival-fixture-hero-route-');
    async function unchanged(){
      assert.deepEqual((await readdir(journal)).sort(),Object.keys(proof.journalSha256).sort());
      for(const [name,digest]of Object.entries(proof.journalSha256))assert.equal(await hash(join(journal,name)),digest,name);
    }
    await unchanged();
    const world='original-profile-test',path=['native-world-'+world,heroRouteDirectory(proof.identity.entityId)];
    const filesOpened=[],lockCalls=[];let reads=0,activeReads=0,peakReads=0,largestRead=0,held=false;
    function directory(level){return {
      async getDirectoryHandle(name,options){assert.ok(held);assert.ok(!options?.create);assert.equal(name,path[level]);return directory(level+1);},
      async getFileHandle(name,options){
        assert.ok(held);assert.equal(level,2);assert.ok(!options?.create);heroRouteFilename(name);
        let source;
        try{source=await stoppedFileSource(join(journal,name));}
        catch(error){if(error.code==='ENOENT')throw Object.assign(Error('missing'),{name:'NotFoundError'});throw error;}
        filesOpened.push(name);
        return {async getFile(){return {size:source.size,slice(at,end){return {async arrayBuffer(){
          ++reads;++activeReads;peakReads=Math.max(peakReads,activeReads);largestRead=Math.max(largestRead,end-at);
          try{const bytes=await source.readAt(at,end-at);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}
          finally{--activeReads;}
        }};}};}};
      },
    };}
    const locks={async request(name,options,consume){
      assert.equal(name,pairedLockName('native-world-'+world));assert.deepEqual(options,{mode:'shared',ifAvailable:true});
      assert.ok(!held);held=true;lockCalls.push({name,...options});try{return await consume({});}finally{held=false;}
    }};
    const expected={worldId:proof.identity.registeredHome.worldId,entityId:proof.identity.entityId,contentDigest:proof.identity.contentDigest};
    const store=await openNativeHeroRouteStore(directory(0),world,expected,{locks});
    assert.deepEqual(filesOpened,['Frontier_Hero_Route_Identity.json']);
    const selected=await store.read();assert.deepEqual(selected.owner,proof.selectedOwner);
    assert.equal(selected.record.manifest,proof.selectedManifest);
    let escaped;const clock=await store.withOwner(async value=>{escaped=value.source;return checkpointSavedClock(value.source);});
    assert.equal(clock,113500);await assert.rejects(escaped.readAt(0,4),/lease ended/);
    const ownerPeakReads=peakReads;assert.equal(ownerPeakReads,1);
    assert.deepEqual([...new Set(filesOpened.filter(name=>name.endsWith('.GMP')))].map(name=>name.split('_').slice(3,5).join('_')),['0_0']);
    const paired=await store.withDestination('1_0',null,async value=>({regions:value.regions,
      clocks:await Promise.all(value.sources.map(source=>checkpointSavedClock(source)))}));
    assert.deepEqual(paired.regions,['0_0','1_0']);assert.deepEqual(paired.clocks,[113500,4050]);
    const reopened=await openNativeHeroRouteStore(directory(0),world,expected,{locks});
    assert.deepEqual(await reopened.read(),selected);await unchanged();
    assert.equal(activeReads,0);assert.ok(largestRead<=4096);assert.equal(peakReads,2);
    const sourceSha256={};for(const name of ['web/world/hero-route-profile.mjs','web/world/hero-route-store.mjs',
      'web/world/checkpoint-lease.mjs','tests/hero-route-profile-original.test.mjs'])sourceSha256[name]=await hash(name);
    await writeFile(output,JSON.stringify({version:1,originalSavedCustodyProfileReadQualified:true,
      publication:{filename:resolve(publicationName),sha256:await hash(publicationName)},
      terminalAttempt:{filename:resolve(attemptName),sha256:await hash(attemptName),producerAbsent:true},
      selectedRevision:8,selectedOwner:selected.owner,selectedClock:clock,paired,filesOpened,lockCalls,
      reads,largestRead,ownerPeakReads,peakReads,journalUnchanged:true,sourceSha256,writes:0,nativeProcessesStarted:0,
      browserUsed:false,realOPFSDurabilityQualified:false,liveHeroTravelQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
  });
