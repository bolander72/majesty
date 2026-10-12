import {hashCheckpointSource} from './transfer-store.mjs';

// Export both worlds while their selected read leases remain held. A destination
// must finish each write before returning; publish the receipt only after both.
// This copies stopped snapshots, not running engines or evolving game state.
export function exportSelectedEntityPair(store, writeWorld, publishReceipt) {
  if (!store || typeof store.withSelected !== 'function' || typeof writeWorld !== 'function' || typeof publishReceipt !== 'function')
    return Promise.reject(Error('Invalid selected-pair exporter'));
  return store.withSelected(async selected => {
    if (!selected) throw Error('No selected entity pair');
    const worlds = selected.record.worlds.map(w => ({...w}));
    const receipt = {version: 1, manifest: selected.record.manifest, owner: {...selected.owner}, worlds};
    for (let side = 0; side < 2; ++side) {
      let invoked = false, completed = false, active = true;
      try {
        await writeWorld(side, {...worlds[side]}, async sink => {
          if (!active || invoked || !sink || typeof sink.write !== 'function') throw Error('Invalid export writer lifetime');
          invoked = true;
          const digest = await hashCheckpointSource(selected.sources[side], bytes => {
            if (!active) throw Error('Export writer lifetime ended');
            return sink.write(bytes);
          });
          if (digest !== worlds[side].sha256) throw Error('Selected export digest mismatch');
          completed = true;
        });
      } finally {active = false;}
      if (!completed) throw Error('Selected export writer did not finish world');
    }
    await publishReceipt(structuredClone(receipt));
    return receipt;
  });
}
