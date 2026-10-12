#!/usr/bin/env node
// Reject contradictory changes to the actual stopped, qualified native trace.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {requireExpansionTrace} from './inspect-native-coordinate-expansion.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async path=>(await hashNativeFile(path)).sha256;
assert.ok((await stat(name)).size<1024*1024);const proof=JSON.parse(await readFile(name,'utf8'));
assert.equal(proof.qualified,true);assert.equal(proof.generatedKingdomReturnedWithoutRegeneration,true);
assert.equal(proof.scriptSha256,await hash(resolve('scripts/inspect-native-coordinate-expansion.mjs')));
assert.equal(proof.sourceManifestSha256,await hash(proof.sourceManifest));
const m=JSON.parse(await readFile(proof.sourceManifest,'utf8'));
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
try{process.kill(m.nativePid,0);assert.fail('Native game remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(m.logSha256,await hash(m.log));assert.ok((await stat(m.log)).size<1024*1024);
const log=await readFile(m.log,'utf8');requireExpansionTrace(m,log);
function line(prefix){const found=log.split('\n').find(l=>l.startsWith(prefix));assert.ok(found,prefix);return found;}
const generation=line('[frontier] Region generated '),admission=line('[streaming] World expansion admitted '),
  partial=line('[streaming] World coordinate-request refused visit=0 serial=1 source=0_0 target=0_1 '),
  context=line('[frontier] Region context key=-1_0 '),request=line('[streaming] World coordinate-request accepted visit=0 '),
  exit=line('[streaming] World residency exit=0 '),commit=line('[streaming] World coordinate-checkpoint visit=1 '),
  seed=line('[streaming] World persistence rng visit=0 ');
const controls=[],changed=(old,next)=>{assert.notEqual(old,next);assert.ok(log.includes(old));return log.replace(old,next);};
function reject(label,trial=log,manifest=m){assert.throws(()=>requireExpansionTrace(manifest,trial),undefined,label);controls.push(label);}
reject('missing actual generation',changed(generation,''));
reject('second generation instead of restoring saved west',changed(generation,generation+'\n'+generation));
reject('generation points at wrong kingdom',changed(generation,generation.replace('key=-1_0','key=1_0')));
reject('different original preset routine',changed(generation,generation.replace('original-preset=00446910','original-preset=004636b0')));
reject('generation before old world disposal',log.replace(generation+'\n','').replace(exit,generation+'\n'+exit));
reject('missing proof that new destination paths were absent',changed(admission,admission.replace('slots-absent=2','slots-absent=1')));
reject('partial existing save admitted as unexplored',changed(partial,partial.replace('available=0','available=1')));
reject('missing actual partial-save refusal',changed(partial,''));
reject('stale region context used for western world',changed(context,context.replace('key=-1_0','key=0_0')));
const contexts=log.split('\n').filter(l=>l.startsWith('[frontier] Region context key=-1_0 '));assert.equal(contexts.length,2);
reject('saved western revisit marked fresh',changed(contexts[1],contexts[1].replace('generate=0','generate=1')));
reject('source not preserved at accepted request',changed(request,request.replace('world-same=1','world-same=0')));
reject('accepted request not consumed',changed(request,request.replace('consumed=1','consumed=0')));
reject('one original tracked root survives',changed(exit,exit.replace('roots-freed=1,1,1,1,1,1','roots-freed=1,1,1,1,1,0')));
reject('new kingdom checkpoint not published',changed(commit,commit.replace('published=1','published=0')));
reject('new kingdom checkpoint labelled home',changed(commit,commit.replace('region=-1_0','region=0_0')));
reject('source RNG restored into a fresh generated kingdom',changed(seed,seed+'\n'+seed.replace('visit=0','visit=1')));
const altered=structuredClone(m),publication=altered.requestPublications.find(p=>p.kind==='travel');publication.words[5]=1;
const raw=Buffer.alloc(36);publication.words.forEach((v,i)=>raw.writeUInt32LE(v,i*4));publication.sha256=createHash('sha256').update(raw).digest('hex');
reject('different wire destination with recomputed packet hash',log,altered);
const alteredReady=structuredClone(m);alteredReady.readyPublications[1].words[2]=1;
reject('replayed readiness serial',log,alteredReady);
await writeFile(out,JSON.stringify({version:1,qualified:true,proof:resolve(name),proofSha256:await hash(name),
  sourceManifest:proof.sourceManifest,sourceManifestSha256:proof.sourceManifestSha256,logSha256:m.logSha256,
  sourceSha256:await hash(new URL(import.meta.url)),contradictoryActualTraceControls:controls,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,contradictoryActualTraceControls:controls.length}));
