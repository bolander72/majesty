// Stopped-world registered-hero custody across arbitrary regions. Each region
// has two checkpoint slots; an append-only, hash-linked metadata journal and
// one atomic head select both sides of a handoff. No native actor is imported
// here. The adapter must own its directory and serialize all its writers.
import {encodeRevisionIdentity} from './entity-revisions.mjs';
import {canonicalHeroHomeAliases,verifyRegisteredHeroSnapshot,registeredHeroRegions} from './entity-home-ownership.mjs';
import {verifyEntitySnapshot} from './entity-ownership.mjs';
import {MAX_CHECKPOINT_BYTES} from './checkpoint.mjs';
import {CheckpointReadLease,checkCheckpointReadSignal} from './checkpoint-lease.mjs';
import {hashCheckpointSource} from './transfer-store.mjs';
import {Sha256} from './sha256.mjs';

export const HERO_ROUTE_IDENTITY='Frontier_Hero_Route_Identity.json';
export const HERO_ROUTE_HEAD='Frontier_Hero_Route.checkpoint';
export const MAX_HERO_ROUTE_METADATA_BYTES=4096;
const hash=b=>new Sha256().update(b).hex(),clone=v=>JSON.parse(JSON.stringify(v));
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uint=(v,max=0xffffffff)=>Number.isInteger(v)&&v>=0&&v<=max;
const unchecked=()=>{};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...k].sort().join(',');
function region(r){registeredHeroRegions([r,r==='0_0'?'1_0':'0_0']);return r;}
function alias(a){
  if(!keys(a,['unitId','agentId'])||!uint(a.unitId)||!a.unitId||!uint(a.agentId,0x7fffffff)||!a.agentId)
    throw Error('Invalid hero route alias');return {unitId:a.unitId,agentId:a.agentId};
}
function world(w){
  if(!keys(w,['size','sha256'])||!uint(w.size,MAX_CHECKPOINT_BYTES)||w.size<16||!digest(w.sha256))
    throw Error('Invalid hero route world');return {size:w.size,sha256:w.sha256};
}
function entry(e){
  if(!keys(e,['region','slot','alias','homeAlias','world'])||!uint(e.slot,1))throw Error('Invalid hero route entry');
  const a=alias(e.alias),h=canonicalHeroHomeAliases([e.homeAlias,e.homeAlias])[0];
  if(a.unitId===h.unitId||a.agentId===h.agentId)throw Error('Hero route home alias collides');
  return {region:region(e.region),slot:e.slot,alias:a,homeAlias:h,world:world(e.world)};
}
function encode(v){
  const b=new TextEncoder().encode(JSON.stringify(v)+'\n');
  if(b.length>MAX_HERO_ROUTE_METADATA_BYTES)throw Error('Hero route metadata exceeds bound');return b;
}
function head(h){
  if(!keys(h,['version','identitySha256','revision','nodeSha256'])||h.version!==1||!digest(h.identitySha256)||
     !uint(h.revision)||!digest(h.nodeSha256))throw Error('Invalid hero route head');
  return {version:1,identitySha256:h.identitySha256,revision:h.revision,nodeSha256:h.nodeSha256};
}
function node(n){
  if(!keys(n,['version','identitySha256','revision','previous','kind','ownerRegion','operationId','changes'])||
     n.version!==1||!digest(n.identitySha256)||!uint(n.revision)||!digest(n.operationId)||
     !['seed','save','handoff'].includes(n.kind)||!Array.isArray(n.changes)||n.changes.length!==(n.kind==='handoff'?2:1)||
     (n.revision===0)!==(n.kind==='seed')||(n.revision===0)!==(n.previous===null))throw Error('Invalid hero route node');
  const previous=n.previous===null?null:head(n.previous);
  if(previous&&(previous.identitySha256!==n.identitySha256||previous.revision+1!==n.revision))throw Error('Broken hero route chain');
  const changes=n.changes.map(entry),ownerRegion=region(n.ownerRegion);
  if(changes.at(-1).region!==ownerRegion||new Set(changes.map(e=>e.region)).size!==changes.length)
    throw Error('Invalid hero route owner');
  return {version:1,identitySha256:n.identitySha256,revision:n.revision,previous,kind:n.kind,ownerRegion,
    operationId:n.operationId,changes};
}
async function readMetadata(file,canonical,check=unchecked){
  check();
  if(!file||!uint(file.size,MAX_HERO_ROUTE_METADATA_BYTES)||!file.size||typeof file.readAt!=='function')
    throw Error('Missing or oversized hero route metadata');
  const bytes=await file.readAt(0,file.size);
  check();
  if(!(bytes instanceof Uint8Array)||bytes.length!==file.size)throw Error('Truncated hero route metadata');
  const value=canonical(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))),expected=encode(value);
  if(expected.length!==bytes.length||expected.some((v,i)=>v!==bytes[i]))throw Error('Noncanonical hero route metadata');
  return {value,bytes};
}
const nodeFile=revision=>`Frontier_Hero_Route_Node_${revision}.json`;
const pointer=h=>head({version:h.version,identitySha256:h.identitySha256,revision:h.revision,nodeSha256:h.nodeSha256});
const worldFile=e=>`Frontier_Hero_Route_${e.region}_${e.slot}.GMP`;
function input(source,sha256){
  if(!source||!uint(source.size,MAX_CHECKPOINT_BYTES)||source.size<16||typeof source.readAt!=='function'||!digest(sha256))
    throw Error('Invalid hero route source');return {source,world:{size:source.size,sha256}};
}

