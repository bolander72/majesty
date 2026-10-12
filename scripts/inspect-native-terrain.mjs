#!/usr/bin/env node
// Read-only terrain qualification. Caller supplies an owned stopped snapshot.
import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointTerrain,TERRAIN_WINDOW_SIDE,MAX_TERRAIN_WINDOW_BYTES} from '../web/world/terrain.mjs';
import {CHECKPOINT_PAGE_BYTES} from '../web/world/checkpoint.mjs';

const filename=process.argv[2];
if(!filename)throw new Error('Usage: node scripts/inspect-native-terrain.mjs <owned stopped GMP>');
const handle=await open(filename,'r');
try {
 const before=await handle.stat();let readBytes=0,readRequests=0,largestRead=0;
 const source={size:before.size,async readAt(at,n){
  const bytes=new Uint8Array(n),{bytesRead}=await handle.read(bytes,0,n,at);
  readBytes+=bytesRead;++readRequests;largestRead=Math.max(largestRead,n);return bytes.subarray(0,bytesRead);
 }};
 const terrain=await checkpointTerrain(source),digest=createHash('sha256'),samples=[];
 let windows=0,largestWindow=0,cells=0;
 for(let y=0;y<terrain.height;y+=TERRAIN_WINDOW_SIDE)for(let x=0;x<terrain.width;x+=TERRAIN_WINDOW_SIDE){
  const width=Math.min(TERRAIN_WINDOW_SIDE,terrain.width-x),height=Math.min(TERRAIN_WINDOW_SIDE,terrain.height-y);
  const window=await terrain.window(x,y,width,height),bytes=window.vertices.length+window.cells.length;
  ++windows;cells+=width*height;largestWindow=Math.max(largestWindow,bytes);
  digest.update(JSON.stringify({x,y,width,height})+'\n');digest.update(window.vertices);digest.update(window.cells);
  if(samples.length<8)samples.push({x,y,width,height,bytes,
    vertexSha256:createHash('sha256').update(window.vertices).digest('hex'),
    cellSha256:createHash('sha256').update(window.cells).digest('hex')});
 }
 const fileHash=createHash('sha256');
 for(let at=0;at<source.size;at+=CHECKPOINT_PAGE_BYTES)
  fileHash.update(await source.readAt(at,Math.min(CHECKPOINT_PAGE_BYTES,source.size-at)));
 const after=await handle.stat();
 if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)
  throw new Error('Terrain snapshot changed during inspection');
 if(largestRead>CHECKPOINT_PAGE_BYTES||largestWindow>MAX_TERRAIN_WINDOW_BYTES||cells!==terrain.width*terrain.height)
  throw new Error('Terrain qualification bounds failed');
 console.log(JSON.stringify({width:terrain.width,height:terrain.height,windows,cells,largestWindow,
  largestRead,readBytes,readRequests,fileBytes:before.size,fileSha256:fileHash.digest('hex'),
  orderedWindowSha256:digest.digest('hex'),samples,
  limitations:'Read-only compact terrain bytes. No material/flag interpretation, native map replacement, navigation reconstruction or browser memory qualification.'},null,2));
} finally {await handle.close();}
