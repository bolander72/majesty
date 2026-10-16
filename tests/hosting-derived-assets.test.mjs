import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {derivedDescriptor, buildDerivedFiles} from '../web/hosting/derived-assets.mjs';
import {WAYFINDER_FILES} from '../web/content/edition-session.mjs';
import {hashBlob} from '../web/world/content-hash.mjs';
import {LOST_TRAIL_FILES} from '../web/content/lost-trail-files.mjs';
import {VAMPIRIC_FILES, VAMPIRIC_SIZES, VAMPIRIC_STORAGE_ID} from '../web/content/vampiric-revenge-files.mjs';

const patches = Object.entries(WAYFINDER_FILES).map(([path, sha256]) => ({path, sha256, bytes: 10,
  url: 'https://example.public.blob.vercel-storage.com/' + path}));
const descriptor = {format: 'majesty-automatic-assets-v1', games: {'majesty-wayfinder': {baseId: 'majesty', patches}}};

test('original demo requires the complete pinned community and mission collection', () => {
  const recipe = {baseId: 'majesty', patches: Object.entries(VAMPIRIC_FILES).map(([path, sha256]) =>
    ({path, sha256, bytes: VAMPIRIC_SIZES[path],
      url: 'https://raw.githubusercontent.com/bolander72/majesty/' + 'a'.repeat(40) + '/assets/content/' + path}))};
  const plan = {format: descriptor.format, games: {[VAMPIRIC_STORAGE_ID]: recipe}};
  assert.equal(derivedDescriptor(plan, VAMPIRIC_STORAGE_ID).contentSet, 'vampiric-revenge-v1');
  for (const change of [r => r.patches.pop(), r => r.patches[0].bytes++,
    r => {r.patches[0].sha256 = '0'.repeat(64);}, r => {r.baseId = 'majesty-alchemist-v1-campaign3';}]) {
    const bad = structuredClone(plan); change(bad.games[VAMPIRIC_STORAGE_ID]);
    assert.throws(() => derivedDescriptor(bad, VAMPIRIC_STORAGE_ID));
  }
});

test('only the exact four qualified resources can be overlaid', () => {
  assert.equal(derivedDescriptor(descriptor, 'majesty-wayfinder').patches.length, 4);
  for (const change of [{path: '../profile/save.GMP'}, {path: 'unknown', sha256: undefined}, {sha256: '0'.repeat(64)},
    {url: 'https://example.com/file'}, {bytes: 2 ** 30}]) {
    const bad = structuredClone(descriptor);
    Object.assign(bad.games['majesty-wayfinder'].patches[0], change);
    assert.throws(() => derivedDescriptor(bad, 'majesty-wayfinder'));
  }
});

test('duplicate patches cannot replace a missing resource', () => {
  const bad = structuredClone(descriptor);
  bad.games['majesty-wayfinder'].patches[3] = bad.games['majesty-wayfinder'].patches[0];
  assert.throws(() => derivedDescriptor(bad, 'majesty-wayfinder'));
});

test('small content patches also accept only commit-pinned URLs in the public Majesty repo', () => {
  const plan = structuredClone(descriptor);
  for (const p of plan.games['majesty-wayfinder'].patches)
    p.url = 'https://raw.githubusercontent.com/bolander72/majesty/' + 'a'.repeat(40) + '/assets/content/' + p.path;
  assert.equal(derivedDescriptor(plan, 'majesty-wayfinder').patches.length, 4);
  plan.games['majesty-wayfinder'].patches[0].url = plan.games['majesty-wayfinder'].patches[0].url.replace('a'.repeat(40), 'main');
  assert.throws(() => derivedDescriptor(plan, 'majesty-wayfinder'));
});

test('Lost Trail requires all twelve bound mission, menu and hero resources', () => {
  const lost = {format: descriptor.format, games: {'majesty-lost-trail': {baseId: 'majesty',
    patches: Object.entries(LOST_TRAIL_FILES).map(([path, sha256]) => ({path, sha256, bytes: 10,
      url: 'https://example.public.blob.vercel-storage.com/' + path}))}}};
  assert.equal(derivedDescriptor(lost, 'majesty-lost-trail').contentSet, 'lost-trail-v1');
  for (const change of [r => r.patches.pop(), r => {r.patches[3].sha256 = '0'.repeat(64);},
    r => {r.patches[0] = r.patches[1];}, r => {r.baseId = 'majesty-wayfinder';}]) {
    const bad = structuredClone(lost); change(bad.games['majesty-lost-trail']);
    assert.throws(() => derivedDescriptor(bad, 'majesty-lost-trail'));
  }
});

