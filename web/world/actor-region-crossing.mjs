import {actorRegionCoordinates} from './actor-coordinates.mjs';

const FIXED = 2048, CELL = 32;
const int32 = value => Number.isInteger(value) && value >= -0x80000000 && value <= 0x7fffffff;
function inside(position, region) {
  return position.x >= 0 && position.y >= 0 &&
    position.x < region.widthCells * CELL * FIXED &&
    position.y < region.heightCells * CELL * FIXED;
}

// Unlike remapping a saved in-bounds actor between overlapping windows, a
// crossing consumes a prospective original movement step BEFORE it is applied
// to the departing engine. The old position must still be inside that region;
// the proposed position must be outside it and inside one cardinal neighbor.
// This only converts coordinates. Native collision, grounding, order/roster
// migration and durable ownership must succeed before a caller applies it.
export function actorRegionCrossingCoordinates(previous, proposed, source, destination) {
  // The existing converter owns geometry, fixed-point and safe-global checks.
  // Keeping that API unchanged also preserves recorded preparation provenance.
  const before = actorRegionCoordinates(previous, source, source);
  actorRegionCoordinates({x:0,y:0,z:0}, destination, destination);
  if (!proposed || ![proposed.x, proposed.y, proposed.z].every(int32))
    throw new Error('Invalid native actor position');
  if (source.widthCells !== destination.widthCells || source.heightCells !== destination.heightCells)
    throw new Error('Actor crossing requires equal region extents');
  const dx = destination.originX - source.originX, dy = destination.originY - source.originY,
    width = source.widthCells * CELL, height = source.heightCells * CELL;
  let direction;
  if (dy === 0 && dx === -width) direction = 'west';
  else if (dx === 0 && dy === -height) direction = 'north';
  else if (dx === 0 && dy === height) direction = 'south';
  else if (dy === 0 && dx === width) direction = 'east';
  else throw new Error('Actor crossing requires one adjacent cardinal region');
  if (inside(proposed, source)) throw new Error('Proposed movement has not crossed a region boundary');
  // Both endpoints of the tangent motion stay within the shared edge span.
  // Corner/diagonal proposals need an explicit multi-step handoff, not clamping.
  const horizontal = direction === 'west' || direction === 'east';
  const tangent = horizontal ? proposed.y : proposed.x,
    tangentLimit = (horizontal ? height : width) * FIXED;
  if (tangent < 0 || tangent >= tangentLimit) throw new Error('Ambiguous corner crossing');
  const fixed = {x:proposed.x - dx * FIXED, y:proposed.y - dy * FIXED, z:proposed.z};
  if (!inside(fixed, destination)) throw new Error('Actor is outside the destination region');
  const result = actorRegionCoordinates(fixed, destination, destination);
  return {...result, direction, deltaWorld:{x:-dx,y:-dy}, previousGlobalFixed:before.globalFixed,
    stepFixed: {x: proposed.x - previous.x, y: proposed.y - previous.y, z: proposed.z - previous.z}};
}
