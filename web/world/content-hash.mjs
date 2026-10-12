import {Sha256} from './sha256.mjs';

export const HASH_READ_BYTES=64*1024;
function blob(file){
  if(!(file instanceof Blob)||!Number.isSafeInteger(file.size)||file.size<0)
    throw new Error('Invalid content hash input');
}
export async function hashBlob(file) {
  blob(file);
  const hash=new Sha256(),size=file.size;
  for(let offset=0;offset<size;offset+=HASH_READ_BYTES){
    const count=Math.min(HASH_READ_BYTES,size-offset);
    const bytes=new Uint8Array(await file.slice(offset,offset+count).arrayBuffer());
    if(bytes.length!==count)throw new Error('Content changed while hashing');
    hash.update(bytes);
  }
  return hash.hex();
}

// One worker, one accepted file, no queued file payloads. File/Blob messages
// share the browser's immutable backing storage; no whole-file buffer is sent.
export class ContentHasher {
  #worker;
  #pending=null;
  #sequence=0;
  #closed=false;
  constructor(makeWorker=()=>new Worker(new URL('./content-hash-worker.mjs',import.meta.url),{type:'module'})) {
    this.#worker=makeWorker();
    this.#worker.onmessage=event=>{
      const pending=this.#pending,data=event.data;
      if(!pending||!data||data.id!==pending.id){this.close();return;}
      this.#pending=null;
      if(typeof data.sha256==='string'&&/^[a-f0-9]{64}$/.test(data.sha256))pending.resolve(data.sha256);
      else if(data.error===true)pending.reject(new Error('Content could not be read for compatibility checking'));
      else {pending.reject(new Error('Invalid content hash worker result'));this.close();}
    };
    this.#worker.onerror=event=>{event.preventDefault?.();this.close();};
    this.#worker.onmessageerror=()=>this.close();
  }
  hash(file) {
    if(this.#closed)return Promise.reject(new Error('Content hash worker is closed'));
    if(this.#pending)return Promise.reject(new Error('Content hash worker is busy'));
    try{blob(file);}catch(error){return Promise.reject(error);}
    return new Promise((resolve,reject)=>{
      this.#pending={id:++this.#sequence,resolve,reject};
      try{this.#worker.postMessage({id:this.#sequence,file});}
      catch{this.close();}
    });
  }
  close() {
    if(this.#closed)return;
    this.#closed=true;
    const pending=this.#pending;this.#pending=null;
    this.#worker.onmessage=this.#worker.onerror=this.#worker.onmessageerror=null;
    this.#worker.terminate();
    pending?.reject(new Error('Content hash worker stopped'));
  }
}
