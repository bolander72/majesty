// Bounded stopped-world revisions. Engines must be quiescent; this does not
// capture native state, reserve IDs, migrate actors or prove reference closure.
import {Sha256} from './sha256.mjs';
import {regionKey} from './region.mjs';
import {MAX_CHECKPOINT_BYTES} from './checkpoint.mjs';
import {CheckpointReadLease} from './checkpoint-lease.mjs';
import {hashCheckpointSource} from './transfer-store.mjs';
import {verifyEntityOwnership} from './entity-ownership.mjs';
import {registeredHeroHome,canonicalHeroHomeAliases} from './entity-home-ownership.mjs';

export const REVISION_IDENTITY='Frontier_Revision_Identity.json';
export const REVISION_MANIFEST='Frontier_Revision.checkpoint';
export const MAX_REVISION_BYTES=4096;
const sha=b=>new Sha256().update(b).hex();
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...k].sort().join(',');
const uint=(v,max=0xffffffff)=>Number.isInteger(v)&&v>=0&&v<=max;
const clone=v=>JSON.parse(JSON.stringify(v));
function encode(value) {
  const bytes=new TextEncoder().encode(JSON.stringify(value)+'\n');
  if(bytes.length>MAX_REVISION_BYTES)throw Error('Revision metadata exceeds bound');return bytes;
}
function decode(bytes,encoder) {
  if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>MAX_REVISION_BYTES)throw Error('Invalid revision metadata bytes');
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),canonical=encoder(value);
  if(bytes.length!==canonical.length||bytes.some((v,i)=>v!==canonical[i]))throw Error('Noncanonical revision metadata');return clone(value);
}
export function encodeRevisionIdentity(o) {
  if(!keys(o,['version','entityId','contentDigest','regions','actor',...(o?.version===2?['registeredHome']:[])])||
    ![1,2].includes(o.version)||!digest(o.entityId)||!digest(o.contentDigest)||
    !Array.isArray(o.regions)||o.regions.length!==2||o.regions[0]===o.regions[1]||!keys(o.actor,['family','description','playerNumber'])||
    !['BLDG','VHCL','GRND','RWRD','MSGF','OFMP'].includes(o.actor.family)||!uint(o.actor.description)||!o.actor.description||
    !Number.isInteger(o.actor.playerNumber)||o.actor.playerNumber<-1||o.actor.playerNumber>7)throw Error('Invalid revision identity');
  const regions=o.regions.map(r=>{
    if(typeof r!=='string'||r.length>24)throw Error('Invalid revision region');const p=r.split('_').map(Number);
    if(p.length!==2||regionKey(...p)!==r)throw Error('Invalid revision region');return r;
  });
  return encode({version:o.version,entityId:o.entityId,contentDigest:o.contentDigest,regions,
    actor:{family:o.actor.family,description:o.actor.description,playerNumber:o.actor.playerNumber},
    ...(o.version===2?{registeredHome:registeredHeroHome(o).record}:{})});
}
function alias(o) {
  if(!keys(o,['unitId','agentId'])||!uint(o.unitId)||!o.unitId||!uint(o.agentId,0x7fffffff)||!o.agentId)throw Error('Invalid revision alias');
  return {unitId:o.unitId,agentId:o.agentId};
}
function descriptor(o) {
  if(!keys(o,['size','sha256'])||!uint(o.size,MAX_CHECKPOINT_BYTES)||o.size<16||!digest(o.sha256))throw Error('Invalid revision world');
  return {size:o.size,sha256:o.sha256};
}
export function encodeEntityRevision(o) {
  if(!keys(o,['version','identitySha256','revision','previous','operationId','kind','ownerSide','visitedSides','aliases','referenceBindings','worlds',
      ...(o?.version===2?['homeAliases']:[])])||
    ![1,2].includes(o.version)||!digest(o.identitySha256)||!uint(o.revision)||!digest(o.operationId)||
    !['seed','save','handoff'].includes(o.kind)||!(o.previous===null||digest(o.previous))||
    (o.revision===0)!==(o.kind==='seed')||(o.revision===0)!==(o.previous===null)||
    !uint(o.ownerSide,1)||!uint(o.visitedSides,3)||!(o.visitedSides&(1<<o.ownerSide))||
    !Array.isArray(o.aliases)||o.aliases.length!==2||!Array.isArray(o.referenceBindings)||o.referenceBindings.length>16||
    !Array.isArray(o.worlds)||o.worlds.length!==2)throw Error('Invalid entity revision');
  const aliases=o.aliases.map(alias),seen=[new Set(),new Set()];let previousUnit=0;
  const referenceBindings=o.referenceBindings.map(b=>{
    if(!keys(b,['source','destination']))throw Error('Invalid revision reference');
    const a=alias(b.source),d=alias(b.destination);
    if(a.unitId<=previousUnit)throw Error('Noncanonical revision reference order');previousUnit=a.unitId;
    for(const [i,v] of [a,d].entries()){
      if(v.unitId===aliases[i].unitId||v.agentId===aliases[i].agentId||seen[i].has('u'+v.unitId)||seen[i].has('a'+v.agentId))throw Error('Ambiguous revision reference');
      seen[i].add('u'+v.unitId);seen[i].add('a'+v.agentId);
    }
    return {source:a,destination:d};
  });
  const homeAliases=o.version===2?canonicalHeroHomeAliases(o.homeAliases):null;
  if(homeAliases)for(const [i,h] of homeAliases.entries())
    if(h.agentId===aliases[i].agentId||h.unitId===aliases[i].unitId||seen[i].has('a'+h.agentId)||
       (h.unitId&&seen[i].has('u'+h.unitId)))throw Error('Ambiguous registered home alias');
  return encode({version:o.version,identitySha256:o.identitySha256,revision:o.revision,previous:o.previous,operationId:o.operationId,
    kind:o.kind,ownerSide:o.ownerSide,visitedSides:o.visitedSides,aliases,referenceBindings,worlds:o.worlds.map(descriptor),
    ...(homeAliases?{homeAliases}:{})});
}
const stateFile=slot=>`Frontier_Revision_State_${slot}.json`;
const worldFile=(side,slot)=>`Frontier_Revision_${side?'Destination':'Source'}_${slot}.GMP`;
function marker(text,identitySha256) {
  if(typeof text!=='string'||text.length>256||/[^\x20-\x7e\n]/.test(text))throw Error('Invalid revision manifest');
  const a=text.split('\n'),revision=Number(a[2]);
  if(a.length!==6||a[5]!==''||a[0]!=='majesty-entity-revision-v1'||!/^[01]$/.test(a[1])||
    !uint(revision)||String(revision)!==a[2]||a[3]!==identitySha256||!digest(a[4]))throw Error('Invalid revision manifest identity');
  return {slot:Number(a[1]),revision,stateSha256:a[4],manifest:text};
}
async function bounded(file) {
  if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_REVISION_BYTES||typeof file.readAt!=='function')throw Error('Missing or oversized revision metadata');
  const bytes=await file.readAt(0,file.size);
  if(!(bytes instanceof Uint8Array)||bytes.length!==file.size)throw Error('Truncated revision metadata');return bytes;
}
export class EntityRevisionStore {
  #io;#identity;#bytes;#digest;
  constructor(io,identity,contentDigest) {
    if(!io||!['open','atomicWrite','withLock'].every(k=>typeof io[k]==='function'))throw Error('Invalid revision storage');
    this.#bytes=encodeRevisionIdentity(identity);this.#identity=decode(this.#bytes,encodeRevisionIdentity);this.#digest=sha(this.#bytes);this.#io=io;
    if(this.#identity.contentDigest!==contentDigest)throw Error('Revision content differs');
  }
  get identity(){return clone(this.#identity);}
  async #binding(create=false,boundary=async()=>{}) {
    const file=await this.#io.open(REVISION_IDENTITY);
    if(file===null&&create){await this.#io.atomicWrite(REVISION_IDENTITY,sink=>sink.write(new Uint8Array(this.#bytes)));await this.#binding();await boundary('after-identity');return;}
    if(sha(await bounded(file))!==this.#digest)throw Error('Damaged revision identity');
  }
  async #read(lease) {
    const file=await this.#io.open(REVISION_MANIFEST);if(file===null)return null;
    const m=marker(new TextDecoder('utf-8',{fatal:true}).decode(await bounded(file)),this.#digest);await this.#binding();
    const bytes=await bounded(await this.#io.open(stateFile(m.slot)));
    if(sha(bytes)!==m.stateSha256)throw Error('Damaged selected revision state');
    const state=decode(bytes,encodeEntityRevision);
    if(state.version!==this.#identity.version||state.identitySha256!==this.#digest||state.revision!==m.revision)throw Error('Selected revision identity differs');
    const sources=[];
    for(let i=0;i<2;++i) {
      const source=await this.#io.open(worldFile(i,m.slot)),w=state.worlds[i];
      if(!source||source.size!==w.size||await hashCheckpointSource(source)!==w.sha256)throw Error('Damaged selected revision world');
      sources.push(lease?lease.source(source,w.size):source);
    }
    await verifyEntityOwnership(this.#identity,state.aliases,state.referenceBindings,sources.map(source=>({source})),state.ownerSide,state.homeAliases);
    const owner={entityId:this.#identity.entityId,region:this.#identity.regions[state.ownerSide],...state.aliases[state.ownerSide]};
    return {record:{...m,state,worlds:clone(state.worlds)},owner,...(lease?{sources}:{})};
  }
  #withSelected(consume,metadataFilename=null) {
    if(typeof consume!=='function')return Promise.reject(Error('Invalid revision consumer'));
    return this.#io.withLock('shared',async()=>{
      const lease=new CheckpointReadLease({maximum:2,ended:'Revision lease ended',bounds:'Unbounded revision read',truncated:'Truncated revision world'});
      try{
        const selected=await this.#read(lease);
        if(selected&&metadataFilename!==null) {
          const file=await this.#io.open(metadataFilename);
          selected.metadata=file===null?null:new Uint8Array(await bounded(file));
        }
        return await consume(selected);
      }finally{lease.revoke();}
    });
  }
  withSelected(consume){return this.#withSelected(consume);}
  // One copied <=4 KiB record, under the same adapter lock as ownership.
  // Callers must use this adapter/lock for metadata publication too.
  withSelectedMetadata(filename,consume) {
    if(typeof filename!=='string'||filename.length>128||!filename.length||
       !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(filename))
      return Promise.reject(Error('Invalid selected metadata filename'));
    return this.#withSelected(consume,filename);
  }
  read(){return this.withSelected(v=>v?{record:v.record,owner:v.owner}:null);}
  async commit({worlds,aliases,referenceBindings,ownerSide,visitedSides,operationId,kind,expectedManifest,homeAliases},boundary=async()=>{}) {
    if(!Array.isArray(worlds)||worlds.length!==2||typeof boundary!=='function'||!(expectedManifest===null||typeof expectedManifest==='string'))throw Error('Invalid revision commit');
    const previous=expectedManifest===null?null:marker(expectedManifest,this.#digest);
    if(previous?.revision===0xffffffff)throw Error('Revision counter exhausted');
    const inputs=worlds.map(w=>{
      if(!w?.source||typeof w.source.readAt!=='function')throw Error('Invalid revision source');
      return {source:w.source,size:w.source.size,sha256:w.sha256};
    });
    if(this.#identity.version===1&&homeAliases!==undefined)throw Error('Native-only revision identity cannot use home aliases');
    const state=decode(encodeEntityRevision({version:this.#identity.version,identitySha256:this.#digest,revision:previous?previous.revision+1:0,
      previous:previous?sha(new TextEncoder().encode(previous.manifest)):null,operationId,kind,ownerSide,visitedSides,aliases,referenceBindings,
      worlds:inputs.map(({size,sha256})=>({size,sha256})),
      ...(this.#identity.version===2?{homeAliases}:{})}),encodeEntityRevision),bytes=encodeEntityRevision(state);
    return this.#io.withLock('exclusive',async()=>{
      const old=await this.#read();
      if(old?.record.state.operationId===state.operationId) {
        if(sha(encodeEntityRevision(old.record.state))!==sha(bytes))throw Error('Revision operation ID reused for different state');
        return {...old.record,idempotent:true};
      }
      if((old?.record.manifest??null)!==expectedManifest)throw Error('Revision changed; reload before committing');
      if(old) {
        const before=old.record.state;
        if(state.version===2&&(JSON.stringify(state.referenceBindings)!==JSON.stringify(before.referenceBindings)||
           (kind==='save'&&JSON.stringify(state.homeAliases)!==JSON.stringify(before.homeAliases))||
           (kind==='handoff'&&JSON.stringify(state.homeAliases[before.ownerSide])!==JSON.stringify(before.homeAliases[before.ownerSide]))))
          throw Error('Registered home save/handoff cannot rebind preserved aliases or references');
        if(kind==='save') {
          if(ownerSide!==before.ownerSide||visitedSides!==before.visitedSides||JSON.stringify(state.aliases)!==JSON.stringify(before.aliases)||
            JSON.stringify(state.worlds[1-ownerSide])!==JSON.stringify(before.worlds[1-ownerSide])||
            state.worlds[ownerSide].sha256===before.worlds[ownerSide].sha256)throw Error('Save must evolve the active owner and preserve dormant world/aliases');
        } else if(kind==='handoff') {
          const from=before.ownerSide,to=1-from;
          if(ownerSide!==to||visitedSides!==(before.visitedSides|(1<<to))||
            JSON.stringify(state.aliases[from])!==JSON.stringify(before.aliases[from])||
            state.worlds.some((w,i)=>w.sha256===before.worlds[i].sha256)||
            (before.visitedSides&(1<<to))&&(state.aliases[to].unitId<=before.aliases[to].unitId||state.aliases[to].agentId<=before.aliases[to].agentId))
            throw Error('Handoff must retire outgoing owner and use fresh incoming aliases on return');
        } else throw Error('Cannot seed an existing revision store');
      }
      await this.#binding(true,boundary);
      await verifyEntityOwnership(this.#identity,state.aliases,state.referenceBindings,inputs,state.ownerSide,state.homeAliases);
      const slot=old?.record.slot===0?1:0;
      const stagedInputs=[];
      for(let i=0;i<2;++i) {
        const input=inputs[i];
        if(input.source.size!==input.size)throw Error('Revision source size changed');
        await this.#io.atomicWrite(worldFile(i,slot),async sink=>{
          if(await hashCheckpointSource(input.source,b=>sink.write(b))!==input.sha256)throw Error('Revision source digest differs');
        });
        const staged=await this.#io.open(worldFile(i,slot));
        if(!staged||staged.size!==input.size||await hashCheckpointSource(staged)!==input.sha256)throw Error('Revision staging differs');
        stagedInputs.push({source:staged});
        if(i===0)await boundary('after-source');
      }
      await verifyEntityOwnership(this.#identity,state.aliases,state.referenceBindings,stagedInputs,state.ownerSide,state.homeAliases);
      await this.#io.atomicWrite(stateFile(slot),sink=>sink.write(new Uint8Array(bytes)));
      if(sha(await bounded(await this.#io.open(stateFile(slot))))!==sha(bytes))throw Error('Revision state staging differs');
      await boundary('after-state');
      const text=['majesty-entity-revision-v1',slot,state.revision,this.#digest,sha(bytes),''].join('\n'),record=marker(text,this.#digest);
      await boundary('before-publish');
      await this.#io.atomicWrite(REVISION_MANIFEST,sink=>sink.write(new TextEncoder().encode(text)));
      await boundary('after-publish');
      return {...record,state:clone(state),worlds:clone(state.worlds),idempotent:false};
    });
  }
}
export function openEntityRevisionStore(io,contentDigest) {
  return io.withLock('shared',async()=>new EntityRevisionStore(io,decode(await bounded(await io.open(REVISION_IDENTITY)),encodeRevisionIdentity),contentDigest));
}
export {marker as parseEntityRevisionManifest};
