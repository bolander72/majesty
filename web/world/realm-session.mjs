import {selectedWorld} from './world-name.mjs';
import {selectedRegion} from './region.mjs';
import {nativeWorldDirectory,nativeRealmProfilePath,opfsNativeRealmStorage} from './realm-profile.mjs';
import {pairedLockName} from './transfer-store.mjs';
import {realmFiles,NativeRealmStore} from './realm-store.mjs';
import {MAX_CHECKPOINT_BYTES} from './checkpoint.mjs';
import {CheckpointReadLease} from './checkpoint-lease.mjs';
import {nativeHeroRestoreConfig,prepareNativeHeroStartup,nativeHeroContentDigest} from './hero-route-launch.mjs';
import {parseHeroRuntimeBinding,selectedHeroHaloBinding} from './hero-runtime-binding.mjs';
import {publishNativeHeroCurrentOwnerSave} from './hero-route-native-save.mjs';
import {heroRouteFilename,openNativeHeroRouteStore} from './hero-route-profile.mjs';
import {Sha256} from './sha256.mjs';
import {requireCheckpointHaloLayout} from './halo-checkpoint-layout.mjs';
import {boundNativeHeroCrossing} from './hero-travel-boundary.mjs';
import {registeredHeroHome} from './entity-home-ownership.mjs';
import {prepareOrReuseRemoteHomeAgent} from './remote-home-cache.mjs';
import {checkpointNextAgentId} from './checkpoint.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {prepareSelectedHeroHomeArrival,prepareSelectedHeroNeighborArrival} from './hero-home-arrival-package.mjs';
import {withProposedRemoteHome} from './remote-home-projection.mjs';
import {stageNativeHeroHomeInput,stageNativeHeroProxyInput,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT,HERO_ARRIVAL_HOME} from './hero-arrival-staging.mjs';
import {restoreSelectedDormantHeroRegion} from './hero-dormant-home-restore.mjs';
import {stageNativeHeroTravelRequest,HERO_TRAVEL_REQUEST} from './hero-travel-request.mjs';
import {stageNativeHeroGenerationRequest,HERO_GENERATION_REQUEST} from './hero-generation-request.mjs';
import {publishNativeHeroArrivalOwner} from './hero-native-arrival-publication.mjs';
import {parseNativeHeroArrivalReady} from './hero-travel-publication.mjs';
import {nativeHeroGenerationConsumedLine,parseNativeHeroGenerationInitialized} from './hero-generation-boundary.mjs';
import {checkpointHeroGenerationInitialization} from './arrival.mjs';

// Capabilities belong to this document's injected game, not to another tab's
// Web Lock or to an uninitialized startup. Never release its exclusive lease
// merely to let a destination reader acquire a new shared one.
const injectedWorlds=new Map();

export function confirmNativeHeroGameReady(world,binding){
  const owner=injectedWorlds.get(world),hero=owner?.hero;
  if(!hero||owner.session||binding!==hero.receipt.runtimeBinding||owner.region.key!==hero.config.region)
    throw Error('Hero readiness differs from this document\'s prepared kingdom');
  hero.ready=true;
}
export function queueNativeHeroGameSave(world,serial,{crossing}={}){
  const owner=injectedWorlds.get(world),hero=owner?.hero;
  if(!hero?.ready||hero.pending||!Number.isInteger(serial)||serial!==hero.serial+1||serial>0xffffffff)
    throw Error('Hero save requires this document\'s next native pause');
  const accepted=crossing===undefined?null:boundNativeHeroCrossing(hero.receipt.runtimeBinding,crossing);
  if(accepted&&(hero.receipt.haloLayout?.version!=='halo-v1'||accepted.serial!==serial))
    throw Error('Hero crossing requires its prepared halo layout and exact save serial');
  hero.serial=serial;hero.pending={serial,crossing:accepted,controller:new AbortController(),work:null,settled:false,
    published:null,ending:false,travelWork:null,travelController:null,preparedArrival:null,stagedArrival:null,
    departure:null,departureConsumed:false,arrivalPublished:null,arrivalRecovery:undefined,generation:null};
}

// Only this entry point can publish a live save. It borrows the existing game
// lease after the exact paused native checkpoint event, writes custody only,
// and cannot replace a native region save or touch a different region/profile.
export function publishNativeHeroGameSave(world,boundary,{signal,storage=globalThis.navigator?.storage}={}){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending,r=boundary&&{...boundary};
  if(!hero?.ready||!token||token.work||!r||Object.keys(r).sort().join(',')!=='clock,region,serial,sha256,size,slot'||
      r.serial!==token.serial||r.region!==owner.region.key||!Number.isInteger(r.clock)||r.clock<0||r.clock>0xffffffff||
      ![0,1].includes(r.slot)||!Number.isSafeInteger(r.size)||r.size<16||r.size>MAX_CHECKPOINT_BYTES||
      typeof r.sha256!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256))throw Error('Hero publication requires its exact native held save');
  if(signal&&typeof signal.throwIfAborted!=='function')throw Error('Invalid hero save cancellation');
  const binding=parseHeroRuntimeBinding(hero.receipt.runtimeBinding);
  if(r.clock<binding.clock)throw Error('Held kingdom predates the prepared hero');
  if(token.crossing&&r.clock!==token.crossing.clock)throw Error('Held kingdom differs from its accepted crossing tick');
  const cancel=()=>token.controller.abort(signal?.reason);
  if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
  let active=true;
  function check(){
    if(!active||injectedWorlds.get(world)!==owner||hero.pending!==token)throw Error('Native hero save capability ended');
    token.controller.signal.throwIfAborted();
  }
  const borrowed={async request(name,options,consume){
    check();if(name!==owner.lock||!['shared','exclusive'].includes(options?.mode)||options.ifAvailable!==true||typeof consume!=='function')
      throw Error('Native hero save requires its owning world lease');
    const result=await consume({});check();return result;
  }};
  const root=nativeWorldDirectory(world),nativePaths=[root,`frontier_${r.region}`,'Documents','My Games','MajestyHD','SaveGame'];
  const names=realmFiles(r.region);
  function directory(backing,parts=[]){return {
    async getDirectoryHandle(name,options){
      check();const next=[...parts,name],journal=next.length===2&&next[0]===root&&next[1]==='hero-route',
        native=next.length<=nativePaths.length&&next.every((p,i)=>p===nativePaths[i]);
      if(!journal&&!native||options?.create&&!(journal||next.length===1))throw Error('Native hero save directory outside its kingdom');
      const handle=await backing.getDirectoryHandle(name,options);check();return directory(handle,next);
    },
    async getFileHandle(name,options){
      check();const journal=parts.length===2&&parts[0]===root&&parts[1]==='hero-route';
      if(journal){heroRouteFilename(name);
        if(name.endsWith('.GMP')&&!name.startsWith(`Frontier_Hero_Route_${r.region}_`))throw Error('Native hero save outside its owner region');
      }else if(options?.create||!(parts.length===2&&name===names.marker||parts.length===6&&names.slots.includes(name)))
        throw Error('Native hero save cannot write a region checkpoint');
      const handle=await backing.getFileHandle(name,options);check();return {
        async getFile(){check();const file=await handle.getFile();check();return file;},
        async createWritable(){
          check();if(!journal)throw Error('Native hero save cannot write a region checkpoint');
          const stream=await handle.createWritable();
          try{check();}catch(error){await stream.abort().catch(()=>{});throw error;}
          return {async write(bytes){check();await stream.write(bytes);check();},
            async close(){check();await stream.close();check();},async abort(){await stream.abort();}};
        },
      };
    },
    async removeEntry(name){
      check();if(parts.length!==2||parts[1]!=='hero-route')throw Error('Native hero save cannot remove region data');
      heroRouteFilename(name);await backing.removeEntry(name);check();
    },
  };}
  token.work=(async()=>{
    try{
      check();if(!storage||typeof storage.getDirectory!=='function')throw Error('Native hero profile storage unavailable');
      const top=await storage.getDirectory();check();const game=await top.getDirectoryHandle('majesty');check();
      const profiles=await game.getDirectoryHandle('profile');check();
      const expectedNativeManifest=['checkpoint-v1',r.slot,r.size,r.sha256,hero.content,''].join('\n');
      const operationId=new Sha256().update(new TextEncoder().encode(JSON.stringify(['majesty-native-held-hero-save-v1',
        hero.config.worldId,hero.config.entityId,r.region,expectedNativeManifest]))).hex();
      const result=await publishNativeHeroCurrentOwnerSave(directory(profiles),world,{worldId:hero.config.worldId,
        entityId:hero.config.entityId,content:hero.content,region:r.region,expectedNativeManifest,operationId,
        expectedClock:r.clock,
        expectedOwner:{unitId:binding.unitId,agentId:binding.agentId},
        expectedHome:{kind:binding.homeKind,unitId:binding.homeUnitId,agentId:binding.homeAgentId}},
        {locks:borrowed,signal:token.controller.signal,...(token.crossing?{crossing:token.crossing}:{})});
      check();if(result.clock!==r.clock)throw Error('Native hero checkpoint clock differs from its held boundary');
      token.published=Object.freeze({...r,nativeManifest:expectedNativeManifest,ownerManifest:result.ownerManifest,
        travel:result.travel??null});
      return result;
    }finally{active=false;token.settled=true;signal?.removeEventListener('abort',cancel);}
  })();
  return token.work;
}
export async function endNativeHeroGameSave(world,serial,{abandoned=false}={}){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending;
  if(!hero||!token||token.serial!==serial)throw Error('Native hero save completion differs from this document');
  if(token.departureConsumed&&!abandoned)throw Error('Departed hero cannot finish its old source save');
  token.ending=true;token.travelController?.abort(new Error('Native hero held read ended'));
  if(abandoned){hero.ready=false;token.controller.abort(new Error('Native hero save abandoned'));}
  if(token.work)await token.work.catch(()=>{});
  if(token.travelWork)await token.travelWork.catch(()=>{});
  if(hero.pending===token)hero.pending=null;
}

