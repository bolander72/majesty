import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeGroundHeightQ16, sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';

test('alternating triangles use original diagonal and signed floor products', () => {
  const heights = [0, 65536, 196608, -65536];
  const at = (cellX, x, y) => nativeGroundHeightQ16({xQ16: cellX * 65536 + x, yQ16: y, heights});
  assert.equal(at(0, 49152, 16384), 16384);
  assert.equal(at(0, 16384, 49152), 81920);
  assert.equal(at(1, 16384, 16384), 65536);
  assert.equal(at(1, 49152, 49152), 32768);
  assert.equal(nativeGroundHeightQ16({xQ16: 1, yQ16: 0, heights: [0, -1, 0, 0]}), -1);
});

test('native signed subtraction/product/addition wrap is exact without float multiplication', () => {
  assert.equal(nativeGroundHeightQ16({xQ16: 32768, yQ16: 0, heights: [2147483647, -2147483648, 0, 0]}), 2147483647);
  for (const input of [{xQ16: -1, yQ16: 0, heights: [0, 0, 0, 0]},
    {xQ16: 0.5, yQ16: 0, heights: [0, 0, 0, 0]},
    {xQ16: 0, yQ16: 0, heights: [0, 0, 0]},
    {xQ16: 0, yQ16: 0, heights: [0, 0, 0, 2147483648]}])
    assert.throws(() => nativeGroundHeightQ16(input), /input/);
});

test('sampler reads one cell and its four vertices, validates bounds before reading', async () => {
  let reads = 0;
  const terrain = {width: 128, height: 128, async window(x, y, width, height) {
    ++reads; assert.deepEqual([x, y, width, height], [1, 2, 1, 1]);
    const vertices = new Uint8Array(36), view = new DataView(vertices.buffer);
    [0, 1, 3, -1].forEach((n, i) => view.setFloat32(i * 9, n, true));
    return {vertices};
  }};
  assert.equal(await sampleNativeGroundHeight(terrain, {x: 65536 + 16384, y: 131072 + 16384}), 65536);
  for (const position of [{x: -1, y: 0}, {x: 127 * 65536, y: 0}, {x: 0, y: 128 * 65536}])
    await assert.rejects(sampleNativeGroundHeight(terrain, position), /sampler|interior/);
  assert.equal(reads, 1);
});
