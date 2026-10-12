#!/usr/bin/env node
// Explain actual stopped cold-load differences without turning them into passes.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {verifyConnectedInitialization} from './check-native-connected-initialization.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {checkpointChunks,checkpointUnits} from '../web/world/checkpoint.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {connectedLoadTransformEvents,assertSelectionRecordChange} from './lib/connected-load-transforms.mjs';

async function readBounded(source,offset,length) {
  assert.ok(length<=65536);
  const bytes=Buffer.alloc(length);
  for(let at=0;at<length;at+=4096)bytes.set(await source.readAt(offset+at,Math.min(4096,length-at)),at);
  return bytes;
}
async function root(source,tag) {
  const found=[];
  for await(const part of checkpointChunks(source))if(part.tag===tag)found.push(part);
  assert.equal(found.length,1);return found[0];
}
async function unit(source,id) {
  const found=[];
  for await(const record of checkpointUnits(source))if(record.primary.words[1]===id)found.push(record);
  assert.equal(found.length,1);const record=found[0];assert.ok(record.size<=4096);
  return {record,bytes:await readBounded(source,record.offset,record.size)};
}

export async function inspectConnectedNeighborLoadTransforms(manifestName,auditName) {
  await promisify(execFile)(join(workspace,'upstream/majesty-recomp/.venv/bin/python'),
    [join(workspace,'scripts/audit-native-connected-load-transforms.py'),'--verify-report',resolve(auditName)],
    {cwd:workspace,maxBuffer:8192});
  const qualification=await verifyConnectedInitialization(manifestName);
  const manifest=JSON.parse(await readFile(manifestName,'utf8'));
  assert.equal(manifest.connectedLoadTransformObservation,'v2');
  const audit=JSON.parse(await readFile(auditName,'utf8'));
  assert.equal(audit.executableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  assert.equal(audit.primaryFieldsIgnored,false);assert.equal(audit.checkedInstructions.length,23);
  const visits=connectedLoadTransformEvents(await readFile(manifest.log,'utf8'),manifest.loadSequence.length);
  const explanations=[];
  for(let i=0;i<2;++i) {
    const source=await stoppedFileSource(join(manifest.profile,`Residency_Initial_${manifest.loadSequence[i]}.GMP`));
    const loaded=await stoppedFileSource(join(manifest.profile,`Residency_Visit_${i}_Before.GMP`));
    const selected=visits[i].filter(event=>event.kind===1),targets=visits[i].filter(event=>event.kind===3);
    const reveals=visits[i].filter(event=>event.kind===2),load=qualification.firstLoads[i];
    assert.equal(load.statePreserved,false);
    assert.equal(load.clockSame,true);assert.equal(load.scriptingRngSame,true);
    assert.equal(load.gameplayRngSame,true);assert.equal(load.queuesSame,true);
    assert.deepEqual(load.changedRecords.agents,[]);assert.deepEqual(load.changedRecords.attachments,[]);
    assert.deepEqual(selected.map(event=>String(event.id)).sort(),load.changedRecords.units.slice().sort());
    assert.equal(selected.length,1);assert.equal(targets.length,1);
    const event=selected[0],beforeUnit=await unit(source,event.id),afterUnit=await unit(loaded,event.id);
    assert.equal(beforeUnit.record.family,'BLDG');assert.equal(afterUnit.record.family,'BLDG');
    const primary=beforeUnit.record.components.find(part=>part.tag==='PRIM');assert.equal(primary.version,9);
    assertSelectionRecordChange(beforeUnit.bytes,afterUnit.bytes,primary.offset+16+8-beforeUnit.record.offset,event);
    const g0=await root(source,'GSGL'),g1=await root(loaded,'GSGL');
    assert.deepEqual([g0.version,g1.version,g0.count,g1.count],[6,6,0,0]);assert.equal(g0.size,g1.size);
    const globalBefore=await readBounded(source,g0.offset+16,g0.size),globalAfter=await readBounded(loaded,g1.offset+16,g1.size);
    const target=targets[0];assert.equal(globalBefore.readUInt32LE(20),target.id);
    assert.equal(globalBefore.readUInt32LE(24),target.before);assert.equal(globalAfter.readUInt32LE(24),target.after);
    globalBefore.writeUInt32LE(target.after,24);assert.deepEqual(globalBefore,globalAfter);
    const t0=await checkpointTerrain(source),t1=await checkpointTerrain(loaded);
    const m0=await root(source,'MTER'),m1=await root(loaded,'MTER');assert.equal(m0.size,m1.size);
    const vertices=t0.heightOffset(0,0)-m0.offset-16;
    assert.equal(vertices,t1.heightOffset(0,0)-m1.offset-16);
    const wordOffset=vertices+(126*129+28)*9+5;
    assert.equal(reveals.length,0);
    if(reveals.length) {
      const reveal=reveals[0],actor0=await unit(source,reveal.id),actor1=await unit(loaded,reveal.id);
      assert.equal(actor0.record.family,'BLDG');assert.equal(actor0.record.primary.words[5],0);
      assert.deepEqual(actor0.bytes,actor1.bytes);
      const opaque0=await readBounded(source,m0.offset+16+wordOffset,4),opaque1=await readBounded(loaded,m1.offset+16+wordOffset,4);
      assert.equal(opaque0.readUInt32LE(0),reveal.before);assert.equal(opaque1.readUInt32LE(0),reveal.after);
    }
    // Compare the complete terrain payload. Cache shading is already audited;
    // the only extra allowed difference here must be the observed reveal word.
    // This is a cause check, not a change to the persistence comparison policy.
    for(let at=0;at<m0.size;at+=4096) {
      const length=Math.min(4096,m0.size-at);
      const a=await readBounded(source,m0.offset+16+at,length),b=await readBounded(loaded,m1.offset+16+at,length);
      for(let j=0;j<length;++j) {
        const position=at+j;
        if(position>=vertices&&position<vertices+129*129*9&&(position-vertices)%9===4)a[j]=b[j];
        if(reveals.length&&position>=wordOffset&&position<wordOffset+4)a[j]=b[j];
      }
      assert.deepEqual(a,b,'Unexplained primary terrain difference');
    }
    assert.deepEqual(new Set(load.changedRootTags),new Set(['BLDG','GSGL','ORDR',...(reveals.length?['MTER']:[])]));
    explanations.push({visit:i,region:load.region,deselectedUnit:event.id,selection:event,
      previousMiniViewTarget:target,terrainReveals:reveals});
  }
  for(const visit of visits.slice(2))assert.deepEqual(visit,[],'Unexpected warm-load transformation');
  const sourceSha256={};for(const path of ['scripts/inspect-native-connected-neighbor-load-transforms.mjs','scripts/check-native-connected-initialization.mjs','scripts/lib/connected-load-transforms.mjs'])sourceSha256[path]=(await hashNativeFile(path)).sha256;
  return {version:1,sourceSha256,scope:'Original native deselection, previous mini-view target assignment and unchanged primary terrain explain the measured first-load byte changes. Saved fields remain primary differences in the persistence qualification.',
    loadTransformCausesQualified:true,explanations,firstGeneratedLoadsPreserved:false,
    generatedRegionInitializationQualified:qualification.generatedRegionsInitializedWithoutSimulation===true&&
      qualification.initializedRegionsReturnedWithoutStateChanges===true,
    fullGeneratedRegionHandoffQualified:false,bothGeneratedRegionsRevisited:qualification.bothGeneratedRegionsRevisited,
    originalWholeWorldTeardownQualified:qualification.originalWholeWorldTeardownQualified,
    sourceManifest:resolve(manifestName),sourceManifestSha256:(await hashNativeFile(manifestName)).sha256,
    instructionAudit:resolve(auditName),instructionAuditSha256:(await hashNativeFile(auditName)).sha256,
    evidenceSha256:qualification.evidenceSha256,primaryFieldsIgnored:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [manifest,audit,out]=process.argv.slice(2);if(process.argv.length!==5)throw Error('Usage: <stopped manifest> <pinned audit> <fresh report>');
  const report=await inspectConnectedNeighborLoadTransforms(manifest,audit);
  await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({loadTransformCausesQualified:report.loadTransformCausesQualified,firstGeneratedLoadsPreserved:false}));
}
