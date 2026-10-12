import {open,rename,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {ownedDirectory,stoppedFileSource} from './stopped-entity-io.mjs';
import {REVISION_IDENTITY,REVISION_MANIFEST} from '../../web/world/entity-revisions.mjs';

export async function stoppedRevisionStorage(directory,stats={}) {
  const path=await ownedDirectory(directory,'actor-arrival-fixture-entity-revision-');let busy=false;
  const valid=name=>[REVISION_IDENTITY,REVISION_MANIFEST].includes(name)||/^Frontier_Revision_State_[01]\.json$/.test(name)||/^Frontier_Revision_(Source|Destination)_[01]\.GMP$/.test(name);
  return {
    async withLock(mode,consume) {
      // Owned serial parent/worker fixture supervision, not an OS/browser lock.
      if(busy)throw Error('Stopped revision fixture busy');busy=true;
      try{return await consume();}finally{busy=false;}
    },
    async open(name) {
      if(!valid(name))throw Error('Invalid revision filename');
      let file;try{file=await stoppedFileSource(join(path,name));}catch(e){if(e.code==='ENOENT')return null;throw e;}
      return {size:file.size,async readAt(at,n) {
        stats.largestRead=Math.max(stats.largestRead||0,n);stats.activeReads=(stats.activeReads||0)+1;stats.peakReads=Math.max(stats.peakReads||0,stats.activeReads);
        try{return await file.readAt(at,n);}finally{--stats.activeReads;}
      }};
    },
    async atomicWrite(name,produce) {
      if(!valid(name))throw Error('Invalid revision filename');
      const temp=join(path,name+'.tmp-'+randomUUID()),f=await open(temp,'wx');let at=0,closed=false;
      try {
        await produce({async write(bytes) {
          if(!(bytes instanceof Uint8Array)||bytes.length>4096)throw Error('Unbounded revision write');
          stats.largestWrite=Math.max(stats.largestWrite||0,bytes.length);
          for(let i=0;i<bytes.length;) {
            const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);if(!bytesWritten)throw Error('Short revision write');i+=bytesWritten;at+=bytesWritten;
          }
        }});
        await f.sync();await f.close();closed=true;await rename(temp,join(path,name));
        const dir=await open(path,'r');try{await dir.sync();}finally{await dir.close();}
      }catch(e){if(!closed)await f.close().catch(()=>{});await rm(temp,{force:true});throw e;}
    },
  };
}
