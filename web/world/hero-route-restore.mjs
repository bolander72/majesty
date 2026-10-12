// Prepare an existing custody owner for the original region loader. This
// copies a stopped selected save, never imports an actor or simulates a world.
import {openNativeHeroRouteStore} from './hero-route-profile.mjs';
import {nativeWorldDirectory,opfsNativeRealmStorage} from './realm-profile.mjs';
import {NativeRealmStore,realmFiles,parseRealmManifest} from './realm-store.mjs';
import {pairedLockName} from './transfer-store.mjs';
import {checkpointChunks} from './checkpoint.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';
import {selectedHeroRuntimeBinding,selectedHeroHaloBinding} from './hero-runtime-binding.mjs';
import {requireCheckpointHaloLayout} from './halo-checkpoint-layout.mjs';

export function prepareNativeHeroOwnerRestore(profiles,world,request,
  options={}){
  return prepareOwner(profiles,world,request,options,false);
}

// Startup already owns the exclusive world lease and selects the current head
// inside it. Verify that owner once instead of first loading it solely to
// discover a manifest and then validating the identical save again.
export function prepareNativeHeroCurrentOwnerRestore(profiles,world,request,options={}){
  if(!request||Object.hasOwn(request,'expectedOwnerManifest'))throw Error('Current owner preparation selects its own manifest');
  return prepareOwner(profiles,world,{...request,expectedOwnerManifest:null},options,true);
}

function prepareOwner(profiles,world,request,
  {locks=globalThis.navigator?.locks,signal,boundary=async()=>{},haloLayout}={},current=false){
  const root=nativeWorldDirectory(world),lockName=pairedLockName(root);
  // Capture caller tokens before acquiring a lock or doing asynchronous I/O.
  const r=request&&{...request};
  if(!r||Object.keys(r).sort().join(',')!==['content','contentDigest','entityId','expectedOwnerManifest','region','worldId'].sort().join(',')||
      ![r.worldId,r.entityId,r.contentDigest].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))||
      typeof r.content!=='string'||!/^[a-f0-9]{64}:[a-f0-9]{64}$/.test(r.content)||
      (!(current&&r.expectedOwnerManifest===null)&&
        (typeof r.expectedOwnerManifest!=='string'||!r.expectedOwnerManifest.length||r.expectedOwnerManifest.length>4096))||
      typeof boundary!=='function'||!profiles||typeof profiles.getDirectoryHandle!=='function'||
      !locks||typeof locks.request!=='function'||haloLayout!==undefined&&haloLayout!=='halo-v1')throw Error('Invalid native hero restore preparation');
  realmFiles(r.region);
  // Validate the native content marker separately. Custody content digests
  // may describe a development fixture; their bytes are not native markers.
  parseRealmManifest(['checkpoint-v1',0,16,'0'.repeat(64),r.content,''].join('\n'),r.content);
  checkCheckpointReadSignal(signal);
  return locks.request(lockName,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)throw Error('World storage busy; close the game before preparing its hero owner');
    let active=true;
    function check(){if(!active)throw Error('Native hero restore preparation ended');checkCheckpointReadSignal(signal);}
    // Nested store operations borrow only this exact exclusive world lease.
    // The capability cannot escape the callback or acquire a different lock.
    const borrowed={async request(name,options,consume){
      check();
      if(name!==lockName||!['shared','exclusive'].includes(options?.mode)||options.ifAvailable!==true||typeof consume!=='function')
        throw Error('Native hero restore requires its exact world lease');
      const result=await consume({});check();return result;
    }};
    try{
      check();
      const route=await openNativeHeroRouteStore(profiles,world,
        {worldId:r.worldId,entityId:r.entityId,contentDigest:r.contentDigest},{locks:borrowed,signal});
      const realms=new NativeRealmStore(opfsNativeRealmStorage(profiles,world,borrowed),{content:r.content});
      return await route.withOwner(async selected=>{
        check();
        if((!current&&selected.record.manifest!==r.expectedOwnerManifest)||selected.owner.region!==r.region)
          throw Error('Native hero restore owner changed; reopen the selected kingdom');
        for await(const _ of checkpointChunks(selected.source))check();
        const clock=await checkpointSavedClock(selected.source);check();
        const runtimeBinding=selectedHeroRuntimeBinding(route.identity,selected.entry,clock);
        // Verify the selected leased owner before even creating native slots.
        // Legacy maps remain playable through ordinary owner restoration.
        const layout=haloLayout===undefined?null:await requireCheckpointHaloLayout(selected.source,r.region,haloLayout,{signal});check();
        const old=await realms.read(r.region);check();
        if(old&&(old.size!==selected.entry.world.size||old.sha256!==selected.entry.world.sha256))
          throw Error('Region already has a different saved kingdom; its checkpoint is preserved');
        const record=await realms.commit(r.region,{source:selected.source,sha256:selected.entry.world.sha256,
          expectedManifest:old?.manifest??null},async stage=>{check();await boundary(stage);check();});
        check();
        return Object.freeze({world,region:r.region,owner:Object.freeze({...selected.owner}),
          ownerRevision:selected.record.revision,ownerManifest:selected.record.manifest,
          nativeManifest:record.manifest,sha256:record.sha256,size:record.size,clock,
          idempotent:record.idempotent,runtimeBinding,...(layout?{haloLayout:layout,haloBinding:selectedHeroHaloBinding(runtimeBinding,layout)}:{})});
      },{signal});
    }finally{active=false;}
  });
}
