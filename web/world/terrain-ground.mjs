// Pinned 005af220 interpolation, 004f6ba0 signed Q16 multiplication.
// Actor local Q11 world XY equals Q16 terrain-cell XY (32 world units/cell).
import {nativeHeightQ16} from './native-height.mjs';

function signed(value) { return Number(BigInt.asIntN(32, value)); }
function multiply(a, b) { return signed((BigInt(a) * BigInt(b)) >> 16n); }

export function nativeGroundHeightQ16({xQ16, yQ16, heights} = {}) {
  if (![xQ16, yQ16].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647) ||
      !Array.isArray(heights) || heights.length !== 4 ||
      !heights.every(value => Number.isSafeInteger(value) && value >= -2147483648 && value <= 2147483647))
    throw new Error('Invalid native ground interpolation input');
  const x = xQ16 % 65536, y = yQ16 % 65536, [a, b, c, d] = heights;
  let base, first, second, weightFirst, weightSecond;
  if ((Math.floor(xQ16 / 65536) ^ Math.floor(yQ16 / 65536)) & 1) {
    if (x + y < 65536) {
      base = a; first = c; second = b; weightFirst = y; weightSecond = x;
    } else {
      base = d; first = b; second = c; weightFirst = 65536 - y; weightSecond = 65536 - x;
    }
  } else if (x > y) {
    base = b; first = d; second = a; weightFirst = y; weightSecond = 65536 - x;
  } else {
    base = c; first = a; second = d; weightFirst = 65536 - y; weightSecond = x;
  }
  const firstDelta = signed(BigInt(first) - BigInt(base)), secondDelta = signed(BigInt(second) - BigInt(base));
  return signed(BigInt(base) + BigInt(multiply(weightFirst, firstDelta)) + BigInt(multiply(weightSecond, secondDelta)));
}

export async function sampleNativeGroundHeight(terrain, {x, y} = {}) {
  if (!terrain || ![terrain.width, terrain.height].every(n => Number.isSafeInteger(n) && n > 1 && n <= 1024) ||
      typeof terrain.window !== 'function' || ![x, y].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 2147483647))
    throw new Error('Invalid native ground sampler');
  const cellX = Math.floor(x / 65536), cellY = Math.floor(y / 65536);
  // Match the original strict interior bound. Never interpret its zero fallback
  // as valid ground outside that range.
  if (cellX + 1 >= terrain.width || cellY + 1 >= terrain.height)
    throw new Error('Native ground position outside interpolation interior');
  const window = await terrain.window(cellX, cellY, 1, 1);
  if (!(window?.vertices instanceof Uint8Array) || window.vertices.length !== 36)
    throw new Error('Invalid native ground vertex window');
  const view = new DataView(window.vertices.buffer, window.vertices.byteOffset, 36);
  const heights = [0, 9, 18, 27].map(at => nativeHeightQ16(view.getUint32(at, true)));
  return nativeGroundHeightQ16({xQ16: x, yQ16: y, heights});
}
