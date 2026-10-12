// Pinned MTER heights: native signed Q16, serialized as float32. The reader
// truncates magnitude, discards sub-step values and can wrap invalid ranges.
const scratch=new DataView(new ArrayBuffer(4));
export function nativeHeightQ16(bits){
  if(!Number.isSafeInteger(bits)||bits<0||bits>0xffffffff)throw new Error('Invalid native height bits');
  scratch.setUint32(0,bits,true);
  const height=scratch.getFloat32(0,true);
  if(!Number.isFinite(height))throw new Error('Nonfinite native border height');
  if(height<-32768||height>=32768)throw new Error('Native border height exceeds signed Q16 range');
  return Math.trunc(height*65536)||0;
}
export function nativeHeightBits(q16){
  if(!Number.isSafeInteger(q16)||q16< -2147483648||q16>2147483647)throw new Error('Invalid native Q16 height');
  scratch.setFloat32(0,q16===0?0:q16/65536,true);
  return scratch.getUint32(0,true);
}
export function requireStableNativeHeight(bits){
  if(nativeHeightBits(nativeHeightQ16(bits))!==bits)throw new Error('Native border height changes on reload');
}
