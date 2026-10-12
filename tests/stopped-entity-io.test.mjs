import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,stat,rename,utimes,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stoppedFileSource} from '../scripts/lib/stopped-entity-io.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
async function fixture(consume) {
  const directory=await mkdtemp(join(tmpdir(),'majesty-stopped-file-test-')),file=join(directory,'snapshot.GMP');
  try{await writeFile(file,Buffer.alloc(32,7),{mode:0o600});await consume(file,directory);}finally{await rm(directory,{recursive:true,force:true});}
}
test('metadata-only permission changes retain stable bytes, inode and nanosecond mtime',()=>fixture(async file=>{
  const source=await stoppedFileSource(file),before=await stat(file,{bigint:true}),digest=await hashCheckpointSource(source);
  await chmod(file,0o640);const after=await stat(file,{bigint:true});
  assert.equal(after.ino,before.ino);assert.equal(after.size,before.size);assert.equal(after.mtimeNs,before.mtimeNs);
  assert.notEqual(after.ctimeNs,before.ctimeNs);
  assert.equal(await hashCheckpointSource(source),digest);
}));
test('inode replacement is rejected even when replacement bytes and mtime match',()=>fixture(async(file,directory)=>{
  const stamp=new Date(1720000000000);await utimes(file,stamp,stamp);
  const source=await stoppedFileSource(file),before=await stat(file,{bigint:true}),replacement=join(directory,'replacement');
  await writeFile(replacement,Buffer.alloc(32,7));await utimes(replacement,stamp,stamp);await rename(replacement,file);
  const after=await stat(file,{bigint:true});assert.equal(after.mtimeNs,before.mtimeNs);assert.notEqual(after.ino,before.ino);
  await assert.rejects(source.readAt(0,16),/changed/);
}));
test('content/mtime changes and unbounded reads are rejected',()=>fixture(async file=>{
  const source=await stoppedFileSource(file);
  await assert.rejects(source.readAt(0,4097),/Unbounded/);
  await writeFile(file,Buffer.alloc(32,8));const future=new Date(Date.now()+1000);await utimes(file,future,future);
  await assert.rejects(source.readAt(0,16),/changed/);
}));
test('symbolic links are not stopped regular-file sources',()=>fixture(async(file,directory)=>{
  const alias=join(directory,'alias');await symlink(file,alias);await assert.rejects(stoppedFileSource(alias),/Invalid/);
}));
