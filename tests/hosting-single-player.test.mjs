import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const context = {URLSearchParams};
vm.runInNewContext(await readFile(new URL('../web/hosting/single-player.js', import.meta.url), 'utf8'), context);
const clean = context.majestySinglePlayerSearch;

test('old invitations cannot select a shared session or restore network environment', () => {
  const search = '?profile=my-save&room=old&role=host&mode=coop&relay=wss%3A%2F%2Fexample.test&' +
    'RECOMP_RULE_FRONTIER_CHAPTER=4&RECOMP_COOP_RESUME=old&RECOMP_RULE_COOP_WORLD=old&' +
    'RECOMP_RULE_COOP_FUTURE=1&RECOMP_NETWORK_URL=old&RECOMP_NETWORK_DEBUG=1&' +
    'RECOMP_DIRECTPLAY_PROVIDER=old&RECOMP_RULE_NATIVE_COOP_RESUME=old&' +
    'RECOMP_BROWSER_NETWORK_STATE=old&RECOMP_SINGLE_PLAYER_ONLY=0';
  assert.equal(clean(search), '?profile=my-save');
});

test('single-player profiles, named worlds and supported solo settings remain intact', () => {
  assert.equal(clean('?profile=kingdom_1&world=atlas&RECOMP_RULE_INVENTORY_COMPAT=1&setup=1'),
    '?profile=kingdom_1&world=atlas&RECOMP_RULE_INVENTORY_COMPAT=1&setup=1');
});

test('empty and repeated shared-session settings are all removed', () => {
  assert.equal(clean('?room=one&room=two&RECOMP_COOP_RESUME=x&RECOMP_COOP_RESUME=y'), '');
  assert.equal(clean(''), '');
});
