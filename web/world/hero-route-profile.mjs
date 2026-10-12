// Browser custody journals live in a dedicated directory beneath their
// named native world. All region and custody operations use the same world
// writer lock. Never borrow a live engine's lease for an offline write.
import {HERO_ROUTE_HEAD,HERO_ROUTE_IDENTITY,openHeroRouteStore,readHeroRouteIdentity} from './hero-route-store.mjs';
import {nativeWorldDirectory} from './realm-profile.mjs';
import {realmFiles} from './realm-store.mjs';
import {pairedLockName} from './transfer-store.mjs';
import {MAX_CHECKPOINT_BYTES,CHECKPOINT_PAGE_BYTES} from './checkpoint.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';

export function heroRouteDirectory(entityId){
  if(typeof entityId!=='string'||!/^[a-f0-9]{64}$/.test(entityId))throw Error('Invalid hero route directory identity');
  // The current journal binds one registered hero. Do not fork an entire
  // kingdom's save history into independent directories for different heroes.
  // A different hero must fail the stored identity check in this same world.
  return 'hero-route';
}

export function heroRouteFilename(name){
  if([HERO_ROUTE_HEAD,HERO_ROUTE_IDENTITY].includes(name))return name;
  if(typeof name!=='string'||name.length>80)throw Error('Invalid hero route filename');
  const node=/^Frontier_Hero_Route_Node_(0|[1-9][0-9]{0,9})\.json$/.exec(name);
  if(node&&Number(node[1])<=0xffffffff)return name;
  const checkpoint=/^Frontier_Hero_Route_(-?\d+_-?\d+)_([01])\.GMP$/.exec(name);
  if(checkpoint){realmFiles(checkpoint[1]);return name;}
  throw Error('Invalid hero route filename');
}

export function opfsHeroRouteStorage(profiles,world,entityId,locks=globalThis.navigator?.locks){
  heroRouteDirectory(entityId);
  return routeProfileStorage(profiles,world,locks);
}

