// Path adapter for stopped snapshots from the pinned MajestyHD serializer.
// Every writer must hold the world lease; legacy game pages must be stopped.
import {realmFiles,opfsRealmStorage} from './realm-store.mjs';
import {worldName} from './world-name.mjs';

export function nativeWorldDirectory(world){
  return 'native-world-'+worldName(world);
}
export function nativeRealmProfilePath(world,key){
  realmFiles(key);
  return nativeWorldDirectory(world)+'/frontier_'+key;
}
export function nativeRealmRelativePath(name){
  const match=typeof name==='string'&&name.length<=64&&/^Frontier_(-?\d+_-?\d+)(?:_Recovery)?\.(?:GMP|checkpoint)$/.exec(name);
  if(!match)throw new Error('Invalid native realm filename');
  const key=match[1],files=realmFiles(key);
  if(name!==files.marker&&!files.slots.includes(name))throw new Error('Invalid native realm filename');
  return ['frontier_'+key,...(name===files.marker?[]:['Documents','My Games','MajestyHD','SaveGame']),name];
}

export function opfsNativeRealmStorage(profiles,world,locks=typeof navigator==='undefined'?null:navigator.locks){
  const directory=nativeWorldDirectory(world);
  if(!profiles||typeof profiles.getDirectoryHandle!=='function')throw new Error('Native profile storage unavailable');
  // Resolve only the requested region; neither reads nor construction create
  // directories. No fallback to the personal root or old flat realm storage.
  const mapped={async getFileHandle(name,options){
    const parts=[directory,...nativeRealmRelativePath(name)],create=options?.create===true;
    let current=profiles;
    for(const part of parts.slice(0,-1))current=await current.getDirectoryHandle(part,create?{create:true}:undefined);
    return current.getFileHandle(parts.at(-1),create?{create:true}:undefined);
  }};
  return opfsRealmStorage(mapped,world,locks);
}