// Read just the held source and one named neighbor. Layout admission does not
// retire the hero or activate a second kingdom; the subsequent handoff must
// preserve this exact source/native/custody boundary before either mutation.
export function inspectNativeHeroTravelDestination(world,serial,target,{layout,signal,storage=globalThis.navigator?.storage}={}){
  return readNativeHeroTravelDestination(world,serial,target,{layout,signal,storage});
}

// Prepare the original pure-home record before a handoff. Nothing is imported,
// reserved, retired or published here. A returned ID is an inert proposal until
// the original destination runtime acknowledges its registration. Every byte
// comes from the exact captured owner and the one selected saved neighbor.
export function prepareNativeHeroTravelHome(world,serial,target,options={}){
  return prepareNativeHeroTravelDestination(world,serial,target,options,true);
}

// The crossing controller uses one pair inspection/preparation, rather than
// reading both full terrain maps again to prepare a saved destination's home.
// An absent neighbor is explicitly unprepared; its generation/load comes next.
export function prepareNativeHeroTravel(world,serial,target,options={}){
  return prepareNativeHeroTravelDestination(world,serial,target,options,false);
}

// Prepare the complete native-home or proxy-home import capsule for the one
// selected destination, retaining only bounded records after readers revoke.
export function prepareNativeHeroTravelArrival(world,serial,target,options={}){
  const owner=injectedWorlds.get(world),token=owner?.hero?.pending;
  return prepareNativeHeroTravelDestination(world,serial,target,options,false,true).then(prepared=>{
    if(injectedWorlds.get(world)!==owner||owner.hero.pending!==token||token.ending)
      throw Error('Native hero arrival preparation ended');
    token.preparedArrival=prepared;return prepared;
  });
}

// Before return-package preparation, project any selected dormant kingdom into
// its loader slots. Unvisited destinations keep their existing preparation.
export function restoreNativeHeroTravelHome(world,serial,target,{layout,signal,storage=globalThis.navigator?.storage}={}){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending;
  realmFiles(target);const [x,y]=target.split('_').map(Number);
  if(layout!=='halo-v1'||!hero?.ready||!token||token.ending||token.serial!==serial||!token.settled||
      !token.published?.travel?.savedActorPositionVerified||token.crossing?.target!==target||token.travelWork||
      Math.abs(x-owner.region.x)+Math.abs(y-owner.region.y)!==1)
    throw Error('Dormant home restoration requires its held published crossing');
  if(signal&&(typeof signal.throwIfAborted!=='function'||typeof signal.addEventListener!=='function'||
      typeof signal.removeEventListener!=='function'))throw Error('Invalid dormant home cancellation');
  signal?.throwIfAborted();token.preparedArrival=null;
  const controller=new AbortController();token.travelController=controller;
  const cancel=()=>controller.abort(signal?.reason),abandoned=()=>controller.abort(token.controller.signal.reason);
  signal?.addEventListener('abort',cancel,{once:true});token.controller.signal.addEventListener('abort',abandoned,{once:true});
  function check(){
    if(injectedWorlds.get(world)!==owner||hero.pending!==token||token.ending)throw Error('Dormant home restoration ended');
    controller.signal.throwIfAborted();token.controller.signal.throwIfAborted();
  }
  const locks={async request(name,options,consume){check();
    if(name!==owner.lock||!['shared','exclusive'].includes(options?.mode)||options.ifAvailable!==true)
      throw Error('Dormant restoration requires its injected game lease');
    const result=await consume({});check();return result;
  }};
  const job=Promise.resolve().then(async()=>{try{
    check();if(!storage||typeof storage.getDirectory!=='function')throw Error('Native profile storage unavailable');
    const top=await storage.getDirectory();check();const game=await top.getDirectoryHandle('majesty');check();
    const profiles=await game.getDirectoryHandle('profile');check();
    const route=await openNativeHeroRouteStore(profiles,world,{worldId:hero.config.worldId,entityId:hero.config.entityId,
      contentDigest:nativeHeroContentDigest(hero.content)},{locks,signal:controller.signal});check();
    if(registeredHeroHome(route.identity).record.home.region!==target&&
        !await route.hasVisitedRegion(target,{signal:controller.signal}))
      return Object.freeze({serial,targetRegion:target,kind:'foreign',homeRestored:false});
    check();
    const backing=opfsNativeRealmStorage(profiles,world,locks),readable=new Set([owner.region.key,target].flatMap(key=>{
      const names=realmFiles(key);return [names.marker,...names.slots];})),names=realmFiles(target),writable=new Set([names.marker,...names.slots]);
    const io={withLock:(mode,consume)=>backing.withLock(mode,consume),async open(name){check();
      if(!readable.has(name))throw Error('Dormant restoration read outside its saved pair');
      const file=await backing.open(name);check();if(!file)return null;
      return {size:file.size,async readAt(at,n){check();const bytes=await file.readAt(at,n);check();return bytes;}};
    },async atomicWrite(name,produce){check();if(!writable.has(name))throw Error('Dormant restoration write outside its target');
      await backing.atomicWrite(name,sink=>produce({async write(bytes){check();await sink.write(bytes);check();}}));check();
    }};
    const binding=parseHeroRuntimeBinding(hero.receipt.runtimeBinding);
    return await restoreSelectedDormantHeroRegion(route,new NativeRealmStore(io,{content:hero.content}),{
      serial,sourceRegion:owner.region.key,targetRegion:target,sourceAlias:{unitId:binding.unitId,agentId:binding.agentId},
      sourceOwnerManifest:token.published.ownerManifest,sourceNativeManifest:token.published.nativeManifest,
      sourceSha256:token.published.sha256,sourceSize:token.published.size,sourceClock:token.published.clock},
      {signal:controller.signal,check});
  }finally{
    signal?.removeEventListener('abort',cancel);token.controller.signal.removeEventListener('abort',abandoned);
    if(token.travelWork===job)token.travelWork=null;if(token.travelController===controller)token.travelController=null;
  }});
  token.travelWork=job;return job;
}