function routeProfileStorage(profiles,world,locks){
  const root=nativeWorldDirectory(world),route='hero-route',lockName=pairedLockName(root);
  if(!profiles||typeof profiles.getDirectoryHandle!=='function'||!locks||typeof locks.request!=='function')
    throw Error('Hero route storage locking unavailable');
  let held=null;
  function check(write=false){
    if(!held||write&&held.mode!=='exclusive')throw Error('Hero route operation requires its world lock');
    return held;
  }
  async function directory(create=false){
    const owner=check(create);
    const worldFolder=await profiles.getDirectoryHandle(root,create?{create:true}:undefined);
    if(check(create)!==owner)throw Error('Hero route world lease ended');
    const folder=await worldFolder.getDirectoryHandle(route,create?{create:true}:undefined);
    if(check(create)!==owner)throw Error('Hero route world lease ended');
    return folder;
  }
  return Object.freeze({
    async withLock(mode,consume){
      if(!['shared','exclusive'].includes(mode)||typeof consume!=='function'||held)
        throw Error('Invalid or overlapping hero route operation');
      return locks.request(lockName,{mode,ifAvailable:true},async lock=>{
        if(!lock)throw Error('World storage busy; close the game or wait for its checkpoint operation');
        // Another operation on this adapter may have won while acquiring.
        if(held)throw Error('Overlapping hero route operation');
        const owner={mode};held=owner;
        try{return await consume();}finally{if(held===owner)held=null;}
      });
    },
    async open(name){
      heroRouteFilename(name);const owner=check();let file;
      try{
        const folder=await directory(),handle=await folder.getFileHandle(name);
        if(check()!==owner)throw Error('Hero route world lease ended');
        file=await handle.getFile();
      }catch(error){
        if(error.name==='NotFoundError'){
          if(check()!==owner)throw Error('Hero route world lease ended');return null;
        }
        throw error;
      }
      if(check()!==owner)throw Error('Hero route world lease ended');
      return Object.freeze({size:file.size,async readAt(at,n){
        if(check()!==owner)throw Error('Hero route world lease ended');
        if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>CHECKPOINT_PAGE_BYTES||at+n>file.size)
          throw Error('Unbounded hero route profile read');
        const bytes=new Uint8Array(await file.slice(at,at+n).arrayBuffer());
        if(check()!==owner)throw Error('Hero route world lease ended');return bytes;
      }});
    },
    async atomicWrite(name,produce){
      heroRouteFilename(name);const owner=check(true);
      if(typeof produce!=='function')throw Error('Invalid hero route writer');
      const folder=await directory(true);let handle,created=false,stream,bytesWritten=0,closing=false;
      const maximum=name.endsWith('.GMP')?MAX_CHECKPOINT_BYTES:CHECKPOINT_PAGE_BYTES;
      try{
        try{handle=await folder.getFileHandle(name);}
        catch(error){if(error.name!=='NotFoundError')throw error;
          if(check(true)!==owner)throw Error('Hero route world lease ended');
          handle=await folder.getFileHandle(name,{create:true});created=true;
        }
        if(check(true)!==owner)throw Error('Hero route world lease ended');
        stream=await handle.createWritable();
        if(check(true)!==owner)throw Error('Hero route world lease ended');
        await produce({async write(bytes){
          if(check(true)!==owner)throw Error('Hero route world lease ended');
          if(!(bytes instanceof Uint8Array)||bytes.length>CHECKPOINT_PAGE_BYTES||bytesWritten+bytes.length>maximum)
            throw Error('Unbounded hero route profile write');
          bytesWritten+=bytes.length;
          await stream.write(bytes);if(check(true)!==owner)throw Error('Hero route world lease ended');
        }});
        if(bytesWritten<(name.endsWith('.GMP')?16:1))throw Error('Empty hero route profile write');
        if(check(true)!==owner)throw Error('Hero route world lease ended');closing=true;await stream.close();
      }catch(error){
        let aborted=!stream;
        try{if(stream){await stream.abort();aborted=true;}}catch{}
        // Creating a new handle precedes its atomic stream. If production or
        // stream creation fails, retire only that new file while still owning
        // the exclusive lease; leave every pre-existing file untouched.
        // Once close starts, publication is uncertain; recovery must inspect
        // the head rather than deleting a potentially published new file.
        if(created&&!closing&&aborted&&held===owner){try{await folder.removeEntry(name);}catch{}}
        throw error;
      }
    },
  });
}

export function readNativeHeroRouteIdentity(profiles,world,{locks=globalThis.navigator?.locks,signal}={}){
  return readHeroRouteIdentity(routeProfileStorage(profiles,world,locks),{signal});
}

// A missing origin is not permission to overwrite an orphaned journal. Seed
// publishes its identity first, so legitimate interrupted seeds retain it.
export function requireEmptyNativeHeroRoute(profiles,world,{locks=globalThis.navigator?.locks,signal}={}){
  const root=nativeWorldDirectory(world),name=pairedLockName(root);
  if(!profiles||typeof profiles.getDirectoryHandle!=='function'||!locks||typeof locks.request!=='function')throw Error('Hero enrollment storage unavailable');
  const check=()=>checkCheckpointReadSignal(signal);check();
  return locks.request(name,{mode:'shared',ifAvailable:true},async lock=>{
    if(!lock)throw Error('World storage busy');
    check();
    let folder;
    try{const owned=await profiles.getDirectoryHandle(root);check();folder=await owned.getDirectoryHandle('hero-route');check();}
    catch(error){check();if(error.name==='NotFoundError')return;throw error;}
    const iterator=folder.entries()[Symbol.asyncIterator]();
    try{const first=await iterator.next();check();if(!first.done)throw Error('Hero journey has unregistered files; preserve them before registering');}
    finally{await iterator.return?.();}
  });
}

export function openNativeHeroRouteStore(profiles,world,identity,{locks=globalThis.navigator?.locks,signal}={}){
  const io=opfsHeroRouteStorage(profiles,world,identity?.entityId,locks);
  return openHeroRouteStore(io,{worldId:identity?.worldId,entityId:identity?.entityId,
    contentDigest:identity?.contentDigest,signal});
}
