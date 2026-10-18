import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMUNITY_FILES, COMMUNITY_SIZES, COMMUNITY_REPLACEMENTS, COMMUNITY_STORAGE_ID} from '../web/content/community-files.mjs';
import {derivedDescriptor, buildDerivedFiles} from '../web/hosting/derived-assets.mjs';

const patches = Object.entries(COMMUNITY_FILES).map(([path, sha256]) => ({
  path, sha256, bytes: COMMUNITY_SIZES[path],
  url: 'https://raw.githubusercontent.com/bolander72/majesty/' + 'a'.repeat(40) + '/assets/content/community/' + path,
}));
const plan = {format: 'majesty-automatic-assets-v1', games: {
  [COMMUNITY_STORAGE_ID]: {baseId: 'majesty', patches},
}};

test('composed community admission binds all resources and rejects changed recipes', () => {
  const recipe = derivedDescriptor(plan, COMMUNITY_STORAGE_ID);
  assert.equal(recipe.contentSet, 'community-guilds-v1');
  assert.equal(recipe.baseId, 'majesty');
  assert.equal(recipe.patches.length, 54);
  for (const change of [
    r => {r.patches[0].bytes++;},
    r => {r.patches[0].sha256 = '0'.repeat(64);},
    r => {r.patches[0].path = 'Data/unreviewed.cam';},
    r => {r.baseId = 'majesty-lost-trail';},
    r => {r.patches[0].url = 'https://untrusted.invalid/mod.cam';},
    r => {r.patches[1] = r.patches[0];},
  ]) {
    const invalid = structuredClone(plan);
    change(invalid.games[COMMUNITY_STORAGE_ID]);
    assert.throws(() => derivedDescriptor(invalid, COMMUNITY_STORAGE_ID));
  }
});

test('modified original inputs are preserved and refused before any community download', async () => {
  const base = [{path: 'MajestyHD - Old.exe', file: {hash: 'original-executable'}}];
  for (const [path, hash] of Object.entries(COMMUNITY_REPLACEMENTS))
    base.push({path, file: {hash}});
  const recipe = derivedDescriptor(plan, COMMUNITY_STORAGE_ID);
  let downloads = 0;
  const options = {hashFile: async file => file.hash,
    fetchFile: async () => {downloads++; throw Error('download reached');}};
  const changed = base.map(row => row.path === 'Data/sounddesc.cam' ?
    {...row, file: {hash: 'player-customized-input'}} : row);
  await assert.rejects(buildDerivedFiles(changed, recipe, options), /modified content/);
  assert.equal(downloads, 0);
  assert.equal(changed.find(row => row.path === 'Data/sounddesc.cam').file.hash, 'player-customized-input');
  await assert.rejects(buildDerivedFiles(base, recipe, options), /download reached/);
  assert.equal(downloads, 1);
  for (const [path, hash] of Object.entries(COMMUNITY_REPLACEMENTS))
    assert.equal(base.find(row => row.path === path).file.hash, hash);
});