// Accept only this pending crossing's own prepared package. Stage its two or
// three fixed destination inputs; region slots and custody stay outside this
// writer. A subsequent source request and native action precede the handoff.
export function stageNativeHeroTravelArrival(world,serial,prepared,{signal,storage=globalThis.navigator?.storage}={}){
  return stageHeroTravelInput(world,serial,prepared,{signal,storage},false);
}

// Prepare the source request only after this exact capability staged its
// destination. The native action and ownership-publication lifecycle follow
// separately; returning this request does not release the held source.
export function stageNativeHeroTravelDeparture(world,serial,prepared,{signal,storage=globalThis.navigator?.storage}={}){
  return stageHeroTravelInput(world,serial,prepared,{signal,storage},true);
}

// A new-region preparation is a capability from this held crossing, not a
// caller-supplied recipe. Recheck the selected recovery and absence of BOTH
// neighbor slots under the injected game's lease before staging generation.
// This leaves ownership and the live engine held until separate consumption.
export function stageNativeHeroTravelGeneration(world,serial,prepared,{signal,storage=globalThis.navigator?.storage}={}){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending;
  if(!hero?.ready||!token||token.ending||token.serial!==serial||token.travelWork||!token.settled||
    token.preparedArrival!==prepared||prepared?.kind!=='new'||prepared.layout?.version!=='halo-v1'||
    !token.crossing||token.crossing.target!==prepared.targetRegion||
    !token.published?.travel?.savedActorPositionVerified)
    throw Error('Native generation requires its held prepared unexplored crossing');
  if(signal&&(typeof signal.throwIfAborted!=='function'||typeof signal.addEventListener!=='function'||
    typeof signal.removeEventListener!=='function'))throw Error('Invalid generation cancellation');
  signal?.throwIfAborted();token.generation=null;
  const controller=new AbortController();token.travelController=controller;
  const cancel=()=>controller.abort(signal?.reason),abandoned=()=>controller.abort(token.controller.signal.reason);
  signal?.addEventListener('abort',cancel,{once:true});token.controller.signal.addEventListener('abort',abandoned,{once:true});
  function check(){
    if(injectedWorlds.get(world)!==owner||hero.pending!==token||token.ending||token.preparedArrival!==prepared)
      throw Error('Native generation staging ended');
    controller.signal.throwIfAborted();token.controller.signal.throwIfAborted();
  }
  const locks={async request(name,options,consume){check();
    if(name!==owner.lock||options?.mode!=='shared'||options.ifAvailable!==true)
      throw Error('Native generation requires its injected game lease');
    const result=await consume({});check();return result;
  }};
  const binding=parseHeroRuntimeBinding(hero.receipt.runtimeBinding);
  const job=Promise.resolve().then(async()=>{try{
    check();if(!storage||typeof storage.getDirectory!=='function')throw Error('Native profile storage unavailable');
    const top=await storage.getDirectory();check();const game=await top.getDirectoryHandle('majesty');check();
    const profiles=await game.getDirectoryHandle('profile');check();
    const route=await openNativeHeroRouteStore(profiles,world,{worldId:hero.config.worldId,entityId:hero.config.entityId,
      contentDigest:nativeHeroContentDigest(hero.content)},{locks,signal:controller.signal});check();
    const io=opfsNativeRealmStorage(profiles,world,locks),native=new NativeRealmStore(io,{content:hero.content});
    if(registeredHeroHome(route.identity).record.home.region===prepared.targetRegion)
      throw Error('The registered home kingdom must be restored, not generated');
    async function validate(){
      check();await route.withOwner(async selected=>{
        check();if(selected.record.manifest!==prepared.sourceOwnerManifest||selected.entry.world.sha256!==token.published.sha256||
          selected.entry.world.size!==token.published.size||selected.owner.region!==prepared.sourceRegion||
          selected.owner.unitId!==binding.unitId||selected.owner.agentId!==binding.agentId)
          throw Error('Captured hero owner changed before generation');
      },{signal:controller.signal});check();
      await native.withRegions([prepared.sourceRegion,prepared.targetRegion],async selected=>{
        check();if(selected.get(prepared.sourceRegion)?.record.manifest!==prepared.sourceNativeManifest||
          selected.get(prepared.targetRegion)!==null)throw Error('Generation kingdoms changed; preserve their saves');
        for(const name of realmFiles(prepared.targetRegion).slots){
          check();if(await io.open(name)!==null)throw Error('Neighbor has unregistered save data; its files are preserved');check();
        }
      },{signal:controller.signal});check();
    }
    const directory=await profiles.getDirectoryHandle(nativeWorldDirectory(world));check();
    const source=await directory.getDirectoryHandle('frontier_'+prepared.sourceRegion);check();
    const folder={async getFileHandle(name,options){check();
      if(name!==HERO_GENERATION_REQUEST)throw Error('Native generation outside its request');
      const handle=await source.getFileHandle(name,options);check();return handle;
    }};
    const result=await stageNativeHeroGenerationRequest(folder,{serial,sourceRegion:prepared.sourceRegion,targetRegion:prepared.targetRegion,
      sourceClock:token.published.clock,sourceAlias:{unitId:binding.unitId,agentId:binding.agentId},
      homeAlias:{kind:binding.homeKind,unitId:binding.homeUnitId,agentId:binding.homeAgentId},
      sourceNativeManifest:prepared.sourceNativeManifest,ownerManifest:prepared.sourceOwnerManifest},{check,validate});check();
    token.generation={prepared,result};return result;
  }finally{
    signal?.removeEventListener('abort',cancel);token.controller.signal.removeEventListener('abort',abandoned);
    if(token.travelWork===job)token.travelWork=null;if(token.travelController===controller)token.travelController=null;
  }});
  token.travelWork=job;return job;
}

