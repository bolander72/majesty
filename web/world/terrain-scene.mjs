// Bounded read-only scene of saved native terrain. Native engine simulation,
// rendering, navigation and cross-kingdom seam reconciliation are unchanged.
import {checkpointTerrain,TERRAIN_WINDOW_SIDE,MAX_NATIVE_MAP_SIDE,VERTEX_BYTES,CELL_BYTES,MAX_TERRAIN_WINDOW_BYTES} from './terrain.mjs';
import {regionKey} from './region.mjs';
import {requireExactWindowSeams} from './terrain-seam.mjs';
import {SceneViewLease,MAX_SCENE_VIEW_ENTRIES} from './scene-view.mjs';
import {ATLAS_MARKER_WORDS,MAX_ATLAS_WINDOW_MARKER_BYTES,ATLAS_POSITION_SCALE} from './atlas-units.mjs';

export const MAX_NATIVE_ACTIVE_WINDOWS=MAX_SCENE_VIEW_ENTRIES,MAX_NATIVE_RESIDENT_WINDOWS=98;
export const MAX_NATIVE_RESIDENT_BYTES=MAX_NATIVE_RESIDENT_WINDOWS*(MAX_TERRAIN_WINDOW_BYTES+MAX_ATLAS_WINDOW_MARKER_BYTES);
const MAX_WINDOW_COORD=1000000*MAX_NATIVE_MAP_SIDE/TERRAIN_WINDOW_SIDE+MAX_NATIVE_MAP_SIDE/TERRAIN_WINDOW_SIDE;
const key=(x,y)=>`${x},${y}`;
export function nativeVisibleWindows(cx,cy,width,height){
  if(![cx,cy,width,height].every(Number.isFinite)||width<=0||height<=0||width>128||height>128)
    throw new Error('Invalid native scene viewport');
  const wanted=[];
  for(let y=Math.floor((cy-height/2)/TERRAIN_WINDOW_SIDE)-1;y<=Math.floor((cy+height/2)/TERRAIN_WINDOW_SIDE)+1;++y)
    for(let x=Math.floor((cx-width/2)/TERRAIN_WINDOW_SIDE)-1;x<=Math.floor((cx+width/2)/TERRAIN_WINDOW_SIDE)+1;++x){
      if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||Math.abs(x)>MAX_WINDOW_COORD||Math.abs(y)>MAX_WINDOW_COORD)
        throw new Error('Native scene world boundary reached');
      wanted.push([x,y]);
    }
  if(wanted.length>MAX_NATIVE_ACTIVE_WINDOWS)throw new Error('Native scene residency budget exceeded');
  return wanted;
}
function windowData(value){
  if(value===null)return null;
  if(!value||value.width!==TERRAIN_WINDOW_SIDE||value.height!==TERRAIN_WINDOW_SIDE||
      !Number.isSafeInteger(value.x)||!Number.isSafeInteger(value.y)||value.x<0||value.y<0||
      value.x+TERRAIN_WINDOW_SIDE>MAX_NATIVE_MAP_SIDE||value.y+TERRAIN_WINDOW_SIDE>MAX_NATIVE_MAP_SIDE||
      value.x%TERRAIN_WINDOW_SIDE!==0||value.y%TERRAIN_WINDOW_SIDE!==0||
      typeof value.realmKey!=='string'||value.realmKey.length>24||
      !(value.vertices instanceof Uint8Array)||!(value.cells instanceof Uint8Array)||
      !(value.vertices.buffer instanceof ArrayBuffer)||!(value.cells.buffer instanceof ArrayBuffer)||
      value.vertices.length!==(TERRAIN_WINDOW_SIDE+1)**2*VERTEX_BYTES||value.cells.length!==TERRAIN_WINDOW_SIDE**2*CELL_BYTES||
      value.vertices.byteOffset!==0||value.cells.byteOffset!==0||
      value.vertices.buffer.byteLength!==value.vertices.length||value.cells.buffer.byteLength!==value.cells.length)
    throw new Error('Invalid native scene window');
  const realm=value.realmKey.split('_').map(Number);
  if(realm.length!==2||regionKey(...realm)!==value.realmKey)throw new Error('Invalid native scene realm');
  if(value.markers!==undefined){
    const markers=value.markers;
    if(!(markers instanceof Int32Array)||!(markers.buffer instanceof ArrayBuffer)||
      markers.byteOffset!==0||markers.buffer.byteLength!==markers.byteLength||
      markers.length%ATLAS_MARKER_WORDS||markers.byteLength>MAX_ATLAS_WINDOW_MARKER_BYTES||
      !Number.isSafeInteger(value.omittedMarkers)||value.omittedMarkers<0)
      throw new Error('Invalid native scene unit markers');
    for(let at=0;at<markers.length;at+=ATLAS_MARKER_WORDS){
      if(![1,2].includes(markers[at+2])||markers[at+3]<0||markers[at+4]<0||
        markers[at+3]>=TERRAIN_WINDOW_SIDE*ATLAS_POSITION_SCALE||
        markers[at+4]>=TERRAIN_WINDOW_SIDE*ATLAS_POSITION_SCALE)throw new Error('Invalid native scene unit position');
    }
  }else if(value.omittedMarkers!==undefined)throw new Error('Missing native scene unit markers');
  // Keep only supported scalar fields and the exact-sized owned buffers.
  return Object.freeze({x:value.x,y:value.y,width:value.width,height:value.height,realmKey:value.realmKey,
    vertices:value.vertices,cells:value.cells,...(value.markers===undefined?{}:
      {markers:value.markers,omittedMarkers:value.omittedMarkers})});
}

