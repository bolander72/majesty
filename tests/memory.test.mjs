import test from 'node:test';
import assert from 'node:assert/strict';
import {MemorySampler, MAX_MEMORY_SAMPLES} from '../web/world/memory.mjs';

test('overlapping measurements share one browser request and retain no attribution data', async () => {
  let resolve, calls = 0;
  const pending = new Promise(r => { resolve = r; });
  const sampler = new MemorySampler({measureUserAgentSpecificMemory(){calls++;return pending;}}, () => 'sample-time');
  const first = sampler.measure();
  for (let i = 0; i < 10000; i++) assert.equal(sampler.measure(), first);
  resolve({bytes: 1000, breakdown: [{attribution: [{url: 'private-file'}]}]});
  assert.deepEqual(await first, {bytes: 1000, at: 'sample-time'});
  assert.equal(calls, 1);
  assert.deepEqual(sampler.samples, [{bytes: 1000, at: 'sample-time'}]);
});
test('successful sampling keeps only the newest bounded history', async () => {
  let bytes = 0;
  const sampler = new MemorySampler({async measureUserAgentSpecificMemory(){return {bytes: ++bytes};}}, () => 'time');
  for (let i = 0; i < 100; i++) await sampler.measure();
  assert.equal(sampler.samples.length, MAX_MEMORY_SAMPLES);
  assert.deepEqual(sampler.samples.map(s => s.bytes), [93,94,95,96,97,98,99,100]);
  const copy = sampler.samples; copy.length = 0;
  assert.equal(sampler.samples.length, MAX_MEMORY_SAMPLES);
});
test('failed or invalid measurement preserves history and permits a new attempt', async () => {
  let result = {bytes: 1};
  const sampler = new MemorySampler({async measureUserAgentSpecificMemory(){if(result instanceof Error)throw result;return result;}}, () => 'time');
  await sampler.measure();
  result = new Error('SecurityError');await assert.rejects(sampler.measure(), /SecurityError/);
  for (const bytes of [undefined,-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1]) {
    result = {bytes};await assert.rejects(sampler.measure(), /invalid memory estimate/);
  }
  assert.deepEqual(sampler.samples, [{bytes: 1, at: 'time'}]);
  result = {bytes: 2};await sampler.measure();
  assert.deepEqual(sampler.samples.map(s=>s.bytes), [1,2]);
});