export function confirmNativeHeroGenerationDeparture(world,serial,request,line){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending,generation=token?.generation;
  if(!hero?.ready||!token||token.ending||token.travelWork||token.serial!==serial||
    generation?.result!==request||generation.prepared!==token.preparedArrival||line!==nativeHeroGenerationConsumedLine(request))
    throw Error('Generation departure differs from its held staged request');
  generation.consumed=true;token.departureConsumed=true;hero.ready=false;
  token.departure={result:request,prepared:null};
}

// Read the real generated kingdom under the already-held game lease. This
// cannot stage another departure or reinterpret an arbitrary saved neighbor.
export function prepareNativeHeroGeneratedArrival(world,serial,request,line,options={}){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending,generation=token?.generation;
  if(!hero||hero.ready||!token||token.ending||token.travelWork||token.serial!==serial||
    generation?.result!==request||!generation.consumed||!token.departureConsumed)
    throw Error('Generated arrival requires its consumed native generation');
  const boundary=parseNativeHeroGenerationInitialized(request,line);
  if(generation.initialized&&generation.initialized.line!==line)throw Error('Generated initialization changed');
  generation.initialized=boundary;
  return prepareNativeHeroTravelDestination(world,serial,request.targetRegion,options,true,true,boundary).then(prepared=>{
    if(injectedWorlds.get(world)!==owner||hero.pending!==token||token.ending)
      throw Error('Generated arrival preparation ended');
    token.preparedArrival=prepared;token.departure.prepared=prepared;return prepared;
  });
}

// Confirm the observed native mutation separately from staging. Until this
// exact message arrives the source remains the current held save capability.
export function confirmNativeHeroTravelDeparture(world,serial,request,line){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending;
  if(!hero?.ready||!token||token.ending||token.serial!==serial||token.travelWork||
    token.departure?.result!==request||token.departure.prepared!==token.preparedArrival)
    throw Error('Native departure differs from its held staged request');
  const expected=`[frontier] Hero departure request consumed serial=${serial} source=${request.sourceRegion} target=${request.targetRegion} bytes=${request.requestSize} selected-owner-verified=1 crossing-verified=1 destination-input-verified=1 source-retired=1 phase=7 pending=0`;
  if(line!==expected)throw Error('Native departure has no matching consumed boundary');
  token.departureConsumed=true;hero.ready=false;
}

// A departed hero can resume only after the actual loaded arrival selects
// both original saved worlds. This operation cannot reacquire another tab's
// lease or replace either native save. Ending the capability drains its I/O.
export function publishNativeHeroTravelArrival(world,serial,request,readyPacket,
  {signal,storage=globalThis.navigator?.storage,boundary=async()=>{}}={}){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending;
  if(!token||token.ending||token.serial!==serial||token.travelWork||!token.departureConsumed||
    token.departure?.result!==request||typeof boundary!=='function')
    throw Error('Arrival publication requires its consumed native departure');
  const ready=parseNativeHeroArrivalReady(readyPacket),prepared=token.departure.prepared;
  if(ready.serial!==serial||ready.region!==prepared.targetRegion||ready.clock!==prepared.arrival.destinationClock||
    ready.homeAgentId!==prepared.home.agentId)throw Error('Arrival differs from its staged destination');
  if(signal&&(typeof signal.throwIfAborted!=='function'||typeof signal.addEventListener!=='function'||
    typeof signal.removeEventListener!=='function'))throw Error('Invalid arrival publication cancellation');
  signal?.throwIfAborted();const controller=new AbortController();token.travelController=controller;
  const cancel=()=>controller.abort(signal?.reason),abandoned=()=>controller.abort(token.controller.signal.reason);
  signal?.addEventListener('abort',cancel,{once:true});token.controller.signal.addEventListener('abort',abandoned,{once:true});
  function check(){if(injectedWorlds.get(world)!==owner||hero.pending!==token||token.ending||!token.departureConsumed)
    throw Error('Native arrival capability ended');controller.signal.throwIfAborted();token.controller.signal.throwIfAborted();}
  const locks={async request(name,options,consume){check();
    if(name!==owner.lock||!['shared','exclusive'].includes(options?.mode)||options.ifAvailable!==true||typeof consume!=='function')
      throw Error('Native arrival requires its injected game lease');
    const result=await consume({});check();return result;
  }};
  const binding=parseHeroRuntimeBinding(hero.receipt.runtimeBinding);
  const job=Promise.resolve().then(async()=>{try{
    check();if(!storage||typeof storage.getDirectory!=='function')throw Error('Native profile storage unavailable');
    const top=await storage.getDirectory();check();const game=await top.getDirectoryHandle('majesty');check();
    const profiles=await game.getDirectoryHandle('profile');check();
    const result=await publishNativeHeroArrivalOwner(profiles,world,{worldId:hero.config.worldId,entityId:hero.config.entityId,
      content:hero.content,ready:readyPacket,sourceRegion:prepared.sourceRegion,
      sourceAlias:{unitId:binding.unitId,agentId:binding.agentId},sourceHome:{kind:binding.homeKind,unitId:binding.homeUnitId,agentId:binding.homeAgentId},
      sourceClock:token.published.clock,sourceNativeManifest:token.published.nativeManifest,sourceOwnerManifest:token.published.ownerManifest},
      {locks,signal:controller.signal,haloLayout:'halo-v1',recovery:token.arrivalRecovery,
       onRecovery:capability=>{check();token.arrivalRecovery=capability;},
       boundary:async phase=>{check();await boundary(phase);check();}});check();
    token.arrivalPublished=result;return result;
  }finally{
    signal?.removeEventListener('abort',cancel);token.controller.signal.removeEventListener('abort',abandoned);
    if(token.travelWork===job)token.travelWork=null;if(token.travelController===controller)token.travelController=null;
  }});
  token.travelWork=job;return job;
}

