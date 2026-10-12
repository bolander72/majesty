#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parsePageEvents} from './check-native-page-sites.mjs';
import {parsePageContexts} from './check-native-page-context.mjs';
import {parsePageOwners} from './inspect-native-page-owners.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=async n=>(await hashNativeFile(n)).sha256;
async function bounded(n,cap){const s=await stoppedFileSource(n);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
 for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
export function validateRecipientTree(r){
 assert.deepEqual([r.complete,r.result],[1,'pass']);assert.ok(r.count<=64);assert.equal(r.walked,r.count);assert.equal(r.nodes.length,r.count);
 const address=n=>assert.ok(n>=0x1000000&&n<0x10000000&&n%16===0);
 address(r.head);address(r.leaf);assert.notEqual(r.head,r.leaf);
 const byAddress=new Map(r.nodes.map(n=>[n.address,n]));assert.equal(byAddress.size,r.count);
 for(const n of r.nodes){address(n.address);assert.notEqual(n.address,r.head);assert.notEqual(n.address,r.leaf);if(n.queue)address(n.queue);}
 const pending=r.root===r.leaf?[]:[{address:r.root,parent:r.head,lower:0,upper:0x100000000}],seen=new Set();
 while(pending.length){const q=pending.pop(),n=byAddress.get(q.address);assert.ok(n);assert.ok(!seen.has(q.address));seen.add(q.address);
  assert.equal(n.parent,q.parent);assert.ok(n.key>=q.lower&&n.key<q.upper);
  for(const [child,lower,upper]of [[n.left,q.lower,n.key],[n.right,n.key+1,q.upper]])if(child!==r.leaf){assert.ok(pending.length<64);pending.push({address:child,parent:n.address,lower,upper});}}
 assert.equal(seen.size,r.count);if(!r.count)assert.equal(r.root,r.leaf);
 const match=r.nodes.filter(n=>n.key===r.recipient);assert.ok(match.length<=1);
 assert.deepEqual([r['recipient-node'],r['recipient-queue']],[match[0]?.address??0,match[0]?.queue??0]);
 assert.equal(r['queue-references'],r.nodes.filter(n=>n.queue===r.queue).length);
 return r;
}
export function parsePageRegistrations(log,owners){
 const keys='event visit stage queue parent recipient head leaf root count walked recipient-node recipient-queue queue-references default-match complete nodes result'.split(' '),hex=new Set('queue parent head leaf root recipient-node recipient-queue'.split(' '));
 const matches=[...log.matchAll(/^\[streaming\] World page-registration .*$/gm)];assert.equal(matches.length,owners.samples.length);
 const rows=matches.map((t,i)=>{const owner=owners.samples[i],r={position:t.index},tokens=t[0].slice('[streaming] World page-registration '.length).split(' ');
  assert.equal(tokens.length,keys.length);tokens.forEach((v,i)=>{const at=v.indexOf('='),key=v.slice(0,at),value=v.slice(at+1);assert.equal(key,keys[i]);
   if(key==='nodes'){r.nodes=value==='-'?[]:value.split(',').map(v=>{const a=v.split(':');assert.equal(a.length,6);assert.ok(a.every(v=>/^[0-9a-f]{8}$/.test(v)));return Object.fromEntries(['address','left','parent','right','key','queue'].map((k,i)=>[k,parseInt(a[i],16)]));});}
   else if(key==='stage'||key==='result')r[key]=value;else{assert.match(value,hex.has(key)?/^[0-9a-f]{8}$/:/^\d+$/);r[key]=parseInt(value,hex.has(key)?16:10);assert.ok(Number.isSafeInteger(r[key])&&r[key]<=0xffffffff);}});
  for(const key of ['event','visit','stage','queue','parent','recipient'])assert.equal(r[key],owner[key]);
  assert.ok(owner.position<t.index);const next=owners.samples[i+1];if(next)assert.ok(t.index<next.position);
  assert.equal(r.head,owner['tree-head']);assert.ok(r['default-match']===0||r['default-match']===1);
  assert.equal(r['default-match'],Number(owner['default-queue']===r.queue));validateRecipientTree(r);
  if(r.stage==='allocation'){assert.equal(r['queue-references'],1);assert.equal(r['recipient-queue'],r.queue);assert.equal(r['default-match'],0);}
  return r;
 });
 return {samples:rows,captures:owners.captures.map(c=>({...c,rows:rows.filter(r=>r.visit===c.visit&&r.stage===c.stage)}))};
}
export async function inspectPageRegistration(heapName){
 const raw=await bounded(heapName,512*1024),h=JSON.parse(raw);assert.equal(h.actualSavedKingdomHeapMetadataQualified,true);
 assert.equal(h.actualRegisteredHeroSameProcessRegionReturnQualified,true);assert.equal(h.scriptSha256,await hash(join(workspace,'scripts/inspect-native-hero-region-heap.mjs')));
 const manifestRaw=await bounded(h.sourceManifest,256*1024);assert.equal(sha(manifestRaw),h.sourceManifestSha256);const m=JSON.parse(manifestRaw),build=JSON.parse(await bounded(m.buildReport,256*1024));
 assert.deepEqual([m.worldPageContextProbe,m.worldPageOwnerVersion,m.worldPageRegistrationVersion],[true,1,1]);
 assert.equal(await hash(m.buildReport),m.buildReportSha256);await verifyConnectedNativeArtifact(m,build);
 for(const [n,d]of Object.entries(h.evidenceSha256))assert.equal(await hash(n),d);
 const logRaw=await bounded(m.log,1024*1024);assert.equal(sha(logRaw),m.logSha256);const log=logRaw.toString('utf8');
 const events=parsePageEvents(log,4),contexts=parsePageContexts(log,events),owners=parsePageOwners(log,events,contexts),registration=parsePageRegistrations(log,owners);
 const auditName=join(workspace,'output/native-page-registration-layout-001-observed.json'),auditRaw=await bounded(auditName,65536),a=JSON.parse(auditRaw);
 assert.deepEqual([a.qualified,a.version,a.managerFinalVtable,a.recipientTreeCountOffset,a.recipientTreeHeadOffset,a.treeRootOffset,a.treeNodeBytes,a.nodeKeyOffset,a.nodeQueueOffset,a.leafGlobal],[true,3,0x682bc4,0x58,0x50,4,24,12,16,0x6d857c]);
 assert.equal(a.scriptSha256,await hash(join(workspace,'scripts/audit-native-page-registration.py')));assert.equal(a.contradictoryInstructionControls.length,11);assert.ok(a.contradictoryInstructionControls.every(c=>c.refused));
 const peName=join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe');assert.equal(await hash(peName),a.originalExecutableSha256);
 const pe=await stoppedFileSource(peName),header=Buffer.from(await pe.readAt(0,4096)),at=header.readUInt32LE(60),count=header.readUInt16LE(at+6),opt=header.readUInt16LE(at+20);
 assert.ok(count>0&&count<=16);const sections=Array.from({length:count},(_,i)=>{const p=at+24+opt+i*40;return {rva:header.readUInt32LE(p+12),size:header.readUInt32LE(p+16),offset:header.readUInt32LE(p+20)};});
 for(const f of Object.values(a.fragments)){const rva=f.start-0x400000,s=sections.find(s=>s.rva<=rva&&rva+f.end-f.start<=s.rva+s.size);assert.ok(s);assert.equal(sha(await pe.readAt(s.offset+rva-s.rva,f.end-f.start)),f.sha256);}
 const captures=registration.captures.map(c=>{const hc=h.captures.find(v=>v.visit===c.visit&&v.stage===c.stage);assert.ok(hc);
  const observed=h.pageVisits.find(v=>v.visit===c.visit);return {...c,...(c.stage==='after-exit'?{ordinaryPageBlocks:observed.blocks}:{})};});
 return {version:1,actualSavedKingdomHeapMetadataQualified:true,observedRecipientTreeMembershipQualified:true,
  scope:'Actual saved kingdoms, hero ownership and heap captures qualify independently. Complete bounded original recipient-tree metadata matches observed live descriptors at each owner sample. Tree graph, parent links, unsigned key ranges, lookup results and all queue value references are checked independently. No cleanup or other alias/message lifetime qualification is claimed.',
  heapReport:resolve(heapName),heapReportSha256:sha(raw),sourceManifest:h.sourceManifest,sourceManifestSha256:h.sourceManifestSha256,
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,ownerIdentities:owners.identities,samples:registration.samples,captures,
  evidenceSha256:{[auditName]:sha(auditRaw),[m.log]:sha(logRaw)},safeQueueRetirementQualified:false,sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false,
  legacyRawWord54NotTreeCount:true,browserUsed:false,nativeProcessesStarted:0,scriptSha256:await hash(new URL(import.meta.url))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);const r=await inspectPageRegistration(name);
 await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({observedRecipientTreeMembershipQualified:true,samples:r.samples.length,
  afterExit:r.captures.filter(c=>c.stage==='after-exit').map(c=>({visit:c.visit,blocks:c.ordinaryPageBlocks,treeCounts:[...new Set(c.rows.map(r=>r.count))],registered:c.rows.filter(r=>r['queue-references']).length,unregistered:c.rows.filter(r=>!r['queue-references']&&!r['default-match']).length}))}));}
