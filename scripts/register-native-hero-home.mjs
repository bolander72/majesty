#!/usr/bin/env node
// Terminal-only real saved-roster registration in a fresh owned output folder.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, rename, unlink} from 'node:fs/promises';
import {join, resolve, dirname, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareGeneratedHero} from './prepare-native-generated-hero.mjs';
import {stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {registerCheckpointGuildHome, GuildHomeStore, prepareHomeBoundActorArrival,
  MAX_HOME_RECORD_BYTES, openGuildHomeStoreByAlias} from '../web/world/hero-home.mjs';
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const [manifest, out] = process.argv.slice(2);
assert.equal(process.argv.length, 4, 'Usage: <terminal recruitment manifest> <fresh registration directory>');
const directory = resolve(out);
assert.equal(dirname(directory), join(workspace, 'output'));
assert.match(basename(directory), /^hero-home-registration-[0-9]{3}$/);
const original = await prepareGeneratedHero(manifest);
const producer = JSON.parse(await readFile(manifest, 'utf8'));
const worldId = sha(['isolated-native-hero-world-v1', original.capture.sourceManifestSha256]);
// An exact development-fixture binding, not a general asset/pack compatibility digest.
const contentDescriptor = {kind: 'native-home-fixture-v1', nativeExecutableSha256: producer.nativeExecutableSha256,
  nativeSourceSha256: producer.nativeSourceSha256, modSettingsSha256: producer.inputHashes['mod-settings.json']};
const contentDigest = sha(contentDescriptor);
const source = await stoppedFileSource(original.capture.save.filename);
const registration = await registerCheckpointGuildHome(source, {worldId, contentDigest, region: '0_0',
  guildUnitId: original.capture.home.unit.unitId});
assert.equal(registration.home.originCheckpointSha256, original.capture.save.sha256);
assert.equal(registration.members.length, 1);
assert.deepEqual([registration.members[0].unitId, registration.members[0].agentId], [502, 27]);
await mkdir(directory);
let busy = false, sequence = 0, largestRead = 0, largestWrite = 0, writes = 0;
const filename = name => {assert.match(name, /^Frontier_GuildHome_-?\d+_-?\d+_\d+_\d+\.checkpoint$/); return join(directory, name);};
const io = {
  async withLock(mode, consume) {
    // This stopped terminal fixture is serial, not an interprocess/Web Lock.
    if (busy) throw Error('Stopped home fixture busy'); busy = true;
    try {return await consume();} finally {busy = false;}
  }, async open(name) {
    assert.ok(busy);
    try {
      const input = await stoppedFileSource(filename(name));
      return {size: input.size, async readAt(at, n) {largestRead = Math.max(largestRead, n); return input.readAt(at, n);}};
    } catch (error) {if (error.code === 'ENOENT') return null; throw error;}
  }, async atomicWrite(name, produce) {
    assert.ok(busy); const temp = filename(name) + `.tmp-${++sequence}`, parts = []; let bytes = 0;
    try {
      await produce({async write(data) {
        bytes += data.length; assert.ok(bytes <= MAX_HOME_RECORD_BYTES);
        largestWrite = Math.max(largestWrite, data.length); parts.push(Buffer.from(data));
      }});
      await writeFile(temp, Buffer.concat(parts), {flag: 'wx'});
      await rename(temp, filename(name)); writes++;
    } finally {try {await unlink(temp);} catch (error) {if (error.code !== 'ENOENT') throw error;}}
  },
};
const id = {worldId, contentDigest, guildEntityId: registration.guildEntityId,
  homeAlias: {region: '0_0', unitId: registration.home.unitId, agentId: registration.home.agentId}};
const openStore = () => new GuildHomeStore(io, id);
const seeded = await openStore().initialize(registration);
const request = {heroEntityId: registration.members[0].entityId, toRegion: '1_0',
  operationId: sha(['fixture-home-travel-v1', seeded.sha256]), expectedSha256: seeded.sha256};
const reserved = await openStore().reserveTravel(request), reopened = await openStore().read();
assert.deepEqual(reopened.record.home, seeded.record.home);
assert.deepEqual(reopened.record.members, seeded.record.members);
assert.equal(reopened.occupiedSlots, 1);
assert.equal((await openStore().reserveTravel(request)).idempotent, true);
const recovered = await openGuildHomeStoreByAlias(io, {worldId, contentDigest, ...id.homeAlias});
assert.deepEqual((await recovered.read()).record, reopened.record);
await assert.rejects(openStore().withRegistered(selected => prepareHomeBoundActorArrival(source, source,
  original.options, {selected, worldId, contentDigest, sourceRegion: '0_0', destinationRegion: '1_0'})), /Remote native home projection/);
const cancellation = {operationId: request.operationId, expectedSha256: reserved.sha256};
const canceled = await openStore().cancelTravel(cancellation);
assert.equal((await openStore().cancelTravel(cancellation)).idempotent, true);
const prepared = await openStore().withRegistered(selected => prepareHomeBoundActorArrival(source, source,
  original.options, {selected, worldId, contentDigest, sourceRegion: '0_0', destinationRegion: '0_0'}));
for (const [name, data] of Object.entries(prepared.records)) assert.deepEqual(data, original.records[name]);
assert.equal((await hashNativeFile(original.capture.save.filename)).sha256, original.capture.save.sha256);
assert.equal(canceled.occupiedSlots, 1); assert.equal(canceled.record.pending, null);
assert.ok(largestRead <= 4096 && largestWrite <= 4096);
const report = {version: 1, persistentHomeMetadataQualified: true, sourceManifest: resolve(manifest),
  sourceManifestSha256: original.capture.sourceManifestSha256, sourceSave: original.capture.save,
  contentDescriptor, registration, seeded, reserved, reopened, canceled,
  persistentArrivalHome: prepared.plan.persistentHome, originalPreparedPayloadsUnchanged: true,
  sourceSaveUnchanged: true, localJournalWrites: writes, largestRead, largestWrite,
  homeIdentityRecoveredByNativeAlias: true,
  remoteProjectionPreparationRejected: true, homeSourceSha256: (await hashNativeFile(join(workspace, 'web/world/hero-home.mjs'))).sha256,
  maximumRegisteredMembers: 8, nativeHomeProjectionQualified: false, completedOwnerTransferQualified: false,
  multiRegionAtomicPublicationQualified: false, browserPersistenceQualified: false, heroCrossingQualified: false,
  browserUsed: false, nativeProcessesStarted: 0};
await writeFile(join(directory, 'registration-observed.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({persistentHomeMetadataQualified: true, occupiedSlots: 1,
  unchangedHeroPayloadBytes: original.totalBytes, localJournalWrites: writes, largestRead, largestWrite,
  remoteProjectionPreparationRejected: true, heroCrossingQualified: false, nativeProcessesStarted: 0, browserUsed: false}));