// A generic provider can supply more realms; this adapter projects the two
// selected saved kingdoms under one shared lease. It never creates a kingdom.
export function pairedTerrainProvider(store,{realmWidth=128,realmHeight=128}={}){
  if(!store||typeof store.withSelected!=='function'||![realmWidth,realmHeight].every(n=>
      Number.isSafeInteger(n)&&n>=TERRAIN_WINDOW_SIDE&&n<=MAX_NATIVE_MAP_SIDE&&n%TERRAIN_WINDOW_SIDE===0))
    throw new Error('Invalid native realm layout');
  return {withSnapshot(consume){return store.withSelected(async selected=>{
    if(!selected)throw new Error('No selected native kingdoms');
    const realms=new Map();
    for(let side=0;side<2;++side){
      const terrain=await checkpointTerrain(selected.sources[side]);
      if(terrain.width!==realmWidth||terrain.height!==realmHeight)throw new Error('Native realm dimensions differ from layout');
      realms.set(selected.record.regions[side],terrain);
    }
    let active=true;
    const snapshot={identity:`${realmWidth}x${realmHeight}\n${selected.record.manifest}`,async readWindow(wx,wy){
      if(!active)throw new Error('Native terrain snapshot lease ended');
      if(!Number.isSafeInteger(wx)||!Number.isSafeInteger(wy)||Math.abs(wx)>MAX_WINDOW_COORD||Math.abs(wy)>MAX_WINDOW_COORD)
        throw new Error('Native scene window out of bounds');
      const x=wx*TERRAIN_WINDOW_SIDE,y=wy*TERRAIN_WINDOW_SIDE;
      const rx=Math.floor(x/realmWidth),ry=Math.floor(y/realmHeight);
      if(Math.abs(rx)>1000000||Math.abs(ry)>1000000)return null;
      const id=regionKey(rx,ry),terrain=realms.get(id);
      if(!terrain)return null; // An absent realm is unavailable, never regenerated.
      const value=await terrain.window(x-rx*realmWidth,y-ry*realmHeight,TERRAIN_WINDOW_SIDE,TERRAIN_WINDOW_SIDE);
      if(!active)throw new Error('Native terrain snapshot lease ended');
      return {...value,realmKey:id};
    }};
    try{return await consume(Object.freeze(snapshot));}finally{active=false;realms.clear();}
  });}};
}

