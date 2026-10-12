import {validateProfile} from '../campaign/progress.mjs';

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_RESUME_COPIES = 64, MAX_RESUME_BYTES = 64 * 1024 * 1024;
const hex = /^[a-f0-9]{64}$/;
function fail() { throw Error('Invalid shared-world resume checkpoint.'); }
function integer(value, maximum, signed = false) {
  if (!(signed ? /^(0|-?[1-9]\d*)$/ : /^(0|[1-9]\d*)$/).test(value ?? '')) fail();
  const n = Number(value);
  if (!Number.isSafeInteger(n) || Math.abs(n) > maximum) fail();
  return n;
}
function identity(world, x, y, content, rules) {
  if (!/^[a-z0-9-]{1,40}$/.test(world ?? '') || !hex.test(rules ?? '') ||
      !/^[a-f0-9]{64}:[a-f0-9]{64}$/.test(content ?? '')) fail();
  return {world, x: integer(x, 1000000, true), y: integer(y, 1000000, true), content, rules};
}
export function parseCheckpoint(text) {
  if (typeof text !== 'string' || text.length >= 768 || !text.endsWith('\n')) fail();
  const f = text.split('\n');
  if (f.length !== 13 || f[0] !== 'majesty-coop-checkpoint-v1' || !['0', '1'].includes(f[1]) || !hex.test(f[11])) fail();
  const record = {...identity(f[2], f[5], f[6], f[3], f[4]), slot: Number(f[1]),
    frame: integer(f[7], 0xffffffff), clock: integer(f[8], 0xffffffff),
    revision: f[9], bytes: integer(f[10], MAX_BYTES), sha256: f[11]};
  // Native revisions are uint64; retain their canonical decimal spelling.
  if (!/^[1-9]\d{0,19}$/.test(record.revision) || BigInt(record.revision) > 0xffffffffffffffffn || !record.bytes) fail();
  return record;
}
export function resumeToken(record, chapter, initialRegion = `${record.x}_${record.y}`) {
  const origin = /^((?:0|-?[1-9]\d*))_((?:0|-?[1-9]\d*))$/.exec(initialRegion ?? '');
  if (!origin) fail();
  origin.slice(1).forEach(value => integer(value, 1000000, true));
  const token = ['v2', chapter, record.world, record.x, record.y, origin[1], origin[2], record.frame,
    record.clock, record.revision, record.bytes, record.sha256, record.content, record.rules].join('|');
  parseResumeToken(token); return token;
}
export function parseResumeToken(token) {
  if (typeof token !== 'string' || token.length > 512) fail();
  const f = token.split('|');
  if (f.length !== 14 || f[0] !== 'v2' || !/^[1234]$/.test(f[1])) fail();
  const record = parseCheckpoint(['majesty-coop-checkpoint-v1', '0', f[2], f[12], f[13],
    f[3], f[4], f[7], f[8], f[9], f[10], f[11], ''].join('\n'));
  delete record.slot;
  return {...record, chapter: Number(f[1]), initialRegion: `${integer(f[5],1000000,true)}_${integer(f[6],1000000,true)}`};
}
export function resumeLabel(record) {
  // Original lobby file transfer writes this separate name, never a live slot.
  return `WorldResume_${record.world}_${record.x}_${record.y}_${record.sha256.slice(0, 16)}`;
}
export function validateResumeContext(token, context) {
  const record = parseResumeToken(token);
  if (record.world !== context.world || `${record.x}_${record.y}` !== context.region || record.chapter !== Number(context.chapter))
    throw Error('The resume checkpoint belongs to a different world, region or chapter.');
  return record;
}
async function findMarker(root, name) {
  let visited = 0, found;
  async function walk(dir, depth) {
    if (depth > 12) throw Error('Save folder nesting exceeds the resume limit.');
    for await (const [entry, handle] of dir.entries()) {
      if (++visited > 4096) throw Error('Save collection exceeds the resume scan limit.');
      if (handle.kind === 'directory') await walk(handle, depth + 1);
      else if (entry === name) {
        if (found) throw Error('More than one checkpoint exists for this region.');
        found = {parent: dir, marker: handle};
      }
    }
  }
  await walk(root, 0);
  if (!found) throw Error('No committed checkpoint exists for this region. Save and pause the shared game first.');
  return found;
}
async function missingFile(dir, name) {
  try { return await dir.getFileHandle(name); }
  catch (error) { if (error.name === 'NotFoundError') return null; throw error; }
}
// Run only after the game document releases its profile. Never acquire the
// game's lease from inside an injected engine or overwrite checkpoint slots.
export async function prepareResume({context, profile, root, locks = globalThis.navigator?.locks,
  hash, signal} = {}) {
  validateProfile(profile);
  if (!profile) throw Error('Choose a named local profile to prepare a shared-world resume.');
  if (!/^[a-z0-9-]{1,40}$/.test(context?.world ?? '') || !/^(0|-?[1-9]\d*)_(0|-?[1-9]\d*)$/.test(context.region ?? '') || !/^[1234]$/.test(String(context.chapter))) fail();
  context.region.split('_').forEach(value => integer(value, 1000000, true));
  if (!locks?.request) throw Error('Save profile locking is unavailable.');
  hash ??= (await import('../backups/bundle.mjs')).hashBlob;
  root ??= await navigator.storage.getDirectory();
  return locks.request(`majesty-native-profile:majesty:${profile}`, {mode: 'exclusive', ifAvailable: true}, async lease => {
    if (!lease) throw Error('Close this profile’s game before preparing its resume file.');
    signal?.throwIfAborted();
    const game = await root.getDirectoryHandle('majesty');
    if (await missingFile(game, '.player-restore-v1.json'))
      throw Error('Recover the interrupted player backup restore before preparing a resume file.');
    let dir = await (await game.getDirectoryHandle('profile')).getDirectoryHandle(profile);
    const basename = `CoopTransitions_${context.world}_${context.region}`;
    const {parent, marker} = await findMarker(dir, basename + '.checkpoint');
    const markerFile = await marker.getFile();
    if (markerFile.size >= 768) fail();
    const text = await markerFile.text(), record = parseCheckpoint(text);
    const token = resumeToken(record, context.chapter, context.initialRegion ?? context.region);
    validateResumeContext(token, context);
    const sourceHandle = await parent.getFileHandle(`${basename}_${record.slot}.GMP`);
    const source = await sourceHandle.getFile();
    if (source.size !== record.bytes || await hash(source, {signal}) !== record.sha256)
      throw Error('Saved kingdom bytes do not match their committed checkpoint.');
    const label = resumeLabel(record), name = label + '.GMP';
    const previous = await missingFile(parent, name);
    if (previous) {
      const file = await previous.getFile();
      if (file.size !== record.bytes || await hash(file, {signal}) !== record.sha256)
        throw Error('An existing resume file is incomplete or different. It has been preserved.');
    } else {
      // Region visits usually produce small saves. Bound both the lobby list
      // and its disk footprint instead of stopping every expedition at eight
      // preparations. Inspect metadata only; preserve all existing copies.
      let count = 0, bytes = record.bytes;
      for await (const [entry, handle] of parent.entries()) {
        signal?.throwIfAborted();
        if (!entry.startsWith('WorldResume_') || !entry.endsWith('.GMP')) continue;
        if (handle.kind !== 'file') throw Error('An existing resume entry is not a file. It has been preserved.');
        ++count;bytes += (await handle.getFile()).size;
        if (count >= MAX_RESUME_COPIES || bytes > MAX_RESUME_BYTES)
          throw Error('Resume copies reached the 64-copy or 64 MiB budget. Back them up and remove older copies before creating another.');
      }
      const alias = await parent.getFileHandle(name, {create: true});
      let sink;
      try {
        sink = await alias.createWritable();
        for (let at = 0; at < source.size; at += 65536) {
          signal?.throwIfAborted();
          await sink.write(await source.slice(at, at + 65536).arrayBuffer());
        }
        await sink.close();
        const file = await alias.getFile();
        if (file.size !== record.bytes || await hash(file, {signal}) !== record.sha256) throw Error('Resume copy verification failed.');
      } catch (error) {
        await sink?.abort().catch(() => {});
        await parent.removeEntry(name).catch(() => {});
        throw error;
      }
    }
    // A lease excludes supported writers; also detect unsupported replacement.
    if (await (await marker.getFile()).text() !== text ||
        await hash(await sourceHandle.getFile(), {signal}) !== record.sha256)
      throw Error('The checkpoint changed while preparing its resume file.');
    signal?.throwIfAborted();
    return {record: parseResumeToken(token), token, label};
  });
}
