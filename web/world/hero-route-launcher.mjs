import {HeroRouteStore} from './hero-route-store.mjs';
import {readNativeHeroRouteIdentity,opfsHeroRouteStorage,requireEmptyNativeHeroRoute} from './hero-route-profile.mjs';
import {nativeWorldDirectory,opfsNativeRealmStorage} from './realm-profile.mjs';
import {savedAtlasStore} from './native-atlas.mjs';
import {realmFiles} from './realm-store.mjs';
import {pairedLockName} from './transfer-store.mjs';
import {nativeHeroContentDigest} from './hero-route-launch.mjs';
import {publishNativeHeroOwnerSave} from './hero-route-native-save.mjs';
import {prepareNativeHeroOwnerRestore} from './hero-route-restore.mjs';
import {checkpointChunks,checkpointContainerEntries,checkpointUnitAgentLinks,checkpointAgentValues,checkpointActorRecords} from './checkpoint.mjs';
import {registerCheckpointGuildHome} from './hero-home.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';
import {nativeRegionURL} from './region.mjs';
import {Sha256} from './sha256.mjs';

export const MAX_JOURNEY_HEROES=8,MAX_JOURNEY_HOMES=8,MAX_JOURNEY_GROUPS=64;
const digest=value=>new Sha256().update(new TextEncoder().encode(JSON.stringify(value))).hex();
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const origin=(world,region,content,sha256)=>digest(['majesty-browser-hero-origin-v1',world,region,content,sha256]);

function operation(profiles,world,mode,{locks=globalThis.navigator?.locks,signal}={},consume){
  const name=pairedLockName(nativeWorldDirectory(world));
  if(!profiles||typeof profiles.getDirectoryHandle!=='function'||!locks||typeof locks.request!=='function')throw Error('Hero journey storage unavailable');
  checkCheckpointReadSignal(signal);
  return locks.request(name,{mode,ifAvailable:true},async lock=>{
    if(!lock)throw Error('Close this world’s game before preparing its saved journey');
    let active=true;
    function check(){if(!active)throw Error('Hero journey operation ended');checkCheckpointReadSignal(signal);}
    const borrowed={async request(key,options,fn){
      check();if(key!==name||options?.ifAvailable!==true||!['shared','exclusive'].includes(options.mode)||
        mode==='shared'&&options.mode!=='shared'||typeof fn!=='function')throw Error('Hero journey requires its exact world lease');
      const result=await fn({});check();return result;
    }};
    try{check();return await consume({check,locks:borrowed,signal});}finally{active=false;}
  });
}

function cancellable(io,check){return {
  async withLock(mode,fn){check();const result=await io.withLock(mode,fn);check();return result;},
  async open(name){check();const file=await io.open(name);check();if(!file)return null;
    return {size:file.size,async readAt(at,n){check();const bytes=await file.readAt(at,n);check();return bytes;}};},
  async atomicWrite(name,produce){check();await io.atomicWrite(name,sink=>produce({async write(bytes){check();await sink.write(bytes);check();}}));check();},
};}

function saved(profiles,world,locks){return savedAtlasStore(opfsNativeRealmStorage(profiles,world,locks));}
function contentOf(record){const content=record.manifest.split('\n')[4];nativeHeroContentDigest(content);return content;}

export function inspectSavedHeroJourney(profiles,world,options={}){
  return operation(profiles,world,'shared',options,async({locks,signal,check})=>{
    const identity=await readNativeHeroRouteIdentity(profiles,world,{locks,signal});check();
    if(!identity)return Object.freeze({state:'unregistered',world});
    const route=new HeroRouteStore(opfsHeroRouteStorage(profiles,world,identity.entityId,locks),identity,identity.contentDigest);
    const selected=await route.read({signal});check();
    if(!selected)return Object.freeze({state:'incomplete',world,region:identity.registeredHome.home.region});
    const clock=await route.withOwner(value=>checkpointSavedClock(value.source),{signal});
    return saved(profiles,world,locks).withRegions([selected.owner.region],async regions=>{
      const current=regions.get(selected.owner.region);check();
      if(!current)throw Error('The registered journey’s native kingdom checkpoint is missing');
      const content=contentOf(current.record);
      if(nativeHeroContentDigest(content)!==identity.contentDigest)throw Error('Saved journey and kingdom require different game content');
      return Object.freeze({state:'registered',world,worldId:identity.registeredHome.worldId,entityId:identity.entityId,
        region:selected.owner.region,content,ownerManifest:selected.record.manifest,ownerClock:clock,
        nativeManifest:current.record.manifest,nativeClock:await checkpointSavedClock(current.source)});
    },{signal});
  });
}

