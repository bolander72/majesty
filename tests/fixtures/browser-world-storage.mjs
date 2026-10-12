// Controlled OPFS/Web Locks for bounded custody-to-region preparation tests.
import assert from 'node:assert/strict';
import {fixture,source,hash} from './registered-hero-world.mjs';
import {HeroRouteStore} from '../../web/world/hero-route-store.mjs';
import {opfsHeroRouteStorage,heroRouteDirectory} from '../../web/world/hero-route-profile.mjs';
import {NativeRealmStore} from '../../web/world/realm-store.mjs';
import {opfsNativeRealmStorage,nativeRealmRelativePath} from '../../web/world/realm-profile.mjs';
import {registerCheckpointGuildHome} from '../../web/world/hero-home.mjs';
import {nativeHeroContentDigest} from '../../web/world/hero-route-launch.mjs';

let serial=0;
export async function browserWorldStorage({browserContent=false}={}){
  const f=await fixture(),world='restore-'+(++serial),files=new Map(),folders=new Set(['']),calls=[];
  const content='a'.repeat(64)+':'+'b'.repeat(64);
  if(browserContent){
    const contentDigest=nativeHeroContentDigest(content),registration=await registerCheckpointGuildHome(source(f.worlds[0]),
      {worldId:f.identity.registeredHome.worldId,contentDigest,region:'0_0',guildUnitId:469});
    f.identity={...f.identity,entityId:registration.members[0].entityId,contentDigest,registeredHome:registration};
    f.registration=registration;
  }
  let held=false;
  const missing=()=>Object.assign(Error('missing'),{name:'NotFoundError'});
  function directory(prefix){return {
    async *entries(){
      for(const name of folders)if(name.startsWith(prefix+'/')&&!name.slice(prefix.length+1).includes('/'))yield [name.slice(prefix.length+1),{kind:'directory'}];
      for(const name of files.keys())if(name.startsWith(prefix+'/')&&!name.slice(prefix.length+1).includes('/'))yield [name.slice(prefix.length+1),{kind:'file'}];
    },
    async getDirectoryHandle(name,options){
      const path=prefix?prefix+'/'+name:name;calls.push({directory:path,create:!!options?.create});
      if(!folders.has(path)){if(!options?.create)throw missing();folders.add(path);}return directory(path);
    },
    async getFileHandle(name,options){
      const path=prefix+'/'+name;calls.push({file:path,create:!!options?.create});
      if(!files.has(path)){if(!options?.create)throw missing();files.set(path,Buffer.alloc(0));}
      return {async getFile(){const bytes=Buffer.from(files.get(path));return {size:bytes.length,slice(at,end){
        calls.push({read:path,n:end-at});return {async arrayBuffer(){return Uint8Array.from(bytes.subarray(at,end)).buffer;}};
      }};},async createWritable(){let parts=[];return {
        async write(bytes){calls.push({write:path,n:bytes.length});parts.push(Buffer.from(bytes));},
        async close(){files.set(path,Buffer.concat(parts));parts=[];calls.push({close:path});},
        async abort(){parts=[];calls.push({abort:path});},
      };}};
    },
    async removeEntry(name){files.delete(prefix+'/'+name);calls.push({remove:prefix+'/'+name});},
  };}
  const profiles=directory(''),locks={async request(name,options,consume){
    calls.push({lock:name,...options});if(held)return consume(null);
    held=true;try{return await consume({});}finally{held=false;}
  }};
  const route=new HeroRouteStore(opfsHeroRouteStorage(profiles,world,f.identity.entityId,locks),f.identity,f.identity.contentDigest);
  const bytes=f.worlds[0],seed={kind:'seed',operationId:'1'.padStart(64,'0'),expectedManifest:null,regions:['0_0'],
    aliases:[{unitId:502,agentId:27}],homeAliases:[{kind:'native',unitId:469,agentId:7}],
    worlds:[{source:source(bytes),sha256:hash(bytes)}]};
  const head=await route.commit(seed);
  const request={worldId:f.identity.registeredHome.worldId,entityId:f.identity.entityId,contentDigest:f.identity.contentDigest,
    expectedOwnerManifest:head.manifest,region:'0_0',content};
  const realms=new NativeRealmStore(opfsNativeRealmStorage(profiles,world,locks),{content});
  const nativePath=name=>['native-world-'+world,...nativeRealmRelativePath(name)].join('/');
  const routePrefix='native-world-'+world+'/'+heroRouteDirectory(f.identity.entityId)+'/';
  const snapshot=()=>new Map([...files].filter(([name])=>name.startsWith(routePrefix)).map(([name,b])=>[name,Buffer.from(b)]));
  function putNative(name,bytes){
    const path=nativePath(name),parts=path.split('/');
    for(let i=1;i<parts.length;i++)folders.add(parts.slice(0,i).join('/'));files.set(path,Buffer.from(bytes));
  }
  return {...f,world,files,folders,calls,profiles,locks,route,realms,head,request,nativePath,routePrefix,snapshot,putNative,
    busy(value){held=value;},assertBounded(){assert.ok(calls.filter(c=>c.read||c.write).every(c=>c.n<=4096));}};
}
