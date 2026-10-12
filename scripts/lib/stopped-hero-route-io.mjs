import {open,rename,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {ownedDirectory,stoppedFileSource} from './stopped-entity-io.mjs';
import {HERO_ROUTE_HEAD,HERO_ROUTE_IDENTITY} from '../../web/world/hero-route-store.mjs';

// Serial, owned stopped-checkpoint qualification only. Live browser use needs
// the shared world writer lock; this local guard is not an interprocess lock.
export async function stoppedHeroRouteStorage(directory,stats={}){
  const root=await ownedDirectory(directory,'actor-arrival-fixture-hero-route-');let busy=false;
  const valid=n=>[HERO_ROUTE_HEAD,HERO_ROUTE_IDENTITY].includes(n)||
    /^Frontier_Hero_Route_Node_(0|[1-9][0-9]{0,9})\.json$/.test(n)||
    /^Frontier_Hero_Route_-?(0|[1-9][0-9]{0,6})_-?(0|[1-9][0-9]{0,6})_[01]\.GMP$/.test(n);
  return {
    async withLock(mode,consume){
      if(!['shared','exclusive'].includes(mode)||busy)throw Error('Stopped hero route busy or invalid lock');
      busy=true;try{return await consume();}finally{busy=false;}
    },
    async open(name){
      if(!busy||!valid(name))throw Error('Invalid stopped hero route filename or lock');
      let file;try{file=await stoppedFileSource(join(root,name));}catch(e){if(e.code==='ENOENT')return null;throw e;}
      return {size:file.size,async readAt(at,n){
        stats.largestRead=Math.max(stats.largestRead??0,n);stats.activeReads=(stats.activeReads??0)+1;
        stats.peakReads=Math.max(stats.peakReads??0,stats.activeReads);
        try{return await file.readAt(at,n);}finally{stats.activeReads--;}
      }};
    },
    async atomicWrite(name,produce){
      if(!busy||!valid(name))throw Error('Invalid stopped hero route filename or lock');
      const temp=join(root,name+'.tmp-'+randomUUID()),file=await open(temp,'wx');let at=0,closed=false;
      try{
        await produce({async write(bytes){
          if(!(bytes instanceof Uint8Array)||bytes.length>4096)throw Error('Unbounded stopped hero route write');
          stats.largestWrite=Math.max(stats.largestWrite??0,bytes.length);
          for(let i=0;i<bytes.length;){const {bytesWritten}=await file.write(bytes,i,bytes.length-i,at);
            if(!bytesWritten)throw Error('Short stopped hero route write');i+=bytesWritten;at+=bytesWritten;}
        }});
        await file.sync();await file.close();closed=true;await rename(temp,join(root,name));
        const dir=await open(root,'r');try{await dir.sync();}finally{await dir.close();}
        stats.writes=(stats.writes??0)+1;
      }catch(e){if(!closed)await file.close().catch(()=>{});await rm(temp,{force:true});throw e;}
    }
  };
}
