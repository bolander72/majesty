import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeHeightQ16,nativeHeightBits,requireStableNativeHeight} from '../web/world/native-height.mjs';

test('pinned native reader/writer conversion keeps canonical signed Q16 heights stable',()=>{
  assert.equal(nativeHeightBits(-0),0,'native integer zero serializes as positive float zero');
  for(const [bits,q16]of [[0,0],[0x37800000,1],[0xb7800000,-1],[0x3fc00000,98304],
    [0xbfc00000,-98304],[0x46ffffff,2147483520],[0xc7000000,-2147483648]]){
    assert.equal(nativeHeightQ16(bits),q16);assert.equal(nativeHeightBits(q16),bits);requireStableNativeHeight(bits);
  }
});
test('lossy float32 heights, signed zero and sub-step values cannot be published as exact shared borders',()=>{
  for(const [bits,q16,serialized]of [[0x80000000,0,0],[0x37000000,0,0],[0xb7000000,0,0],
    [0x3dcccccd,6553,0x3dccc800],[0xbdcccccd,-6553,0xbdccc800]]){
    assert.equal(nativeHeightQ16(bits),q16);assert.equal(nativeHeightBits(q16),serialized);
    assert.throws(()=>requireStableNativeHeight(bits),/changes on reload/);
  }
});
test('wrapping ranges, nonfinite heights and invalid scalar inputs are rejected',()=>{
  for(const bits of [0x47000000,0xc7000001,0x7149f2ca])assert.throws(()=>nativeHeightQ16(bits),/signed Q16 range/);
  for(const bits of [0x7f800000,0xff800000,0x7fc00000])assert.throws(()=>nativeHeightQ16(bits),/Nonfinite/);
  for(const bits of [null,NaN,-1,0.5,0x100000000])assert.throws(()=>nativeHeightQ16(bits),/bits/);
  for(const q16 of [null,NaN,-2147483649,2147483648,0.5])assert.throws(()=>nativeHeightBits(q16),/Q16/);
  // The original writer rounds this extreme native value above the reader's
  // signed range; writer conversion alone does not establish a stable save.
  assert.equal(nativeHeightBits(2147483647),0x47000000);
  assert.throws(()=>requireStableNativeHeight(nativeHeightBits(2147483647)),/signed Q16 range/);
});
