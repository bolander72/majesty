#!/usr/bin/env node
// Verify the stopped official test evidence; do not execute another native process.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hashNativeFile} from './lib/native-generation.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const filename='output/native-outdoor-order-read-001-observed.json';
const p=JSON.parse(await readFile(filename,'utf8'));
assert.equal(p.originalOutdoorOrderReaderQualified,true);
assert.equal(p.nativeToolSessionExitCode,0); assert.equal(p.failures,0);
assert.equal(p.nativeCommand,'.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1');
for(const [n,h] of Object.entries(p.sourceSha256)) assert.equal(await hash(n),h);
assert.equal(await hash(p.nativeExecutable.filename),p.nativeExecutable.sha256);
for(const field of ['preparation','log','lastTestLog','payloadAdmissionLog','allocationAudit'])
  assert.equal(await hash(p[field]),p[`${field}Sha256`]);
const prep=JSON.parse(await readFile(p.preparation,'utf8'));
assert.equal(prep.actualSourcePayloadsQualified,true);
assert.equal(await hash(prep.source.filename),prep.source.sha256);
assert.equal(await hash(prep.sourceProof),prep.sourceProofSha256);
for(const [n,h] of Object.entries({...prep.sourceSha256,...prep.preparations})) assert.equal(await hash(n),h);
assert.equal(await hash(prep.fixture.filename),prep.fixture.sha256);
assert.deepEqual(prep.payloads.map(r=>[r.unitId,r.kinds,r.requestedBytes]),
  [[504,[4,7],454],[527,[5],202],[528,[9],161],[529,[9],161]]);
for(const row of prep.payloads) assert.equal(await hash(row.payload.filename),row.payload.sha256);
const audit=JSON.parse(await readFile(p.allocationAudit,'utf8'));
assert.equal(audit.waitAllocationReturnQualified,true); assert.equal(audit.returnPc,'005da6bd');
for(const [n,h] of Object.entries(audit.sourceSha256)) assert.equal(await hash(n),h);
const original='upstream/majesty-recomp/original/gog/MajestyHD - Old.exe';
assert.equal(await hash(original),p.originalExecutableSha256);
assert.equal(audit.executableSha256,p.originalExecutableSha256);
const log=await readFile(p.lastTestLog,'utf8');
assert(log.includes('433088 bank read hook checks, 0 failures; 210 trials'));
assert(log.includes('outdoor source payloads: 4, positive trials: 8, kind9 allocation refusals: 1'));
assert(log.includes('engine ownership handoff: 94 graphs'));
assert(log.includes('original private vehicle lifecycle: 94 constructions, 94 deletions'));
assert(log.includes('Test Passed.'));
assert((await readFile(p.payloadAdmissionLog,'utf8')).includes('100% tests passed, 0 tests failed out of 1'));
assert.equal(p.heroTransferred,false); assert.equal(p.destinationImportQualified,false); assert.equal(p.browserUsed,false);
console.log(JSON.stringify({originalOutdoorOrderReaderQualified:true,payloads:4,positiveTrials:8,
  originalReaderChecks:p.checks,sourceUnchanged:true,heroTransferred:false,browserUsed:false,nativeProcessesStarted:0}));