// The journal acknowledgement is permission to resume, not proof that the
// original engine resumed. Rebind only after its exact fresh-actor message.
export function confirmNativeHeroTravelResume(world,serial,request,line){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending,published=token?.arrivalPublished;
  if(!hero||hero.ready||!token||token.ending||token.travelWork||token.serial!==serial||!token.departureConsumed||
    token.departure?.result!==request||!published?.haloLayout)
    throw Error('Hero resume requires its published native arrival');
  const expected=`[frontier] Hero travel resumed serial=${serial} region=${published.region} unit=${published.owner.unitId} agent=${published.owner.agentId} home=${published.home.kind}/${published.home.unitId}/${published.home.agentId} clock=${published.clock} manifest-sha256=${published.ownerManifestSha256} original-resume=1 fresh-binding=1 phase=3 pending=0`;
  if(line!==expected)throw Error('Hero resume differs from its published fresh binding');
  const old=parseHeroRuntimeBinding(hero.receipt.runtimeBinding);
  const runtimeBinding=['majesty-hero-runtime-v1',published.region,published.clock,published.owner.unitId,published.owner.agentId,
    old.description,old.playerNumber,published.home.kind,published.home.unitId,published.home.agentId,old.homeDescription,published.sha256].join('|');
  parseHeroRuntimeBinding(runtimeBinding);
  const receipt=Object.freeze({...hero.receipt,...published,runtimeBinding,
    owner:Object.freeze({...hero.receipt.owner,...published.owner,region:published.region}),
    haloBinding:selectedHeroHaloBinding(runtimeBinding,published.haloLayout)});
  const [x,y]=published.region.split('_').map(Number);
  hero.config=Object.freeze({...hero.config,region:published.region});hero.receipt=receipt;hero.pending=null;hero.ready=true;
  // Replacing the document capability revokes readers opened against the old
  // loaded world while the actual exclusive lease remains held.
  injectedWorlds.set(world,{...owner,region:{...owner.region,key:published.region,x,y,checkpoint:'Frontier_'+published.region}});
  return receipt;
}
function stageHeroTravelInput(world,serial,prepared,{signal,storage},departure){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending;
  const proxy=prepared?.arrival?.kind==='proxy-home';
  const generated=prepared?.kind==='generated'&&token?.generation?.consumed&&token.generation.initialized&&token.departureConsumed;
  if((!hero?.ready&&!generated)||!token||token.ending||token.serial!==serial||token.travelWork||
      token.preparedArrival!==prepared||(!generated&&prepared?.kind!=='saved')||(generated&&departure)||
      (proxy?!['existing','proposal'].includes(prepared.home?.kind):
        prepared.home?.kind!=='native'||prepared.arrival?.kind!=='native-home'))
    throw Error('Native hero staging requires its held prepared return');
  if(departure&&token.stagedArrival?.prepared!==prepared)
    throw Error('Native departure requires this held staged arrival');
  if(signal&&(typeof signal.throwIfAborted!=='function'||typeof signal.addEventListener!=='function'||
      typeof signal.removeEventListener!=='function'))throw Error('Invalid native hero staging cancellation');
  signal?.throwIfAborted();
  if(!generated)token.departure=null;
  if(!departure)token.stagedArrival=null;
  const controller=new AbortController();token.travelController=controller;
  const cancel=()=>controller.abort(signal?.reason),abandoned=()=>controller.abort(token.controller.signal.reason);
  signal?.addEventListener('abort',cancel,{once:true});token.controller.signal.addEventListener('abort',abandoned,{once:true});
  function check(){
    if(injectedWorlds.get(world)!==owner||hero.pending!==token||token.ending||token.preparedArrival!==prepared)
      throw Error('Native hero arrival staging ended');
    controller.signal.throwIfAborted();token.controller.signal.throwIfAborted();
  }
  const locks={async request(name,options,consume){check();
    if(name!==owner.lock||options?.mode!=='shared'||options.ifAvailable!==true)throw Error('Native hero staging requires its game lease');
    const result=await consume({});check();return result;
  }};
  const job=Promise.resolve().then(async()=>{try{
    check();if(!storage||typeof storage.getDirectory!=='function')throw Error('Native profile storage unavailable');
    const root=await storage.getDirectory();check();const game=await root.getDirectoryHandle('majesty');check();
    const profiles=await game.getDirectoryHandle('profile');check();
    const route=await openNativeHeroRouteStore(profiles,world,{worldId:hero.config.worldId,entityId:hero.config.entityId,
      contentDigest:nativeHeroContentDigest(hero.content)},{locks,signal:controller.signal});check();
    const native=new NativeRealmStore(opfsNativeRealmStorage(profiles,world,locks),{content:hero.content});
    async function validate(){
      check();await route.withOwner(async selected=>{
        check();if(selected.record.manifest!==prepared.sourceOwnerManifest||selected.entry.world.sha256!==token.published.sha256||
          selected.entry.world.size!==token.published.size||selected.owner.region!==prepared.sourceRegion||
          selected.owner.unitId!==prepared.arrival.plan.unitId||selected.owner.agentId!==prepared.arrival.plan.agentId)
          throw Error('Captured hero owner changed before input staging');
      },{signal:controller.signal});check();
      await native.withRegions([prepared.sourceRegion,prepared.targetRegion],async selected=>{
        check();if(selected.get(prepared.sourceRegion)?.record.manifest!==prepared.sourceNativeManifest||
          selected.get(prepared.targetRegion)?.record.manifest!==prepared.destinationNativeManifest)
          throw Error('Saved hero kingdoms changed before input staging');
      },{signal:controller.signal});check();
    }
    const directory=await profiles.getDirectoryHandle(nativeWorldDirectory(world));check();
    const destination=await directory.getDirectoryHandle('frontier_'+prepared.targetRegion);check();
    const folder={async getFileHandle(name,options){check();
      if(departure&&options?.create)throw Error('Native departure destination is read-only');
      if(![HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT,...(proxy?[HERO_ARRIVAL_HOME]:[])].includes(name))throw Error('Native hero staging outside its input files');
      const handle=await destination.getFileHandle(name,options);check();return handle;
    }};
    if(departure){
      const source=await directory.getDirectoryHandle('frontier_'+prepared.sourceRegion);check();
      const sourceFolder={async getFileHandle(name,options){check();
        if(name!==HERO_TRAVEL_REQUEST)throw Error('Native departure outside its request file');
        const handle=await source.getFileHandle(name,options);check();return handle;
      }};
      const result=await stageNativeHeroTravelRequest(sourceFolder,folder,token.stagedArrival.result,{check,validate});check();
      token.departure={prepared,result};return result;
    }
    const stage=proxy?stageNativeHeroProxyInput:stageNativeHeroHomeInput;
    const result=await stage(folder,{serial,sourceRegion:prepared.sourceRegion,targetRegion:prepared.targetRegion,
      sourceClock:prepared.arrival.sourceClock,destinationClock:prepared.arrival.destinationClock,
      sourceAlias:{unitId:prepared.arrival.plan.unitId,agentId:prepared.arrival.plan.agentId},
      homeAlias:{kind:proxy?'proxy':'native',unitId:proxy?0:prepared.home.unitId,agentId:prepared.home.agentId},
      ...(proxy?{homeAdmission:prepared.home.plan.admission,homeRecord:prepared.home.record,homeSha256:prepared.home.sha256}:{}),
      sourceNativeManifest:prepared.sourceNativeManifest,destinationNativeManifest:prepared.destinationNativeManifest,
      ownerManifest:prepared.sourceOwnerManifest,pack:prepared.arrival.pack,sha256:prepared.arrival.sha256},{check,validate});check();
    token.stagedArrival={prepared,result};
    return result;
  }finally{
    signal?.removeEventListener('abort',cancel);token.controller.signal.removeEventListener('abort',abandoned);
    if(token.travelWork===job)token.travelWork=null;if(token.travelController===controller)token.travelController=null;
  }});
  token.travelWork=job;return job;
}

