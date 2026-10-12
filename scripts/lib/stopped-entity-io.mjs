import {open, lstat, realpath} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {ENTITY_LEDGER_FILE, TRANSFER_MANIFEST} from '../../web/world/transfer-store.mjs';
export const workspace = resolve(new URL('../../', import.meta.url).pathname);
export async function stoppedFileSource(filename) {
  const info = await lstat(filename,{bigint:true});
  if (!info.isFile() || info.size < 1n || info.size > 64n * 1024n * 1024n) throw Error('Invalid stopped export source');
  const size=Number(info.size);
  const unchanged=stat=>stat.dev===info.dev&&stat.ino===info.ino&&stat.size===info.size&&stat.mtimeNs===info.mtimeNs;
  // ctime also changes for permissions/extended attributes (including macOS
  // provenance). It is not a content version. Readers bind bytes with expected
  // SHA-256 separately; reject inode replacement and nanosecond mtime/size drift.
  return {size, async readAt(at, n) {
    if (![at,n].every(Number.isSafeInteger) || at < 0 || n < 0 || n > 4096 || at+n > size) throw Error('Unbounded export read');
    const f = await open(filename, 'r');
    try {
      if(!unchanged(await f.stat({bigint:true})))throw Error('Stopped export source changed before read');
      const b = new Uint8Array(n), {bytesRead} = await f.read(b,0,n,at);
      if (bytesRead !== n) throw Error('Truncated export source');
      if(!unchanged(await f.stat({bigint:true})))throw Error('Stopped export source changed during read');
      return b;
    } finally {await f.close();}
  }};
}
export async function ownedDirectory(directory, prefix) {
  const path = resolve(directory), build = join(workspace,'upstream/majesty-recomp/build');
  if (!path.startsWith(join(build,prefix)) || await realpath(path) !== path) throw Error('Require owned stopped directory');
  return path;
}
export async function stoppedPairReader(directory) {
  const path = await ownedDirectory(directory,'actor-arrival-fixture-entity-pair-');
  let busy = false;
  return {
    async withLock(mode, fn) {
      // Serial fixture supervision only; this is not an interprocess OS lock.
      if (busy) throw Error('Stopped pair busy');
      busy = true; try {return await fn();} finally {busy = false;}
    },
    async open(name) {
      if (![ENTITY_LEDGER_FILE,TRANSFER_MANIFEST].includes(name) && !/^Frontier_Transfer_(Source|Destination)_[01]\.GMP$/.test(name)) throw Error('Invalid pair filename');
      try {return await stoppedFileSource(join(path,name));} catch(e) {if(e.code === 'ENOENT') return null; throw e;}
    },
    async atomicWrite() {throw Error('Read-only stopped pair');},
  };
}
