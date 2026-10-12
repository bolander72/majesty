import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {NativeHeroSaveSession} from '../web/world/hero-save-session.mjs';
import {parseNativeHeroArrivalReady} from '../web/world/hero-travel-publication.mjs';
import {selectedHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';

const archiveName=process.env.MAJESTY_HERO_CONTROLS_ORIGINAL_ARCHIVE;
test('current travel controls admit the actual native340 first trip and subsequent crossing',
 {skip:!archiveName,timeout:30000},async()=>{
 const root=resolve('.'),out=resolve(process.env.MAJESTY_HERO_CONTROLS_ORIGINAL_REPORT);
 assert.equal(dirname(out),resolve('output'));assert.match(out,/hero-browser-travel-controls-original-\d{3}\.json$/);
 await assert.rejects(lstat(out),e=>e.code==='ENOENT');
 const json=async name=>{assert.ok((await lstat(name)).size<=1024*1024);return JSON.parse(await readFile(name,'utf8'));};
 const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
 async function evidence(name){const row=archive.evidence.find(r=>r.original===resolve(name));assert.ok(row,name);
  assert.equal((await hashNativeFile(row.preserved)).sha256,row.sha256);return json(row.preserved);}
 const archive=await json(archiveName);assert.equal(archive.nativeSourceRequestConsumptionQualified,true);
 const m=await evidence('output/native-hero-binding-attempt-052.json'),first=await evidence(m.publication.filename),
  outward=await evidence(first.firstOutwardInput.filename),startup=await evidence(m.startup.filename);
 assert.equal(m.nativeSessionTerminal,true);assert.equal(m.publicationWorkerTerminal,true);
 for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
 // The stopped producer's log is hash-bound by its frozen trial metadata.
 // This generation preserves that metadata rather than a second log copy.
 const logName=resolve(m.log);assert.equal(dirname(logName),resolve('output'));
 assert.equal(logName,resolve('output/native-hero-binding-attempt-052.log'));
 assert.equal((await hashNativeFile(logName)).sha256,m.logSha256);
 const lines=(await readFile(logName,'utf8')).split('\n');
 function line(prefix){const found=lines.filter(v=>v.startsWith(prefix));assert.equal(found.length,1,prefix);return found[0];}
 const bound=line('[frontier] Selected hero bound '),crossing=line('[frontier] Hero crossing serial=1 '),
  held=line('[frontier] Hero save held serial=1 '),consumed=line('[frontier] Hero departure request consumed serial=1 '),
  arrival=lines.find(v=>v.startsWith('[frontier] Hero travel publication held receipt='+first.ready+' ')),
  resumed=line('[frontier] Hero travel resumed serial=1 '),nextCrossing=line('[frontier] Hero crossing serial=2 '),
  nextHeld=line('[frontier] Hero save held serial=2 ');
 const request=outward.sourceRequest.staged,r=parseNativeHeroArrivalReady(first.ready),
  publication={...first.publicationReceipt,size:r.size,sha256:r.sha256};
 const entry={region:r.region,alias:publication.owner,homeAlias:publication.home,world:{sha256:r.sha256}};
 const runtimeBinding=selectedHeroRuntimeBinding(first.identity,entry,r.clock),
  receipt={...publication,runtimeBinding,haloBinding:`majesty-hero-halo-v1|${r.region}|${r.sha256}`};
 for(const early of [false,true]){
  const session=new NativeHeroSaveSession(m.runtimeBinding,{haloBinding:startup.receipt.haloBinding});
  assert.equal(session.message(bound).kind,'bound');assert.equal(session.message('[frontier] Region 0_0 ready').kind,'ready');
  assert.equal(session.message(crossing).serial,1);assert.equal(session.message(held).kind,'held');
  session.queueTravel(request);assert.equal(session.poll(request.nativeAction).kind,'travel-requested');
  assert.equal(session.message(consumed).kind,'travel-departed');assert.equal(session.message(arrival).kind,'travel-held');
  if(early){assert.equal(session.message(resumed),null);assert.equal(session.message(nextCrossing),null);assert.equal(session.message(nextHeld),null);}
  const ready=session.acceptTravelPublication(publication);
  if(early)assert.equal(ready.kind,'travel-resumed');else assert.equal(session.message(resumed).kind,'travel-resumed');
  const buffered=session.completeTravel(receipt);assert.deepEqual(buffered,early?[nextCrossing,nextHeld]:[]);
  assert.equal(session.message(nextCrossing).serial,2);assert.equal(session.message(nextHeld).boundary.clock,4350);
 }
 const sourceSha256={},pending=[resolve('tests/hero-save-session-original.test.mjs')];
 while(pending.length){const name=pending.pop(),key=relative(root,name);if(sourceSha256[key])continue;
  assert.ok(!key.startsWith('..')&&Object.keys(sourceSha256).length<128);sourceSha256[key]=(await hashNativeFile(name)).sha256;
  for(const match of (await readFile(name,'utf8')).matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))
   if(match[1].startsWith('.'))pending.push(resolve(dirname(name),match[1]));
 }
 await writeFile(out,JSON.stringify({version:1,originalNativeTravelSessionEventsQualified:true,archive:await descriptor(archiveName),
  nativeTrial:await descriptor('output/native-hero-binding-attempt-052.json'),serial:1,nextSerial:2,sourceUnitId:508,
  activatedUnitId:538,activatedAgentId:39,targetClock:4050,nextHeldClock:4350,earlyResumeAndNextCrossingQualified:true,
  sourceSha256,browserUsed:false,nativeProcessesStarted:0,nativeActionIssued:false,
  newPublisherNativeReceiptConsumptionQualified:false,liveBrowserTravelQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
});
