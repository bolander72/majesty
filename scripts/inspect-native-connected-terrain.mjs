#!/usr/bin/env node
// Inspect stopped original-engine generated saves. No publication or mutation.
import {open,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointTerrain,TERRAIN_WINDOW_SIDE,VERTEX_BYTES} from '../web/world/terrain.mjs';
import {connectedHeightQ16,CONNECTED_TERRAIN_VERSION} from '../web/world/connected-height.mjs';
import {nativeHeightBits} from '../web/world/native-height.mjs';

const reports=process.argv.slice(2);
if(!reports.length)throw new Error('Supply one or more terminal native attempt JSON files');
const cases=[];
for(const filename of reports){
  const attempt=JSON.parse(await readFile(filename,'utf8'));
  if(attempt.nativeSessionTerminal!==true||attempt.nativeExitCode!==0||attempt.stopReason||
      attempt.connectedTerrainVersion!==CONNECTED_TERRAIN_VERSION||attempt.originalSettingsUnchanged!==true||
      attempt.saves.length!==1)throw new Error('Require a successful stopped run and one original save');
  const [rx,ry]=attempt.region.split('_').map(Number);
  if(![rx,ry].every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=1000000)||attempt.region!==`${rx}_${ry}`)
    throw new Error('Invalid generated region');
  const log=await readFile(attempt.log,'utf8');
  if(!log.includes(`[frontier] Region ${attempt.region} connected terrain v1 generation preserved=1`)||
     !log.includes(`[frontier] Region ${attempt.region} connected terrain v1 installed before players vertices=16641 empty-grid-cells=65536`))
    throw new Error('Original generation did not confirm pre-placement installation and preserved borders');
  const save=attempt.saves[0],handle=await open(save.filename,'r');
  try{
    const before=await handle.stat();let largestRead=0;
    if(before.size!==save.bytes)throw new Error('Generated save size changed');
    const source={size:before.size,async readAt(at,n){
      if(n>4096)throw new Error('Generated terrain read bound exceeded');largestRead=Math.max(largestRead,n);
      const bytes=new Uint8Array(n),{bytesRead}=await handle.read(bytes,0,n,at);
      if(bytesRead!==n)throw new Error('Truncated generated terrain');return bytes;
    }};
    async function digest(){const hash=createHash('sha256');for(let at=0;at<source.size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,source.size-at)));return hash.digest('hex');}
    if(await digest()!==save.sha256)throw new Error('Generated save digest changed');
    const terrain=await checkpointTerrain(source);
    if(terrain.width!==128||terrain.height!==128)throw new Error('Unsupported connected layout');
    let inspected=0,differing=0,borderDiffering=0;const edgeHashes={};
    for(let y=0;y<128;y+=TERRAIN_WINDOW_SIDE)for(let x=0;x<128;x+=TERRAIN_WINDOW_SIDE){
      const window=await terrain.window(x,y,32,32),view=new DataView(window.vertices.buffer);
      const rows=y===96?33:32,columns=x===96?33:32;
      for(let j=0;j<rows;++j)for(let i=0;i<columns;++i){
        ++inspected;
        if(view.getUint32((j*33+i)*VERTEX_BYTES,true)!==nativeHeightBits(connectedHeightQ16(rx*128+x+i,ry*128+y+j))){
          ++differing;if(x+i===0||x+i===128||y+j===0||y+j===128)++borderDiffering;
        }
      }
    }
    for(const side of ['left','right','top','bottom']){
      const hash=createHash('sha256');
      for(let at=0;at<=128;at+=33){const count=Math.min(33,129-at),edge=await terrain.edge(side,at,count);
        for(let i=0;i<count;++i)hash.update(edge.subarray(i*VERTEX_BYTES,i*VERTEX_BYTES+4));
      }
      edgeHashes[side]=hash.digest('hex');
    }
    const after=await handle.stat();
    if(await digest()!==save.sha256||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)
      throw new Error('Generated save changed during comparison');
    if(inspected!==16641||borderDiffering)throw new Error('Generated shared boundary does not match its world recipe');
    cases.push({attemptReport:filename,region:attempt.region,savedFile:save.filename,savedSha256:save.sha256,
      nativeExecutableSha256:attempt.nativeExecutableSha256,inspectedVertices:inspected,interiorHeightDifferences:differing,
      borderHeightDifferences:borderDiffering,edgeHashes,largestRead,sourceUnchanged:true});
  }finally{await handle.close();}
}
const seams=[];
for(let i=0;i<cases.length;++i)for(let j=i+1;j<cases.length;++j){
  const a=cases[i],b=cases[j],[ax,ay]=a.region.split('_').map(Number),[bx,by]=b.region.split('_').map(Number);
  let first,second;
  if(ay===by&&Math.abs(ax-bx)===1){first=ax<bx?'right':'left';second=ax<bx?'left':'right';}
  if(ax===bx&&Math.abs(ay-by)===1){first=ay<by?'bottom':'top';second=ay<by?'top':'bottom';}
  if(first){
    if(a.edgeHashes[first]!==b.edgeHashes[second])throw new Error('Independently generated saved borders disagree');
    seams.push({firstRegion:a.region,secondRegion:b.region,vertices:129,matchingHeightBits:true});
  }
}
console.log(JSON.stringify({cases,seams,originalGeneratedBordersQualified:true,browserUsed:false,
  limitations:'Stopped original native generated saves. No lighting halo continuity, hero crossing, repeated world disposal, native/browser memory bound, co-op publication or WAN qualification.'},null,2));
