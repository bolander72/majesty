// Readers may escape a stopped-checkpoint callback. Revocation must remove
// their backing sources as well as rejecting later reads.
import {MAX_CHECKPOINT_BYTES,CHECKPOINT_PAGE_BYTES} from './checkpoint.mjs';

export function checkCheckpointReadSignal(signal){
  if(signal===undefined)return;
  if(!signal||typeof signal.aborted!=='boolean')throw new Error('Invalid checkpoint read signal');
  if(signal.aborted)throw signal.reason??new Error('Checkpoint read cancelled');
}

export class CheckpointReadLease {
  #sources=new Map();
  #active=true;
  #maximum;
  #messages;
  #signal;
  #abort;
  constructor({maximum,ended,bounds,truncated,signal}){
    if(!Number.isSafeInteger(maximum)||maximum<1||maximum>49||
        ![ended,bounds,truncated].every(s=>typeof s==='string'&&s.length>0&&s.length<=128))
      throw new Error('Invalid checkpoint read lease');
    checkCheckpointReadSignal(signal);
    this.#maximum=maximum;this.#messages={ended,bounds,truncated};this.#signal=signal;
    // An idle consumer may keep its callback pending after a view closes.
    // Drop backing Files immediately, rather than waiting for another read or
    // for that consumer to settle. Explicit revoke also removes the listener.
    if(typeof signal?.addEventListener==='function'&&typeof signal?.removeEventListener==='function'){
      this.#abort=()=>this.#sources.clear();
      signal.addEventListener('abort',this.#abort,{once:true});
    }
  }
  check(){
    if(!this.#active)throw new Error(this.#messages.ended);
    try{checkCheckpointReadSignal(this.#signal);}
    catch(error){this.#sources.clear();throw error;}
  }
  source(file,size=file?.size){
    this.check();
    if(this.#sources.size>=this.#maximum)throw new Error('Checkpoint read lease budget exceeded');
    if(!file||!Number.isSafeInteger(size)||size<1||size>MAX_CHECKPOINT_BYTES||file.size!==size||typeof file.readAt!=='function')
      throw new Error('Invalid checkpoint lease source');
    const id=this.#sources.size;this.#sources.set(id,file);
    // The bound method captures only the lease and scalar identifiers. It
    // does not close over this method's file parameter.
    return Object.freeze({size,readAt:this.#read.bind(this,id,size)});
  }
  async #read(id,size,at,n){
    this.check();
    if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>CHECKPOINT_PAGE_BYTES||at+n>size)
      throw new Error(this.#messages.bounds);
    const bytes=await this.#sources.get(id).readAt(at,n);
    this.check();
    if(!(bytes instanceof Uint8Array)||bytes.length!==n)throw new Error(this.#messages.truncated);
    return bytes;
  }
  revoke(){
    this.#active=false;this.#sources.clear();
    if(this.#abort)this.#signal.removeEventListener('abort',this.#abort);
    this.#abort=undefined;this.#signal=undefined;
  }
  get retainedSources(){return this.#sources.size;}
}
