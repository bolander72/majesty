// Original positions use signed Q11 world units; a terrain cell spans 32
// world units and a navigation cell spans 16. Keep the fractional position.
const FIXED = 2048, CELL = 32, GRID = 16;
const int32 = value => Number.isInteger(value) && value >= -0x80000000 && value <= 0x7fffffff;
function geometry(region) {
  if (!region || ![region.originX, region.originY].every(Number.isSafeInteger) ||
      ![region.widthCells, region.heightCells].every(n => Number.isInteger(n) && n > 0 && n <= 1024) ||
      region.originX % CELL || region.originY % CELL ||
      ![region.originX * FIXED, region.originY * FIXED].every(Number.isSafeInteger))
    throw new Error('Invalid native region geometry');
}
export function actorRegionCoordinates(position, source, destination) {
  geometry(source); geometry(destination);
  if (!position || ![position.x, position.y, position.z].every(int32) ||
      position.x < 0 || position.y < 0 ||
      position.x >= source.widthCells * CELL * FIXED ||
      position.y >= source.heightCells * CELL * FIXED)
    throw new Error('Actor is outside its source region');
  const globalX = source.originX * FIXED + position.x,
    globalY = source.originY * FIXED + position.y;
  const x = globalX - destination.originX * FIXED,
    y = globalY - destination.originY * FIXED;
  if (![globalX, globalY, x, y].every(Number.isSafeInteger) || ![x, y].every(int32) ||
      x < 0 || y < 0 || x >= destination.widthCells * CELL * FIXED ||
      y >= destination.heightCells * CELL * FIXED)
    throw new Error('Actor is outside the destination region');
  const world = {x: Math.floor(x / FIXED), y: Math.floor(y / FIXED)};
  return {fixed: {x, y, z: position.z}, world,
    grid: {x: Math.trunc(world.x / GRID), y: Math.trunc(world.y / GRID)},
    globalFixed: {x: globalX, y: globalY},
    deltaWorld: {x: source.originX - destination.originX,
      y: source.originY - destination.originY}};
}
export function actorRegionGridCells(cells, source, destination) {
  geometry(source); geometry(destination);
  if (!cells || ![cells.x, cells.y].every(Number.isInteger) || cells.x < 0 || cells.y < 0 ||
      cells.x >= source.widthCells * 2 || cells.y >= source.heightCells * 2)
    throw new Error('Saved navigation cell is outside its source region');
  const x = cells.x + (source.originX - destination.originX) / GRID,
    y = cells.y + (source.originY - destination.originY) / GRID;
  if (![x, y].every(Number.isSafeInteger) || x < 0 || y < 0 ||
      x >= destination.widthCells * 2 || y >= destination.heightCells * 2)
    throw new Error('Saved navigation cell is outside the destination region');
  return {x, y};
}
