#!/usr/bin/env node
// Supervised stopped-file publication with real original saves. No game/browser.
import {open,readFile,writeFile,mkdtemp,mkdir,rename,rm,readdir,stat} from 'node:fs/promises';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {EntityPairStore,openEntityPairStore,encodeEntityLedger} from '../web/world/entity-pair.mjs';
import {ENTITY_LEDGER_FILE,TRANSFER_MANIFEST} from '../web/world/transfer-store.mjs';
import {checkpointActorRecords} from '../web/world/checkpoint.mjs';
const run=promisify(execFile),root=resolve(new URL('../',import.meta.url).pathname),script=resolve(new URL(import.meta.url).pathname);
const sha=b=>createHash('sha256').update(b).digest('hex');
let largestRead=0,largestWrite=0,activeReads=0,peakReads=0;
async function fileSource(name){
  const info=await stat(name);if(!info.isFile()||info.size<1||info.size>64*1024*1024)throw Error('Invalid stopped file source');
  return {size:info.size,async readAt(at,n){
    if(![at,n].every(Number.isSafeInteger)||at<0||n<0||n>4096||at+n>info.size)throw Error('Unbounded stopped-file read');
    largestRead=Math.max(largestRead,n);peakReads=Math.max(peakReads,++activeReads);
    const f=await open(name,'r');try{const b=new Uint8Array(n),{bytesRead}=await f.read(b,0,n,at);if(bytesRead!==n)throw Error('Truncated stopped file');return b;}
    finally{await f.close();--activeReads;}
  }};
}
function io(directory){
  // Parent serially supervises child exits. This lock excludes operations within
  // one process; it is not a production OS lock or a browser Web Locks claim.
  if(!resolve(directory).startsWith(join(root,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-pair-')))throw Error('Require owned stopped pair directory');
  let busy=false;
  const valid=name=>name===ENTITY_LEDGER_FILE||name===TRANSFER_MANIFEST||/^Frontier_Transfer_(Source|Destination)_[01]\.GMP$/.test(name);
  return {async withLock(mode,consume){if(busy)throw Error('busy stopped fixture');busy=true;try{return await consume();}finally{busy=false;}},
    async open(name){if(!valid(name))throw Error('Invalid stopped pair filename');try{return await fileSource(join(directory,name));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async atomicWrite(name,produce){
      if(!valid(name))throw Error('Invalid stopped pair filename');
      const temp=join(directory,name+'.tmp-'+randomUUID()),target=join(directory,name),f=await open(temp,'wx');let position=0,closed=false;
      try{
        await produce({async write(bytes){if(!(bytes instanceof Uint8Array)||bytes.length>4096)throw Error('Unbounded stopped write');largestWrite=Math.max(largestWrite,bytes.length);
          for(let at=0;at<bytes.length;){const {bytesWritten}=await f.write(bytes,at,bytes.length-at,position);if(!bytesWritten)throw Error('Short stopped write');at+=bytesWritten;position+=bytesWritten;}}});
        await f.sync();await f.close();closed=true;await rename(temp,target);
        const dir=await open(directory,'r');try{await dir.sync();}finally{await dir.close();}
      }catch(e){if(!closed)await f.close().catch(()=>{});await rm(temp,{force:true});throw e;}
    }};
}
async function request(config,state,expectedManifest){
  return {worlds:await Promise.all(config.files[state].map(async (file,i)=>({source:await fileSource(file),sha256:config.ledger[state][i].sha256}))),expectedManifest};
}
async function child(configName,directory,point){
  const c=JSON.parse(await readFile(configName,'utf8')),store=await openEntityPairStore(io(directory),c.ledger.contentDigest);
  const before=await store.read();
  await store.publish(await request(c,'after',before.record.manifest),async at=>{if(at===point)process.exit(77);});
  throw Error('Expected supervised interruption did not occur');
}
if(process.argv[2]==='--owned-child'){
  if(process.argv.length!==6)throw Error('Invalid supervised worker arguments');
  await child(process.argv[3],process.argv[4],process.argv[5]);
}else{
  const [basename='native-entity-pair-observed']=process.argv.slice(2);
  if(process.argv.length>3||!/^[a-z][a-z0-9-]*$/.test(basename))throw Error('Use a fresh output basename');
  const output=join(root,'output',basename+'.json');try{await stat(output);throw Error('Preserve prior entity-pair evidence');}catch(e){if(e.code!=='ENOENT')throw e;}
  const names={source:'native-original-source-departure-observed.json',sourceReload:'native-original-source-departed-reload-current-observed.json',
    destination:'native-npc-schedule-current-observed.json',destinationReload:'native-npc-scheduled-reload-motion-observed.json',destinationBefore:'native-inflight-move-checkpoint-observed.json'};
  const evidence={},proofs={};
  for(const [key,name] of Object.entries(names)){const bytes=await readFile(join(root,'output',name));proofs[key]=JSON.parse(bytes);if(!proofs[key].qualified)throw Error('Unqualified native input');evidence['output/'+name]=sha(bytes);}
  for(const [key,checker,args] of [
    ['source','check-native-npc-departure.mjs',[proofs.source.sourceReloadReport,'--stdout']],
    ['sourceReload','check-native-npc-departed-reload.mjs',[proofs.sourceReload.sourceManifest,'--stdout']],
    ['destination','check-native-npc-schedule.mjs',[proofs.destination.sourceReloadReport,'--stdout']],
  ]){
    const {stdout}=await run(process.execPath,[join(root,'scripts',checker),...args],{maxBuffer:1024*1024});
    assert.deepEqual(JSON.parse(stdout),proofs[key]);
  }
  const motion=proofs.destinationReload;
  const code="import importlib.util,json;from pathlib import Path;s=importlib.util.spec_from_file_location('v','scripts/check-native-joint-motion.py');v=importlib.util.module_from_spec(s);s.loader.exec_module(v);r=v.verify(Path('output/native-joint-reload-attempt-010.json').resolve());print(json.dumps({k:r[k] for k in ['qualified','fixture','freshScheduledWorldReloadQualified','originalAiExecutionQualified','observedTicks','originalContextActions']}))";
  const {stdout}=await run('python3',['-c',code],{cwd:root,maxBuffer:32768});const fresh=JSON.parse(stdout);
  for(const [key,value] of Object.entries(fresh))assert.deepEqual(value,motion[key]);
  assert.equal(proofs.source.originalBrashnardSourceDeparturePerformed,true);
  assert.equal(proofs.sourceReload.input.sha256,proofs.source.after.sha256);
  assert.equal(proofs.destinationReload.fixture.inputHashes['Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'],proofs.destination.after.sha256);
  for(const m of [proofs.source.sourceManifest,motion.fixture]){
    assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
    try{process.kill(m.nativePid,0);throw Error('Native fixture still live; stop publication work');}catch(e){if(e.code!=='ESRCH')throw e;}
  }
  const contentDigest=sha(Buffer.from(['654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542',
    proofs.source.sourceManifest.nativeSourceSha256['upstream/majesty-recomp/game.toml'],proofs.source.sourceManifest.inputHashes['mod-settings.json']].join('\n')));
  assert.equal(proofs.source.sourceManifest.nativeSourceSha256['upstream/majesty-recomp/game.toml'],motion.fixture.nativeSourceSha256['upstream/majesty-recomp/game.toml']);
  assert.equal(proofs.source.sourceManifest.inputHashes['mod-settings.json'],motion.fixture.inputHashes['mod-settings.json']);
  const before=[proofs.source.before,proofs.destinationBefore.before],after=[proofs.source.after,proofs.destination.after];
  const src=await fileSource(before[0].filename),{unit}=await checkpointActorRecords(src,2101);
  const ledger={version:1,entityId:randomBytes(32).toString('hex'),contentDigest,regions:['0_0','1_0'],
    actor:{family:unit.family,description:unit.description,playerNumber:unit.playerNumber},aliases:[{unitId:2101,agentId:37},{unitId:510,agentId:79}],
    referenceBindings:[{source:{unitId:2073,agentId:12},destination:{unitId:497,agentId:2}}],
    before:before.map(p=>({size:p.bytes,sha256:p.sha256})),after:after.map(p=>({size:p.bytes,sha256:p.sha256}))};
  const owned=await mkdtemp(join(root,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-pair-'));
  const config={ledger,files:{before:before.map(p=>p.filename),after:after.map(p=>p.filename)}};
  const configName=join(owned,'Owned_Pair_Inputs.json');await writeFile(configName,JSON.stringify(config)+'\n',{flag:'wx'});
  const cases=[];
  for(const point of ['after-source','before-publish','after-publish']){
    const directory=join(owned,point);await mkdir(directory);const store=new EntityPairStore(io(directory),ledger,contentDigest);
    const initial=await store.initialize(await request(config,'before'));
    try{await run(process.execPath,[script,'--owned-child',configName,directory,point],{maxBuffer:4096});throw Error('Missing interrupted worker exit');}
    catch(e){if(e.code!==77)throw e;}
    const reopened=await openEntityPairStore(io(directory),contentDigest),selected=await reopened.read(),published=point==='after-publish';
    assert.equal(selected.record.moved,published);assert.equal(selected.owner.unitId,published?510:2101);
    assert.deepEqual(selected.record.worlds,published?ledger.after:ledger.before);
    const recovered=await reopened.publish(await request(config,'after',initial.manifest));assert.equal(recovered.idempotent,published);
    const retry=await reopened.publish(await request(config,'after',initial.manifest));assert.equal(retry.idempotent,true);
    const final=await(await openEntityPairStore(io(directory),contentDigest)).read();assert.equal(final.owner.unitId,510);
    const files=await readdir(directory);assert.equal(files.filter(n=>n.endsWith('.GMP')).length,4);assert.equal(files.filter(n=>n.includes('.tmp-')).length,0);
    cases.push({point,workerExit:77,selectedOwnerAfterInterruption:selected.owner,recoveryIdempotent:recovered.idempotent,
      retryIdempotent:true,finalOwner:final.owner,selectedManifest:final.record.manifest,retainedWorldSlots:4});
  }
  const corruptDirectory=join(owned,'damaged-ledger');await mkdir(corruptDirectory);
  const corruptStore=new EntityPairStore(io(corruptDirectory),ledger,contentDigest);await corruptStore.initialize(await request(config,'before'));
  const damaged=Buffer.from(encodeEntityLedger(ledger));damaged[20]^=1;await writeFile(join(corruptDirectory,ENTITY_LEDGER_FILE),damaged);
  await assert.rejects(corruptStore.read(),/Damaged entity ledger/);
  const result={qualified:true,scope:'Stopped file-backed publication of one verified original NPC transfer with immutable ID/reference mapping and supervised child-process interruption recovery. Engine loading selected paired files, browser OPFS recovery, repeated gameplay crossings and general references remain unqualified.',
    fixture:owned,ledger,ledgerBytes:encodeEntityLedger(ledger).length,ledgerSha256:sha(encodeEntityLedger(ledger)),cases,
    sourceAndDestinationSnapshotsQualified:true,selectedCompletePairAndSingleEntityOwnerQualified:true,
    fileBackedPairedOwnershipPublicationQualified:true,supervisedProcessInterruptionRecoveryQualified:true,
    immutableEntityAndReferenceBindingQualified:true,damagedLedgerRejected:true,idempotentRetriesQualified:true,
    largestRead,largestWrite,peakReads,wholeGmpBuffered:false,retainedWorldSlotsPerPair:4,
    browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,
    browserPairedPublicationRecoveryQualified:false,selectedPairNativeReloadQualified:false,
    repeatedGameplayCrossingsQualified:false,wholeBrowserMemoryBoundQualified:false,completeReferenceClosureQualified:false,
    evidenceSha256:evidence,sourceSha256:{}};
  for(const name of ['web/world/entity-pair.mjs','web/world/transfer-store.mjs','scripts/qualify-native-entity-pair.mjs'])result.sourceSha256[name]=sha(await readFile(join(root,name)));
  assert.ok(largestRead<=4096&&largestWrite<=4096&&peakReads===1);
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,processInterruptionCases:3,ledgerBytes:result.ledgerBytes,largestRead,largestWrite,peakReads,nativeProcessesStarted:0}));
}
