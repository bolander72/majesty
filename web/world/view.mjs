import {BrowserRegionStore, RegionStream, REGION, SIDE, TILE, MAX_RESIDENT, MAX_PENDING} from './stream.mjs';
import {nativeRegionURL, selectedAtlasRegion} from './region.mjs';
import {paintGeneratedWorld} from './render.mjs';
import {CameraCheckpointWriter} from './camera-checkpoint.mjs';
import {initializeRegionBackups} from './region-backup-controls.mjs';
import {initializeRealmCatalog} from './realm-catalog-controls.mjs';
import {initializeHeroJourneys} from './hero-route-controls.mjs';
import {initializeJourney} from './journey-controls.mjs';
import {selectedWorld} from './world-name.mjs';
import {openNativeAtlas,moveNativeAtlas,paintNativeAtlas,NATIVE_ATLAS_CELL,NATIVE_ATLAS_SPAN} from './native-atlas.mjs';
const canvas = document.querySelector('#world'), ctx = canvas.getContext('2d');
const stats = document.querySelector('#stats'), notice = document.querySelector('#notice');
let stream, nativeScene, nativeMode=false, world, camera = {x:256,y:256}, busy = false, pending = null, placement = false, drag = null;
let cameraWriter, pointerTarget = null, pointerFrame = false, cameraWarning = '', flushCameraAfterMove = false;
let cssWidth = 1, cssHeight = 1, width = 1, height = 1;
let departed=false;
let catalogControls,backupControls,heroControls;
addEventListener('pagehide',()=>{
  departed=true;pending=null;pointerTarget=null;drag=null;
  catalogControls?.close().catch(()=>{});catalogControls=null;
  backupControls?.close().catch(()=>{});backupControls=null;
  heroControls?.close().catch(()=>{});heroControls=null;
  cameraWriter?.close().catch(()=>{});
  canvas.width=canvas.height=1;
  stream?.close().catch(()=>{});
  nativeScene?.close().catch(()=>{});
});
function size() {
  if(departed)return;
  cssWidth = innerWidth; cssHeight = innerHeight;
  const scale = Math.min(1, (nativeMode?NATIVE_ATLAS_SPAN:2048) / Math.max(cssWidth, cssHeight));
  width = cssWidth * scale; height = cssHeight * scale;
  const dpr = Math.min(devicePixelRatio || 1, 2, 4096 / Math.max(cssWidth, cssHeight));
  canvas.width = Math.round(cssWidth * dpr); canvas.height = Math.round(cssHeight * dpr);
}
let drawPending=false;
function draw(){
  if(departed||drawPending)return;
  drawPending=true;
  requestAnimationFrame(()=>{drawPending=false;if(!departed)paint();});
}
function paint() {
  ctx.setTransform(canvas.width / width,0,0,canvas.height / height,0,0);
  ctx.fillStyle = '#233732'; ctx.fillRect(0,0,width,height);
  if (!stream) return;
  if(nativeMode)paintNativeAtlas(ctx,nativeScene,camera,width,height);
  else paintGeneratedWorld(ctx,stream.active,camera,width,height);
  const rx=Math.floor(camera.x/REGION),ry=Math.floor(camera.y/REGION);
  stats.textContent=nativeMode
    ?`Region ${rx}, ${ry} · saved altitude map · ${nativeScene.active.size}/49 active windows · ${nativeScene.activeBytes.toLocaleString()} active map bytes · peak ${nativeScene.residentHighWater}/98 resident windows including handoff · ${nativeScene.pendingOperations}/1 queued destinations · ${nativeScene.windowReads} window reads · one canvas`
    :`Region ${rx}, ${ry} · ${stream.active.size}/49 active regions · ${stream.terrainBytes.toLocaleString()} active terrain bytes · peak ${stream.residentHighWater}/${MAX_RESIDENT} resident regions including handoff · ${stream.pendingOperations}/${MAX_PENDING} queued actions · ${stream.store.readTransactions} storage read transactions · one canvas`;
  document.querySelector('#x').value=rx;document.querySelector('#y').value=ry;
  document.querySelector('#native').href=nativeRegionURL(rx,ry,location.href);
}
// Coalesce pointer moves into one latest destination, with at most one handoff in flight.
async function move(x,y,{refresh=false}={}) {
  if(departed)return false;
  pending={x,y,refresh}; if(busy || !stream)return false;busy=true;
  try {
    while(pending&&!departed) {
      const target=pending;pending=null;
      if(nativeMode){
        const next=await moveNativeAtlas(nativeScene,target.x/NATIVE_ATLAS_CELL,target.y/NATIVE_ATLAS_CELL,width/NATIVE_ATLAS_CELL,height/NATIVE_ATLAS_CELL,{refresh:target.refresh});
        if(departed)return false;
        camera={x:next.x*NATIVE_ATLAS_CELL,y:next.y*NATIVE_ATLAS_CELL};draw();
      }else{
        const next=await stream.move(target.x,target.y,width,height);
        if(departed){stream.active.clear();return false;}
        camera=next;draw();
      }
      cameraWriter.schedule(camera);
      notice.textContent=cameraWarning;
    }
    return !departed;
  } catch(e) {pending=null;if(!departed)notice.textContent=`Travel stopped: ${e.message}. Saved regions are preserved.`;return false;}
  finally {busy=false;if(flushCameraAfterMove){flushCameraAfterMove=false;cameraWriter?.flush().catch(()=>{});}}
}
function travel(dx,dy){move(camera.x+dx*REGION,camera.y+dy*REGION);}
for(const [id,dx,dy] of [['west',-1,0],['east',1,0],['north',0,-1],['south',0,1]])document.querySelector(`#${id}`).onclick=()=>travel(dx,dy);
document.querySelector('#home').onclick=()=>move(256,256);
// Replace the current page so visited WASM worlds are not retained in history.
document.querySelector('#native').onclick=async e=>{
  e.preventDefault();
  if(departed||!e.currentTarget.hasAttribute('href')||busy)return;
  const destination=e.currentTarget.href;
  try{await cameraWriter?.flush();}catch{/* View metadata does not invalidate kingdom saves. */}
  if(departed)return;
  location.replace(destination);
};
document.querySelector('#travel').onsubmit=e=>{e.preventDefault();move(Number(document.querySelector('#x').value)*REGION+256,Number(document.querySelector('#y').value)*REGION+256);};
document.querySelector('#build').onclick=()=>{if(departed)return;placement=!placement;notice.textContent=placement?'Click dry land to place a watchtower.':'Exploration resumed.';canvas.style.cursor=placement?'crosshair':'grab';};
document.querySelector('#terrain').onclick=async()=>{
  if(departed||busy||!stream||!world)return;
  busy=true;drag=null;pointerTarget=null;
  try{
    const nextMode=!nativeMode,span=nextMode?NATIVE_ATLAS_SPAN:2048;
    const scale=Math.min(1,span/Math.max(cssWidth,cssHeight)),nextWidth=cssWidth*scale,nextHeight=cssHeight*scale;
    if(nextMode){
      nativeScene??=await openNativeAtlas(world);
      if(departed){await nativeScene.close();return;}
      await nativeScene.move(camera.x/NATIVE_ATLAS_CELL,camera.y/NATIVE_ATLAS_CELL,nextWidth/NATIVE_ATLAS_CELL,nextHeight/NATIVE_ATLAS_CELL);
    }else{
      await stream.move(camera.x,camera.y,nextWidth,nextHeight);
      await nativeScene.close();nativeScene=null;
    }
    if(departed)return;
    nativeMode=nextMode;placement=false;canvas.style.cursor='grab';size();draw();
    // Tower edits finish durably before the mode can change. Keep only the
    // selected map's terrain arrays; reconstruct the other view when needed.
    if(nativeMode)stream.active.clear();
    document.querySelector('#build').disabled=nativeMode;
    document.querySelector('#terrain').textContent=nativeMode?'Show generated experiment':'Show saved Majesty terrain';
    document.querySelector('#map-info').textContent=nativeMode?'Saved Majesty terrain with building squares and smaller unit markers colored by kingdom. Empty areas have no checkpoint. This shows the last save; units inside buildings are omitted and crowded areas have limited markers.':'Explore an expanding map. Leave a watchtower, travel away, and return to find it preserved.';
    notice.textContent=nativeMode?'Showing saved terrain. Independent kingdoms may have mismatched borders.':'';
  }catch(e){if(!departed)notice.textContent=`Map view unchanged: ${e.message}`;}
  finally{busy=false;if(pending){const target=pending;move(target.x,target.y,{refresh:target.refresh});}}
};
canvas.onpointerdown=async e=>{
  if(departed||!stream || busy)return;
  const wx=camera.x+(e.clientX/cssWidth-.5)*width,wy=camera.y+(e.clientY/cssHeight-.5)*height;
  if(placement&&!nativeMode){busy=true;try{await stream.tower(wx,wy);if(!departed){notice.textContent='Watchtower saved. Travel away and return to check it.';draw();}}catch(error){if(!departed)notice.textContent=error.message;}finally{busy=false;if(pending){const p=pending;move(p.x,p.y,{refresh:p.refresh});}}return;}
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,camera:{...camera}};canvas.setPointerCapture(e.pointerId);
};
function consumePointer(){const target=pointerTarget;pointerTarget=null;if(target)move(target.x,target.y);}
canvas.onpointermove=e=>{
  if(drag?.id!==e.pointerId)return;
  pointerTarget={x:drag.camera.x-(e.clientX-drag.x)*width/cssWidth,y:drag.camera.y-(e.clientY-drag.y)*height/cssHeight};
  if(pointerFrame)return;
  pointerFrame=true;requestAnimationFrame(()=>{pointerFrame=false;consumePointer();});
};
function release(e){
  if(drag?.id!==e.pointerId)return;
  drag=null;flushCameraAfterMove=true;consumePointer();
  if(!busy){flushCameraAfterMove=false;cameraWriter?.flush().catch(()=>{});}
}
canvas.onpointerup=release;canvas.onpointercancel=release;
addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')cameraWriter?.flush().catch(()=>{});});
canvas.onkeydown=e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();travel(...d);}};
addEventListener('resize',()=>{size();move(camera.x,camera.y);});
size();draw();
try{
 world=selectedWorld(location.search);
 const destination=selectedAtlasRegion(location.search);
 const store=await BrowserRegionStore.open(world??'frontier-v1',{nativeWorld:world!==null});
 if(departed){store.close();throw new Error('World view closed');}
 const saved=await store.read('camera-v1');
 if(departed)throw new Error('World view closed');
 stream=new RegionStream(store);
 cameraWriter=new CameraCheckpointWriter(store,{report:({error,latest})=>{
   if(departed||!latest)return;
   const previous=cameraWarning;
   cameraWarning=error?`Travel completed; the view position could not be saved: ${error.message}. Buildings remain saved.`:'';
   // An optional camera result must not erase a newer building/travel error.
   if(notice.textContent===previous||notice.textContent==='')notice.textContent=cameraWarning;
 }});
 const position=destination?{x:destination.x*REGION+REGION/2,y:destination.y*REGION+REGION/2}:
   saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?saved:{x:256,y:256};
 await move(position.x,position.y);
 if(departed)throw new Error('World view closed');
 canvas.style.cursor='grab';document.querySelector('#terrain').disabled=world===null;
 await initializeJourney({document,store,world,base:location.href,navigate:async destination=>{
   if(departed)throw new Error('World view closed');
   if(busy)throw new Error('Wait for the current map action');
   try{await cameraWriter.flush();}catch{/* Optional camera state does not invalidate kingdom checkpoints. */}
   if(departed)throw new Error('World view closed');
   location.replace(destination);
 }});
 if(departed)throw new Error('World view closed');
 backupControls=initializeRegionBackups({document,base:location.href,getCurrent:()=>({world,x:Math.floor(camera.x/REGION),y:Math.floor(camera.y/REGION)})});
 heroControls=initializeHeroJourneys({document,base:location.href,
   getCurrent:()=>({world,x:Math.floor(camera.x/REGION),y:Math.floor(camera.y/REGION)}),navigate:async destination=>{
     if(departed)throw new Error('World view closed');
     if(busy)throw new Error('Wait for the current map action');
     try{await cameraWriter.flush();}catch{/* Optional camera state does not invalidate kingdom saves. */}
     if(departed)throw new Error('World view closed');
     location.replace(destination);
   }});
 catalogControls=initializeRealmCatalog({document,getWorld:()=>world,onSelect:async(x,y)=>{
   if(departed)throw new Error('World view closed');
   if(busy||!stream)throw new Error('Wait for the current map action');
   const target={x:x*REGION+REGION/2,y:y*REGION+REGION/2};
   const moved=await move(target.x,target.y,{refresh:true});
   if(departed)throw new Error('World view closed');
   if(!moved||camera.x!==target.x||camera.y!==target.y)throw new Error('Map travel did not complete');
   if(!nativeMode)await document.querySelector('#terrain').onclick();
   if(!nativeMode)throw new Error('Saved terrain could not be loaded');
 }});
}
catch(e){if(!departed){notice.textContent=`World unavailable: ${e.message}`;document.querySelectorAll('button').forEach(b=>b.disabled=true);document.querySelector('#native').removeAttribute('href');}}
