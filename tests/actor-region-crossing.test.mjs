import test from 'node:test';
import assert from 'node:assert/strict';
import {actorRegionCoordinates} from '../web/world/actor-coordinates.mjs';
import {actorRegionCrossingCoordinates} from '../web/world/actor-region-crossing.mjs';

const Q = 2048, extent = 128 * 32, edge = extent * Q;
const source = Object.freeze({originX:0, originY:0, widthCells:128, heightCells:128});
const neighbors = {west:{...source, originX:-extent}, east:{...source, originX:extent},
  north:{...source, originY:-extent}, south:{...source, originY:extent}};

test('adjacent 128-cell domains require a pending step, not saved-position remapping', () => {
  const previous = {x:0, y:288 * Q + 713, z:12345}, proposed = {...previous, x:-1};
  assert.throws(() => actorRegionCoordinates(previous, source, neighbors.west), /destination/);
  assert.throws(() => actorRegionCoordinates(proposed, source, neighbors.west), /source/);
  const r = actorRegionCrossingCoordinates(previous, proposed, source, neighbors.west);
  assert.equal(r.fixed.x, edge - 1); assert.equal(r.fixed.y, previous.y); assert.equal(r.fixed.z, previous.z);
  assert.equal(r.direction, 'west'); assert.deepEqual(r.grid, {x:255, y:18});
  assert.deepEqual(r.globalFixed, {x:-1, y:previous.y}); assert.deepEqual(r.stepFixed, {x:-1, y:0, z:0});
  assert.deepEqual(previous, {x:0, y:288 * Q + 713, z:12345}); assert.equal(proposed.x, -1);
});

test('all cardinal crossings preserve exact global displacement and fractional positions', () => {
  for (const [direction, destination] of Object.entries(neighbors)) {
    const horizontal = ['west','east'].includes(direction), negative = ['west','north'].includes(direction),
      previous = {x:500 * Q + 813, y:731 * Q + 125, z:-8193};
    previous[horizontal ? 'x' : 'y'] = negative ? 13 : edge - 14;
    const proposed = {...previous}; proposed[horizontal ? 'x' : 'y'] += negative ? -727 : 727;
    proposed[horizontal ? 'y' : 'x'] += 9; proposed.z += 1;
    const r = actorRegionCrossingCoordinates(previous, proposed, source, destination);
    assert.equal(r.direction, direction); assert.equal(r.fixed.z, proposed.z);
    for (const [axis, origin] of [['x','originX'],['y','originY']]) {
      assert.equal(r.globalFixed[axis], destination[origin] * Q + r.fixed[axis]);
      assert.equal(r.globalFixed[axis] - r.previousGlobalFixed[axis], proposed[axis] - previous[axis]);
      assert.equal(r.fixed[axis] % Q, (proposed[axis] % Q + Q) % Q);
      assert.ok(r.grid[axis] >= 0 && r.grid[axis] < 256);
    }
  }
});

test('new regions at distant negative and positive origins retain sub-unit precision', () => {
  for (const origin of [-4096000000, 4096000000]) {
    const from = {...source, originX:origin, originY:-origin}, to = {...from, originX:origin + extent};
    const previous = {x:edge - 1, y:31 * Q + 2047, z:0}, proposed = {...previous, x:edge + 713};
    const r = actorRegionCrossingCoordinates(previous, proposed, from, to);
    assert.equal(r.fixed.x, 713); assert.equal(r.fixed.y, proposed.y);
    assert.equal(r.globalFixed.x - r.previousGlobalFixed.x, 714);
  }
});

test('a reverse pending step returns to the original global position', () => {
  const previous = {x:0, y:731 * Q + 813, z:12345}, proposed = {...previous,x:-1};
  const outward = actorRegionCrossingCoordinates(previous, proposed, source, neighbors.west);
  const returned = actorRegionCrossingCoordinates(outward.fixed, {...outward.fixed,x:edge}, neighbors.west, source);
  assert.deepEqual(returned.fixed, previous); assert.equal(returned.direction, 'east');
  assert.deepEqual(returned.stepFixed, {x:1,y:0,z:0});
});

test('edge inclusivity follows half-open destination footprints without clamping', () => {
  const east = actorRegionCrossingCoordinates({x:edge - 1, y:0, z:0}, {x:edge, y:0, z:0}, source, neighbors.east);
  assert.equal(east.fixed.x, 0);
  assert.throws(() => actorRegionCrossingCoordinates({x:0,y:0,z:0}, {x:0,y:0,z:0}, source, neighbors.west), /has not crossed/);
  assert.throws(() => actorRegionCrossingCoordinates({x:edge - 1,y:0,z:0}, {x:2 * edge,y:0,z:0}, source, neighbors.east), /destination/);
});

test('overlap, distant destinations, wrong directions and corner steps refuse', () => {
  const previous = {x:edge - 1, y:40 * Q, z:0}, proposed = {...previous, x:edge + 1};
  for (const to of [source, {...source, originX:extent / 2}, {...source, originX:2 * extent},
    {...source, originX:extent, originY:extent}, {...neighbors.east, widthCells:256}])
    assert.throws(() => actorRegionCrossingCoordinates(previous, proposed, source, to), /adjacent|equal region/);
  assert.throws(() => actorRegionCrossingCoordinates(previous, proposed, source, neighbors.west), /destination/);
  for (const y of [-1, edge])
    assert.throws(() => actorRegionCrossingCoordinates(previous, {...proposed,y}, source, neighbors.east), /corner/);
});

test('invalid pending movement and out-of-bounds departing positions refuse', () => {
  const previous = {x:edge - 1,y:40 * Q,z:0}, proposed = {...previous,x:edge + 1};
  for (const patch of [{x:1.5}, {x:0x80000000}, {y:NaN}, {z:Infinity}])
    assert.throws(() => actorRegionCrossingCoordinates(previous, {...proposed,...patch}, source, neighbors.east), /Invalid native actor position/);
  for (const patch of [{x:-1}, {x:edge}, {y:edge}])
    assert.throws(() => actorRegionCrossingCoordinates({...previous,...patch}, proposed, source, neighbors.east), /source/);
  assert.throws(() => actorRegionCrossingCoordinates(previous, proposed, {...source, originX:1}, neighbors.east), /geometry/);
  const limitOrigin = Math.floor(Number.MAX_SAFE_INTEGER / Q / 32) * 32,
    nearLimit = {...source,originX:limitOrigin}, nearNeighbor = {...nearLimit,originX:limitOrigin - extent};
  assert.throws(() => actorRegionCrossingCoordinates(previous, {...proposed,x:-1}, nearLimit, nearNeighbor), /destination/);
});
