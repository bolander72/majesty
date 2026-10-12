// Publish the held arrival through the same journal verifier as native journeys.
// Live callers must supply the injected game's borrowed world lease.
import {nativeWorldDirectory,opfsNativeRealmStorage} from './realm-profile.mjs';
import {NativeRealmStore,realmFiles,parseRealmManifest} from './realm-store.mjs';
import {openNativeHeroRouteStore} from './hero-route-profile.mjs';
import {heroRouteFilename} from './hero-route-profile.mjs';
import {nativeHeroContentDigest} from './hero-route-launch.mjs';
import {pairedLockName,hashCheckpointSource} from './transfer-store.mjs';
import {publishHeldNativeHeroArrival,parseNativeHeroArrivalReady,nativeHeroArrivalPublished} from './hero-travel-publication.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';
import {MAX_CHECKPOINT_BYTES} from './checkpoint.mjs';
import {Sha256} from './sha256.mjs';
import {requireCheckpointHaloLayout} from './halo-checkpoint-layout.mjs';

export const HERO_RETIRED_SNAPSHOT='Hero_Travel_Source_Retired.GMP';
export const HERO_ARRIVAL_ACK='Frontier_Hero_Travel_Published.txt';
const hash=text=>new Sha256().update(new TextEncoder().encode(text)).hex();
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
// Same-document retry capabilities retain only the verified receipt and layout,
// never checkpoint bytes, readers or file handles. Callers cannot invent one.
const recoveries=new WeakMap();

