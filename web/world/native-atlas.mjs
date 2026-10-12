// Read-only saved-map projection. It never starts or modifies a native kingdom.
import {NativeRealmStore,realmFiles,parseRealmManifest,MAX_REALM_READS} from './realm-store.mjs';
import {opfsNativeRealmStorage} from './realm-profile.mjs';
import {realmTerrainProvider} from './realm-terrain.mjs';
import {NativeTerrainScene,nativeVisibleWindows} from './terrain-scene.mjs';
import {worldName} from './world-name.mjs';
import {TERRAIN_WINDOW_SIDE,VERTEX_BYTES} from './terrain.mjs';
import {ATLAS_MARKER_WORDS,ATLAS_POSITION_SCALE} from './atlas-units.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';

export const NATIVE_ATLAS_CELL=4,NATIVE_ATLAS_SPAN=128*NATIVE_ATLAS_CELL;

// Discover the displayed saves' identity under the same lease as all file
// validation and terrain reads. This is not an imported-assets compatibility
// check: only stopped saved bytes are displayed, never fed into the engine.
export function savedAtlasStore(io){
  if(!io||typeof io.open!=='function'||typeof io.withLock!=='function')throw new Error('Saved map storage unavailable');
  return {withRegions(keys,consume,{signal}={}){
    try{
      checkCheckpointReadSignal(signal);
      if(!Array.isArray(keys)||keys.length>MAX_REALM_READS||new Set(keys).size!==keys.length||typeof consume!=='function')
        throw new Error('Invalid saved map read set');
      keys=keys.slice();keys.forEach(realmFiles);
    }catch(error){return Promise.reject(error);}
    return io.withLock('shared',async()=>{
      checkCheckpointReadSignal(signal);
      let content;
      for(const key of keys){
        const marker=await io.open(realmFiles(key).marker);
        checkCheckpointReadSignal(signal);
        if(marker===null)continue;
        if(!Number.isSafeInteger(marker?.size)||marker.size<1||marker.size>511||typeof marker.readAt!=='function')
          throw new Error('Invalid saved map manifest size');
        const raw=await marker.readAt(0,marker.size);
        checkCheckpointReadSignal(signal);
        if(!(raw instanceof Uint8Array)||raw.length!==marker.size||raw.some(b=>b!==10&&(b<32||b>126)))
          throw new Error('Invalid saved map manifest encoding');
        const text=new TextDecoder().decode(raw);content=text.split('\n')[4];
        parseRealmManifest(text,content);break;
      }
      if(content===undefined){
        const empty=new Map(keys.map(key=>[key,null]));
        try{const result=await consume(empty);checkCheckpointReadSignal(signal);return result;}finally{empty.clear();}
      }
      const reader=new NativeRealmStore({open:name=>io.open(name),
        atomicWrite(){throw new Error('Saved map is read-only');},
        withLock(mode,fn){if(mode!=='shared')throw new Error('Saved map is read-only');return fn();}}, {content});
      return reader.withRegions(keys,consume,{signal});
    });
  }};
}

export async function openNativeAtlas(world,{storage=navigator.storage,locks=navigator.locks}={}){
  worldName(world);
  if(!storage||typeof storage.getDirectory!=='function')throw new Error('Saved map storage unavailable');
  const root=await storage.getDirectory(),game=await root.getDirectoryHandle('majesty');
  const profiles=await game.getDirectoryHandle('profile');
  return new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(opfsNativeRealmStorage(profiles,world,locks)),{includeUnits:true}));
}

// Pan the captured snapshot without rehashing entire saves for every pointer
// move. Loading another footprint, or selecting this view again, reads current
// checkpoints. A snapshot is not a live view of another running game.
export async function moveNativeAtlas(scene,x,y,width,height,{refresh=false}={}){
  const wanted=nativeVisibleWindows(x,y,width,height);
  if(!refresh&&scene.identity!==null&&wanted.every(([wx,wy])=>scene.active.has(`${wx},${wy}`)))return {x,y};
  return scene.move(x,y,width,height);
}

