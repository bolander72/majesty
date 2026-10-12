#!/usr/bin/env node
// Prepare the actual committed Warrior for its registered native home.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {join,resolve,basename,dirname} from 'node:path';
import {workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {prepareSelectedRegisteredHeroArrival} from '../web/world/registered-hero-arrival.mjs';
import {inspectNativeHeroPairReload} from './inspect-native-hero-pair-reload.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
export async function prepareNativeHeroReturn(reloadName) {
 assert.ok((await stat(reloadName)).size<=65536);const r=JSON.parse(await readFile(reloadName,'utf8'));
 const checked=await inspectNativeHeroPairReload(...r.sides.map(s=>s.sourceManifest));
 assert.equal(checked.actualRegisteredHeroFreshPairedNativeReloadQualified,true);
 assert.equal(checked.publication,r.publication);assert.equal(checked.publicationSha256,r.publicationSha256);
 const pub=JSON.parse(await readFile(r.publication,'utf8')),stats={},io=await stoppedRevisionStorage(pub.fixture,stats);
 io.atomicWrite=async()=>{throw Error('Actual return preparation is read-only');};
 const store=await openEntityRevisionStore(io,pub.identity.contentDigest),selected=await store.read();
 assert.equal(selected.record.manifest,pub.selectedManifest);assert.equal(selected.record.revision,1);
 assert.deepEqual(selected.owner,checked.selectedOwner);assert.equal(selected.owner.region,'1_0');
 const files=(await readdir(pub.fixture)).sort(),before={};for(const n of files)before[n]=await hash(join(pub.fixture,n));
 const request={expectedManifest:selected.record.manifest,freshUnitId:100002,freshAgentId:1002,unitBindings:[],attachedUnitBindings:[]};
 const prepared=await prepareSelectedRegisteredHeroArrival(store,request),plan=prepared.plan;
 assert.deepEqual([plan.sourceClockMs,plan.destinationClockMs,plan.unitId,plan.agentId],[24250,25800,554,48]);
 assert.deepEqual(Object.fromEntries(Object.entries(prepared.records).map(([k,v])=>[k,v.length])),{unit:442,agent:1853,container:84});
 assert.equal(plan.contexts.length,12);const active=plan.contexts.filter(c=>c.active);
 assert.equal(active.length,1);assert.deepEqual([active[0].attribute,active[0].flags,active[0].delay,active[0].stamp,active[0].after,active[0].elapsed],['activescript',2,300,19300,20850,4950]);
 assert.equal(plan.contexts.filter(c=>c.paused).length,0);assert.equal(plan.registeredHome.occupiedSlots,1);
 assert.deepEqual([plan.registeredHome.source.kind,plan.registeredHome.destination.kind,plan.registeredHome.destination.unitId,plan.registeredHome.destination.agentId],['proxy','native',469,7]);
 assert.equal(plan.registeredHome.scriptArrival.destinationMemberCount,0);assert.equal(plan.registeredHome.nativeArrival.groupKind,100);
 // Independently reconstruct byte edits and the one CONT101 insertion.
 for(const [name,range] of Object.entries(plan.ranges)) {
  assert.ok(range.size<=4096);const original=await store.withSelected(s=>s.sources[1].readAt(range.offset,range.size)),expected=Uint8Array.from(original),view=new DataView(expected.buffer);
  for(const e of plan.edits.filter(e=>e.record===name)){assert.equal(view.getUint32(e.offset-range.offset,true),e.before);view.setUint32(e.offset-range.offset,e.after,true);}
  const t=plan.containerTransforms.find(t=>t.record===name);let result=expected;
  if(t){assert.equal(name,'container');assert.equal(t.removeBytes,0);assert.deepEqual(t.insertWords,[469,1]);const at=t.offset-range.offset,insert=new Uint8Array(8),v=new DataView(insert.buffer);v.setUint32(0,469,true);v.setUint32(4,1,true);result=new Uint8Array(expected.length+8);result.set(expected.subarray(0,at));result.set(insert,at);result.set(expected.subarray(at),at+8);}
  assert.deepEqual(prepared.records[name],result);
 }
 assert.deepEqual(await readdir(pub.fixture).then(a=>a.sort()),files);for(const [n,h] of Object.entries(before))assert.equal(await hash(join(pub.fixture,n)),h);
 assert.ok(stats.largestRead<=4096&&stats.peakReads===1);
 return {prepared,checked,pub,selected,request,stats,reloadProof:resolve(reloadName),reloadProofSha256:await hash(reloadName)};
}
export async function inspectNativeHeroReturnPreparation(name) {
 assert.ok((await stat(name)).size<=65536);const m=JSON.parse(await readFile(name,'utf8')),p=await prepareNativeHeroReturn(m.reloadProof);
 assert.equal(m.actualRegisteredHeroReturnCapsuleQualified,true);assert.equal(m.reloadProofSha256,p.reloadProofSha256);
 assert.deepEqual(m.plan,p.prepared.plan);assert.equal(m.publication,p.checked.publication);
 assert.equal(m.publicationSha256,p.checked.publicationSha256);assert.equal(m.ownerManifest,p.selected.record.manifest);
 assert.deepEqual(m.owner,p.selected.owner);assert.equal(Object.keys(m.records).length,3);
 for(const [key,r] of Object.entries(m.records)) {
  assert.equal(r.filename,join(dirname(resolve(name)),key+'.bin'));
  const bytes=p.prepared.records[key];assert.equal(r.bytes,bytes.length);assert.equal((await stat(r.filename)).size,bytes.length);
  assert.deepEqual(Uint8Array.from(await readFile(r.filename)),bytes);
  assert.equal(await hash(r.filename),r.sha256);
 }
 return {...m,sourceManifest:resolve(name),sourceManifestSha256:await hash(name)};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
 const [reload,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <fresh actual pair reload proof> <fresh output directory>');
 assert.equal(dirname(resolve(out)),join(workspace,'output'));assert.match(basename(out),/^registered-hero-return-preparation-[0-9]{3}$/);
 const p=await prepareNativeHeroReturn(reload);await mkdir(out,{recursive:false});const records={};let total=0;
 for(const [key,b] of Object.entries(p.prepared.records)){const filename=join(resolve(out),key+'.bin');await writeFile(filename,b,{flag:'wx'});records[key]={filename,bytes:b.length,sha256:await hash(filename)};total+=b.length;}
 const m={version:1,actualRegisteredHeroReturnCapsuleQualified:true,
  scope:'Actual committed Warrior554/GPL48 prepares for registered guild469/GPL7 at actual clocks24250/25800. Three inert original records preserve the saved home request, rebase its one active timestamp with4950ms elapsed retained, and restore CONT101 plus obligations for native/script reciprocal rosters. Fresh aliases remain unreserved proposals; no native import, scheduling, return publication or travel.',
  reloadProof:p.reloadProof,reloadProofSha256:p.reloadProofSha256,publication:p.checked.publication,publicationSha256:p.checked.publicationSha256,
  owner:p.selected.owner,ownerManifest:p.selected.record.manifest,request:p.request,plan:p.prepared.plan,records,totalRecordBytes:total,
  sourceWorldsUnchanged:true,selectedOwnerUnchanged:true,largestRead:p.stats.largestRead,peakReads:p.stats.peakReads,
  nativeProcessesStarted:0,browserUsed:false,heroCrossingQualified:false,remoteHomeRoutingQualified:false};
 const filename=join(resolve(out),'return-preparation.json');await writeFile(filename,JSON.stringify(m,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualRegisteredHeroReturnCapsuleQualified:true,totalRecordBytes:total,activeScriptElapsedMs:4950,browserUsed:false}));
}
