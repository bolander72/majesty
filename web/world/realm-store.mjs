// Independent stopped native regions. One region commits atomically; this is
// not a multi-region actor handoff or a shared co-op checkpoint transaction.
import {regionKey} from './region.mjs';
import {MAX_CHECKPOINT_BYTES} from './checkpoint.mjs';
import {hashCheckpointSource,opfsPairedStorage} from './transfer-store.mjs';
import {worldName} from './world-name.mjs';
import {CheckpointReadLease,checkCheckpointReadSignal} from './checkpoint-lease.mjs';

export const MAX_REALM_READS=49;
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
function realm(key){
  if(typeof key!=='string'||key.length>24)throw new Error('Invalid native realm key');
  const parts=key.split('_').map(Number);
  if(parts.length!==2||regionKey(...parts)!==key)throw new Error('Invalid native realm key');
  return key;
}
function contentValid(content){
  if(typeof content!=='string'||!content.length||content.length>192||/[^\x20-\x7e]/.test(content))
    throw new Error('Invalid native realm content');
}
function inputValid(source){
  if(!source||!Number.isSafeInteger(source.size)||source.size<1||source.size>MAX_CHECKPOINT_BYTES||typeof source.readAt!=='function')
    throw new Error('Invalid native realm source');
  return source;
}
export function realmFiles(key){realm(key);const name='Frontier_'+key;
  return {marker:name+'.checkpoint',slots:[name+'.GMP',name+'_Recovery.GMP']};
}
export function parseRealmManifest(text,content){
  contentValid(content);
  if(typeof text!=='string'||!text.length||text.length>511||/[^\x20-\x7e\n]/.test(text))throw new Error('Invalid native realm manifest');
  const lines=text.split('\n'),size=Number(lines[2]);
  if(lines.length!==6||lines[0]!=='checkpoint-v1'||!/^[01]$/.test(lines[1])||lines[4]!==content||lines[5]!==''||
      !Number.isSafeInteger(size)||size<1||size>MAX_CHECKPOINT_BYTES||String(size)!==lines[2]||!digest(lines[3]))
    throw new Error('Invalid native realm manifest identity');
  return {slot:Number(lines[1]),size,sha256:lines[3],manifest:text};
}
export class NativeRealmStore {
  #io;
  #content;
  constructor(io,{content}){
    contentValid(content);
    if(!io||typeof io.open!=='function'||typeof io.atomicWrite!=='function'||typeof io.withLock!=='function')
      throw new Error('Invalid native realm adapter');
    this.#io=io;this.#content=content;
  }
  async #read(key,lease=null){
    lease?.check();
    const names=realmFiles(key),marker=await this.#io.open(names.marker);
    lease?.check();
    if(marker===null)return null;
    inputValid(marker);if(marker.size>511)throw new Error('Invalid native realm manifest size');
    const raw=await marker.readAt(0,marker.size);
    lease?.check();
    if(!(raw instanceof Uint8Array)||raw.length!==marker.size||raw.some(b=>b!==10&&(b<32||b>126)))
      throw new Error('Invalid native realm manifest encoding');
    const record=parseRealmManifest(new TextDecoder().decode(raw),this.#content);
    const file=inputValid(await this.#io.open(names.slots[record.slot]));
    lease?.check();
    if(file.size!==record.size)throw new Error('Damaged native realm snapshot');
    // Digest validation uses the same cancellable, bounded reader as terrain.
    // Do not finish hashing every kingdom before noticing a closed scene.
    const source=lease?lease.source(file,record.size):file;
    if(source.size!==record.size||await hashCheckpointSource(source)!==record.sha256)throw new Error('Damaged native realm snapshot');
    if(file.size!==record.size)throw new Error('Damaged native realm snapshot');
    lease?.check();
    // Lease the exact source whose size and digest were checked above.
    return lease?{record:Object.freeze(record),source}:record;
  }
  read(key){realm(key);return this.#io.withLock('shared',()=>this.#read(key));}
  withRegions(keys,consume,{signal}={}){
    if(!Array.isArray(keys)||keys.length>MAX_REALM_READS||new Set(keys).size!==keys.length||typeof consume!=='function')
      return Promise.reject(new Error('Invalid native realm read set'));
    try{checkCheckpointReadSignal(signal);keys=keys.map(realm);}catch(error){return Promise.reject(error);}
    return this.#io.withLock('shared',async()=>{
      checkCheckpointReadSignal(signal);
      const selected=new Map(),lease=new CheckpointReadLease({maximum:MAX_REALM_READS,
        ended:'Native realm lease ended',bounds:'Native realm read out of bounds',truncated:'Truncated native realm',signal});
      try{
        for(const key of keys){
          selected.set(key,await this.#read(key,lease));
        }
        const result=await consume(selected);lease.check();return result;
      }finally{lease.revoke();selected.clear();}
    });
  }
  async commit(key,{source,sha256,expectedManifest},boundary=async()=>{}){
    const names=realmFiles(key);inputValid(source);const size=source.size;
    if(!digest(sha256)||(expectedManifest!==null&&typeof expectedManifest!=='string')||typeof boundary!=='function')
      throw new Error('Invalid native realm commit');
    if(expectedManifest!==null)parseRealmManifest(expectedManifest,this.#content);
    return this.#io.withLock('exclusive',async()=>{
      const old=await this.#read(key);
      if(old&&old.size===size&&old.sha256===sha256)return {...old,idempotent:true};
      if((old?.manifest??null)!==expectedManifest)throw new Error('Native realm changed; reload before committing');
      if(source.size!==size)throw new Error('Native realm source changed');
      const slot=old?.slot===0?1:0;
      let alreadyStaged=false;
      if(!old){
        for(let index=0;index<2;++index){
          const existing=await this.#io.open(names.slots[index]);
          if(existing===null)continue;
          if(index!==slot||inputValid(existing).size!==size||await hashCheckpointSource(existing)!==sha256)
            throw new Error('Unregistered native realm files are preserved; use a new owned region directory');
          alreadyStaged=true;
        }
      }
      if(!alreadyStaged)await this.#io.atomicWrite(names.slots[slot],async sink=>{
        if(await hashCheckpointSource(source,bytes=>sink.write(bytes))!==sha256)throw new Error('Native realm source digest mismatch');
      });
      const staged=inputValid(await this.#io.open(names.slots[slot]));
      if(staged.size!==size||await hashCheckpointSource(staged)!==sha256)throw new Error('Native realm staging failed');
      const manifest=['checkpoint-v1',slot,size,sha256,this.#content,''].join('\n');
      const record=parseRealmManifest(manifest,this.#content);
      await boundary('before-publish');
      await this.#io.atomicWrite(names.marker,sink=>sink.write(new TextEncoder().encode(manifest)));
      await boundary('after-publish');return {...record,idempotent:false};
    });
  }
}
export function opfsRealmStorage(directory,world,locks=typeof navigator==='undefined'?null:navigator.locks){
  worldName(world);
  // Caller supplies an owned world directory, never the personal profile root.
  return opfsPairedStorage(directory,'native-world-'+world,locks);
}
