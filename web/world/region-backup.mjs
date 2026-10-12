// Portable independent native kingdom. No assets, campaign progress or actor
// handoff ledger is included. Restores claim a fresh world under its game lease.
import {worldName} from './world-name.mjs';
import {realmFiles,parseRealmManifest,NativeRealmStore} from './realm-store.mjs';
import {nativeWorldDirectory,opfsNativeRealmStorage} from './realm-profile.mjs';
import {MAX_CHECKPOINT_BYTES,checkpointChunks} from './checkpoint.mjs';
import {hashCheckpointSource} from './transfer-store.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';

const MAGIC=new TextEncoder().encode('MajestyRegion-v1');
const PREFIX=24;
export const MAX_REGION_BACKUP_HEADER=1024,REGION_BACKUP_PAGE=4096;
export const REGION_BACKUP_ENGINE_SHA256='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542';
const fields=['version','engine','engineSha256','sourceWorld','region','size','sha256','content'].sort();
function metadata(value){
  if(!value||Object.keys(value).sort().join('|')!==fields.join('|')||value.version!==1||
      value.engine!=='majesty-gold-hd-directdraw'||value.engineSha256!==REGION_BACKUP_ENGINE_SHA256)
    throw new Error('Unsupported kingdom backup');
  worldName(value.sourceWorld);realmFiles(value.region);
  parseRealmManifest(['checkpoint-v1',0,value.size,value.sha256,value.content,''].join('\n'),value.content);
  if(!Number.isSafeInteger(value.size)||value.size<16)throw new Error('Invalid kingdom backup size');
  return Object.freeze({...value});
}
function input(source,maximum){
  if(!source||!Number.isSafeInteger(source.size)||source.size<16||source.size>maximum||typeof source.readAt!=='function')
    throw new Error('Invalid kingdom backup source');
}
async function bytes(source,offset,length){
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<1||
      length>REGION_BACKUP_PAGE||offset+length>source.size)throw new Error('Kingdom backup read out of bounds');
  const value=await source.readAt(offset,length);
  if(!(value instanceof Uint8Array)||value.length!==length)throw new Error('Truncated kingdom backup');
  return value;
}
export function regionBackupFile(file){
  if(!file||typeof file.slice!=='function')throw new Error('Choose a kingdom backup file');
  input({size:file.size,readAt(){}},MAX_CHECKPOINT_BYTES+PREFIX+MAX_REGION_BACKUP_HEADER);
  return Object.freeze({size:file.size,async readAt(offset,length){
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<1||
        length>REGION_BACKUP_PAGE||offset+length>file.size)throw new Error('Kingdom backup read out of bounds');
    return new Uint8Array(await file.slice(offset,offset+length).arrayBuffer());
  }});
}
export async function exportNativeRegion(store,key,sink,{world,signal}){
  worldName(world);realmFiles(key);
  if(typeof store?.withRegions!=='function'||typeof sink?.write!=='function')throw new Error('Kingdom export unavailable');
  return store.withRegions([key],async selected=>{
    const write=async part=>{
      checkCheckpointReadSignal(signal);await sink.write(part);checkCheckpointReadSignal(signal);
    };
    const saved=selected.get(key);
    if(!saved)throw new Error('Save this kingdom in Majesty before exporting it');
    const {record,source}=saved;
    const info=metadata({version:1,engine:'majesty-gold-hd-directdraw',engineSha256:REGION_BACKUP_ENGINE_SHA256,
      sourceWorld:world,region:key,size:record.size,sha256:record.sha256,content:record.manifest.split('\n')[4]});
    const header=new TextEncoder().encode(JSON.stringify(info));
    if(header.length>MAX_REGION_BACKUP_HEADER)throw new Error('Kingdom backup header exceeds limit');
    const prefix=new Uint8Array(PREFIX);prefix.set(MAGIC);new DataView(prefix.buffer).setUint32(16,header.length,true);
    await write(prefix);await write(header);
    if(await hashCheckpointSource(source,write)!==info.sha256)throw new Error('Kingdom changed during export');
    return {metadata:info,bytes:PREFIX+header.length+info.size};
  },{signal});
}
export async function inspectNativeRegionBackup(source){
  input(source,MAX_CHECKPOINT_BYTES+PREFIX+MAX_REGION_BACKUP_HEADER);
  if(source.size<PREFIX)throw new Error('Truncated kingdom backup');
  const prefix=await bytes(source,0,PREFIX),view=new DataView(prefix.buffer,prefix.byteOffset,prefix.byteLength);
  if(!MAGIC.every((b,i)=>prefix[i]===b)||view.getUint32(20,true)!==0)throw new Error('Unsupported kingdom backup');
  const size=view.getUint32(16,true);
  if(size<1||size>MAX_REGION_BACKUP_HEADER||PREFIX+size>=source.size)throw new Error('Invalid kingdom backup header');
  const raw=await bytes(source,PREFIX,size);
  if(raw.some(b=>b<32||b>126))throw new Error('Invalid kingdom backup encoding');
  const text=new TextDecoder().decode(raw);
  let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('Invalid kingdom backup header');}
  if(JSON.stringify(parsed)!==text)throw new Error('Noncanonical kingdom backup header');
  const info=metadata(parsed),offset=PREFIX+size;
  if(offset+info.size!==source.size)throw new Error('Kingdom backup length mismatch');
  const body=Object.freeze({size:info.size,async readAt(at,n){
    if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<1||n>REGION_BACKUP_PAGE||at+n>info.size)
      throw new Error('Kingdom backup body read out of bounds');
    return bytes(source,offset+at,n);
  }});
  if(await hashCheckpointSource(body)!==info.sha256)throw new Error('Damaged kingdom backup');
  let count=0;
  for await(const chunk of checkpointChunks(body)){
    if(!count&&(chunk.tag!=='VERS'||chunk.version!==1))throw new Error('Unsupported kingdom checkpoint');
    ++count;
  }
  if(!count)throw new Error('Empty kingdom checkpoint');
  return Object.freeze({metadata:info,source:body});
}
export async function restoreNativeRegionBackup(profiles,world,source,{locks}={}){
  worldName(world);
  const backup=await inspectNativeRegionBackup(source);
  const io=opfsNativeRealmStorage(profiles,world,locks),directory=nativeWorldDirectory(world);
  return io.withLock('exclusive',async()=>{
    try{await profiles.getDirectoryHandle(directory);throw new Error('That world already exists; choose a new world name');}
    catch(error){if(error.name!=='NotFoundError')throw error;}
    // Never take over an existing world, even an empty or incomplete directory.
    // If publication fails, retain this owned directory rather than deleting
    // saves that another legacy writer might have added without a lease.
    await profiles.getDirectoryHandle(directory,{create:true});
    const store=new NativeRealmStore({...io,withLock(_mode,fn){return fn();}},{content:backup.metadata.content});
    const record=await store.commit(backup.metadata.region,{source:backup.source,sha256:backup.metadata.sha256,expectedManifest:null});
    return {world,region:backup.metadata.region,record};
  });
}