export class NativeTerrainScene {
  #provider;
  #active=new Map();
  #lease=new SceneViewLease(this.#active);
  #view=this.#lease.view;
  #identity=null;
  #revisions=new Map();
  #pending=null;
  #running=false;
  #closed=false;
  #closing=null;
  #finishClose;
  #reads=new AbortController();
  #staged=0;
  #stagedBytes=0;
  #seamPolicy;
  constructor(provider,{seamPolicy='independent'}={}){
    if(!provider||typeof provider.withSnapshot!=='function')throw new Error('Invalid native terrain provider');
    if(!['independent','exact-vertices','height-bytes'].includes(seamPolicy))throw new Error('Invalid native terrain seam policy');
    this.#seamPolicy=seamPolicy;
    this.#provider=provider;this.activeHighWater=0;this.residentHighWater=0;this.residentBytesHighWater=0;
    this.windowReads=0;this.pendingHighWater=0;
  }
  move(x,y,width,height){
    if(this.#closed)return Promise.reject(new Error('Native terrain scene closed'));
    let wanted;
    try{wanted=nativeVisibleWindows(x,y,width,height);}catch(error){return Promise.reject(error);}
    const target={x,y,wanted};
    if(this.#pending){this.#pending.target=target;return this.#pending.promise;}
    const job={target};job.promise=new Promise((resolve,reject)=>{job.resolve=resolve;job.reject=reject;});
    this.#pending=job;this.pendingHighWater=1;this.#drain();return job.promise;
  }
  async #drain(){
    if(this.#running)return;
    this.#running=true;
    try{while(this.#pending){
      const job=this.#pending;this.#pending=null;
      try{job.resolve(await this.#move(job.target));}catch(error){job.reject(error);}
    }}finally{this.#running=false;if(this.#closed)this.#release();}
  }
  // Expire public views immediately, but keep residency accounting and the
  // provider alive until an in-flight snapshot has settled its cleanup.
  close(){
    if(this.#closing)return this.#closing;
    this.#closed=true;this.#identity=null;this.#lease.revoke();
    this.#reads.abort(new Error('Native terrain scene closed'));
    this.#closing=new Promise(resolve=>{this.#finishClose=resolve;});
    if(this.#pending){this.#pending.reject(new Error('Native terrain scene closed'));this.#pending=null;}
    if(!this.#running)this.#release();
    return this.#closing;
  }
  #release(){
    this.#active.clear();this.#revisions.clear();this.#provider=null;
    this.#finishClose();this.#finishClose=null;
  }
  #requireOpen(){if(this.#closed)throw new Error('Native terrain scene closed');}
  async #move({x,y,wanted}){
    let scene,supplied=false,published=false;
    try{await this.#provider.withSnapshot(async snapshot=>{
      this.#requireOpen();
      if(supplied)throw new Error('Multiple native terrain snapshots supplied');
      supplied=true;
      const identity=snapshot?.identity;
      if(!snapshot||typeof identity!=='string'||!identity.length||identity.length>1024||
          typeof snapshot.readWindow!=='function')throw new Error('Invalid native terrain snapshot');
      if(snapshot.windowIdentity!==undefined&&typeof snapshot.windowIdentity!=='function')throw new Error('Invalid native window identity provider');
      const next=new Map(),revisions=new Map();
      scene={next,identity,revisions};
      for(const [wx,wy]of wanted){
        this.#requireOpen();
        const id=key(wx,wy);
        const revision=snapshot.windowIdentity?snapshot.windowIdentity(wx,wy):identity;
        if(typeof revision!=='string'||!revision.length||revision.length>1024)throw new Error('Invalid native window identity');
        revisions.set(id,revision);
        if(revision===this.#revisions.get(id)&&this.#active.has(id)){next.set(id,this.#active.get(id));continue;}
        const read=await snapshot.readWindow(wx,wy);
        this.#requireOpen();
        const value=windowData(read);++this.windowReads;
        next.set(id,value);++this.#staged;
        if(value)this.#stagedBytes+=value.vertices.length+value.cells.length+(value.markers?.byteLength??0);
        this.residentHighWater=Math.max(this.residentHighWater,this.residentWindows);
        this.residentBytesHighWater=Math.max(this.residentBytesHighWater,this.residentBytes);
        if(this.residentWindows>MAX_NATIVE_RESIDENT_WINDOWS||this.residentBytes>MAX_NATIVE_RESIDENT_BYTES)
          throw new Error('Native scene residency budget exceeded');
      }
    },{windows:wanted,signal:this.#reads.signal});
      this.#requireOpen();
      if(!scene)throw new Error('Native terrain snapshot unavailable');
      if(this.#seamPolicy==='exact-vertices')requireExactWindowSeams(scene.next);
      if(this.#seamPolicy==='height-bytes')requireExactWindowSeams(scene.next,4);
      // Wait for the snapshot operation and lease cleanup to succeed before
      // publishing its complete bytes and matching generation together.
      const lease=new SceneViewLease(scene.next),previous=this.#active,previousLease=this.#lease,
        previousRevisions=this.#revisions;
      this.#active=scene.next;this.#identity=scene.identity;
      this.#revisions=scene.revisions;
      this.#lease=lease;this.#view=lease.view;
      previousLease.revoke();previous.clear();previousRevisions.clear();
      published=true;
      this.activeHighWater=Math.max(this.activeHighWater,scene.next.size);
      return {x,y};
    }finally{
      if(!published&&scene){scene.next.clear();scene.revisions.clear();}
      scene=null;this.#staged=0;this.#stagedBytes=0;
    }
  }
  get closed(){return this.#closed;}
  get active(){return this.#view;}
  get identity(){return this.#identity;}
  get pendingOperations(){return this.#pending?1:0;}
  get residentWindows(){return this.#active.size+this.#staged;}
  get activeBytes(){let bytes=0;for(const value of this.#active.values())if(value)bytes+=value.vertices.length+value.cells.length+(value.markers?.byteLength??0);return bytes;}
  get residentBytes(){return this.activeBytes+this.#stagedBytes;}
}
