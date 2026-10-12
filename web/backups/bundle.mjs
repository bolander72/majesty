import {Sha256, ZipReader} from '../core.js';
import {zipWriteFileBlobs,zipWriteStream} from '../zip-stream.mjs';
import {JOURNEY_KEY,parseJourney} from '../world/journey-record.mjs';

export const FORMAT = 'majesty-player-backup-v1';
export const MAX_FILES = 12000, MAX_METADATA = 16 * 1024 * 1024;
export const MAX_TOTAL = 3 * 1024 * 1024 * 1024, PAGE = 65536;
const MANIFEST = 'player-backup.json';
function fail(message) { throw Error(message); }
export function safePath(path) {
  if (typeof path !== 'string' || !path || path.length > 512 || /[\\\x00-\x1f\x7f]/.test(path) ||
      path.split('/').some(p => !p || p === '.' || p === '..')) fail('Invalid backup path.');
  return path;
}
export function databaseKind(name) {
  if (/^majesty-frontier-campaign-v1(?:-profile-[a-zA-Z0-9_-]{1,40})?$/.test(name)) return 'campaign';
  if (/^majesty-(?:native-world-)?[a-z0-9-]{1,40}$/.test(name) && !name.startsWith('majesty-frontier-campaign')) return 'atlas';
  fail('Unsupported backup database.');
}
export function validateDatabase(db) {
  const kind = databaseKind(db?.name), store = kind === 'campaign' ? 'chapters' : 'regions';
  if (db.version !== 1 || db.store !== store || !Array.isArray(db.rows) || db.rows.length > 50000) fail('Invalid backup database schema.');
  const seen = new Set();
  for (const row of db.rows) {
    if (!Array.isArray(row) || row.length !== 2 || seen.has(JSON.stringify(row[0]))) fail('Invalid or duplicate backup record.');
    seen.add(JSON.stringify(row[0]));
    const [key,value] = row;
    if (kind === 'campaign') {
      if (![1,2,3,4].includes(key) || value !== true) fail('Invalid campaign completion record.');
    } else if (key === JOURNEY_KEY) {
      // Native Atlas travel recovery is stored as bounded JSON text, unlike
      // region/camera objects. Validate its world identity and preserve bytes.
      const prefix = 'majesty-native-world-';
      if (!db.name.startsWith(prefix)) fail('Invalid Atlas travel recovery database.');
      try { parseJourney(value, db.name.slice(prefix.length)); }
      catch { fail('Invalid Atlas travel recovery record.'); }
    } else {
      if (typeof key !== 'string' || !value || typeof value !== 'object') fail('Invalid Atlas record.');
      if (key === 'camera-v1') {
        if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) fail('Invalid Atlas camera.');
      } else {
        const parts = key.split(',').map(Number);
        if (parts.length !== 2 || parts.some(n=>!Number.isSafeInteger(n)||Math.abs(n)>1000000) || parts.join(',') !== key ||
            value.version !== 1 || !Number.isSafeInteger(value.seed) || value.x !== parts[0] || value.y !== parts[1] ||
            !Array.isArray(value.buildings) || value.buildings.length > 64 ||
            value.buildings.some(b=>!b || b.kind!=='tower' || !Number.isInteger(b.x) || !Number.isInteger(b.y) || b.x<0 || b.y<0 || b.x>=32 || b.y>=32)) fail('Invalid Atlas region.');
        if (new Set(value.buildings.map(b=>`${b.x},${b.y}`)).size !== value.buildings.length) fail('Duplicate Atlas building.');
      }
    }
  }
  return db;
}
export async function hashBlob(blob, {signal}={}) {
  const sha = new Sha256();
  for (let at=0; at<blob.size; at+=PAGE) {
    signal?.throwIfAborted();
    sha.update(new Uint8Array(await blob.slice(at,at+PAGE).arrayBuffer()));
  }
  signal?.throwIfAborted(); return sha.hex();
}
export async function createBundle(nativeFiles, databases, {signal,output,central}={}) {
  const records=[], paths=new Set(), dbRecords=[], seen=new Set(); let total=0,manifest;
  async function* entries(){
  for await (const {path,file} of nativeFiles) {
    safePath(path); const name='native/'+path;
    if (records.length>=MAX_FILES || paths.has(path)) fail('Too many or duplicate save files.'); paths.add(path);
    total+=file.size; if(total>MAX_TOTAL) fail('Backup exceeds the 3 GiB ZIP limit.');
    records.push({path,bytes:file.size,sha256:await hashBlob(file,{signal})}); yield {name,file};
  }
  for await (const database of databases) {
    validateDatabase(database);
    if(seen.has(database.name)) fail('Duplicate backup database.'); seen.add(database.name);
    const file=new Blob([JSON.stringify(database)]), name=`databases/${dbRecords.length}.json`;
    if(file.size>MAX_METADATA) fail('Atlas metadata exceeds the 16 MiB per-world limit.');
    total+=file.size; if(total>MAX_TOTAL || dbRecords.length>=256) fail('Backup collection limit exceeded.');
    dbRecords.push({name:database.name,path:name,bytes:file.size,sha256:await hashBlob(file,{signal})}); yield {name,file};
  }
  manifest={format:FORMAT,game:'majesty',createdAt:new Date().toISOString(),native:records,databases:dbRecords};
  const file=new Blob([JSON.stringify(manifest)]);
  if(file.size>MAX_METADATA) fail('Backup index limit exceeded.');
  yield {name:MANIFEST,file};
  }
  const result=output?await zipWriteStream(entries(),output,central,{signal}):await zipWriteFileBlobs(entries(),{signal}); return {...result,manifest};
}
async function readEntry(zip, entry, consume, {signal}={}) {
  const reader=(await zip.stream(entry)).getReader(), sha=new Sha256(); let size=0;
  try {
    for (;;) {
      signal?.throwIfAborted(); const {done,value}=await reader.read(); if(done)break;
      if(!(value instanceof Uint8Array) || (size+=value.length)>entry.size) fail('Backup entry size mismatch.');
      sha.update(value); if(consume)await consume(value);
    }
    if(size!==entry.size)fail('Truncated backup entry.');
    signal?.throwIfAborted(); return sha.hex();
  } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}
