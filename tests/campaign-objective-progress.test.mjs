import test from 'node:test';
import assert from 'node:assert/strict';
import {treasuryProgress,treasuryText} from '../web/campaign/objective-progress.mjs';

test('reports the remaining gold from the captured Chapter 2 checkpoint observation', () => {
  // Captured production log; no local game assets or ignored evidence needed.
  const line='[campaign] Chapter 2 treasury progress: kingdom 1 30015/30100; kingdom 2 30015/30100; gathering gold';
  const parsed=treasuryProgress(line,2);
  assert.deepEqual(parsed,{target:30100,ready:false,kingdoms:[
    {owner:1,gold:30015,remaining:85},{owner:2,gold:30015,remaining:85}]});
  assert.equal(treasuryText(parsed),'Kingdom 1: 30,015 / 30,100 gold (85 needed). Kingdom 2: 30,015 / 30,100 gold (85 needed).');
});
test('handles distinct sparse owners, excess gold and debt in Chapter 3',()=>{
  const line='[campaign] Chapter 3 treasury progress: kingdom 4 37000/35000; kingdom 2 -40/35000; gathering gold';
  assert.deepEqual(treasuryProgress(line,3).kingdoms,[{owner:4,gold:37000,remaining:0},{owner:2,gold:-40,remaining:35040}]);
});
test('a reached target is an observation, separate from a shared victory',()=>{
  const line='[campaign] Chapter 3 treasury progress: kingdom 1 35000/35000; kingdom 2 35005/35000; objective met';
  assert.equal(treasuryProgress(line,3).ready,true);
  assert.equal(treasuryProgress('[campaign] Chapter 3 shared victory for 2 kingdoms',3),null);
});
test('rejects mismatched chapters, owners, targets, malformed and oversized observations',()=>{
  const good='[campaign] Chapter 2 treasury progress: kingdom 1 30015/30100; kingdom 2 30015/30100; gathering gold';
  for(const line of [good.replace('Chapter 2','Chapter 3'),good.replace('kingdom 2','kingdom 1'),
    good.replace('kingdom 2','kingdom 5'),good.replace('/30100','/35000'),good.replace('30015','2147483648'),
    good.replace('gathering gold','objective met'),good+' trailing',good.repeat(8),null])
    assert.equal(treasuryProgress(line,2),null);
  assert.equal(treasuryProgress(good,1),null);
  assert.equal(treasuryProgress(good.replace(' kingdom 2 30015/30100;',''),2),null);
});

test('construction progress requires both buildings and unpooled gold for every kingdom',()=>{
  const line='[campaign] Chapter 4 treasury progress: kingdom 1 25000/25000; guild=1 dauros=1 readable=1; kingdom 2 26000/25000; guild=1 dauros=0 readable=1; gathering gold';
  const pending=treasuryProgress(line,4);
  assert.equal(pending.ready,false);
  assert.match(treasuryText(pending),/Kingdom 2:.*Temple to Dauros: needed/);
  const ready=line.replace('dauros=0','dauros=1').replace('gathering gold','objective met');
  assert.equal(treasuryProgress(ready,4).ready,true);
  for(const invalid of [line.replace('gathering gold','objective met'),ready.replace('26000','24999'),
    ready.replace('readable=1','readable=0'),ready.replace('kingdom 2','kingdom 1'),
    ready.replace('guild=1','guild=2'),ready.replace('/25000','/35000'),ready+' trailing'])
    assert.equal(treasuryProgress(invalid,4),null);
  const unreadable=line.replace('readable=1','readable=0');
  assert.match(treasuryText(treasuryProgress(unreadable,4)),/Building state unavailable/);
  assert.equal(treasuryProgress(ready,3),null);
});