// Return only eight choices; never retain a complete dormant world's actors.
// These are original reciprocal home memberships, not guesses by class/owner.
export function inspectHeroEnrollment(profiles,world,region,options={}){
  realmFiles(region);
  return operation(profiles,world,'shared',options,async({locks,signal,check})=>
    saved(profiles,world,locks).withRegions([region],async regions=>{
      const selected=regions.get(region);if(!selected)throw Error('Save this kingdom in Majesty before registering a journey');
      const content=contentOf(selected.record),contentDigest=nativeHeroContentDigest(content),worldId=origin(world,region,content,selected.record.sha256);
      const groups=new Set();
      for await(const entry of checkpointContainerEntries(selected.source)){
        check();if(entry.type==='group'&&entry.groupKind===100&&entry.memberCount){
          if(groups.size===MAX_JOURNEY_GROUPS&&!groups.has(entry.unitId))throw Error('This kingdom has too many home groups for journey registration');
          groups.add(entry.unitId);
        }
      }
      const homes=[];
      for await(const unit of checkpointUnitAgentLinks(selected.source)){
        check();if(groups.has(unit.unitId)&&unit.family==='BLDG'&&unit.agentId&&unit.playerNumber>=0&&unit.playerNumber<=7&&!(unit.stateFlags&4)){
          if(homes.length<MAX_JOURNEY_HOMES)homes.push({unitId:unit.unitId,agentId:unit.agentId});
        }
      }
      const choices=[];
      for(const home of homes){
        let hasMembers=false;
        for await(const value of checkpointAgentValues(selected.source,home.agentId)){
          check();if(!value.path.length&&value.attribute.toLowerCase()==='members'&&value.type===4&&value.childCount)hasMembers=true;
        }
        if(!hasMembers)continue;
        const registration=await registerCheckpointGuildHome(selected.source,{worldId,contentDigest,region,guildUnitId:home.unitId});
        for(const member of registration.members){
          if(choices.length===MAX_JOURNEY_HEROES)break;
          const actor=await checkpointActorRecords(selected.source,member.unitId);check();
          const name=actor.agent.name?.trim();
          choices.push(Object.freeze({guildUnitId:home.unitId,heroUnitId:member.unitId,playerNumber:actor.unit.playerNumber,
            name:typeof name==='string'&&name.length<=80&&!/[\x00-\x1f\x7f]/.test(name)?name:''}));
        }
        if(choices.length===MAX_JOURNEY_HEROES)break;
      }
      return Object.freeze({world,region,content,worldId,nativeManifest:selected.record.manifest,
        clock:await checkpointSavedClock(selected.source),choices:Object.freeze(choices)});
    },{signal}));
}

