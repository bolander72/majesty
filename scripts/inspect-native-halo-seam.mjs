#!/usr/bin/env node
// Compare original saved overlap heights. Collision/actor ownership are later gates.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectNativeHaloRegion} from './inspect-native-halo-region.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
import {planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
const [firstName,secondName,output]=process.argv.slice(2);assert.equal(process.argv.length,5);
const proofs=[];
for(const name of [firstName,secondName]) {
  const proof=JSON.parse(await readFile(name,'utf8'));
  assert.deepEqual(await inspectNativeHaloRegion(proof.manifest),proof);
  proofs.push(proof);
}
const [a,b]=proofs;
const dx=(b.layout.core.originX-a.layout.core.originX)/3968,
  dy=(b.layout.core.originY-a.layout.core.originY)/3968;
assert.ok(Number.isInteger(dx)&&Number.isInteger(dy)&&Math.abs(dx)+Math.abs(dy)===1);
const terrains=await Promise.all(proofs.map(async p=>checkpointTerrain(await stoppedFileSource(p.checkpoint.filename))));
let checkedVertices=0,maximumReadBytes=0;
for(let row=0;row<(dx?129:5);++row){
  const yA=dx?row:(dy>0?124+row:row),yB=dx?row:(dy>0?row:124+row),
    xA=dx?(dx>0?124:0):0,xB=dx?(dx>0?0:124):0,count=dx?5:129;
  const data=[];
  for(let i=0;i<2;++i){
    const source=await stoppedFileSource(proofs[i].checkpoint.filename);
    const bytes=await source.readAt(terrains[i].heightOffset(i?xB:xA,i?yB:yA),count*9);
    assert.equal(bytes.length,count*9);maximumReadBytes=Math.max(maximumReadBytes,bytes.length);
    data.push(new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength));
  }
  for(let col=0;col<count;++col){
    assert.equal(data[0].getInt32(col*9,true),data[1].getInt32(col*9,true),`Overlap row=${row} col=${col}`);
    ++checkedVertices;
  }
}
assert.equal(checkedVertices,645);assert.ok(maximumReadBytes<=1161);
// Exercise the pinned native interpolation on both sides of the ownership
// boundary, including fractional positions. These are saved-terrain samples,
// not an assertion that an original actor accepted any of these movements.
let groundSamples=0;
const Q=2048,axis=dx?'x':'y',negative=dx<0||dy<0,boundary=(negative?64:4032)*Q;
for(const along of [160,731,2048,3100,3800])for(const distance of [1,27,813,2048,4095]){
  const previous={x:along*Q+27,y:along*Q+813,z:0};previous[axis]=boundary+(negative?1:-1);
  const accepted={...previous};accepted[axis]=boundary+(negative?-distance:distance);
  const handoff=planHaloActorHandoff(previous,accepted,a.region);assert.equal(handoff.destinationRegion,b.region);
  const from=await sampleNativeGroundHeight(terrains[0],handoff.sourcePose),
    to=await sampleNativeGroundHeight(terrains[1],handoff.destinationPose);
  assert.equal(from,to,`Ground interpolation along=${along} distance=${distance}`);++groundSamples;
}
assert.equal(groundSamples,25);
for(const p of proofs)assert.equal((await hashNativeFile(p.checkpoint.filename)).sha256,p.checkpoint.sha256);
const result={version:1,nativeSharedHaloHeightsQualified:true,
  proofs:await Promise.all([firstName,secondName].map(async n=>({filename:resolve(n),sha256:(await hashNativeFile(n)).sha256}))),
  regions:proofs.map(p=>p.region),direction:dx?(dx>0?'east':'west'):(dy>0?'south':'north'),
  layout:'halo-v1',checkedVertices,overlapTerrainCells:4,maximumReadBytes,groundSamples,
  savedGroundInterpolationMatches:true,
  opaqueVertexFieldsQualified:false,navigationQualified:false,nativeActorCrossingQualified:false,
  ownershipTransferQualified:false,nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSharedHaloHeightsQualified:true,regions:result.regions,checkedVertices,maximumReadBytes}));