const colors=Array.from({length:32},(_,i)=>`hsl(${150-i*2} 22% ${21+i}%)`);
const ownerColors=['#f2d067','#91c4ff','#ff9393','#a3e3a0','#d6acff','#f1b57c','#88e3db','#f1b5dc'];
export function paintNativeAtlas(ctx,scene,camera,width,height){
  const left=camera.x-width/2,top=camera.y-height/2;
  let cells=0,windows=0;
  for(const [key,value]of scene.active){
    if(!value)continue;
    const [wx,wy]=key.split(',').map(Number),dx=wx*TERRAIN_WINDOW_SIDE*NATIVE_ATLAS_CELL-left,dy=wy*TERRAIN_WINDOW_SIDE*NATIVE_ATLAS_CELL-top;
    const span=TERRAIN_WINDOW_SIDE*NATIVE_ATLAS_CELL;
    if(dx+span<=0||dy+span<=0||dx>=width||dy>=height)continue;
    ++windows;
    const firstX=Math.max(0,Math.floor(-dx/NATIVE_ATLAS_CELL)),lastX=Math.min(TERRAIN_WINDOW_SIDE,Math.ceil((width-dx)/NATIVE_ATLAS_CELL));
    const firstY=Math.max(0,Math.floor(-dy/NATIVE_ATLAS_CELL)),lastY=Math.min(TERRAIN_WINDOW_SIDE,Math.ceil((height-dy)/NATIVE_ATLAS_CELL));
    const vertices=new DataView(value.vertices.buffer,value.vertices.byteOffset,value.vertices.byteLength);
    // Adjacent cells with the same altitude colour share one rectangle. Keep
    // the original visible cell geometry without per-window raster caches or
    // extra surfaces; flat saved terrain needs 32 draws instead of 1024.
    for(let y=firstY;y<lastY;++y){
      let start=firstX,color;
      for(let x=firstX;x<=lastX;++x){
        let next;
        if(x<lastX){
          const altitude=vertices.getFloat32((y*(TERRAIN_WINDOW_SIDE+1)+x)*VERTEX_BYTES,true);
          next=Number.isFinite(altitude)?colors[Math.max(0,Math.min(31,Math.floor(8+altitude/16)))]: '#925b87';
        }
        if(x>start&&next!==color){
          ctx.fillStyle=color;
          ctx.fillRect(dx+start*NATIVE_ATLAS_CELL,dy+y*NATIVE_ATLAS_CELL,
            (x-start)*NATIVE_ATLAS_CELL,NATIVE_ATLAS_CELL);
          start=x;
        }
        color=next;
      }
      cells+=lastX-firstX;
    }
    // Grid lines separate independent kingdoms; borders are not seamless yet.
    ctx.strokeStyle='#abc09a66';
    if(value.x===0){ctx.beginPath();ctx.moveTo(dx,dy);ctx.lineTo(dx,dy+span);ctx.stroke();}
    if(value.y===0){ctx.beginPath();ctx.moveTo(dx,dy);ctx.lineTo(dx+span,dy);ctx.stroke();}
    if(value.x===0&&value.y===0){ctx.fillStyle='#e3e7bf';ctx.font='12px system-ui';ctx.fillText(`Saved region ${value.realmKey.replace('_',', ')}`,dx+4,dy+16);}
  }
  // Paint markers after all terrain so neighboring windows cannot cover them.
  for(const [key,value]of scene.active){
    if(!value?.markers)continue;
    const [wx,wy]=key.split(',').map(Number),dx=wx*TERRAIN_WINDOW_SIDE*NATIVE_ATLAS_CELL-left,dy=wy*TERRAIN_WINDOW_SIDE*NATIVE_ATLAS_CELL-top;
    const span=TERRAIN_WINDOW_SIDE*NATIVE_ATLAS_CELL;
    if(dx+span<=0||dy+span<=0||dx>=width||dy>=height)continue;
    const markers=value.markers;
    for(let at=0;at<markers.length;at+=ATLAS_MARKER_WORDS){
      const x=dx+markers[at+3]/ATLAS_POSITION_SCALE*NATIVE_ATLAS_CELL;
      const y=dy+markers[at+4]/ATLAS_POSITION_SCALE*NATIVE_ATLAS_CELL;
      if(x<0||y<0||x>=width||y>=height)continue;
      ctx.fillStyle=ownerColors[markers[at+1]]??'#d3d3cc';
      const size=markers[at+2]===1?6:3;
      const mx=Math.max(0,x-size/2),my=Math.max(0,y-size/2);
      ctx.fillRect(mx,my,Math.min(width,x+size/2)-mx,Math.min(height,y+size/2)-my);
    }
  }
  return {cells,windows};
}
