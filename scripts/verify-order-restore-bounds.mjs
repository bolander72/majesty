#!/usr/bin/env node
// Verify local source/test evidence and stat the served WASM; never read it.
import {readFile,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name){
  const url=new URL('../'+name,import.meta.url),s=await stat(url);
  if(!s.isFile()||s.size>1024*1024)throw Error('Oversized verification input');return readFile(url);
}
const evidenceName='output/native-order-restore-bounds-snapshots-observed.json',bytes=await bounded(evidenceName),r=JSON.parse(bytes);
if(!r.qualified||r.gameLaunched||r.browserUsed||r.nativeBuildRun||r.completeNativeMemoryBound)throw Error('Invalid evidence scope');
for(const [name,sha]of Object.entries(r.sourceSha256))
  if(digest(await bounded(name))!==sha)throw Error('Changed admission source');
const nativeName='output/native-order-bank-rollback-emulated-observed.json',nativeBytes=await bounded(nativeName),native=JSON.parse(nativeBytes);
if(digest(nativeBytes)!==r.nativeBankEvidenceSha256)throw Error('Changed original bank evidence');
for(const [name,sha]of Object.entries({...native.sourceSha256,...native.dependencyEvidenceSha256}))
  if(digest(await bounded(name))!==sha)throw Error('Changed original bank dependency');
const focused=(await bounded('output/order-restore-bounds-focused.log')).toString(),workspace=(await bounded('output/order-restore-bounds-workspace.log')).toString();
for(const [log,count]of [[focused,5],[workspace,313]])
  if(!log.includes(`ℹ tests ${count}\n`)||!log.includes(`ℹ pass ${count}\n`)||!log.includes('ℹ fail 0\n'))throw Error('Incomplete test log');
const baselineText=(await bounded('output/web-memory-policy-artifact-before.json')).toString(),baseline=JSON.parse(baselineText);
// Nanosecond stamps exceed JS safe integers; retain the exact JSON digits.
const baselineMtime=baselineText.match(/"mtimeNs":\s*(\d+)/)?.[1];
if(!baselineMtime)throw Error('Missing precise served artifact timestamp');
const artifact=await stat(new URL('../'+baseline.artifactIdentity.path,import.meta.url),{bigint:true});
if(artifact.size!==BigInt(baseline.artifactIdentity.size)||artifact.ino!==BigInt(baseline.artifactIdentity.inode)||
  artifact.mtimeNs!==BigInt(baselineMtime))throw Error('Served WASM identity changed');
// Glue is small enough to hash independently; the 108 MB WASM remains unread.
const glue=await readFile(new URL('../upstream/majesty-recomp/build/web-site/majesty/MajestyRecomp.js',import.meta.url));
if(digest(glue)!==baseline.glueSha256)throw Error('Served glue changed');
const sourceSha256={...r.sourceSha256},evidenceSha256={};
for(const name of ['tests/order-restore-bounds.test.mjs','scripts/verify-order-restore-bounds.mjs',
  'docs/native-order-restore-bounds.md','docs/frontier-world.md','CHANGELOG.md'])sourceSha256[name]=digest(await bounded(name));
for(const name of [evidenceName,nativeName,'output/native-order-restore-bounds-inspection.log',
  'output/order-restore-bounds-focused.log','output/order-restore-bounds-workspace.log'])evidenceSha256[name]=digest(await bounded(name));
const sum=key=>r.reports.reduce((n,v)=>n+v[key],0);
const report={qualified:true,scope:r.scope,sourceSha256,evidenceSha256,
  files:r.reports.map(v=>({filename:v.filename,sha256:v.sha256,fileBytes:v.fileBytes,fileIdentityUnchanged:v.fileIdentityUnchanged})),
  actors:sum('attachments'),banks:sum('banks'),entries:sum('entries'),nativeComparisons:sum('nativeComparisons'),
  totalAllocationRequestBytes:sum('totalAllocationRequestBytes'),largestActorAllocationRequestBytes:Math.max(...r.reports.map(v=>v.largestActorAllocationRequestBytes)),
  focusedTestsPassed:5,workspaceTestsPassed:313,nativeCpuCasesRerun:false,
  servedWasmIdentityUnchanged:true,servedGlueSha256Unchanged:true,entireWasmArtifactHashed:false,
  completeNativeMemoryBound:false,completeOrderRestorationQualified:false,activeOrderMigrationQualified:false,
  liveHeroCrossingQualified:false,liveNativePagingQualified:false,gameLaunched:false,browserUsed:false,
  nativeBuildRun:false,crashResolved:false,goalCompleted:false};
await writeFile(new URL('../output/native-order-restore-bounds-terminal-verified.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({qualified:true,actors:report.actors,nativeComparisons:report.nativeComparisons,
  workspaceTestsPassed:313,servedArtifactsUnchanged:true,gameLaunched:false}));