function prepareNativeHeroTravelDestination(world,serial,target,options,requireSaved,prepareArrival=false,generatedBoundary=null){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending;
  if(!token?.crossing||!token.published?.travel?.savedActorPositionVerified)
    throw Error('Hero home preparation requires an actual verified crossing save');
  return readNativeHeroTravelDestination(world,serial,target,options,async({admission,destination,profiles,locks,check,signal})=>{
    if(!destination){
      if(requireSaved)throw Error('Generate and pause the new destination before preparing its registered home');
      return Object.freeze({...admission,home:null,sourceRetired:false,destinationActivated:false,ownerTransferred:false});
    }
    const route=await openNativeHeroRouteStore(profiles,world,{worldId:hero.config.worldId,entityId:hero.config.entityId,
      contentDigest:nativeHeroContentDigest(hero.content)},{locks,signal});check();
    const binding=parseHeroRuntimeBinding(hero.receipt.runtimeBinding);
    const registered=registeredHeroHome(route.identity);
    if(registered.record.home.region===target){
      // A visited home comes from the selected dormant journal. A native slot
      // left over from departure can still contain the old hero and roster;
      // never admit it just because its guild numeric IDs happen to match.
      return await route.withDestination(target,null,async selected=>{
        check();const [from,to]=selected.entries,h=registered.record.home;
        if(selected.record.manifest!==token.published.ownerManifest||
            from.region!==binding.region||from.alias.unitId!==binding.unitId||from.alias.agentId!==binding.agentId||
            from.world.sha256!==token.published.sha256||from.world.size!==token.published.size||
            to.world.sha256!==destination.record.sha256||to.world.size!==destination.record.size||
            to.homeAlias.kind!=='native'||to.homeAlias.unitId!==h.unitId||to.homeAlias.agentId!==h.agentId)
          throw Error('Native home return differs from the selected dormant kingdom');
        const clock=await checkpointSavedClock(selected.sources[1]);check();
        let arrival;
        if(prepareArrival){
          const prepared=await prepareSelectedHeroHomeArrival(route.identity,selected,token.crossing,{signal});check();
          const pack=prepared.pack,sha256=new Sha256().update(pack).hex();
          const plan=JSON.parse(JSON.stringify(prepared.plan));
          function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
          arrival=Object.freeze({kind:'native-home',size:pack.length,sha256,sourceClock:prepared.options.sourceClockMs,
            destinationClock:clock,plan:freeze(plan),get pack(){return Uint8Array.from(pack);}});
        }
        return Object.freeze({...admission,home:Object.freeze({kind:'native',clock,unitId:h.unitId,agentId:h.agentId,
          guildEntityId:registered.record.guildEntityId,worldId:registered.record.worldId,
          ownerManifest:selected.record.manifest,destinationSha256:to.world.sha256,destinationSize:to.world.size,
          requiresOriginalGuildArrival:true}),...(arrival?{arrival}:{}),sourceRetired:false,destinationActivated:false,ownerTransferred:false});
      },{signal});
    }
    const prepareRemote=async selected=>{
      check();if(selected.record.manifest!==token.published.ownerManifest||selected.entry.world.sha256!==token.published.sha256||
        selected.entry.world.size!==token.published.size||
        selected.owner.region!==binding.region||selected.owner.unitId!==binding.unitId||selected.owner.agentId!==binding.agentId)
        throw Error('Captured hero owner changed before home preparation');
    const nextAgentId=await checkpointNextAgentId(destination.source);check();
    const prepared=await prepareOrReuseRemoteHomeAgent(destination.source,registered,{worldId:hero.config.worldId,
      contentDigest:nativeHeroContentDigest(hero.content),destinationRegion:target,
      freshAgentId:nextAgentId});check();
    if(prepared.plan.admission==='reserve-new'&&nextAgentId>=0x7ffffffe)throw Error('Destination native agent IDs exhausted');
    const clock=await checkpointSavedClock(destination.source);check();
    const record=Uint8Array.from(prepared.record),plan=JSON.parse(JSON.stringify(prepared.plan));
    function frozen(value){if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
    let arrival;
    if(prepareArrival){
      const homeAlias={kind:'proxy',unitId:0,agentId:plan.proposedAgentId};
      async function capsule(source){
        const value=await prepareSelectedHeroNeighborArrival(route.identity,{regions:[binding.region,target],
          entries:[selected.entry,{region:target,alias:{unitId:100000,agentId:1000},homeAlias}],
          sources:[selected.source,source]},token.crossing,{signal});check();return value;
      }
      const value=plan.admission==='reserve-new'?
        await withProposedRemoteHome(destination.source,registered,prepared,async projected=>{
          const result=await capsule(projected.source);return {...result,homeProjection:projected.plan};
        },{signal,check}):await capsule(destination.source);check();
      const pack=value.pack,sha256=new Sha256().update(pack).hex();
      arrival=Object.freeze({kind:'proxy-home',size:pack.length,sha256,sourceClock:value.options.sourceClockMs,
        destinationClock:clock,plan:frozen(JSON.parse(JSON.stringify(value.plan))),
        ...(value.homeProjection?{homeProjection:value.homeProjection}:{}),get pack(){return Uint8Array.from(pack);}});
    }
    return Object.freeze({...admission,home:Object.freeze({kind:plan.admission==='reuse-existing'?'existing':'proposal',
      clock,agentId:plan.proposedAgentId,sha256:plan.recordSha256,size:record.length,plan:frozen(plan),
      get record(){return Uint8Array.from(record);}}),...(arrival?{arrival}:{}),
      sourceRetired:Boolean(generatedBoundary),destinationActivated:false,ownerTransferred:false});
    };
    if(admission.kind==='saved'&&await route.hasVisitedRegion(target,{signal})){
      check();return await route.withDestination(target,null,async selected=>{
        check();const [from,to]=selected.entries;
        if(selected.record.manifest!==token.published.ownerManifest||
            to.world.sha256!==destination.record.sha256||to.world.size!==destination.record.size)
          throw Error('Remote return differs from the selected dormant kingdom');
        const prepared=await prepareRemote({record:selected.record,entry:from,owner:selected.owner,source:selected.sources[0]});check();
        if(prepared.home.plan.admission!=='reuse-existing'||prepared.home.agentId!==to.homeAlias.agentId)
          throw Error('Remote return differs from its selected guild proxy');
        return prepared;
      },{signal});
    }
    check();return await route.withOwner(prepareRemote,{signal});
  },generatedBoundary);
}

function readNativeHeroTravelDestination(world,serial,target,{layout,signal,storage=globalThis.navigator?.storage}={},prepare,generatedBoundary=null){
  const owner=injectedWorlds.get(world),hero=owner?.hero,token=hero?.pending;
  realmFiles(target);const parts=target.split('_').map(Number);
  const generated=generatedBoundary&&token?.generation?.initialized===generatedBoundary&&token.generation.consumed&&token.departureConsumed;
  if(layout!=='halo-v1'||(!hero?.ready&&!generated)||!token||token.serial!==serial||token.ending||!token.settled||!token.published||token.travelWork||
      Math.abs(parts[0]-owner.region.x)+Math.abs(parts[1]-owner.region.y)!==1)
    throw Error('Hero travel admission requires its held published source and one neighbor');
  if(token.crossing&&target!==token.crossing.target)throw Error('Hero travel destination differs from its accepted crossing');
  if(signal&&(typeof signal.throwIfAborted!=='function'||typeof signal.addEventListener!=='function'||
      typeof signal.removeEventListener!=='function'))throw Error('Invalid hero travel cancellation');
  signal?.throwIfAborted();
  const controller=new AbortController();token.travelController=controller;
  const cancel=()=>controller.abort(signal?.reason),abandoned=()=>controller.abort(token.controller.signal.reason);
  if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
  if(token.controller.signal.aborted)abandoned();else token.controller.signal.addEventListener('abort',abandoned,{once:true});
  const lease=new CheckpointReadLease({maximum:6,signal:controller.signal,ended:'Native hero held read ended',
    bounds:'Native hero held read out of bounds',truncated:'Truncated native hero held read'});
  let active=true;
  function check(){
    if(!active||injectedWorlds.get(world)!==owner||hero.pending!==token||token.ending)throw Error('Native hero held read ended');
    lease.check();
  }
  const locks={async request(name,options,consume){check();
    if(name!==owner.lock||options?.mode!=='shared'||options.ifAvailable!==true)throw Error('Native hero held read is read-only');
    const result=await consume({});check();return result;
  }};
  const keys=[owner.region.key,target],allowed=new Set(keys.flatMap(key=>{const n=realmFiles(key);return [n.marker,...n.slots];}));
  const checked=folder=>({
    async getDirectoryHandle(name,options){check();if(options?.create)throw Error('Native hero held read is read-only');
      const result=await folder.getDirectoryHandle(name,options);check();return checked(result);},
    async getFileHandle(name,options){check();if(options?.create)throw Error('Native hero held read is read-only');
      const handle=await folder.getFileHandle(name,options);check();return {async getFile(){check();const file=await handle.getFile();check();return file;}};},
  });
  const job=Promise.resolve().then(async()=>{try{
    check();if(!storage||typeof storage.getDirectory!=='function')throw Error('Native profile storage unavailable');
    const root=await storage.getDirectory();check();const game=await root.getDirectoryHandle('majesty');check();
    const profiles=await game.getDirectoryHandle('profile');check();
    const backing=opfsNativeRealmStorage(checked(profiles),world,locks);let opens=0;
    const io={withLock:(mode,consume)=>backing.withLock(mode,consume),async open(name){check();
      if(!allowed.has(name)||++opens>6)throw Error('Native hero held read outside its pair');
      const file=await backing.open(name);check();if(file===null)return null;
      if(!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_CHECKPOINT_BYTES)
        return {size:file.size,async readAt(){throw Error('Invalid native hero held checkpoint');}};
      const reader=lease.source(file,file.size);return {size:reader.size,async readAt(at,n){check();const bytes=await reader.readAt(at,n);check();return bytes;}};
    },async atomicWrite(){throw Error('Native hero held read is read-only');}};
    const native=new NativeRealmStore(io,{content:hero.content});
    return await native.withRegions(keys,async selected=>{
      check();const source=selected.get(owner.region.key),destination=selected.get(target);
      if(!source||source.record.manifest!==token.published.nativeManifest)throw Error('Held native hero checkpoint changed before travel');
      const sourceLayout=await requireCheckpointHaloLayout(source.source,owner.region.key,layout,{signal:controller.signal});
      if(!destination){
        if(generated)throw Error('Initialized generated kingdom is missing');
        for(const name of realmFiles(target).slots)if(await io.open(name)!==null)throw Error('Neighbor has unregistered save data; its files are preserved');
        check();const admission=Object.freeze({world,serial,sourceRegion:owner.region.key,targetRegion:target,kind:'new',layout:sourceLayout,
          sourceNativeManifest:source.record.manifest,sourceOwnerManifest:token.published.ownerManifest,destinationNativeManifest:null,
          ...(token.published.travel?{travel:token.published.travel}:{})});
        if(!prepare)return admission;
        const result=await prepare({admission,destination,profiles:checked(profiles),locks,check,signal:controller.signal});
        check();return result;
      }
      const destinationLayout=await requireCheckpointHaloLayout(destination.source,target,layout,{signal:controller.signal});
      if(generated){
        const binding=parseHeroRuntimeBinding(hero.receipt.runtimeBinding);
        const initialization=await checkpointHeroGenerationInitialization(source.source,binding.unitId,token.published.clock);
        if(initialization.clock!==generatedBoundary.clock||initialization.ticks!==generatedBoundary.ticks)
          throw Error('Generated initialization differs from its captured hero scheduling');
      }
      if(generated&&(destination.record.slot!==generatedBoundary.slot||destination.record.size!==generatedBoundary.size||
        destination.record.sha256!==generatedBoundary.sha256||await checkpointSavedClock(destination.source)!==generatedBoundary.clock))
        throw Error('Generated checkpoint differs from its original initialized boundary');
      check();const admission=Object.freeze({world,serial,sourceRegion:owner.region.key,targetRegion:target,kind:generated?'generated':'saved',layout:sourceLayout,
        destinationLayout,sourceNativeManifest:source.record.manifest,sourceOwnerManifest:token.published.ownerManifest,
        destinationNativeManifest:destination.record.manifest,...(token.published.travel?{travel:token.published.travel}:{})});
      if(!prepare)return admission;
      const result=await prepare({admission,destination,profiles:checked(profiles),locks,check,signal:controller.signal});
      check();return result;
    },{signal:controller.signal});
  }finally{
    active=false;lease.revoke();signal?.removeEventListener('abort',cancel);
    token.controller.signal.removeEventListener('abort',abandoned);
    if(token.travelWork===job)token.travelWork=null;if(token.travelController===controller)token.travelController=null;
  }});
  token.travelWork=job;return job;
}

export function nativeRegionSessionMode(search){
  const query=new URLSearchParams(search),flags=query.getAll('RECOMP_RULE_FRONTIER_SESSION');
  if(!flags.length)return false;
  if(flags.length!==1||flags[0]!=='v1'||!selectedWorld(search)||!selectedRegion(search)||
      query.getAll('RECOMP_RULE_FRONTIER_SEEDED_GENERATION').join(',')!=='1'||
      query.getAll('RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN').join(',')!=='v1'||
      ['room','mode','relay','role'].some(name=>query.has(name)))
    throw new Error('Region sessions require one versioned solo world with seeded, connected terrain');
  return true;
}

// Advance only after the native session has acknowledged the exact unload and
// attach sequence. Replacing the capability owner invalidates old reads without
// releasing the document's exclusive game lease. A restored source after a
// failed destination load also completes one native trip serial.
export function advanceNativeWorldRegion(world,source,target,serial){
  nativeWorldDirectory(world);realmFiles(source);realmFiles(target);
  const owner=injectedWorlds.get(world),parts=target.split('_').map(Number);
  if(!owner?.session||owner.region.key!==source||!Number.isSafeInteger(serial)||serial!==owner.serial+1||
      Math.abs(parts[0]-owner.region.x)+Math.abs(parts[1]-owner.region.y)>1)
    throw new Error('Region activation differs from this document\'s native session');
  injectedWorlds.set(world,{...owner,serial,region:{key:target,x:parts[0],y:parts[1]}});
}

export async function withNativeWorldNeighborRead(world,key,consume,{signal,storage=globalThis.navigator?.storage}={}){
  nativeWorldDirectory(world);realmFiles(key);
  const owner=injectedWorlds.get(world),parts=key.split('_').map(Number);
  if(!owner||Math.abs(parts[0]-owner.region.x)+Math.abs(parts[1]-owner.region.y)!==1||typeof consume!=='function')
    throw new Error('Neighbor reads require this document\'s initialized world');
  let opens=0;
  const lease=new CheckpointReadLease({maximum:5,ended:'Native neighbor read lease ended',
    bounds:'Native neighbor read out of bounds',truncated:'Truncated native neighbor read',signal});
  function check(){
    if(injectedWorlds.get(world)!==owner){lease.revoke();throw new Error('Native neighbor read lease ended');}
    lease.check();
  }
  // This adapter can borrow only the already-held exact world lease, only for
  // reads, and only until consume finishes. It cannot publish a checkpoint.
  const locks={async request(name,options,fn){
    check();
    if(name!==owner.lock||options?.mode!=='shared'||options.ifAvailable!==true||typeof fn!=='function')
      throw new Error('Native neighbor capability is read-only');
    const result=await fn({});check();return result;
  }};
  function checkedDirectory(directory){return {
    async getDirectoryHandle(name,options){
      check();if(options?.create)throw new Error('Native neighbor capability is read-only');
      const next=await directory.getDirectoryHandle(name,options);check();return checkedDirectory(next);
    },
    async getFileHandle(name,options){
      check();if(options?.create)throw new Error('Native neighbor capability is read-only');
      const handle=await directory.getFileHandle(name,options);check();
      return {async getFile(){check();const file=await handle.getFile();check();return file;}};
    },
  };}
  try{
    check();
    if(!storage||typeof storage.getDirectory!=='function')throw new Error('Native profile storage unavailable');
    const root=await storage.getDirectory();check();
    const game=await root.getDirectoryHandle('majesty');check();
    const profiles=await game.getDirectoryHandle('profile');check();
    const backing=opfsNativeRealmStorage(checkedDirectory(profiles),world,locks),names=realmFiles(key),allowed=new Set([names.marker,...names.slots]);
    const io=Object.freeze({withLock:(mode,fn)=>backing.withLock(mode,fn),
      async open(name){
        check();
        if(!allowed.has(name)||++opens>5)throw new Error('Native neighbor read outside destination');
        const file=await backing.open(name);check();if(file===null)return null;
        // Even an empty orphan slot is existing save data. Keep its presence
        // visible to destination admission without leasing an invalid source.
        const size=file.size;
        if(!Number.isSafeInteger(size)||size<1||size>MAX_CHECKPOINT_BYTES)
          return Object.freeze({size,async readAt(){check();throw new Error('Invalid native neighbor checkpoint');}});
        const reader=lease.source(file,file.size);
        return Object.freeze({size:reader.size,async readAt(at,n){
          check();const bytes=await reader.readAt(at,n);check();return bytes;
        }});
      },
      async atomicWrite(){throw new Error('Native neighbor capability is read-only');},
    });
    const result=await consume(io);check();return result;
  }finally{lease.revoke();}
}

export function nativeWorldSessionConfig(search){
  nativeRegionSessionMode(search);
  nativeHeroRestoreConfig(search);
  const world=selectedWorld(search);if(!world)return null;
  const query=new URLSearchParams(search),region=selectedRegion(search),transfer=query.getAll('RECOMP_RULE_FRONTIER_TRANSFER');
  if(!region||query.has('RECOMP_PROFILE_DIR')||transfer.length>1||transfer.length===1&&transfer[0]!=='0'||
      query.has('RECOMP_BROWSER_FRONTIER_TRANSFER_CASE')||query.has('RECOMP_BROWSER_FRONTIER_TRANSFER_ACTION'))
    throw new Error('Named world startup requires a dedicated solo region');
  return Object.freeze({world,profile:nativeRealmProfilePath(world,region.key),lock:pairedLockName(nativeWorldDirectory(world))});
}

// Called before content hashing, GPU creation and native script injection.
// Hold one world lease until the document is destroyed; pagehide or a runtime
// error does not establish that native I/O and workers have actually stopped.
export async function startNativeWorldPlayer(start,{search=location.search,locks=navigator.locks,events=window,
    storage=globalThis.navigator?.storage}={}){
  if(typeof start!=='function')throw new Error('Invalid player startup');
  const config=nativeWorldSessionConfig(search);
  if(!config)return start();
  if(!locks||typeof locks.request!=='function'||!events||typeof events.addEventListener!=='function'||typeof events.removeEventListener!=='function')
    throw new Error('Native world storage locking unavailable');
  let closing=false;const hide=()=>{closing=true;};events.addEventListener('pagehide',hide);
  let rejectInjectedFailure;
  const injectedFailure=new Promise((_,reject)=>{rejectInjectedFailure=reject;});
  try{
    const lease=locks.request(config.lock,{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock)throw new Error('World storage busy; close the other game or wait for its checkpoint operation');
      if(closing)return;
      events.removeEventListener('pagehide',hide);
      let injected=false;
      const owner={lock:config.lock,region:selectedRegion(search),session:nativeRegionSessionMode(search),serial:0};
      const hero=nativeHeroRestoreConfig(search);let preparing=false,prepared=false,preparation=null,startupActive=true;
      const prepareHero=hero?async(content,{signal}={})=>{
        function check(){
          if(!startupActive||injected||closing)throw new Error('Hero restoration must finish before native injection');
          if(!signal||typeof signal.throwIfAborted!=='function')throw new Error('Hero restoration requires startup cancellation');
          signal.throwIfAborted();
        }
        check();if(preparing||prepared)throw new Error('Hero restoration already requested');preparing=true;
        const borrowed={async request(name,options,consume){
          check();if(name!==config.lock||options?.ifAvailable!==true||!['shared','exclusive'].includes(options.mode))
            throw new Error('Hero restoration requires this startup world lease');
          const result=await consume({});check();return result;
        }};
        preparation=(async()=>{try{
          if(!storage||typeof storage.getDirectory!=='function')throw new Error('Hero restore profile storage unavailable');
          const root=await storage.getDirectory();check();
          const game=await root.getDirectoryHandle('majesty');check();
          const profiles=await game.getDirectoryHandle('profile');check();
          const result=await prepareNativeHeroStartup(profiles,hero,content,{locks:borrowed,signal});
          check();owner.hero={config:hero,receipt:result,content,ready:false,serial:0,pending:null};prepared=true;return result;
        }finally{preparing=false;}})();
        return await preparation;
      }:null;
      try{await start(config.profile,()=>{
        if(hero&&(!startupActive||injected))throw new Error('Selected hero native injection already ended');
        if(hero&&!prepared)throw new Error('Selected hero owner was not prepared before native injection');
        injected=true;injectedWorlds.set(config.world,owner);
      },prepareHero);
        if(hero&&!prepared)throw new Error('Selected hero owner was not prepared before native injection');
      }
      catch(error){
        if(!injected){
          // A callback may have failed while preparation was still pending.
          // Drain that exact operation before releasing its real world lease.
          if(preparation)await preparation.catch(()=>{});
          startupActive=false;throw error;
        }
        // Report the error without unwinding the lock-owning callback.
        rejectInjectedFailure(error);
      }
      // Startup returns immediately after injection. Never release the lease
      // based on that return or a later runtime message. No polling or timers.
      await new Promise(()=>{});
    });
    return await Promise.race([lease,injectedFailure]);
  }
  finally{events.removeEventListener('pagehide',hide);}
}