test('a customized stock text resource blocks Lost Trail before downloading or changing anything', async () => {
  const config = new File(['config'], 'config'), text = new File(['custom'], 'text');
  await assert.rejects(buildDerivedFiles([
    {path: 'MajestyHD - Old.exe', file: new File(['exe'], 'exe')},
    {path: 'DataMX/mx_miscdata.cam', file: config}, {path: 'DataMX/mx_textdata.cam', file: text},
  ], {contentSet: 'lost-trail-v1', patches: [{path: 'DataMX/mx_textdata.cam'}]}, {
    fetchFile: () => assert.fail('No download before replacement validation'),
    hashFile: file => file === config ? Promise.resolve('14adacc16a0340f14cf951d933cf10b9bb08b770d189e8591660aebebfac3fb3') : hashBlob(file),
  }), /modified content/);
  assert.equal(await text.text(), 'custom');
});

test('a customized original configuration is preserved without any patch fetch', async () => {
  const config = new File(['custom'], 'original.cam');
  await assert.rejects(buildDerivedFiles([{path: 'MajestyHD - Old.exe', file: new File(['exe'], 'exe')},
    {path: 'DataMX/mx_miscdata.cam', file: config}], {patches}, {fetchFile: () => assert.fail()}),
  /original game configuration differs/);
  assert.equal(await config.text(), 'custom');
});

test('derived copy keeps original File handles and replaces only the copy', async () => {
  const exe = new File(['exe'], 'exe'), config = new File(['original'], 'original.cam');
  const bytes = new TextEncoder().encode('new config');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const base = [{path: 'MajestyHD - Old.exe', file: exe}, {path: 'DataMX/mx_miscdata.cam', file: config}];
  const result = await buildDerivedFiles(base, {patches: [{path: 'DataMX/mx_miscdata.cam',
    bytes: bytes.length, sha256, url: 'https://example.public.blob.vercel-storage.com/config'}]}, {
    fetchFile: async () => new Response(bytes),
    hashFile: file => file === config ? Promise.resolve('14adacc16a0340f14cf951d933cf10b9bb08b770d189e8591660aebebfac3fb3') : hashBlob(file),
  });
  assert.equal(result.find(r => r.path === 'MajestyHD - Old.exe').file, exe);
  assert.equal(await result.find(r => r.path === 'DataMX/mx_miscdata.cam').file.text(), 'new config');
  assert.equal(base[1].file, config);
  assert.equal(await config.text(), 'original');
});


test('Alchemist accepts its complete source-bound media pack with exact sizes', async () => {
  const {ALCHEMIST_FILES, ALCHEMIST_SIZES} = await import('../web/content/alchemist-files.mjs');
  const plan = {format: descriptor.format, games: {'majesty-alchemist-v1-campaign3': {baseId: 'majesty',
    patches: Object.entries(ALCHEMIST_FILES).map(([path, sha256]) => ({path, sha256,
      bytes: ALCHEMIST_SIZES[path],
      url: 'https://raw.githubusercontent.com/bolander72/majesty/' + 'a'.repeat(40) + '/assets/content/' + path}))}}};
  assert.equal(derivedDescriptor(plan, 'majesty-alchemist-v1-campaign3').contentSet, 'alchemist-v1');
  assert.ok(plan.games['majesty-alchemist-v1-campaign3'].patches.some(p => p.bytes > 1024 * 1024));
  for (const change of [p => p.patches.pop(), p => p.patches[0].bytes++,
    p => {p.patches[0].sha256 = '0'.repeat(64);}, p => {p.patches[0] = p.patches[1];}]) {
    const bad = structuredClone(plan); change(bad.games['majesty-alchemist-v1-campaign3']);
    assert.throws(() => derivedDescriptor(bad, 'majesty-alchemist-v1-campaign3'));
  }
});

test('Alchemist verifies every replaced original file before fetching media', async () => {
  const {ALCHEMIST_REPLACEMENTS} = await import('../web/content/alchemist-files.mjs');
  const config = new File(['original'], 'config'), text = new File(['customized'], 'text');
  await assert.rejects(buildDerivedFiles([
    {path: 'MajestyHD - Old.exe', file: new File(['exe'], 'exe')},
    {path: 'DataMX/mx_miscdata.cam', file: config}, {path: 'Data/textdata.cam', file: text},
  ], {contentSet: 'alchemist-v1', patches: [{path: 'Data/textdata.cam'}]}, {
    fetchFile: () => assert.fail('Do not download onto a customized collection'),
    hashFile: file => file === config ? Promise.resolve('14adacc16a0340f14cf951d933cf10b9bb08b770d189e8591660aebebfac3fb3') : hashBlob(file),
  }), /modified content/);
  assert.ok(ALCHEMIST_REPLACEMENTS['Data/textdata.cam']);
  assert.equal(await text.text(), 'customized');
});


test('case-folded resource collisions cannot enter a native content collection', async () => {
  const exe = {path: 'MajestyHD - Old.exe', file: new File(['exe'], 'exe')};
  await assert.rejects(buildDerivedFiles([exe, {...exe, path: 'majestyhd - old.exe'}], {patches: []}),
    /complete original game/);
});
