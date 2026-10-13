// Data-only readers for Phantomstar721's Mod Manager wire contracts.
// These readers validate packages; they do not install native hooks or certify playability.
// Reference: mod-manager 63a81840e0f9264067d7984ad0d2b39859fa1896,
// runtime/RuntimeCapabilityManifest.cpp and runtime/RuntimeFeatureRegistry.cpp.

const capabilityName = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const undefinedCp1252 = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

class Reader {
  constructor(bytes, magic, maximum, minimum) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < minimum || bytes.byteLength > maximum)
      throw new Error(`${magic}: invalid registry size`);
    // Honor subarray offsets; a registry may be a slice of a larger downloaded package.
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.cursor = 0;
    if (String.fromCharCode(...this.take(4)) !== magic) throw new Error(`${magic}: invalid magic`);
    this.magic = magic;
  }
  take(length) {
    if (length > this.bytes.length - this.cursor) throw new Error(`${this.magic}: truncated registry`);
    const value = this.bytes.subarray(this.cursor, this.cursor + length);
    this.cursor += length;
    return value;
  }
  u32() {
    const offset = this.cursor;
    this.take(4);
    return this.view.getUint32(offset, true);
  }
  finish() {
    if (this.cursor !== this.bytes.length) throw new Error(`${this.magic}: trailing bytes`);
  }
}

function increasing(value, previous) {
  if (previous !== undefined && value <= previous) throw new Error('Registry IDs must be strictly increasing');
}

/** Parse MMCP without equating a syntactically valid capability with runtime support. */
export function readCapabilities(bytes) {
  const reader = new Reader(bytes, 'MMCP', 65536, 12);
  if (reader.u32() !== 1) throw new Error('MMCP: unsupported schema version');
  const count = reader.u32();
  if (count > 64 || count > (bytes.length - reader.cursor) / 4) throw new Error('MMCP: invalid count');
  const capabilities = [];
  for (let i = 0; i < count; i++) {
    const length = reader.u32();
    if (length < 1 || length > 128) throw new Error('MMCP: invalid name length');
    const value = String.fromCharCode(...reader.take(length));
    if (capabilityName.exec(value)?.[0] !== value) throw new Error('MMCP: invalid capability name');
    increasing(value, capabilities.at(-1));
    capabilities.push(value);
  }
  reader.finish();
  return Object.freeze(capabilities);
}

function fourCC(value) {
  const chars = [0, 8, 16, 24].map(shift => (value >>> shift) & 255);
  if (chars.some(char => char < 0x21 || char > 0x7e)) throw new Error('MMFR: invalid FourCC');
  return String.fromCharCode(...chars);
}

function privateName(value, prefix, stockLimit) {
  const id = fourCC(value);
  if (!id.startsWith(prefix)) throw new Error(`MMFR: expected ${prefix} FourCC`);
  const number = /^\d{2}$/.test(id.slice(2)) ? Number(id.slice(2)) : 0;
  if (number >= 1 && number <= stockLimit) throw new Error('MMFR: stock name collision');
  return id;
}

/** Alchemist's source declares only MMFR v1 names and oil display rows. */
export function readNameAndOilFeatures(bytes) {
  const reader = new Reader(bytes, 'MMFR', 1024 * 1024, 16);
  if (reader.u32() !== 1) throw new Error('MMFR: unsupported schema version; native extension required');
  const nameCount = reader.u32(), rowCount = reader.u32();
  if (nameCount > 256 || rowCount > 1024 || nameCount * 20 + rowCount * 8 > bytes.length - reader.cursor)
    throw new Error('MMFR: invalid record counts');
  const names = [], oils = [];
  let previous;
  for (let i = 0; i < nameCount; i++) {
    const value = reader.u32();
    increasing(value, previous);
    previous = value;
    const id = privateName(value, 'NM', 17);
    const tables = Array.from({length: 4}, () => privateName(reader.u32(), 'HN', 68));
    if (new Set(tables).size !== 4) throw new Error('MMFR: duplicate name tables');
    names.push(Object.freeze({id, tables: Object.freeze(tables)}));
  }
  previous = undefined;
  for (let i = 0; i < rowCount; i++) {
    const value = reader.u32();
    increasing(value, previous);
    previous = value;
    const id = fourCC(value), length = reader.u32();
    if (length < 1 || length > 512) throw new Error('MMFR: invalid display text length');
    const textBytes = reader.take(length);
    if (textBytes.some(char => char === 0 || undefinedCp1252.has(char))) throw new Error('MMFR: invalid Windows-1252 text');
    oils.push(Object.freeze({id, text: new TextDecoder('windows-1252').decode(textBytes)}));
  }
  reader.finish();
  return Object.freeze({names: Object.freeze(names), oils: Object.freeze(oils)});
}

/** A future runtime must explicitly advertise each qualified hook group. */
export function requireRuntimeCapabilities(capabilities, implemented) {
  if (!(implemented instanceof Set)) throw new Error('Runtime support set is required');
  const missing = capabilities.filter(capability => !implemented.has(capability));
  if (missing.length) throw new Error(`Browser runtime lacks required capabilities: ${missing.join(', ')}`);
}

/** Reject capability/feature disagreements before any package or player data is written. */
export function requireNameAndOilAgreement(capabilities, features) {
  for (const [capability, records] of [
    ['stock.name-generator.v1', features.names],
    ['stock.ap78-enchantment-row.v1', features.oils],
  ]) {
    if (capabilities.includes(capability) !== (records.length > 0))
      throw new Error(`Capability/feature mismatch: ${capability}`);
  }
}
