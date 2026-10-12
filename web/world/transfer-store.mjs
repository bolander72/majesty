// Stopped-world paired publication. This does not migrate actors or stop an
// engine. Callers must supply complete, validated original save snapshots.
import {MAX_CHECKPOINT_BYTES,CHECKPOINT_PAGE_BYTES} from './checkpoint.mjs';
import {regionKey} from './region.mjs';
import {Sha256} from './sha256.mjs';
import {CheckpointReadLease} from './checkpoint-lease.mjs';

export const TRANSFER_MANIFEST = 'Frontier_Transfer.checkpoint';
export const MAX_TRANSFER_MANIFEST_BYTES = 511;
export const ENTITY_LEDGER_FILE = 'Frontier_Entity_Ledger.json';
export function pairedLockName(root) {
  if(typeof root!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(root))throw new Error('Invalid paired storage lock');
  return 'majesty-pair-'+root;
}
const digest = s => typeof s==='string' && /^[a-f0-9]{64}$/.test(s);
function region(s) {
  if(typeof s!=='string'||s.length>24)throw new Error('Invalid transfer region');
  const p=s.split('_').map(Number);
  if(p.length!==2||regionKey(...p)!==s)throw new Error('Invalid transfer region');
  return s;
}
function config(regions,content) {
  if(!Array.isArray(regions)||regions.length!==2||regions[0]===regions[1]||
      typeof content!=='string'||!content.length||content.length>192||/[^\x20-\x7e]/.test(content))
    throw new Error('Invalid transfer identity');
  return {regions:regions.map(region),content};
}
function source(s) {
  if(!s||!Number.isSafeInteger(s.size)||s.size<1||s.size>MAX_CHECKPOINT_BYTES||typeof s.readAt!=='function')
    throw new Error('Invalid transfer source');
  return s;
}
function filename(side,slot) {
  return `Frontier_Transfer_${side?'Destination':'Source'}_${slot}.GMP`;
}
export function parseTransferManifest(text,regions,content) {
  const identity=config(regions,content);
  if(typeof text!=='string'||!text.length||text.length>MAX_TRANSFER_MANIFEST_BYTES||/[^\x20-\x7e\n]/.test(text))
    throw new Error('Invalid transfer manifest');
  const lines=text.split('\n');
  if(lines.length!==11||lines[10]!==''||lines[0]!=='majesty-transfer-v1'||!/^[01]$/.test(lines[1])||
      !/^[01]$/.test(lines[2])||lines[3]!==identity.regions[0]||lines[4]!==identity.regions[1]||lines[9]!==identity.content)
    throw new Error('Invalid transfer manifest identity');
  const worlds=[0,1].map(side=>{
    const raw=lines[5+side*2],size=Number(raw),sha256=lines[6+side*2];
    if(!Number.isSafeInteger(size)||size<1||size>MAX_CHECKPOINT_BYTES||String(size)!==raw||!digest(sha256))
      throw new Error('Invalid transfer world identity');
    return {size,sha256};
  });
  return {slot:Number(lines[1]),moved:lines[2]==='1',regions:identity.regions,content,worlds,manifest:text};
}
async function pages(input,consume) {
  source(input);
  const hash=new Sha256(),size=input.size;
  for(let at=0;at<size;at+=CHECKPOINT_PAGE_BYTES){
    if(input.size!==size)throw new Error('Transfer source changed');
    const n=Math.min(CHECKPOINT_PAGE_BYTES,size-at),bytes=await input.readAt(at,n);
    if(!(bytes instanceof Uint8Array)||bytes.length!==n)throw new Error('Truncated transfer source');
    hash.update(bytes);if(consume)await consume(bytes);
  }
  if(input.size!==size)throw new Error('Transfer source changed');
  return hash.hex();
}
export {pages as hashCheckpointSource};
export class PairedCheckpointStore {
  #binding = null;
  constructor(io,{regions,content,binding=null}) {
    if(!io||typeof io.open!=='function'||typeof io.atomicWrite!=='function'||typeof io.withLock!=='function')
      throw new Error('Invalid paired storage adapter');
    const identity=config(regions,content);this.io=io;this.regions=Object.freeze(identity.regions);this.content=content;
    if(binding!==null){
      if(!binding||binding.name!==ENTITY_LEDGER_FILE||!(binding.bytes instanceof Uint8Array)||
          binding.bytes.length<1||binding.bytes.length>CHECKPOINT_PAGE_BYTES||!digest(binding.sha256)||
          !content.endsWith(':'+binding.sha256)||new Sha256().update(binding.bytes).hex()!==binding.sha256)
        throw new Error('Invalid immutable entity binding');
      this.#binding={name:binding.name,bytes:new Uint8Array(binding.bytes),sha256:binding.sha256};
    }
  }
  async #checkBinding(create=false,boundary=async()=>{}) {
    if(!this.#binding)return;
    const expected=this.#binding;
    const file=await this.io.open(expected.name);
    if(file===null){
      if(!create)throw new Error('Missing selected entity ledger');
      await this.io.atomicWrite(expected.name,sink=>sink.write(new Uint8Array(expected.bytes)));
      await this.#checkBinding();
      await boundary('after-binding');
      return;
    }
    source(file);
    if(file.size!==expected.bytes.length||file.size>CHECKPOINT_PAGE_BYTES)throw new Error('Damaged entity ledger');
    const bytes=await file.readAt(0,file.size);
    if(!(bytes instanceof Uint8Array)||bytes.length!==file.size||new Sha256().update(bytes).hex()!==expected.sha256)
      throw new Error('Damaged entity ledger');
  }
  async #read(lease=null) {
    const input=await this.io.open(TRANSFER_MANIFEST);
    if(input===null)return null; // Only a truly absent marker can initialize.
    source(input);
    if(input.size>MAX_TRANSFER_MANIFEST_BYTES)throw new Error('Invalid transfer manifest size');
    const raw=await input.readAt(0,input.size);
    if(!(raw instanceof Uint8Array)||raw.length!==input.size||raw.some(b=>b!==10&&(b<32||b>126)))
      throw new Error('Invalid transfer manifest encoding');
    const record=parseTransferManifest(new TextDecoder().decode(raw),this.regions,this.content);
    await this.#checkBinding();
    const sources=lease?[]:null;
    for(let side=0;side<2;++side){
      const expected=record.worlds[side],file=source(await this.io.open(filename(side,record.slot)));
      if(file.size!==expected.size||await pages(file)!==expected.sha256)throw new Error('Damaged selected transfer world');
      if(lease)sources.push(lease.source(file,expected.size));
    }
    return lease?{record,sources}:record;
  }
  read() { return this.io.withLock('shared',()=>this.#read()); }
  // A consumer copying selected worlds must retain the same read lease until
  // that copy completes. Returning metadata alone does not pin reusable slots.
  withSelected(consume) {
    if(typeof consume!=='function')return Promise.reject(new Error('Invalid selected-world consumer'));
    return this.io.withLock('shared',async()=>{
      const lease=new CheckpointReadLease({maximum:2,ended:'Selected-world lease ended',
        bounds:'Unbounded selected-world read',truncated:'Truncated selected world'});
      try {
        return await consume(await this.#read(lease));
      } finally {lease.revoke();}
    });
  }
  async commit({worlds,moved,expectedManifest},boundary=async()=>{}) {
    if(!Array.isArray(worlds)||worlds.length!==2||typeof moved!=='boolean'||
        (expectedManifest!==null&&typeof expectedManifest!=='string')||typeof boundary!=='function')
      throw new Error('Invalid paired commit');
    // Capture scalar expectations before awaiting; later caller mutation cannot
    // change which transaction is accepted or its manifest fields.
    const inputs=worlds.map(w=>{if(!w||!digest(w.sha256))throw new Error('Invalid transfer digest');return {source:source(w.source),size:w.source.size,sha256:w.sha256};});
    if(expectedManifest!==null)parseTransferManifest(expectedManifest,this.regions,this.content);
    return this.io.withLock('exclusive',async()=>{
      const old=await this.#read();
      if(old&&old.moved===moved&&old.worlds.every((w,i)=>w.size===inputs[i].size&&w.sha256===inputs[i].sha256))
        return {...old,idempotent:true};
      if((old?.manifest??null)!==expectedManifest)throw new Error('Shared checkpoint changed; reload before committing');
      await this.#checkBinding(true,boundary);
      const slot=old?.slot===0?1:0;
      for(let side=0;side<2;++side){
        const input=inputs[side],name=filename(side,slot);
        if(input.source.size!==input.size)throw new Error('Transfer source changed');
        await this.io.atomicWrite(name,async sink=>{
          if(await pages(input.source,bytes=>sink.write(bytes))!==input.sha256)throw new Error('Transfer source digest mismatch');
        });
        const staged=source(await this.io.open(name));
        if(staged.size!==input.size||await pages(staged)!==input.sha256)throw new Error('Transfer staging verification failed');
        if(side===0)await boundary('after-source');
      }
      const text=['majesty-transfer-v1',slot,Number(moved),...this.regions,inputs[0].size,inputs[0].sha256,inputs[1].size,inputs[1].sha256,this.content,''].join('\n');
      const record=parseTransferManifest(text,this.regions,this.content);
      await boundary('before-publish');
      await this.io.atomicWrite(TRANSFER_MANIFEST,sink=>sink.write(new TextEncoder().encode(text)));
      await boundary('after-publish');
      return {...record,idempotent:false};
    });
  }
}

// Standard OPFS and Web Locks only. A caller supplies an owned directory and a
// world-specific lock name. Every participating reader/writer must use it;
// legacy C++ diagnostic writers do not acquire this lock and must stay stopped.
export function opfsPairedStorage(directory,lockName,locks=typeof navigator==='undefined'?null:navigator.locks) {
  if(!directory||typeof directory.getFileHandle!=='function'||!locks||typeof locks.request!=='function'||
      typeof lockName!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(lockName))throw new Error('Paired storage locking unavailable');
  const name=pairedLockName(lockName);
  return {
    withLock(mode,fn){return locks.request(name,{mode,ifAvailable:true},lock=>{
      if(!lock)throw new Error('Shared checkpoint busy; retry after the other operation');return fn();
    });},
    async open(name){
      let handle;
      try{handle=await directory.getFileHandle(name);}catch(e){if(e.name==='NotFoundError')return null;throw e;}
      const file=await handle.getFile();
      return {size:file.size,async readAt(offset,length){return new Uint8Array(await file.slice(offset,offset+length).arrayBuffer());}};
    },
    async atomicWrite(name,produce){
      const stream=await(await directory.getFileHandle(name,{create:true})).createWritable();
      try{await produce({write:bytes=>stream.write(bytes)});await stream.close();}
      catch(error){try{await stream.abort();}catch{}throw error;}
    },
  };
}