async function entryJSON(zip, entry, options) {
  if(!entry || entry.size>MAX_METADATA)fail('Missing or oversized backup metadata.');
  const parts=[]; await readEntry(zip,entry,bytes=>parts.push(bytes),options);
  return JSON.parse(await new Blob(parts).text());
}
export async function inspectBundle(file,{signal,retainDatabases=true}={}) {
  if(file.size>MAX_TOTAL+32*1024*1024)fail('Backup exceeds the archive size limit.');
  // Bound the ZIP directory before the legacy reader allocates it. Our writer
  // uses ordinary ZIP32; a larger or ZIP64 directory is not a player bundle.
  const tail=new DataView(await file.slice(Math.max(0,file.size-65557)).arrayBuffer()); let footer=-1;
  for(let p=tail.byteLength-22;p>=0;p--)if(tail.getUint32(p,true)===0x06054b50 && p+22+tail.getUint16(p+20,true)===tail.byteLength){footer=p;break;}
  if(footer<0 || tail.getUint32(footer+12,true)>MAX_METADATA || tail.getUint16(footer+10,true)>MAX_FILES+257 ||
      tail.getUint16(footer+4,true)!==0 || tail.getUint16(footer+6,true)!==0 ||
      tail.getUint32(footer+16,true)+tail.getUint32(footer+12,true)>file.size-22)fail('Invalid or oversized ZIP directory.');
  const zip=await ZipReader.open(file), entries=new Map(); let total=0;
  if(zip.entries().length>MAX_FILES+257)fail('Too many backup entries.');
  for(const entry of zip.entries()) {
    safePath(entry.path);
    if(entry.isDir || entries.has(entry.path) || !Number.isSafeInteger(entry.size) || entry.size<0 || entry.size>MAX_TOTAL || ![0,8].includes(entry.method)) fail('Invalid or duplicate archive entry.');
    total+=entry.size; if(total>MAX_TOTAL+MAX_METADATA)fail('Unpacked backup exceeds the size limit.');
    entries.set(entry.path,entry);
  }
  const manifest=await entryJSON(zip,entries.get(MANIFEST),{signal});
  if(manifest?.format!==FORMAT || manifest.game!=='majesty' || !Array.isArray(manifest.native) || !Array.isArray(manifest.databases) ||
      manifest.native.length>MAX_FILES || manifest.databases.length>256)fail('Use a complete Majesty player backup. Legacy save ZIPs still use Import saves on the main launcher.');
  const expected=new Set([MANIFEST]), databases=[], names=new Set();
  for(const [group,prefix] of [[manifest.native,'native/'],[manifest.databases,'']]) for(const record of group) {
    safePath(record.path); const name=prefix+record.path, entry=entries.get(name);
    if(expected.has(name) || !Number.isSafeInteger(record.bytes) || record.bytes<0 || !/^[a-f0-9]{64}$/.test(record.sha256) || !entry || entry.size!==record.bytes)fail('Invalid backup index.');
    expected.add(name);
    if(await readEntry(zip,entry,null,{signal})!==record.sha256)fail('Backup integrity check failed. No saves have been changed.');
    if(!prefix) {
      if(!/^databases\/\d+\.json$/.test(name) || names.has(record.name))fail('Invalid database index.'); names.add(record.name);
      const db=validateDatabase(await entryJSON(zip,entry,{signal}));
      if(db.name!==record.name)fail('Database identity mismatch.');
      databases.push(retainDatabases?db:{name:db.name,version:db.version,store:db.store,rowCount:db.rows.length});
    }
  }
  if(expected.size!==entries.size)fail('Unlisted archive content.');
  // Restore re-inspects this immutable Blob; callers cannot change a checked manifest.
  return {manifest,databases,nativeCount:manifest.native.length,databaseCount:databases.length,
    async readDatabase(record){
      const own=manifest.databases.find(r=>r.name===record.name);
      if(!own)fail('Database not in this backup.');
      return validateDatabase(await entryJSON(zip,entries.get(own.path),{signal}));
    },
    async copyNative(record,sink) {
      const own=manifest.native.find(r=>r.path===record.path);
      if(!own)fail('Save not in this backup.');
      if(await readEntry(zip,entries.get('native/'+own.path),bytes=>sink.write(bytes),{signal})!==own.sha256)fail('Backup changed during restore.');
    }};
}