export function publishNativeHeroArrivalOwner(profiles,world,request,
 {locks=globalThis.navigator?.locks,signal,boundary=async()=>{},haloLayout,recovery,onRecovery=()=>{}}={}){
 const r=request&&{...request,sourceAlias:{...request.sourceAlias},sourceHome:{...request.sourceHome}};
 const fields=['worldId','entityId','content','ready','sourceRegion','sourceAlias','sourceHome','sourceClock',
  'sourceNativeManifest','sourceOwnerManifest'];
 if(!r||Object.keys(r).sort().join(',')!==fields.sort().join(',')||![r.worldId,r.entityId].every(digest)||
  !Number.isInteger(r.sourceClock)||r.sourceClock<0||r.sourceClock>0xffffffff||
  !profiles||typeof profiles.getDirectoryHandle!=='function'||!locks||typeof locks.request!=='function'||typeof boundary!=='function'||typeof onRecovery!=='function'||
  haloLayout!==undefined&&haloLayout!=='halo-v1')
  throw Error('Invalid native arrival publication');
 const ready=parseNativeHeroArrivalReady(r.ready),sourceFiles=realmFiles(r.sourceRegion),targetFiles=realmFiles(ready.region);
 const [sx,sy]=r.sourceRegion.split('_').map(Number),[tx,ty]=ready.region.split('_').map(Number);
 if(Math.abs(sx-tx)+Math.abs(sy-ty)!==1)throw Error('Arrival publication requires its adjacent source');
 const sourceRecord=parseRealmManifest(r.sourceNativeManifest,r.content);
 nativeHeroArrivalPublished(r.ready,r.sourceOwnerManifest);
 const contentDigest=nativeHeroContentDigest(r.content),root=nativeWorldDirectory(world),lockName=pairedLockName(root);
 const identity=hash(JSON.stringify([world,haloLayout??null,...fields.map(key=>r[key])])),prior=recoveries.get(recovery);
 if(recovery!==undefined&&(!prior||prior.identity!==identity))throw Error('Arrival recovery differs from its verified request');
 checkCheckpointReadSignal(signal);
 return locks.request(lockName,{mode:'exclusive',ifAvailable:true},async lock=>{
  if(!lock)throw Error('Native arrival requires its held world lease');
  let active=true;
  function check(){if(!active)throw Error('Native arrival publication ended');checkCheckpointReadSignal(signal);}
  const borrowed={async request(name,options,consume){check();
   if(name!==lockName||!['shared','exclusive'].includes(options?.mode)||options.ifAvailable!==true||typeof consume!=='function')
    throw Error('Native arrival requires its exact world lease');
   const result=await consume({});check();return result;
  }};
  // Reads stay within the saved pair and journal. Only journal state and the
  // one destination acknowledgement may be written; native slots are read-only.
  function directory(backing,parts=[]){return {
   async getDirectoryHandle(name,options){check();const next=[...parts,name];
    const journal=next.length===2&&next[0]===root&&next[1]==='hero-route';
    const native=[r.sourceRegion,ready.region].some(key=>{
     const path=[root,'frontier_'+key,'Documents','My Games','MajestyHD','SaveGame'];
     return next.length<=path.length&&next.every((v,i)=>v===path[i]);
    });
    if(!journal&&!native||options?.create&&!(journal||next.length===1))throw Error('Arrival directory outside its saved pair');
    const value=await backing.getDirectoryHandle(name,options);check();return directory(value,next);
   },
   async getFileHandle(name,options){check();const journal=parts.length===2&&parts[1]==='hero-route';
    const source=parts[1]==='frontier_'+r.sourceRegion,target=parts[1]==='frontier_'+ready.region;
    const ack=parts.length===2&&target&&name===HERO_ARRIVAL_ACK;
    if(journal){heroRouteFilename(name);
     if(name.endsWith('.GMP')&&![r.sourceRegion,ready.region].some(key=>name.startsWith('Frontier_Hero_Route_'+key+'_')))
      throw Error('Arrival journal write outside its saved pair');
    }else if(!(ack||parts.length===2&&(source&&name===sourceFiles.marker||target&&name===targetFiles.marker)||
     parts.length===6&&(source&&(sourceFiles.slots.includes(name)||name===HERO_RETIRED_SNAPSHOT)||target&&targetFiles.slots.includes(name)))||
     options?.create&&!ack)throw Error('Arrival file outside its saved pair');
    const handle=await backing.getFileHandle(name,options);check();return {
     async getFile(){check();const file=await handle.getFile();check();return {
      size:file.size,slice(at,end){check();if(!Number.isSafeInteger(at)||!Number.isSafeInteger(end)||at<0||end<at||end>file.size||end-at>4096)
       throw Error('Unbounded arrival read');const part=file.slice(at,end);return {async arrayBuffer(){check();const bytes=await part.arrayBuffer();check();return bytes;}};},
     };},
     async createWritable(){check();if(!journal&&!ack)throw Error('Arrival cannot write a native checkpoint');
      const stream=await handle.createWritable();let total=0;
      try{check();}catch(error){await stream.abort().catch(()=>{});throw error;}
      return {async write(bytes){check();if(!(bytes instanceof Uint8Array)||bytes.length>4096||
        total+bytes.length>(name.endsWith('.GMP')?MAX_CHECKPOINT_BYTES:ack?512:4096))throw Error('Unbounded arrival write');
       total+=bytes.length;await stream.write(bytes);check();},
       async close(){check();await stream.close();check();},async abort(){await stream.abort();}};
     },
    };
   },
   async removeEntry(name){check();if(parts.length!==2||parts[1]!=='hero-route')throw Error('Arrival cannot remove native files');
    heroRouteFilename(name);await backing.removeEntry(name);check();},
  };}
  return (async()=>{try{
   const scoped=directory(profiles),route=await openNativeHeroRouteStore(scoped,world,
    {worldId:r.worldId,entityId:r.entityId,contentDigest},{locks:borrowed,signal});check();
   const folder=await scoped.getDirectoryHandle(root),target=await folder.getDirectoryHandle('frontier_'+ready.region);
   async function matchingAcknowledgement(published){
    const bytes=new TextEncoder().encode(published.acknowledgement);let previous;
    try{const old=await (await target.getFileHandle(HERO_ARRIVAL_ACK)).getFile();
     if(old.size===bytes.length)previous=new Uint8Array(await old.slice(0,old.size).arrayBuffer());}
    catch(error){if(error?.name!=='NotFoundError')throw error;}check();
    return previous?.length===bytes.length&&previous.every((v,i)=>v===bytes[i]);
   }
   if(prior){
    // Close may have published the acknowledgement before reporting failure.
    // The engine can then resume and overwrite its native marker at the next
    // crossing. Authenticate the already selected journal and exact receipt;
    // do not rewrite native state or issue another permission to resume.
    const recovered=await route.withDestination(r.sourceRegion,null,async selected=>{
     check();if(selected.record.manifest!==prior.result.ownerManifest)throw Error('Arrival recovery owner changed');
     if(selected.entries[0].world.sha256!==ready.sha256||selected.entries[0].world.size!==ready.size||
        selected.entries[1].world.sha256!==prior.retiredDigest||selected.entries[1].world.size!==prior.retiredSize)
      throw Error('Arrival recovery saved pair changed');
     return matchingAcknowledgement(prior.result);
    },{signal});check();
    if(recovered)return Object.freeze({...prior.result,idempotent:true,acknowledgementWritten:false,
     acknowledgementUnchanged:true,recoveredAcknowledgement:true});
   }
   const native=new NativeRealmStore(opfsNativeRealmStorage(scoped,world,borrowed),{content:r.content});
   const source=await folder.getDirectoryHandle('frontier_'+r.sourceRegion);
   let saves=source;for(const name of ['Documents','My Games','MajestyHD','SaveGame'])saves=await saves.getDirectoryHandle(name);
   const file=await (await saves.getFileHandle(HERO_RETIRED_SNAPSHOT)).getFile();check();
   if(!Number.isSafeInteger(file.size)||file.size<16||file.size>MAX_CHECKPOINT_BYTES)throw Error('Invalid retired arrival snapshot');
   const retired={size:file.size,async readAt(at,n){check();const bytes=new Uint8Array(await file.slice(at,at+n).arrayBuffer());check();
    if(bytes.length!==n)throw Error('Truncated retired arrival snapshot');return bytes;}};
   const retiredDigest=await hashCheckpointSource(retired);check();
   async function verifyNative(consume){return native.withRegions([r.sourceRegion,ready.region],async regions=>{
    check();const captured=regions.get(r.sourceRegion),incoming=regions.get(ready.region);
    if(!captured||captured.record.manifest!==r.sourceNativeManifest||!incoming||incoming.record.size!==ready.size||incoming.record.sha256!==ready.sha256)
     throw Error('Native arrival saved pair changed');
    return consume(incoming);
   },{signal});}
   let verifiedLayout;
   const published=await verifyNative(async incoming=>{
    if(haloLayout)verifiedLayout=await requireCheckpointHaloLayout(incoming.source,ready.region,haloLayout,{signal});check();
    return publishHeldNativeHeroArrival(route,{
    ready:r.ready,operationId:hash(JSON.stringify(['majesty-browser-held-arrival-v1',r.ready,r.sourceOwnerManifest,retiredDigest])),
    expectedManifest:r.sourceOwnerManifest,sourceRegion:r.sourceRegion,sourceAlias:r.sourceAlias,sourceHome:r.sourceHome,
    sourceClock:r.sourceClock,capturedSha256:sourceRecord.sha256,
    retiredSource:{source:retired,sha256:retiredDigest},activeSource:{source:incoming.source,sha256:incoming.record.sha256}},
    {signal,boundary:async phase=>{check();await boundary(phase);check();}});
   });check();
   // Reopen the actual native markers after commit and any fault boundary.
   // A valid journal alone cannot acknowledge a changed loaded checkpoint.
   const nativeManifest=await verifyNative(incoming=>incoming.record.manifest);check();
   await route.withOwner(async selected=>{check();if(selected.record.manifest!==published.ownerManifest)
    throw Error('Published arrival owner changed before acknowledgement');},{signal});check();
   const result=Object.freeze({...published,nativeManifest,size:ready.size,sha256:ready.sha256,...(verifiedLayout?{haloLayout:verifiedLayout}:{})});
   const capability=Object.freeze({});recoveries.set(capability,{identity,result,retiredDigest,retiredSize:file.size});onRecovery(capability);check();
   if(await matchingAcknowledgement(result))
    return Object.freeze({...result,acknowledgementWritten:false,acknowledgementUnchanged:true});
   const bytes=new TextEncoder().encode(published.acknowledgement);
   const handle=await target.getFileHandle(HERO_ARRIVAL_ACK,{create:true});check();const stream=await handle.createWritable();
   try{check();await stream.write(bytes);check();await stream.close();check();}
   catch(error){await stream.abort().catch(()=>{});throw error;}
   return Object.freeze({...result,acknowledgementWritten:true,acknowledgementUnchanged:false});
  }finally{active=false;}})();
 });
}
