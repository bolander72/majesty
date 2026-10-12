// Controlled filesystem implementation of the OPFS interfaces. This is not
// browser persistence evidence. Every operation requires the test's held lease.
import assert from 'node:assert/strict';
import {lstat,mkdir,writeFile,open,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {stoppedFileSource} from '../../scripts/lib/stopped-entity-io.mjs';

export function fileProfileStorage(root,isHeld){
  const stats={reads:0,writes:0,largestRead:0,largestWrite:0,activeIO:0,peakIO:0,closed:[]};
  function member(name){assert.equal(typeof name,'string');assert.ok(name.length&&name!=='.'&&name!=='..'&&!/[\\/\0]/.test(name));return name;}
  const missing=()=>Object.assign(Error('missing'),{name:'NotFoundError'});
  async function measured(kind,size,operation){
    assert.ok(isHeld());assert.ok(size<=4096);stats[kind]++;
    const key=kind==='reads'?'largestRead':'largestWrite';stats[key]=Math.max(stats[key],size);
    ++stats.activeIO;stats.peakIO=Math.max(stats.peakIO,stats.activeIO);
    try{return await operation();}finally{--stats.activeIO;}
  }
  function directory(path){return {
    async getDirectoryHandle(name,options){
      assert.ok(isHeld());const next=join(path,member(name));
      try{assert.ok((await lstat(next)).isDirectory());}
      catch(e){if(e.code!=='ENOENT')throw e;if(!options?.create)throw missing();await mkdir(next);}
      return directory(next);
    },
    async getFileHandle(name,options){
      assert.ok(isHeld());const filename=join(path,member(name));
      try{assert.ok((await lstat(filename)).isFile());}
      catch(e){if(e.code!=='ENOENT')throw e;if(!options?.create)throw missing();await writeFile(filename,'',{flag:'wx'});}
      return {
        async getFile(){
          assert.ok(isHeld());const size=(await lstat(filename)).size,source=size?await stoppedFileSource(filename):null;
          return {size,slice(at,end){return {async arrayBuffer(){return measured('reads',end-at,async()=>{
            assert.ok(source);const bytes=await source.readAt(at,end-at);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
          });}};}};
        },
        async createWritable(){
          assert.ok(isHeld());const temporary=filename+'.pending-'+randomUUID(),stream=await open(temporary,'wx');
          let position=0,closed=false;
          return {
            async write(bytes){return measured('writes',bytes.length,async()=>{
              assert.ok(!closed&&bytes instanceof Uint8Array);
              for(let at=0;at<bytes.length;){const {bytesWritten}=await stream.write(bytes,at,bytes.length-at,position);
                assert.ok(bytesWritten);at+=bytesWritten;position+=bytesWritten;}
            });},
            async close(){assert.ok(isHeld()&&!closed);await stream.close();closed=true;await rename(temporary,filename);stats.closed.push(filename);},
            async abort(){if(!closed){await stream.close();closed=true;}await rm(temporary,{force:true});},
          };
        },
      };
    },
    async removeEntry(name){assert.ok(isHeld());await rm(join(path,member(name)));},
  };}
  return {directory,stats,storage:{getDirectory:async()=>{assert.ok(isHeld());return directory(root);}}};
}
