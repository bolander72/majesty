import test from 'node:test';
import assert from 'node:assert/strict';
import {AutomaticLaunch} from '../web/hosting/autoload.mjs';

test('returning player automatically enters the game, retaining local profile and query', async () => {
  const visits = [];
  const launch = new AutomaticLaunch({href: 'https://majesty.boland.co/?profile=local#camera',
    status: async id => { assert.equal(id, 'majesty'); return {status: {state: 'ready'}}; },
    navigate: href => visits.push(href)});
  assert.equal(await launch.check(), true);
  await launch.check();
  assert.deepEqual(visits, ['https://majesty.boland.co/majesty/?profile=local#camera']);
});

test('first-time visitor stays at import, then starts when import completes', async () => {
  let state = 'notFound', visited = false;
  const launch = new AutomaticLaunch({href: 'https://majesty.boland.co/',
    status: async () => ({status: {state}}), navigate: () => { visited = true; }});
  assert.equal(await launch.check(), false);
  assert.equal(visited, false);
  state = 'ready';
  assert.equal(await launch.check(), true);
});

test('setup link prevents a redirect loop and allows managing imported files', async () => {
  const launch = new AutomaticLaunch({href: 'https://majesty.boland.co/?setup=1',
    status: () => { throw Error('Must not start'); }, navigate: () => assert.fail()});
  assert.equal(await launch.check(), false);
});

test('retired edition deep links check the original content import', async () => {
  const launch = new AutomaticLaunch({href: 'https://majesty.boland.co/?edition=wayfinder-v1&profile=wayfinder',
    status: async id => { assert.equal(id, 'majesty'); return {status: {state: 'ready'}}; },
    navigate: href => assert.match(href, /edition=wayfinder-v1&profile=wayfinder/)});
  assert.equal(await launch.check(), true);
});

test('concurrent import status notifications share one check', async () => {
  let complete, calls = 0, visits = 0;
  const launch = new AutomaticLaunch({href: 'https://majesty.boland.co/',
    status: () => { calls++; return new Promise(resolve => { complete = resolve; }); },
    navigate: () => { visits++; }});
  const a = launch.check(), b = launch.check();
  complete({status: {state: 'ready'}});
  await Promise.all([a, b]);
  assert.equal(calls, 1);
  assert.equal(visits, 1);
});
