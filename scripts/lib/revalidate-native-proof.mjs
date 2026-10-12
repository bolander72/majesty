// Revalidate historical findings after a read-only checker changes. Compare all
// findings, fixtures, native provenance and evidence hashes. Only checker-code
// hashes may differ; their old values remain recorded in the original report.
import assert from 'node:assert/strict';
export function assertRevalidatedNativeProof(current,recorded) {
  const normalize=p=>{
    const v=structuredClone(p);
    for(const [name,digest] of Object.entries(v.sourceSha256)) {
      assert.match(digest,/^[a-f0-9]{64}$/,'Invalid original source digest');
      if(name.startsWith('scripts/'))delete v.sourceSha256[name];
    }
    return v;
  };
  assert.deepEqual(normalize(current),normalize(recorded),'Historical native findings or evidence changed');
}
