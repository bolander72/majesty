#!/usr/bin/env node
// Compare complete original writer records and expiry at both clock bases.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
const [baselineName,rebasedName,out]=process.argv.slice(2);assert.equal(process.argv.length,5);
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const reports=[];
for(const [phase,name]of [['baseline',baselineName],['rebased',rebasedName]]){
  const m=await json(name);assert.equal(m.phase,phase);assert.equal(m.nativeOnly,true);assert.equal(m.browserUsed,false);
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.waitClockTrialCompleted,true);
  try{process.kill(m.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-wait-effect-clock-');
  assert.equal(m.worldRoot,join(fixture,'native-world-wait-clock'));assert.equal(m.profile,join(m.worldRoot,'frontier_0_0'));
  assert.equal(await hash(m.buildReport),m.buildReportSha256);const build=await json(m.buildReport);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);
  for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256']){
    assert.deepEqual(m[group],build[group]);for(const [n,h]of Object.entries(m[group]))assert.equal(await hash(join(workspace,n)),h);
  }
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  assert.equal(await hash(m.preparation),m.preparationSha256);const prep=await json(m.preparation);
  assert.equal(prep.waitEffectClockPreparationQualified,true);assert.equal(await hash(prep.sourceProof),prep.sourceProofSha256);
  for(const [n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(join(workspace,n)),h);
  assert.equal(await hash(m.source),m.sourceSha256);assert.equal(m.sourceSha256,prep.source.sha256);
  assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP'));
  assert.equal(await hash(m.sourceCopy),m.sourceSha256);assert.equal(await hash(m.log),m.logSha256);
  for(const field of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged','proposalsUnchanged'])assert.equal(m[field],true);
  for(const [n,h]of Object.entries(m.inputHashes))assert.equal(await hash(join(m.settingsProfile,n)),h);
  assert.equal(m.script,join(fixture,'wait-effects.script'));assert.equal(await hash(m.script),m.scriptSha256);
  assert.equal(await readFile(m.script,'utf8'),'wait 12000\ndump wait_effect_clock_completed\n');
  const log=await readFile(m.log,'utf8');assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
  assert.ok(!/abort from|result=fail|SIGSEGV|exception e06d7363/.test(log));
  const source=await stoppedFileSource(m.source),units=new Map();for await(const u of checkpointUnitAgentLinks(source))if([528,529].includes(u.unitId))units.set(u.unitId,u);
  assert.equal(m.records.length,142);const records=new Map();
  for(const r of m.records){assert.equal(r.filename,join(m.profile,r.filename.split('/').at(-1)));assert.ok(r.bytes<=208);assert.equal(await hash(r.filename),r.sha256);records.set(r.filename,r);}
  const effects=[];
  for(const e of prep.effects){
    const base=phase==='baseline'?57650:24250,expectedAdvance=e.interval-300,steps=expectedAdvance/50+1;
    const prefix=`[streaming] Wait clock begin phase=${phase} unit=${e.unitId} parent=504 source=57650 destination=24250 actual=57650 interval=${e.interval} age=300 serialized-equal=1`;
    assert.equal(log.split('\n').filter(r=>r===prefix).length,1);
    const rows=log.split('\n').filter(r=>r.startsWith(`[streaming] Wait clock step unit=${e.unitId} `));assert.equal(rows.length,steps);
    const rawUnit=Buffer.from(await source.readAt(units.get(e.unitId).offset,151));
    const payload=Buffer.from(await readFile(e.orderPayload.filename));assert.equal(await hash(e.orderPayload.filename),e.orderPayload.sha256);
    assert.equal(payload.length,128);if(phase==='rebased')payload.writeUInt32LE(23950,44);
    for(let index=0;index<steps;++index){
      // Original completion marks deletion and adds the no-block flag. The
      // living ARG effects do not already carry it, unlike Newrecruit.
      const ended=index===steps-1,flags=ended?2596:544;
      assert.equal(rows[index],`[streaming] Wait clock step unit=${e.unitId} index=${index} advance=${index*50} clock=${base+index*50} active=${ended?0:1} flags=${flags} clock-restored=1`);
      const n=String(index).padStart(3,'0'),unitName=join(m.profile,`Wait_${e.unitId}_${n}_Unit.UNIT`),orderName=join(m.profile,`Wait_${e.unitId}_${n}_Orders.bin`);
      assert.ok(records.has(unitName)&&records.has(orderName));
      const expected=Buffer.from(rawUnit);if(ended)expected.writeUInt32LE(2596,40);
      assert.deepEqual(await readFile(unitName),expected,'Original timed-effect UNIT differs');
      const empty=Buffer.alloc(24);for(let i=0;i<3;++i)empty.writeUInt32LE(1,i*8);
      assert.deepEqual(await readFile(orderName),ended?empty:payload,'Original timed-effect banks differ');
    }
    assert.ok(log.includes(`[streaming] Wait clock complete phase=${phase} unit=${e.unitId} steps=${steps} original-dispatch=1 deleted=1 clock-restored=1 hooks-unchanged=1 hero-transfer=0 result=pass`));
    effects.push({unitId:e.unitId,interval:e.interval,elapsed:300,remainingMs:expectedAdvance,steps,completeOriginalRecordsCompared:true});
  }
  assert.ok(m.resourceSamples.length);assert.ok(m.resourceSamples.every(r=>r.pid===m.nativePid&&r.rssBytes<=m.rssCeilingBytes));
  reports.push({phase,manifest:resolve(name),manifestSha256:await hash(name),nativePid:m.nativePid,effects,
    logSha256:m.logSha256,maximumSampledRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),nativeExecutableSha256:m.nativeExecutableSha256});
}
assert.notEqual(reports[0].nativePid,reports[1].nativePid);assert.deepEqual(reports[0].effects,reports[1].effects);
assert.equal(reports[0].nativeExecutableSha256,reports[1].nativeExecutableSha256);
await writeFile(out,JSON.stringify({version:1,originalWaitEffectProjectedLifetimeQualified:true,reports,
  sourceSha256:{'scripts/inspect-native-wait-effect-clock.mjs':await hash(new URL(import.meta.url).pathname)},
  scope:'Actual ARG1/ARG3 Wait effects preserve their complete original UNIT/bank records and expire after700/2700ms at source57650 and projected24250 clocks. No destination import, arbitrary effect classes, actor relocation, command path migration, owner publication or browser activation.',
  destinationImportQualified:false,heroTransferred:false,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalWaitEffectProjectedLifetimeQualified:true,effects:2,phases:2}));
