// Historical source acceptance is limited to one measured publication and two frozen validators.
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {workspace,ownedDirectory} from './stopped-entity-io.mjs';
import {hashNativeFile} from './native-generation.mjs';
const publication=join(workspace,'output/native-hero-handoff-001-published.json');
const publicationSha256='00d5184c535285d3abb7ec5e6fa6f55f7a9d19002fbf2ed40a4f9191c2b18f68';
const knownReports=new Map([[publication,publicationSha256],
 [join(workspace,'output/native-hero-owner-seed-001-observed.json'),'55e7a68f3644e022f6d06ca0ed50a7c4de053540d3b83ac3443b7223a5d3b013']]);
const frozen={
 'web/world/entity-ownership.mjs':'b9f014f309b36ee45d8d9c87039302ea59e7553a15f3599fc887a69d570a2df7',
 'web/world/entity-home-ownership.mjs':'3d4d8d32ae7c23c413a9a11b49876d632fd0dbd3f56f80892f031cbbabdbc8fb'};
export async function verifyRegisteredHeroProducerSources(m,name) {
 const changed=[];
 for(const [n,h]of Object.entries(m.sourceSha256)) {
  const current=await hashNativeFile(join(workspace,n),{maximum:1024*1024});
  if(current.sha256!==h){assert.equal(frozen[n],h,'Unpreserved hero producer source');changed.push(n);}
 }
 if(!changed.length)return;
 const expected=knownReports.get(resolve(name));assert.ok(expected,'Unrecognized historical hero source report');
 assert.equal((await hashNativeFile(name,{maximum:256*1024})).sha256,expected);
 assert.equal((await hashNativeFile(publication,{maximum:256*1024})).sha256,publicationSha256);
 const report=join(workspace,'output/native-hero-owner-source-generation-preserved.json');
 const info=await stat(report);assert.ok(info.isFile()&&info.size<=16384);
 const a=JSON.parse(await readFile(report,'utf8'));
 assert.deepEqual([a.version,a.artifactPreserved,a.publication,a.publicationSha256],[1,true,publication,publicationSha256]);
 const pub=JSON.parse(await readFile(publication,'utf8'));assert.deepEqual(a.sourceSha256,pub.sourceSha256);
 for(const n of changed)assert.equal(a.sourceSha256[n],m.sourceSha256[n]);
 const directory=await ownedDirectory(a.directory,'actor-arrival-fixture-entity-revision-code-');
 // Rehash both frozen modules on every invocation; all other sources must still match current code.
 for(const [n,h]of Object.entries(frozen)) {
  const record=a.sources[n],filename=join(directory,n.split('/').at(-1));
  assert.equal(record.filename,filename);
  const file=await hashNativeFile(filename,{maximum:64*1024});
  assert.equal(file.sha256,h);assert.equal(record.sha256,h);assert.equal(file.bytes,record.bytes);
 }
}