export class HeroRouteStore {
  #io;#identity;#identityBytes;#identitySha256;
  constructor(io,identity,contentDigest){
    if(!io||!['open','atomicWrite','withLock'].every(k=>typeof io[k]==='function')||identity?.version!==2)
      throw Error('Hero route requires a registered origin and owned adapter');
    this.#identityBytes=encodeRevisionIdentity(identity);
    this.#identity=JSON.parse(new TextDecoder().decode(this.#identityBytes));
    if(this.#identity.contentDigest!==contentDigest)throw Error('Hero route content differs');
    this.#identitySha256=hash(this.#identityBytes);this.#io=io;
  }
  get identity(){return clone(this.#identity);}
  async #open(name,check=unchecked){
    check();const file=await this.#io.open(name);check();return file;
  }
  async #binding(create=false,check=unchecked){
    let file=await this.#open(HERO_ROUTE_IDENTITY,check);
    if(file===null&&create){await this.#io.atomicWrite(HERO_ROUTE_IDENTITY,s=>s.write(new Uint8Array(this.#identityBytes)));
      file=await this.#open(HERO_ROUTE_IDENTITY,check);}
    const {bytes}=await readMetadata(file,v=>JSON.parse(new TextDecoder().decode(encodeRevisionIdentity(v))),check);
    if(hash(bytes)!==this.#identitySha256)throw Error('Hero route identity differs');
  }
  async #head(check=unchecked){
    const file=await this.#open(HERO_ROUTE_HEAD,check);if(file===null)return null;
    await this.#binding(false,check);const {value,bytes}=await readMetadata(file,head,check);
    if(value.identitySha256!==this.#identitySha256)throw Error('Hero route head identity differs');
    return {...value,manifest:new TextDecoder().decode(bytes)};
  }
  async #node(pointer,check=unchecked){
    const {value,bytes}=await readMetadata(await this.#open(nodeFile(pointer.revision),check),node,check);
    if(hash(bytes)!==pointer.nodeSha256||value.identitySha256!==this.#identitySha256||value.revision!==pointer.revision)
      throw Error('Damaged hero route node');return value;
  }
  async #lookup(h,regions,check=unchecked){
    // At most two entries retained, independent of visited-region count.
    const found=new Map();let pointer=h;
    while(pointer&&found.size<regions.length){
      const n=await this.#node(pointer,check);
      for(const e of n.changes)if(regions.includes(e.region)&&!found.has(e.region))found.set(e.region,e);
      pointer=n.previous;
    }
    return found;
  }
  async #source(e,lease){
    const file=await this.#open(worldFile(e),lease?()=>lease.check():unchecked);
    if(!file||file.size!==e.world.size)throw Error('Damaged hero route world');
    const source=lease?lease.source(file,e.world.size):file;
    if(await hashCheckpointSource(source)!==e.world.sha256)throw Error('Damaged hero route world');return source;
  }
  async #verify(e,source,present){
    await verifyRegisteredHeroSnapshot(this.#identity,e.alias,e.homeAlias,source,present,e.region);
    await verifyEntitySnapshot(this.#identity,e.alias,source,present,e.homeAlias);
  }
  async #selected(check=unchecked){
    const h=await this.#head(check);check();if(!h)return null;
    const n=await this.#node(h,check),owner=n.changes.at(-1);
    check();
    return {head:h,node:n,owner};
  }
  read({signal}={}){
    checkCheckpointReadSignal(signal);
    return this.#io.withLock('shared',async()=>{
      const lease=new CheckpointReadLease({maximum:1,ended:'Hero route owner lease ended',
        bounds:'Unbounded hero route owner read',truncated:'Truncated hero route owner read',signal});
      try{
        const selected=await this.#selected(()=>lease.check());lease.check();if(!selected)return null;
        await this.#verify(selected.owner,await this.#source(selected.owner,lease),true);lease.check();
        return {record:clone(selected.head),owner:{entityId:this.#identity.entityId,region:selected.owner.region,...selected.owner.alias}};
      }finally{lease.revoke();}
    });
  }
  // Loading/saving the current kingdom needs only its selected checkpoint.
  // Do not open dormant destination worlds just to export the active owner.
  withOwner(consume,{signal}={}){
    if(typeof consume!=='function')throw Error('Invalid hero route owner consumer');
    checkCheckpointReadSignal(signal);
    return this.#io.withLock('shared',async()=>{
      const lease=new CheckpointReadLease({maximum:1,ended:'Hero route owner lease ended',
        bounds:'Unbounded hero route owner read',truncated:'Truncated hero route owner read',signal});
      try{
        const selected=await this.#selected(()=>lease.check());
        lease.check();
        if(!selected)throw Error('Hero route is not seeded');
        const entry=selected.owner,source=await this.#source(entry,lease);
        await this.#verify(entry,source,true);
        lease.check();
        const result=await consume({record:clone(selected.head),entry:clone(entry),
          owner:{entityId:this.#identity.entityId,region:entry.region,...entry.alias},source});
        lease.check();
        if(await hashCheckpointSource(source)!==entry.world.sha256)throw Error('Hero route owner source changed');
        return result;
      }finally{lease.revoke();}
    });
  }
  // Inspect authenticated metadata without retaining checkpoints for every
  // visited kingdom. The caller still verifies its exact saved pair before use.
  hasVisitedRegion(destinationRegion,{signal}={}){
    region(destinationRegion);checkCheckpointReadSignal(signal);
    return this.#io.withLock('shared',async()=>{
      const check=()=>checkCheckpointReadSignal(signal),h=await this.#head(check);
      if(!h)throw Error('Hero route is not seeded');
      const known=await this.#lookup(h,[destinationRegion],check);check();
      return known.has(destinationRegion);
    });
  }
  // A new region needs one stopped candidate; revisits always read the selected
  // journal checkpoint. Escaped readers are revoked when the callback ends.
  withDestination(destinationRegion,candidate,consume,{signal}={}){
    region(destinationRegion);
    if(typeof consume!=='function')throw Error('Invalid hero route consumer');
    checkCheckpointReadSignal(signal);
    // Capture proposals before the first await; checkpoint readers are leased.
    const proposed=candidate?{...input(candidate.source,candidate.sha256),alias:alias(candidate.alias),
      homeAlias:canonicalHeroHomeAliases([candidate.homeAlias,candidate.homeAlias])[0]}:null;
    return this.#io.withLock('shared',async()=>{
      const lease=new CheckpointReadLease({maximum:2,ended:'Hero route lease ended',bounds:'Unbounded hero route read',truncated:'Truncated hero route read',signal});
      try{
        const check=()=>lease.check(),selected=await this.#selected(check);if(!selected)throw Error('Hero route is not seeded');
        if(destinationRegion===selected.owner.region)throw Error('Hero route destination is current region');
        const known=(await this.#lookup(selected.head,[destinationRegion],check)).get(destinationRegion);
        check();
        if(known&&proposed)throw Error('Visited hero route region must use selected checkpoint');
        if(!known&&!proposed)throw Error('Unvisited hero route region needs a stopped candidate');
        const from=selected.owner,to=known??{region:destinationRegion,slot:0,alias:proposed.alias,homeAlias:proposed.homeAlias,world:proposed.world};
        const source=await this.#source(from,lease),destination=known?await this.#source(to,lease):lease.source(proposed.source,to.world.size);
        if(!known&&await hashCheckpointSource(destination)!==to.world.sha256)throw Error('Hero route candidate digest differs');
        await this.#verify(from,source,true);await this.#verify(to,destination,false);
        lease.check();
        const result=await consume({record:clone(selected.head),owner:{entityId:this.#identity.entityId,region:from.region,...from.alias},
          entries:[clone(from),clone(to)],regions:[from.region,to.region],sources:[source,destination]});
        lease.check();
        for(const [i,s]of [source,destination].entries())if(await hashCheckpointSource(s)!==[from,to][i].world.sha256)
          throw Error('Hero route preparation source changed');
        return result;
      }finally{lease.revoke();}
    });
  }
  async commit(request,boundary=async()=>{}){
    if(!request||typeof boundary!=='function'||!['seed','save','handoff'].includes(request.kind)||!digest(request.operationId)||
       !(request.expectedManifest===null||typeof request.expectedManifest==='string')||!Array.isArray(request.regions)||
       request.regions.length!==(request.kind==='handoff'?2:1)||!Array.isArray(request.worlds)||request.worlds.length!==request.regions.length||
       !Array.isArray(request.aliases)||request.aliases.length!==request.regions.length||
       !Array.isArray(request.homeAliases)||request.homeAliases.length!==request.regions.length)throw Error('Invalid hero route commit');
    const kind=request.kind,operationId=request.operationId,expectedManifest=request.expectedManifest;
    const regions=request.regions.map(region);
    if(new Set(regions).size!==regions.length)throw Error('Duplicate hero route region');
    const inputs=request.worlds.map(w=>input(w.source,w.sha256));
    const changes=regions.map((r,i)=>entry({region:r,slot:0,alias:alias(request.aliases[i]),
      homeAlias:request.homeAliases[i],world:inputs[i].world}));
    return this.#io.withLock('exclusive',async()=>{
      const selected=await this.#selected(),h=selected?.head??null;
      // Retrying after publication must identify the identical transaction.
      if(selected?.node.operationId===operationId){
        const old=selected.node;
        if(old.kind!==kind||JSON.stringify(old.changes.map(e=>({...e,slot:0})))!==JSON.stringify(changes)||
           (old.previous?new TextDecoder().decode(encode(old.previous)):null)!==expectedManifest)
          throw Error('Hero route operation ID reused for different state');
        for(const e of old.changes)await this.#verify(e,await this.#source(e),e.region===old.ownerRegion);
        return {...clone(h),idempotent:true};
      }
      if((h?.manifest??null)!==expectedManifest)throw Error('Hero route changed; reload before committing');
      if(h?.revision===0xffffffff)throw Error('Hero route revision exhausted');
      if(!selected){
        if(kind!=='seed'||regions[0]!==this.#identity.registeredHome.home.region)throw Error('Hero route must seed its actual home region');
      }else{
        if(kind==='seed'||regions[0]!==selected.owner.region)throw Error('Hero route must depart from current owner');
        if(JSON.stringify(changes[0].alias)!==JSON.stringify(selected.owner.alias)||
           JSON.stringify(changes[0].homeAlias)!==JSON.stringify(selected.owner.homeAlias))throw Error('Hero route cannot rebind outgoing owner');
        await this.#verify(selected.owner,await this.#source(selected.owner),true);
      }
      const known=h?await this.#lookup(h,regions):new Map();
      for(let i=0;i<changes.length;i++){
        const e=changes[i],old=known.get(e.region);
        if(old){
          e.slot=1-old.slot;
          if(e.world.sha256===old.world.sha256)throw Error('Hero route transaction must evolve changed worlds');
          if(i===1){
            await this.#verify(old,await this.#source(old),false);
            if(e.alias.unitId<=old.alias.unitId||e.alias.agentId<=old.alias.agentId||
               JSON.stringify(e.homeAlias)!==JSON.stringify(old.homeAlias))throw Error('Hero route return requires fresh aliases and preserved home');
            // The previously retired native/script aliases may not reappear.
            await verifyEntitySnapshot(this.#identity,old.alias,inputs[i].source,false,old.homeAlias);
          }
        }
        await this.#verify(e,inputs[i].source,i===changes.length-1);
      }
      await this.#binding(true);
      for(let i=0;i<changes.length;i++){
        const e=changes[i],s=inputs[i].source;
        await this.#io.atomicWrite(worldFile(e),async sink=>{
          if(s.size!==e.world.size||await hashCheckpointSource(s,b=>sink.write(b))!==e.world.sha256)
            throw Error('Hero route source digest differs');
        });
        await this.#verify(e,await this.#source(e),i===changes.length-1);
        await boundary(i===0?'after-source':'after-destination');
      }
      const previous=h?pointer(h):null,revision=h?h.revision+1:0;
      const next=node({version:1,identitySha256:this.#identitySha256,revision,previous,kind,
        ownerRegion:regions.at(-1),operationId,changes}),bytes=encode(next);
      await this.#io.atomicWrite(nodeFile(revision),s=>s.write(new Uint8Array(bytes)));
      const newHead=head({version:1,identitySha256:this.#identitySha256,revision,nodeSha256:hash(bytes)});
      await this.#node(newHead);await boundary('before-publish');
      // Publication selects both staged worlds. Recheck them together after
      // the final fault boundary, not just immediately after each copy.
      for(const e of changes)await this.#verify(e,await this.#source(e),e.region===next.ownerRegion);
      const published=encode(newHead);await this.#io.atomicWrite(HERO_ROUTE_HEAD,s=>s.write(new Uint8Array(published)));
      await boundary('after-publish');return {...newHead,manifest:new TextDecoder().decode(published),idempotent:false};
    });
  }
}

// Discover a previously seeded route without scanning a region directory or
// reading a dormant world. The caller supplies the expected immutable origin;
// the normal store binding check also detects replacement after this lock ends.
export function openHeroRouteStore(io,{worldId,entityId,contentDigest,signal}={}){
  if(!io||!['open','atomicWrite','withLock'].every(k=>typeof io[k]==='function')||
      ![worldId,entityId,contentDigest].every(digest))throw Error('Invalid hero route opening identity');
  checkCheckpointReadSignal(signal);
  const check=()=>checkCheckpointReadSignal(signal);
  return io.withLock('shared',async()=>{
    check();const file=await io.open(HERO_ROUTE_IDENTITY);check();
    const {value}=await readMetadata(file,v=>JSON.parse(new TextDecoder().decode(encodeRevisionIdentity(v))),check);
    check();
    if(value.version!==2||value.entityId!==entityId||value.contentDigest!==contentDigest||
        value.registeredHome.worldId!==worldId)throw Error('Hero route opening identity differs');
    return new HeroRouteStore(io,value,contentDigest);
  });
}

// Local launcher discovery reads canonical origin metadata only. Choosing a
// game still requires the expected identities and verified installed content.
export function readHeroRouteIdentity(io,{signal}={}){
  if(!io||typeof io.open!=='function'||typeof io.withLock!=='function')throw Error('Invalid hero identity storage');
  checkCheckpointReadSignal(signal);const check=()=>checkCheckpointReadSignal(signal);
  return io.withLock('shared',async()=>{
    check();const file=await io.open(HERO_ROUTE_IDENTITY);check();if(file===null)return null;
    const {value}=await readMetadata(file,v=>JSON.parse(new TextDecoder().decode(encodeRevisionIdentity(v))),check);
    if(value.version!==2)throw Error('Hero journey requires a registered guild origin');
    return value;
  });
}
