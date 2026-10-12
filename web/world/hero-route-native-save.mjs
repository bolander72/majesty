// Publish a native region checkpoint into its registered hero journal. Offline
// callers acquire the world lock and refuse an open game. Live callers use the
// paused checkpoint capability in realm-session, which borrows its game lease.
import {openNativeHeroRouteStore,opfsHeroRouteStorage} from './hero-route-profile.mjs';
import {HeroRouteStore} from './hero-route-store.mjs';
import {nativeWorldDirectory,opfsNativeRealmStorage} from './realm-profile.mjs';
import {NativeRealmStore,realmFiles,parseRealmManifest} from './realm-store.mjs';
import {pairedLockName} from './transfer-store.mjs';
import {nativeHeroContentDigest} from './hero-route-launch.mjs';
import {checkpointChunks} from './checkpoint.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';
import {canonicalHeroHomeAliases} from './entity-home-ownership.mjs';
import {copyNativeHeroCrossing,requireCheckpointHeroCrossing} from './hero-travel-boundary.mjs';
import {selectedHeroRuntimeBinding} from './hero-runtime-binding.mjs';

export function publishNativeHeroOwnerSave(profiles,world,request,
  options={}){
  return publishOwnerSave(profiles,world,request,options,false);
}

// A scoped live save selects the current journal head under the game's held
// world lease. Current native aliases are still explicit; an uncertain earlier
// acknowledgement must not select another actor or another kingdom.
export function publishNativeHeroCurrentOwnerSave(profiles,world,request,options={}){
  if(!request||Object.hasOwn(request,'expectedOwnerManifest'))throw Error('Current hero save selects its own manifest');
  return publishOwnerSave(profiles,world,{...request,expectedOwnerManifest:null},options,true);
}
function publishOwnerSave(profiles,world,request,
  {locks=globalThis.navigator?.locks,signal,boundary=async()=>{},crossing}={},current=false){
  const r=request&&{...request},lockName=pairedLockName(nativeWorldDirectory(world));
  if(!r||Object.keys(r).sort().join(',')!==['content','entityId','expectedNativeManifest','expectedOwnerManifest','operationId','region','worldId',
      ...(current?['expectedOwner','expectedHome','expectedClock']:[])].sort().join(',')||
      ![r.worldId,r.entityId,r.operationId].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))||
      (!(current&&r.expectedOwnerManifest===null)&&(typeof r.expectedOwnerManifest!=='string'||!r.expectedOwnerManifest.length||r.expectedOwnerManifest.length>4096))||
      typeof r.expectedNativeManifest!=='string'||r.expectedNativeManifest.length>511||
      !profiles||typeof profiles.getDirectoryHandle!=='function'||!locks||typeof locks.request!=='function'||typeof boundary!=='function')
    throw Error('Invalid native hero save publication');
  if(current){
    if(!Number.isInteger(r.expectedClock)||r.expectedClock<0||r.expectedClock>0xffffffff)throw Error('Invalid held native hero clock');
    const a=r.expectedOwner;
    if(!a||Object.keys(a).sort().join(',')!=='agentId,unitId'||!Number.isInteger(a.unitId)||a.unitId<1||a.unitId>0xffffffff||
        !Number.isInteger(a.agentId)||a.agentId<1||a.agentId>0x7fffffff)throw Error('Invalid current native hero alias');
    r.expectedOwner={unitId:a.unitId,agentId:a.agentId};
    r.expectedHome=canonicalHeroHomeAliases([r.expectedHome,r.expectedHome])[0];
  }
  realmFiles(r.region);const contentDigest=nativeHeroContentDigest(r.content);
  const accepted=crossing===undefined?null:copyNativeHeroCrossing(crossing);
  if(accepted&&(!current||accepted.region!==r.region||accepted.clock!==r.expectedClock||
      accepted.unitId!==r.expectedOwner.unitId||accepted.agentId!==r.expectedOwner.agentId))
    throw Error('Hero crossing publication differs from its held owner');
  parseRealmManifest(r.expectedNativeManifest,r.content);checkCheckpointReadSignal(signal);
  return locks.request(lockName,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)throw Error('World storage busy; close the game before publishing its saved kingdom');
    let active=true;
    function check(){if(!active)throw Error('Native hero save publication ended');checkCheckpointReadSignal(signal);}
    const borrowed={async request(name,options,consume){
      check();if(name!==lockName||!['shared','exclusive'].includes(options?.mode)||options.ifAvailable!==true||typeof consume!=='function')
        throw Error('Native hero save requires its exact world lease');
      const result=await consume({});check();return result;
    }};
    try{
      const opened=await openNativeHeroRouteStore(profiles,world,{worldId:r.worldId,entityId:r.entityId,contentDigest},{locks:borrowed,signal});
      const identity=opened.identity;
      const selected=await opened.withOwner(async value=>({record:value.record,entry:value.entry,owner:value.owner,
        clock:await checkpointSavedClock(value.source)}),{signal});
      check();if(selected.owner.region!==r.region)throw Error('Saved kingdom is not the selected hero region');
      if(current&&(selected.entry.alias.unitId!==r.expectedOwner.unitId||selected.entry.alias.agentId!==r.expectedOwner.agentId||
          ['kind','unitId','agentId'].some(k=>selected.entry.homeAlias[k]!==r.expectedHome[k])))
        throw Error('Current journal owner differs from the loaded hero');
      const expectedOwnerManifest=current?selected.record.manifest:r.expectedOwnerManifest;
      // Commit has no signal parameter. Guard every custody read/write so it
      // drains pending I/O while the outer lease remains held on cancellation.
      const backing=opfsHeroRouteStorage(profiles,world,r.entityId,borrowed);
      const guarded={async withLock(mode,consume){check();const result=await backing.withLock(mode,consume);check();return result;},
        async open(name){check();const file=await backing.open(name);check();if(!file)return null;
          return {size:file.size,async readAt(at,n){check();const bytes=await file.readAt(at,n);check();return bytes;}};},
        async atomicWrite(name,produce){check();await backing.atomicWrite(name,sink=>produce({async write(bytes){
          check();await sink.write(bytes);check();
        }}));check();},
      };
      const route=new HeroRouteStore(guarded,identity,contentDigest);
      const native=new NativeRealmStore(opfsNativeRealmStorage(profiles,world,borrowed),{content:r.content});
      return await native.withRegions([r.region],async regions=>{
        check();const saved=regions.get(r.region);
        if(!saved||saved.record.manifest!==r.expectedNativeManifest)throw Error('Native checkpoint changed; select its current saved kingdom');
        for await(const _ of checkpointChunks(saved.source))check();
        const clock=await checkpointSavedClock(saved.source);check();
        if(current&&clock!==r.expectedClock)throw Error('Native hero checkpoint clock differs from its held boundary');
        if(clock<selected.clock)throw Error('Native checkpoint predates the selected kingdom');
        const travel=accepted?await requireCheckpointHeroCrossing(saved.source,
          selectedHeroRuntimeBinding(identity,selected.entry,selected.clock),accepted,{signal}):null;check();
        const unchanged=selected.record.manifest===expectedOwnerManifest&&
          selected.entry.world.size===saved.record.size&&selected.entry.world.sha256===saved.record.sha256;
        const record=unchanged?{...selected.record,idempotent:true}:await route.commit({kind:'save',
          operationId:r.operationId,expectedManifest:expectedOwnerManifest,regions:[r.region],
          aliases:[selected.entry.alias],homeAliases:[selected.entry.homeAlias],
          worlds:[{source:saved.source,sha256:saved.record.sha256}]},async phase=>{check();await boundary(phase);check();});
        check();
        return Object.freeze({world,region:r.region,owner:Object.freeze({...selected.owner}),ownerRevision:record.revision,
          ownerManifest:record.manifest,nativeManifest:saved.record.manifest,sha256:saved.record.sha256,size:saved.record.size,
          clock,idempotent:record.idempotent,unchanged,...(travel?{travel}:{})});
      },{signal});
    }finally{active=false;}
  });
}
