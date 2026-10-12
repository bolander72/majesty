#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {idleTileReleaseCycles,idleTileCandidateGates} from './lib/idle-tile-release.mjs';
import {idleTileAllocationCoverage} from './lib/idle-tile-allocation-coverage.mjs';
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <qualified stopped gate report> <fresh coverage report>');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const p=await json(name),m=await json(p.sourceManifest),b=await json(m.buildReport);
assert.equal(p.actualRegisteredHeroSameProcessRegionReturnQualified,true);
assert.equal(await hash(p.sourceManifest),p.sourceManifestSha256);
assert.deepEqual([m.nativeSessionTerminal,m.nativeExitCode,m.stopReason,m.nativeOnly,m.browserUsed,m.idleTileGateVersion],[true,0,null,true,false,1]);
try{process.kill(m.nativePid,0);throw Error('Native process still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(m.nativeExecutableSha256,p.nativeExecutableSha256);
await verifyConnectedNativeArtifact(m,b);
assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);
const log=await readFile(m.log,'utf8'),cycles=idleTileReleaseCycles(log,4,{afterExit:true}),gates=idleTileCandidateGates(log,cycles);
assert.deepEqual(cycles,p.idleTileRelease);assert.deepEqual(gates,p.idleTileGates);
const coverage=idleTileAllocationCoverage(log,gates);
const result={version:1,observedOrdinaryBufferAllocationCoverageQualified:true,
 scope:'Replay only the original observed ordinary12208-byte allocation/free events at the four previously qualified original disposal/menu-entry boundaries. Reconcile every tracked-buffer count. Baseline and unobserved allocator paths remain unknown; later menu allocations are retained in the result. This does not establish complete heap ownership, safe eviction or bounded memory.',
 sourceProof:resolve(name),sourceProofSha256:await hash(name),sourceManifest:p.sourceManifest,sourceManifestSha256:p.sourceManifestSha256,
 log:m.log,logSha256:m.logSha256,nativeExecutableSha256:m.nativeExecutableSha256,coverage,
 sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,
 scriptSha256:await hash(new URL(import.meta.url)),helperSha256:await hash(new URL('./lib/idle-tile-allocation-coverage.mjs',import.meta.url))};
await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({observedOrdinaryBufferAllocationCoverageQualified:true,...coverage}));
