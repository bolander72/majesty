import {withNativeWorldNeighborRead} from './realm-session.mjs';
import {NativeRealmStore,realmFiles} from './realm-store.mjs';
import {checkpointChunks} from './checkpoint.mjs';

// Admission before asking the native game to save/depart. Absence of a marker
// alone never makes an existing unregistered slot safe to generate over.
export function checkNativeDestination(world,key,{content,signal,storage}={}){
  return withNativeWorldNeighborRead(world,key,async io=>{
    const store=new NativeRealmStore(io,{content}),names=realmFiles(key);
    return store.withRegions([key],async selected=>{
      const value=selected.get(key);
      if(!value){
        for(const name of names.slots)if(await io.open(name)!==null)
          throw new Error('Neighbor has unregistered save data; its files are preserved');
        return Object.freeze({key,kind:'new'});
      }
      // Validate the pinned VERS header and every root boundary with bounded
      // reads. Native loading still owns semantic validation of saved objects.
      for await(const _ of checkpointChunks(value.source)){}
      return Object.freeze({key,kind:'saved'});
    },{signal});
  },{signal,storage});
}
