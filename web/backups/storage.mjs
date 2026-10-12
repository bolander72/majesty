import {databaseKind,validateDatabase,createBundle,inspectBundle,MAX_METADATA,safePath,PAGE} from './bundle.mjs';

function missing(error){return error?.name==='NotFoundError';}
async function directory(root,parts,create=false){
  let dir=root; for(const part of parts)dir=await dir.getDirectoryHandle(part,{create}); return dir;
}
async function optionalDirectory(root,parts){try{return await directory(root,parts);}catch(error){if(missing(error))return null;throw error;}}
async function* files(dir,prefix=''){
  if(!dir)return;
  for await(const [name,handle] of dir.entries()) {
    const path=safePath(prefix+name);
    if(handle.kind==='directory')yield*files(handle,path+'/');
    else yield {path,file:await handle.getFile()};
  }
}
function openExisting(storage,name){return new Promise((resolve,reject)=>{
  const request=storage.open(name); let absent=false;
  request.onupgradeneeded=()=>{absent=true;request.transaction.abort();};
  request.onerror=()=>reject(absent?Error('Save database changed during backup.'):request.error);
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
  request.onblocked=()=>reject(Error('Close older campaign and Atlas tabs.'));
});}
async function snapshot(storage,name){
  const db=await openExisting(storage,name);
  try{
    const kind=databaseKind(name),store=kind==='campaign'?'chapters':'regions';
    if(db.version!==1 || db.objectStoreNames.length!==1 || !db.objectStoreNames.contains(store))throw Error('Unsupported save database schema.');
    const rows=await new Promise((resolve,reject)=>{
      const transaction=db.transaction(store,'readonly'), result=[]; let bytes=0, failure;
      const request=transaction.objectStore(store).openCursor();
      request.onsuccess=()=>{
        const cursor=request.result; if(!cursor)return;
        const row=[cursor.key,cursor.value]; bytes+=new TextEncoder().encode(JSON.stringify(row)).length;
        if(result.length>=50000 || bytes>MAX_METADATA-1024){failure=Error('Atlas metadata exceeds the backup limit.');transaction.abort();return;}
        result.push(row);cursor.continue();
      };
      transaction.oncomplete=()=>resolve(result);
      transaction.onabort=()=>reject(failure||transaction.error||Error('Save database read failed.'));
    });
    return validateDatabase({name,version:1,store,rows});
  }finally{db.close();}
}
function createDatabase(storage,data,onCreated){return new Promise((resolve,reject)=>{
  const request=storage.open(data.name,1); let created=false;
  request.onupgradeneeded=()=>{created=true;request.result.createObjectStore(data.store);};
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(Error('Close older campaign and Atlas tabs before restoring.'));
  request.onsuccess=async()=>{
    const db=request.result;
    if(!created){db.close();reject(Error('A save database appeared during restore.'));return;}
    try{await onCreated();}catch(error){db.close();reject(error);return;}
    const transaction=db.transaction(data.store,'readwrite');
    for(const [key,value] of data.rows)transaction.objectStore(data.store).put(value,key);
    transaction.oncomplete=()=>{db.close();resolve();};
    transaction.onabort=()=>{db.close();reject(transaction.error||Error('Save database restore failed.'));};
  };
});}
function deleteDatabase(storage,name){return new Promise((resolve,reject)=>{
  const r=storage.deleteDatabase(name);r.onsuccess=resolve;r.onerror=()=>reject(r.error);
  r.onblocked=()=>reject(Error('Close campaign and Atlas tabs to discard the interrupted restore.'));
});}
async function knownDatabases(storage){
  if(typeof storage?.databases!=='function')throw Error('This browser cannot enumerate complete campaign and Atlas backups.');
  return (await storage.databases()).filter(db=>{
    try{databaseKind(db.name);return true;}catch{return false;}
  }).map(db=>db.name).sort();
}
async function locked(locks,names,consume){
  if(!locks?.request)throw Error('Save backup locking is unavailable.');
  const ordered=[...new Set(['majesty-player-backup',...names])].sort();
  async function next(at){
    if(at===ordered.length)return consume();
    return locks.request(ordered[at],{mode:'exclusive',ifAvailable:true},lock=>{
      if(!lock)throw Error('Close Majesty games and Atlas tabs before backing up or restoring saves.');
      return next(at+1);
    });
  }
  return next(0);
}
async function lockNames(profile,databases){
  const names=['majesty-native-profile:majesty:',...databases];
  if(profile)for await(const [name,handle] of profile.entries())if(handle.kind==='directory'){
    names.push('majesty-native-profile:majesty:'+name);
    if(/^[a-zA-Z0-9_-]{1,80}$/.test(name))names.push('majesty-pair-'+name);
  }
  return names;
}
function incomingLocks(bundle){
  const names=['majesty-native-profile:majesty:',...bundle.manifest.databases.map(r=>r.name)];
  for(const record of bundle.manifest.native){
    const top=record.path.split('/')[0];names.push('majesty-native-profile:majesty:'+top);
    if(/^[a-zA-Z0-9_-]{1,80}$/.test(top))names.push('majesty-pair-'+top);
  }
  return names;
}
const MARKER='.player-restore-v1.json';
const CACHE='.player-backup-download';
function validMarker(record){
  if(record?.format!=='majesty-player-restore-v1' || !Array.isArray(record.databases) || record.databases.length>256 ||
      new Set(record.databases).size!==record.databases.length || !Array.isArray(record.createdDatabases) ||
      record.createdDatabases.length>256 || new Set(record.createdDatabases).size!==record.createdDatabases.length ||
      record.createdDatabases.some(n=>!record.databases.includes(n)) || typeof record.profileCreated!=='boolean')throw Error('Invalid restore recovery marker.');
  record.databases.forEach(databaseKind);return record;
}
async function pending(game){
  try{const file=await(await game.getFileHandle(MARKER)).getFile();if(file.size>65536)throw Error('Invalid restore recovery marker.');return validMarker(JSON.parse(await file.text()));}
  catch(error){if(missing(error))return null;throw error;}
}
export async function assertNoPlayerRestore(storage=globalThis.navigator.storage){
  const root=await storage.getDirectory(),game=await optionalDirectory(root,['majesty']);
  if(game && await pending(game))throw Error('A player backup restore was interrupted. Open Player backups to finish recovery before launching a game.');
}
export async function exportPlayer({root,storage=globalThis.indexedDB,locks=globalThis.navigator?.locks,signal}={}){
  root??=await navigator.storage.getDirectory(); const game=await optionalDirectory(root,['majesty']);
  if(game && await pending(game))throw Error('Recover the interrupted restore before exporting.');
  const profile=game?await optionalDirectory(game,['profile']):null, names=await knownDatabases(storage);
  return locked(locks,await lockNames(profile,names),async()=>{
    async function* databases(){for(const name of names){signal?.throwIfAborted();yield await snapshot(storage,name);}}
    const owner=game??await directory(root,['majesty'],true);
    if(await optionalDirectory(owner,[CACHE]))throw Error('A completed backup is still cached. Finish its download, then clear the temporary copy before exporting again.');
    const cache=await owner.getDirectoryHandle(CACHE,{create:true});let output,index;
    try{
      const archive=await cache.getFileHandle('player.zip',{create:true}),indexFile=await cache.getFileHandle('index.bin',{create:true});
      output=await archive.createWritable();index=await indexFile.createWritable();let closed=false;
      const central={write:bytes=>index.write(bytes),async*chunks(){
        await index.close();closed=true;const file=await indexFile.getFile();
        for(let at=0;at<file.size;at+=PAGE)yield new Uint8Array(await file.slice(at,at+PAGE).arrayBuffer());
      }};
      const result=await createBundle(files(profile),databases(),{signal,output,central});
      await output.close();if(!closed)await index.close();await cache.removeEntry('index.bin');
      return {...result,blob:await archive.getFile()};
    }catch(error){await output?.abort().catch(()=>{});await index?.abort().catch(()=>{});await owner.removeEntry(CACHE,{recursive:true}).catch(()=>{});throw error;}
  });
}
export async function clearBackupDownload({root,locks=globalThis.navigator?.locks}={}){
  root??=await navigator.storage.getDirectory();
  return locked(locks,[],async()=>{
    const game=await optionalDirectory(root,['majesty']);if(!game)return false;
    if(!await optionalDirectory(game,[CACHE]))return false;
    await game.removeEntry(CACHE,{recursive:true});return true;
  });
}
export async function restorePlayer(file,{root,storage=globalThis.indexedDB,locks=globalThis.navigator?.locks,signal}={}){
  // Hash and validate the entire archive before accessing a writable destination.
  const bundle=await inspectBundle(file,{signal,retainDatabases:false}); root??=await navigator.storage.getDirectory();
  return locked(locks,incomingLocks(bundle),async()=>{
    const game=await directory(root,['majesty'],true);
    if(await pending(game))throw Error('Recover the interrupted restore first.');
    const profile=await optionalDirectory(game,['profile']);
    if(profile)for await(const _ of profile.entries())throw Error('This browser already has native save data. Restore in a fresh browser save collection; existing saves will not be overwritten.');
    const existing=new Set(await knownDatabases(storage));
    if(bundle.databases.some(db=>existing.has(db.name)))throw Error('A campaign or Atlas database already exists. Existing progress will not be overwritten.');
    // A durable marker blocks player startup after interruption. Only an empty
    // native collection and newly created databases are ever removed on rollback.
    const record={format:'majesty-player-restore-v1',databases:bundle.databases.map(db=>db.name),createdDatabases:[],profileCreated:!profile};
    async function publishMarker(){const marker=await (await game.getFileHandle(MARKER,{create:true})).createWritable();await marker.write(JSON.stringify(record));await marker.close();}
    await publishMarker();
    try{
      const target=profile??await game.getDirectoryHandle('profile',{create:true});
      for(const item of bundle.manifest.native){
        signal?.throwIfAborted(); const parts=item.path.split('/'), parent=await directory(target,parts.slice(0,-1),true);
        const sink=await (await parent.getFileHandle(parts.at(-1),{create:true})).createWritable();
        try{await bundle.copyNative(item,sink);await sink.close();}catch(error){await sink.abort().catch(()=>{});throw error;}
      }
      for(const item of bundle.manifest.databases){
        signal?.throwIfAborted();const data=await bundle.readDatabase(item);
        await createDatabase(storage,data,async()=>{record.createdDatabases.push(data.name);await publishMarker();});
      }
      await game.removeEntry(MARKER);return {nativeCount:bundle.nativeCount,databaseCount:bundle.databaseCount};
    }catch(error){
      try{await rollback(game,record,storage);await game.removeEntry(MARKER);}catch{throw Error('Restore was interrupted. Existing saves were preserved; use Discard interrupted restore before playing.');}
      throw error;
    }
  });
}
async function rollback(game,record,storage){
  validMarker(record);
  for(const name of record.createdDatabases)await deleteDatabase(storage,name);
  const profile=await optionalDirectory(game,['profile']);
  if(profile){
    if(record.profileCreated)await game.removeEntry('profile',{recursive:true});
    else for await(const [name] of profile.entries())await profile.removeEntry(name,{recursive:true});
  }
}
export async function discardInterruptedRestore({root,storage=globalThis.indexedDB,locks=globalThis.navigator?.locks}={}){
  root??=await navigator.storage.getDirectory();const game=await optionalDirectory(root,['majesty']);
  if(!game)return false;const record=await pending(game);if(!record)return false;
  return locked(locks,['majesty-native-profile:majesty:',...record.databases],async()=>{
    await rollback(game,record,storage);await game.removeEntry(MARKER);return true;
  });
}
