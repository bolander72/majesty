// Destination discovery for dormant solo kingdoms. Only a page of metadata is
// returned; GMP bodies are validated by the normal terrain/game loader later.
import {worldName} from './world-name.mjs';
import {nativeWorldDirectory,opfsNativeRealmStorage} from './realm-profile.mjs';
import {realmFiles,parseRealmManifest} from './realm-store.mjs';

export const MAX_CATALOG_ITEMS=8,MAX_CATALOG_SCAN=128;
const unavailable=key=>({key,...coordinates(key),state:'unavailable'});
function coordinates(key){const [x,y]=key.split('_').map(Number);return {x,y};}
export class NativeRealmCatalog {
  #profiles;#world;#io;#iterator=null;#done=false;#busy=false;#faulted=false;
  #closed=false;#closing=null;#operation=null;
  constructor(profiles,world,{locks}={}){
    this.#world=worldName(world);this.#profiles=profiles;
    this.#io=opfsNativeRealmStorage(profiles,world,locks);
  }
  #requireOpen(){if(this.#closed)throw new Error('Saved kingdom list closed');}
  #start(){
    this.#requireOpen();
    if(this.#busy)throw new Error('Saved kingdom list busy');
    this.#busy=true;let settle;
    this.#operation=new Promise(resolve=>{settle=resolve;});
    return ()=>{this.#busy=false;this.#operation=null;settle();};
  }
  close(){
    if(this.#closing)return this.#closing;
    this.#closed=true;
    const operation=this.#operation;
    this.#closing=(async()=>{
      await operation;
      try{await this.#iterator?.return?.();}
      finally{this.#iterator=null;this.#profiles=null;this.#io=null;this.#done=true;}
    })();
    return this.#closing;
  }
  async reset(){
    const finish=this.#start();this.#faulted=true;
    try{
      // Close a suspended iterator where supported, including its resource
      // cleanup. No next() call remains in flight; never retain old pages.
      await this.#iterator?.return?.();
      this.#iterator=null;this.#requireOpen();this.#done=false;this.#faulted=false;
    }finally{finish();}
  }
  async #entry(key){
    this.#requireOpen();
    const names=realmFiles(key),marker=await this.#io.open(names.marker);
    this.#requireOpen();
    if(marker===null)return null;
    if(!Number.isSafeInteger(marker.size)||marker.size<1||marker.size>511)return unavailable(key);
    const bytes=await marker.readAt(0,marker.size);
    this.#requireOpen();
    if(!(bytes instanceof Uint8Array)||bytes.length!==marker.size||bytes.some(b=>b!==10&&(b<32||b>126)))return unavailable(key);
    const text=new TextDecoder().decode(bytes),content=text.split('\n')[4];let record;
    try{record=parseRealmManifest(text,content);}catch{return unavailable(key);}
    const source=await this.#io.open(names.slots[record.slot]);
    this.#requireOpen();
    if(source===null||source.size!==record.size)return unavailable(key);
    return {key,...coordinates(key),state:'saved',size:record.size,sha256:record.sha256,content};
  }
  async page(){
    this.#requireOpen();
    if(this.#busy)throw new Error('Saved kingdom list busy');
    if(this.#faulted)throw new Error('Refresh the saved kingdom list after a read failure');
    const finish=this.#start();let entered=false;
    try{const result=await this.#io.withLock('shared',async()=>{
      this.#requireOpen();
      entered=true;
      if(this.#done)return {items:[],scanned:0,done:true};
      if(!this.#iterator){
        let directory;
        try{directory=await this.#profiles.getDirectoryHandle(nativeWorldDirectory(this.#world));}
        catch(error){this.#requireOpen();if(error.name!=='NotFoundError')throw error;this.#done=true;return {items:[],scanned:0,done:true};}
        this.#requireOpen();
        this.#iterator=directory.entries()[Symbol.asyncIterator]();
      }
      const items=[];let scanned=0;
      while(scanned<MAX_CATALOG_SCAN&&items.length<MAX_CATALOG_ITEMS){
        const entry=await this.#iterator.next();
        this.#requireOpen();
        if(entry.done){this.#iterator=null;this.#done=true;break;}
        ++scanned;
        const [name,handle]=entry.value;
        if(handle.kind!=='directory'||typeof name!=='string'||!name.startsWith('frontier_'))continue;
        const key=name.slice(9);
        try{realmFiles(key);}catch{continue;}
        const value=await this.#entry(key);if(value)items.push(Object.freeze(value));
      }
      return {items,scanned,done:this.#done};
    });this.#requireOpen();return result;}catch(error){
      // Busy admission performs no directory work, so its cursor is safe to
      // retry. Once enumeration or file I/O fails, restart rather than skip
      // an unknown amount of an interrupted page.
      if(entered)this.#faulted=true;
      throw error;
    }finally{finish();}
  }
}
export async function openNativeRealmCatalog(world,{storage=globalThis.navigator?.storage,locks=globalThis.navigator?.locks}={}){
  worldName(world);
  if(typeof storage?.getDirectory!=='function')throw new Error('Saved kingdom storage unavailable');
  const root=await storage.getDirectory();let game,profiles;
  try{game=await root.getDirectoryHandle('majesty');profiles=await game.getDirectoryHandle('profile');}
  catch(error){if(error.name!=='NotFoundError')throw error;
    // A world with no game container is empty. Never create containers just
    // to list it, and never look for saves in the personal/legacy flat root.
    profiles={async getDirectoryHandle(){throw Object.assign(new Error('missing world'),{name:'NotFoundError'});}};
  }
  return new NativeRealmCatalog(profiles,world,{locks});
}
