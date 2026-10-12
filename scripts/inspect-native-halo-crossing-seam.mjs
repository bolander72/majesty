#!/usr/bin/env node
// Compare actual source crossing terrain with a freshly generated neighbor.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectNativeHaloCrossing} from './inspect-native-halo-crossing.mjs';
import {inspectNativeHaloRegion} from './inspect-native-halo-region.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
import {planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
const [crossingName,regionName,output]=process.argv.slice(2);assert.equal(process.argv.length,5);
const crossing=JSON.parse(await readFile(crossingName,'utf8')),neighbor=JSON.parse(await readFile(regionName,'utf8'));
assert.deepEqual(await inspectNativeHaloCrossing(crossing.manifest),crossing);
assert.deepEqual(await inspectNativeHaloRegion(neighbor.manifest),neighbor);
const handoff=planHaloActorHandoff(crossing.hero.previousPose,crossing.hero.acceptedPose,'0_0');
assert.deepEqual(handoff,crossing.handoff);assert.equal(neighbor.region,handoff.destinationRegion);
const sources=await Promise.all([crossing.crossingCheckpoint,neighbor.checkpoint].map(row=>stoppedFileSource(row.filename))),terrains=await Promise.all(sources.map(checkpointTerrain));
const [dx,dy]=neighbor.region.split('_').map(Number);assert.equal(Math.abs(dx)+Math.abs(dy),1);
let vertices=0,maximumTerrainReadBytes=0;
for(let row=0;row<(dx?129:5);++row){
 const count=dx?5:129,yA=dx?row:(dy>0?124+row:row),yB=dx?row:(dy>0?row:124+row),xA=dx?(dx>0?124:0):0,xB=dx?(dx>0?0:124):0;
 const bytes=await Promise.all(terrains.map((t,i)=>sources[i].readAt(t.heightOffset(i?xB:xA,i?yB:yA),count*9)));
 const views=bytes.map(b=>new DataView(b.buffer,b.byteOffset,b.length));maximumTerrainReadBytes=Math.max(maximumTerrainReadBytes,count*9);
 for(let x=0;x<count;++x){assert.equal(views[0].getUint32(x*9,true),views[1].getUint32(x*9,true));++vertices;}
}
assert.equal(vertices,645);
const ground=await Promise.all(terrains.map((t,i)=>sampleNativeGroundHeight(t,i?handoff.destinationPose:handoff.sourcePose)));assert.equal(ground[0],ground[1]);
const result={version:1,nativeCrossingSavedGroundContinuityQualified:true,proofs:await Promise.all([crossingName,regionName].map(async n=>({filename:resolve(n),sha256:(await hashNativeFile(n)).sha256}))),
 layout:'halo-v1',sourceRegion:'0_0',destinationRegion:neighbor.region,sourceClockMs:crossing.clocks[2],destinationClockMs:neighbor.savedClockMs,checkedSharedVertices:vertices,sourcePose:handoff.sourcePose,destinationPose:handoff.destinationPose,globalFixed:handoff.globalFixed,sampledGroundQ16:ground[0],maximumTerrainReadBytes,
 inspectorSha256:(await hashNativeFile('scripts/inspect-native-halo-crossing-seam.mjs')).sha256,nativeProcessesStarted:0,destinationImportQualified:false,destinationCollisionQualified:false,sourceRetired:false,ownershipTransferQualified:false,browserUsed:false,goalComplete:false};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({nativeCrossingSavedGroundContinuityQualified:true,destinationRegion:neighbor.region,checkedSharedVertices:vertices,sampledGroundQ16:ground[0]}));
