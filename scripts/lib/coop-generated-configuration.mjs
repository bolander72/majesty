// Read only the original SVGD v10 / owning freestyle configuration v6.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkpointChunks} from '../../web/world/checkpoint.mjs';
import {checkpointDisplayNames} from './coop-host-checkpoint-state.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {nativeRegionGenerationSeed} from '../../web/world/hero-generation-request.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
function stringEnd(b,start) {
  assert.ok(start<b.length);
  const wide=b[start]===0xff&&b[start+1]===0xfe;
  let at=start+(wide?2:0),count=0;
  for (;;) {
    assert.ok(at+(wide?2:1)<=b.length&&count<=128);
    const word=wide?b.readUInt16LE(at):b[at];at+=wide?2:1;
    if (!word) return at;
    assert.ok(word>=32&&word!==127&&word!==0xffff);++count;
  }
}
export function freestyleConfiguration(bytes) {
  const n=checkpointDisplayNames(bytes).namesEnd;
  assert.equal(bytes.readUInt32LE(n),2,'Require network freestyle scenario kind');
  // Original00436c00 writes six metadata words after the party names before
  // original004ae5e0 serializes the owning configuration. Its v6 order is:
  // words0..12, word14, two strings, bool21, word13, words22/23.
  const start=n+24;assert.ok(start+60<=bytes.length);
  assert.equal(bytes.readUInt32LE(start),6);
  const words=Array.from({length:14},(_,i)=>bytes.readUInt32LE(start+4+i*4));
  let at=stringEnd(bytes,start+60);at=stringEnd(bytes,at);
  assert.ok(at+16<=bytes.length);
  const flags=[bytes.readUInt32LE(at),bytes.readUInt32LE(at+8),bytes.readUInt32LE(at+12)];
  assert.ok(flags[0]===0||flags[0]===1);
  assert.equal(bytes.readUInt32LE(at+4),2,'Owning configuration must retain both players');
  return {bytes:Buffer.from(bytes.subarray(start,at+16)),words,flags,players:2};
}
async function configuration(path) {
  const source=await stoppedFileSource(path);assert.ok(source.size<=2*1024*1024);
  let result;
  for await(const c of checkpointChunks(source))if(c.tag==='SVGD') {
    assert.ok(!result);assert.deepEqual([c.version,c.count],[10,0]);assert.ok(c.size<=1024);
    result=freestyleConfiguration(Buffer.from(await source.readAt(c.offset+16,c.size)));
  }
  assert.ok(result);return result;
}
export async function compareGeneratedConfiguration(sourcePath,targetPath,targetRegion) {
  const source=await configuration(sourcePath),target=await configuration(targetPath);
  assert.equal(source.words[3],0x444e4152,'Require the original RAND starting-settlement selection');
  assert.deepEqual(target.words.slice(0,12),source.words.slice(0,12));
  assert.equal(target.words[12],nativeRegionGenerationSeed(targetRegion));
  assert.deepEqual(target.words.slice(9,11),[128,128]);
  const normalized=[source,target].map(c=>{
    const b=Buffer.from(c.bytes);b.writeUInt32LE(0,4+12*4);return b;
  });
  assert.ok(normalized[0].equals(normalized[1]),'All owning configuration fields except the region seed must match');
  return {configurationVersion:6,players:2,startingSettlementSelection:'RAND',
    sourceSeed:source.words[12],targetSeed:target.words[12],targetRegion,
    allOtherConfigurationBytesMatch:true,sourceConfigurationSha256:sha(source.bytes),
    targetConfigurationSha256:sha(target.bytes),normalizedConfigurationSha256:sha(normalized[0])};
}
