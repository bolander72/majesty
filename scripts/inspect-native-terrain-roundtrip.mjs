#!/usr/bin/env node
// Inspect a stopped, isolated original-engine load/save attempt. Read only.
import {open,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointTerrain,TERRAIN_WINDOW_SIDE,VERTEX_BYTES,CELL_BYTES,MAX_TERRAIN_WINDOW_BYTES} from '../web/world/terrain.mjs';
import {CHECKPOINT_PAGE_BYTES} from '../web/world/checkpoint.mjs';

const reportFile=process.argv[2];
if(!reportFile)throw new Error('Usage: node scripts/inspect-native-terrain-roundtrip.mjs <terminal attempt JSON>');
const attempt=JSON.parse(await readFile(reportFile,'utf8'));
if(attempt.nativeSessionTerminal!==true||attempt.nativeExitCode!==0||attempt.stopReason||
   attempt.browserUsed!==false||attempt.originalDraftUnchanged!==true)
  throw new Error('Require a successful stopped native attempt and unchanged draft');
const candidates=attempt.saves.filter(save=>save.sha256!==attempt.inputDraftSha256);
if(candidates.length!==1)throw new Error('Require exactly one new original-engine save');
const saved=candidates[0],handles=[];
let largestRead=0,largestWindow=0;
async function source(filename,expectedHash,expectedSize){
  const handle=await open(filename,'r');handles.push(handle);
  const before=await handle.stat();
  if(before.size!==expectedSize)throw new Error('Snapshot size changed');
  const reader={size:before.size,async readAt(offset,length){
    if(length>CHECKPOINT_PAGE_BYTES)throw new Error('Read bound exceeded');
    largestRead=Math.max(largestRead,length);
    const bytes=new Uint8Array(length),{bytesRead}=await handle.read(bytes,0,length,offset);
    if(bytesRead!==length)throw new Error('Truncated snapshot');
    return bytes;
  }};
  async function unchanged(){
    const hash=createHash('sha256');
    for(let offset=0;offset<reader.size;offset+=CHECKPOINT_PAGE_BYTES)
      hash.update(await reader.readAt(offset,Math.min(CHECKPOINT_PAGE_BYTES,reader.size-offset)));
    const after=await handle.stat();
    if(hash.digest('hex')!==expectedHash||before.size!==after.size||
       before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)
      throw new Error('Snapshot identity changed');
  }
  await unchanged();
  return {terrain:await checkpointTerrain(reader),unchanged};
}
try{
  const input=await source(attempt.inputDraft,attempt.inputDraftSha256,attempt.inputDraftBytes);
  const output=await source(saved.filename,saved.sha256,saved.bytes);
  const a=input.terrain,b=output.terrain;
  if(a.width!==b.width||a.height!==b.height)throw new Error('Map dimensions changed');
  let vertices=0,cells=0,heightBitsChanged=0,shadingChanged=0,opaqueWordsChanged=0,cellRecordsChanged=0;
  const borders={left:0,right:0,top:0,bottom:0};
  for(let y=0;y<a.height;y+=TERRAIN_WINDOW_SIDE)for(let x=0;x<a.width;x+=TERRAIN_WINDOW_SIDE){
    const width=Math.min(TERRAIN_WINDOW_SIDE,a.width-x),height=Math.min(TERRAIN_WINDOW_SIDE,a.height-y);
    const aw=await a.window(x,y,width,height),bw=await b.window(x,y,width,height);
    largestWindow=Math.max(largestWindow,aw.vertices.length+aw.cells.length,bw.vertices.length+bw.cells.length);
    const av=new DataView(aw.vertices.buffer),bv=new DataView(bw.vertices.buffer);
    // Shared rows/columns are counted only by the following window.
    const columns=width+(x+width===a.width?1:0),rows=height+(y+height===a.height?1:0);
    for(let row=0;row<rows;++row)for(let col=0;col<columns;++col){
      const at=(row*(width+1)+col)*VERTEX_BYTES;
      const changed=av.getUint32(at,true)!==bv.getUint32(at,true);
      ++vertices;if(changed)++heightBitsChanged;
      if(aw.vertices[at+4]!==bw.vertices[at+4])++shadingChanged;
      if(av.getUint32(at+5,true)!==bv.getUint32(at+5,true))++opaqueWordsChanged;
      if(changed){
        if(x+col===0)++borders.left;if(x+col===a.width)++borders.right;
        if(y+row===0)++borders.top;if(y+row===a.height)++borders.bottom;
      }
    }
    for(let at=0;at<aw.cells.length;at+=CELL_BYTES){
      ++cells;
      if(aw.cells.subarray(at,at+CELL_BYTES).some((byte,index)=>byte!==bw.cells[at+index]))++cellRecordsChanged;
    }
  }
  await input.unchanged();await output.unchanged();
  if(vertices!==(a.width+1)*(a.height+1)||cells!==a.width*a.height||largestWindow>MAX_TERRAIN_WINDOW_BYTES)
    throw new Error('Incomplete or unbounded terrain comparison');
  console.log(JSON.stringify({attemptReport:reportFile,inputDraftSha256:attempt.inputDraftSha256,
    savedFile:saved.filename,savedSha256:saved.sha256,nativeExecutableSha256:attempt.nativeExecutableSha256,
    width:a.width,height:a.height,vertices,cells,heightBitsChanged,borderHeightBitsChanged:borders,
    shadingChanged,opaqueWordsChanged,cellRecordsChanged,largestRead,largestWindow,snapshotsUnchanged:true,
    originalEngineTerrainRoundtrip:heightBitsChanged===0&&opaqueWordsChanged===0&&cellRecordsChanged===0,
    limitations:'One stopped native load/save. No navigation, border actor placement, seam lighting continuity, streaming, co-op publication or browser memory qualification.'},null,2));
}finally{for(const handle of handles)await handle.close();}
