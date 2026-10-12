// One stopped NPC handoff with immutable aliases/reference bindings. This does
// not pause an engine, synthesize native snapshots or implement repeated travel.
import {PairedCheckpointStore, ENTITY_LEDGER_FILE} from './transfer-store.mjs';
import {Sha256} from './sha256.mjs';
import {regionKey} from './region.mjs';
import {MAX_CHECKPOINT_BYTES} from './checkpoint.mjs';
import {verifyEntityOwnership} from './entity-ownership.mjs';

export const MAX_ENTITY_LEDGER_BYTES = 4096, MAX_ENTITY_REFERENCE_BINDINGS = 16;
const digest = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const positive = (v, max=0x7fffffff) => Number.isInteger(v) && v > 0 && v <= max;
const keys = (o, names) => o && typeof o === 'object' && !Array.isArray(o) &&
  Object.keys(o).sort().join(',') === [...names].sort().join(',');
const hash = bytes => new Sha256().update(bytes).hex();
function alias(o) {
  if (!keys(o,['unitId','agentId']) || !positive(o.unitId,0xffffffff) || !positive(o.agentId)) throw Error('Invalid entity alias');
  return {unitId:o.unitId,agentId:o.agentId};
}
function descriptor(o) {
  if (!keys(o,['size','sha256']) || !Number.isSafeInteger(o.size) || o.size < 16 || o.size > MAX_CHECKPOINT_BYTES || !digest(o.sha256))
    throw Error('Invalid entity snapshot descriptor');
  return {size:o.size,sha256:o.sha256};
}
export function encodeEntityLedger(o) {
  if (!keys(o,['version','entityId','contentDigest','regions','actor','aliases','referenceBindings','before','after']) ||
      o.version !== 1 || !digest(o.entityId) || !digest(o.contentDigest) || !Array.isArray(o.regions) || o.regions.length !== 2 ||
      o.regions[0] === o.regions[1] || !keys(o.actor,['family','description','playerNumber']) ||
      !['BLDG','VHCL','GRND','RWRD','MSGF','OFMP'].includes(o.actor.family) || !positive(o.actor.description,0xffffffff) ||
      !Number.isInteger(o.actor.playerNumber) || o.actor.playerNumber < -1 || o.actor.playerNumber > 7 ||
      !Array.isArray(o.aliases) || o.aliases.length !== 2 || !Array.isArray(o.referenceBindings) || o.referenceBindings.length > MAX_ENTITY_REFERENCE_BINDINGS ||
      !Array.isArray(o.before) || o.before.length !== 2 || !Array.isArray(o.after) || o.after.length !== 2)
    throw Error('Invalid entity ledger');
  const regions=o.regions.map(r=>{
    if(typeof r!=='string'||r.length>24)throw Error('Invalid entity region');
    const p=r.split('_').map(Number);if(p.length!==2||regionKey(...p)!==r)throw Error('Invalid entity region');return r;
  });
  const aliases=o.aliases.map(alias), seen=[new Set(),new Set()];let previous=0;
  const bindings=o.referenceBindings.map(b=>{
    if(!keys(b,['source','destination']))throw Error('Invalid entity reference binding');
    const a=alias(b.source),c=alias(b.destination);
    if(a.unitId<=previous)throw Error('Noncanonical entity reference binding order');previous=a.unitId;
    for(const [i,v] of [a,c].entries()){
      if(v.unitId===aliases[i].unitId||v.agentId===aliases[i].agentId||seen[i].has('u'+v.unitId)||seen[i].has('a'+v.agentId))
        throw Error('Ambiguous entity reference binding');
      seen[i].add('u'+v.unitId);seen[i].add('a'+v.agentId);
    }
    return {source:a,destination:c};
  });
  const value={version:1,entityId:o.entityId,contentDigest:o.contentDigest,regions,
    actor:{family:o.actor.family,description:o.actor.description,playerNumber:o.actor.playerNumber},
    aliases,referenceBindings:bindings,before:o.before.map(descriptor),after:o.after.map(descriptor)};
  if(value.before.some((w,i)=>w.sha256===value.after[i].sha256))throw Error('Entity handoff requires changed snapshots on both sides');
  const bytes=new TextEncoder().encode(JSON.stringify(value)+'\n');
  if(bytes.length>MAX_ENTITY_LEDGER_BYTES)throw Error('Entity ledger exceeds bound');
  return bytes;
}
export function decodeEntityLedger(bytes,contentDigest) {
  if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>MAX_ENTITY_LEDGER_BYTES||!digest(contentDigest))throw Error('Invalid entity ledger bytes');
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),canonical=encodeEntityLedger(value);
  if(value.contentDigest!==contentDigest||bytes.length!==canonical.length||bytes.some((b,i)=>b!==canonical[i]))throw Error('Entity ledger identity or encoding differs');
  return JSON.parse(new TextDecoder().decode(canonical));
}

export class EntityPairStore {
  #ledger; #store;
  constructor(io,ledger,contentDigest) {
    const bytes=encodeEntityLedger(ledger);this.#ledger=decodeEntityLedger(bytes,contentDigest);
    const sha256=hash(bytes),content='majesty-entity-pair-v1:'+contentDigest+':'+sha256;
    this.#store=new PairedCheckpointStore(io,{regions:this.#ledger.regions,content,
      binding:{name:ENTITY_LEDGER_FILE,bytes,sha256}});
  }
  get ledger(){return JSON.parse(JSON.stringify(this.#ledger));}
  async #verify(worlds,moved) {
    const ledger=this.#ledger, selected=ledger[moved?'after':'before'];
    if(!Array.isArray(worlds)||worlds.length!==2)throw Error('Entity pair requires two snapshots');
    const input=worlds.map((w,i)=>{
      if(!w||w.sha256!==selected[i].sha256||w.source?.size!==selected[i].size||typeof w.source.readAt!=='function')
        throw Error('Entity pair snapshot identity differs');
      return {source:w.source,sha256:w.sha256};
    });
    await verifyEntityOwnership(ledger,ledger.aliases,ledger.referenceBindings,input,Number(moved));
    return input;
  }
  async initialize({worlds},boundary){
    const inputs=await this.#verify(worlds,false);
    return this.#store.commit({worlds:inputs,moved:false,expectedManifest:null},boundary);
  }
  async publish({worlds,expectedManifest},boundary){
    const inputs=await this.#verify(worlds,true);
    return this.#store.commit({worlds:inputs,moved:true,expectedManifest},boundary);
  }
  withSelected(consume){
    if(typeof consume!=='function')return Promise.reject(Error('Invalid entity-pair consumer'));
    return this.#store.withSelected(async selected=>{
      if(!selected)return consume(null);
      const {record,sources}=selected;
      await this.#verify(sources.map((source,i)=>({source,sha256:record.worlds[i].sha256})),record.moved);
      const side=Number(record.moved),owner={entityId:this.#ledger.entityId,region:this.#ledger.regions[side],...this.#ledger.aliases[side]};
      return consume({...selected,owner});
    });
  }
  read(){return this.withSelected(selected=>selected?{record:selected.record,owner:selected.owner}:null);}
}

export function openEntityPairStore(io,contentDigest){
  return io.withLock('shared',async()=>{
    const file=await io.open(ENTITY_LEDGER_FILE);
    if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_ENTITY_LEDGER_BYTES)throw Error('Missing or invalid entity ledger');
    const bytes=await file.readAt(0,file.size);
    return new EntityPairStore(io,decodeEntityLedger(bytes,contentDigest),contentDigest);
  });
}
