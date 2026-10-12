import test from 'node:test';
import assert from 'node:assert/strict';
import {actorRegionCoordinates, actorRegionGridCells} from '../web/world/actor-coordinates.mjs';
const source = {originX: 0, originY: 0, widthCells: 256, heightCells: 256};
test('preserves fractional Q11 position across a region origin and back', () => {
  const position = {x: 5000 * 2048 + 713, y: 2000 * 2048 + 125, z: -8193},
    destination = {originX: 4096, originY: 0, widthCells: 128, heightCells: 128};
  const result = actorRegionCoordinates(position, source, destination);
  assert.deepEqual(result.fixed, {x: 904 * 2048 + 713, y: position.y, z: position.z});
  assert.deepEqual(result.grid, {x: 56, y: 125});
  assert.deepEqual(actorRegionCoordinates(result.fixed, destination, source).fixed, position);
});
test('negative and distant global origins do not overflow native local coordinates', () => {
  for (const origin of [-4096000000, 4096000000]) {
    const a = {...source, originX: origin, originY: -origin},
      b = {originX: origin + 4096, originY: -origin, widthCells: 128, heightCells: 128};
    const position = {x: 4096 * 2048 + 1, y: 31 * 2048 + 2047, z: 0};
    const result = actorRegionCoordinates(position, a, b);
    assert.equal(result.fixed.x, 1); assert.deepEqual(result.grid, {x: 0, y: 1});
    assert.deepEqual(actorRegionCoordinates(result.fixed, b, a).fixed, position);
  }
});
test('destination right and bottom edges are exclusive; last fractional step is retained', () => {
  const destination = {...source, widthCells: 128, heightCells: 128}, edge = 4096 * 2048;
  assert.deepEqual(actorRegionCoordinates({x: edge - 1, y: edge - 1, z: 0}, source, destination).grid, {x: 255, y: 255});
  for (const position of [{x: edge, y: 0, z: 0}, {x: 0, y: edge, z: 0}])
    assert.throws(() => actorRegionCoordinates(position, source, destination), /destination/);
});
test('refuses invalid geometry, unsafe arithmetic and positions outside their source', () => {
  for (const patch of [{originX: 1}, {originX: Number.MAX_SAFE_INTEGER}, {widthCells: 0}, {heightCells: 1025}])
    assert.throws(() => actorRegionCoordinates({x: 0, y: 0, z: 0}, {...source, ...patch}, source));
  for (const patch of [{x: -1}, {y: source.heightCells * 32 * 2048}, {z: 0x80000000}, {x: 0.1}])
    assert.throws(() => actorRegionCoordinates({x: 0, y: 0, z: 0, ...patch}, source, source));
});
test('preserves a moving actor cell independently of fractional position', () => {
  const destination = {originX: 4096, originY: 0, widthCells: 128, heightCells: 128};
  const position = actorRegionCoordinates({x: 323 * 32768 + 100, y: 136 * 32768 + 99, z: 261580}, source, destination);
  const cell = actorRegionGridCells({x: 323, y: 137}, source, destination);
  assert.deepEqual(position.grid, {x: 67, y: 136});
  assert.deepEqual(cell, {x: 67, y: 137});
  assert.deepEqual(actorRegionGridCells(cell, destination, source), {x: 323, y: 137});
  assert.throws(() => actorRegionGridCells({x: 255, y: 137}, source, destination), /destination/);
  assert.throws(() => actorRegionGridCells({x: 512, y: 0}, source, destination), /source/);
});