export function enrollHeroJourney(profiles,world,request,{locks,signal,boundary=async()=>{}}={}){
  const r=request&&{...request};
  if(!r||Object.keys(r).sort().join(',')!==['content','expectedNativeManifest','guildUnitId','heroUnitId','region'].sort().join(',')||
      ![r.guildUnitId,r.heroUnitId].every(n=>Number.isInteger(n)&&n>0&&n<=0xffffffff)||typeof r.expectedNativeManifest!=='string'||
      !r.expectedNativeManifest.length||r.expectedNativeManifest.length>511||typeof boundary!=='function')throw Error('Invalid journey registration');
  realmFiles(r.region);const contentDigest=nativeHeroContentDigest(r.content);
  return operation(profiles,world,'exclusive',{locks,signal},async({locks,check})=>
    saved(profiles,world,locks).withRegions([r.region],async regions=>{
      const selected=regions.get(r.region);check();
      if(!selected||selected.record.manifest!==r.expectedNativeManifest||contentOf(selected.record)!==r.content)
        throw Error('Saved kingdom changed; refresh the available heroes');
      for await(const _ of checkpointChunks(selected.source))check();
      const worldId=origin(world,r.region,r.content,selected.record.sha256);
      const registration=await registerCheckpointGuildHome(selected.source,{worldId,contentDigest,region:r.region,guildUnitId:r.guildUnitId});
      const member=registration.members.find(m=>m.unitId===r.heroUnitId);
      if(!member)throw Error('Selected hero no longer belongs to that home');
      const actor=await checkpointActorRecords(selected.source,r.heroUnitId);check();
      const identity={version:2,entityId:member.entityId,contentDigest,regions:[r.region,r.region==='0_0'?'1_0':'0_0'],
        actor:{family:actor.unit.family,description:actor.unit.description,playerNumber:actor.unit.playerNumber},registeredHome:registration};
      const existing=await readNativeHeroRouteIdentity(profiles,world,{locks,signal});check();
      if(!existing)await requireEmptyNativeHeroRoute(profiles,world,{locks,signal});check();
      const route=new HeroRouteStore(cancellable(opfsHeroRouteStorage(profiles,world,member.entityId,locks),check),identity,contentDigest);
      const record=await route.commit({kind:'seed',operationId:digest(['majesty-browser-hero-enrollment-v1',worldId,member.entityId]),
        expectedManifest:null,regions:[r.region],aliases:[{unitId:member.unitId,agentId:member.agentId}],
        homeAliases:[{kind:'native',unitId:registration.home.unitId,agentId:registration.home.agentId}],
        worlds:[{source:selected.source,sha256:selected.record.sha256}]},async phase=>{check();await boundary(phase);check();});
      check();return Object.freeze({world,worldId,entityId:member.entityId,region:r.region,ownerManifest:record.manifest,
        clock:await checkpointSavedClock(selected.source),idempotent:record.idempotent});
    },{signal}));
}

export function prepareSavedHeroJourney(profiles,world,request,{locks,signal}={}){
  const r=request&&{...request};
  if(!r||Object.keys(r).sort().join(',')!==['content','entityId','nativeManifest','ownerManifest','region','worldId'].sort().join(',')||
      ![r.worldId,r.entityId].every(hex)||![r.nativeManifest,r.ownerManifest].every(v=>typeof v==='string'&&v.length>0&&v.length<=4096))
    throw Error('Refresh the saved journey before preparing it');
  realmFiles(r.region);const contentDigest=nativeHeroContentDigest(r.content);
  return operation(profiles,world,'exclusive',{locks,signal},async({locks,check})=>{
    const publication=await publishNativeHeroOwnerSave(profiles,world,{worldId:r.worldId,entityId:r.entityId,content:r.content,
      region:r.region,expectedOwnerManifest:r.ownerManifest,expectedNativeManifest:r.nativeManifest,
      operationId:digest(['majesty-browser-hero-launch-save-v1',r.worldId,r.entityId,r.ownerManifest,r.nativeManifest])},{locks,signal});
    check();const preparation=await prepareNativeHeroOwnerRestore(profiles,world,{worldId:r.worldId,entityId:r.entityId,
      contentDigest,content:r.content,region:r.region,expectedOwnerManifest:publication.ownerManifest},{locks,signal});
    check();return Object.freeze({world,worldId:r.worldId,entityId:r.entityId,region:r.region,publication,preparation});
  });
}

export function heroJourneyURL(prepared,base){
  if(!prepared||!hex(prepared.worldId)||!hex(prepared.entityId))throw Error('Prepare a saved hero journey first');
  realmFiles(prepared.region);nativeWorldDirectory(prepared.world);
  const clean=new URL(base);clean.search='';clean.searchParams.set('world',prepared.world);
  const [x,y]=prepared.region.split('_').map(Number),url=nativeRegionURL(x,y,clean);
  url.searchParams.set('RECOMP_RULE_FRONTIER_HERO_RESTORE','v1');
  url.searchParams.set('hero-world',prepared.worldId);url.searchParams.set('hero-entity',prepared.entityId);
  return url;
}
