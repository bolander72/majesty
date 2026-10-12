#!/usr/bin/env python3
"""Require both original engines to reload the same selected published NPC pair."""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path
from native_entity_pair import selected_pair_input

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(4096), b''):
            h.update(b)
    return h.hexdigest()


def verify(source_manifest, destination_manifest):
    source = json.loads(subprocess.check_output([
        'node', str(ROOT / 'scripts/check-native-npc-departed-reload.mjs'),
        str(source_manifest), '--stdout',
    ]))
    spec = importlib.util.spec_from_file_location('motion', ROOT / 'scripts/check-native-joint-motion.py')
    motion = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(motion)
    destination = motion.verify(destination_manifest)
    if (source.get('originalBrashnardSourceReloadQualified') is not True or
            destination.get('freshScheduledWorldReloadQualified') is not True or
            destination.get('originalAiExecutionQualified') is not True):
        raise ValueError('Require original departed source and scheduled AI destination reloads')
    manifests = [source['fixture'], destination['fixture']]
    exports = [m.get('selectedPairExport') for m in manifests]
    if any(not e for e in exports) or exports[0]['receipt'] != exports[1]['receipt']:
        raise ValueError('Both native runs must use the same selected export receipt')
    receipt = Path(exports[0]['receipt'])
    worlds = []
    for side, (m, e) in enumerate(zip(manifests, exports)):
        checked = selected_pair_input(receipt, side, e['sha256'])
        if checked != e:
            raise ValueError('Selected native provenance changed')
        name = 'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'
        file = Path(m['profile']) / name
        if (m['inputHashes'][name] != e['sha256'] or sha(file) != e['sha256'] or
                file.stat().st_size != e['bytes'] or m['nativeSessionTerminal'] is not True or m['nativeExitCode'] != 0):
            raise ValueError('Native engine copied another selected snapshot')
        worlds.append({'side': side, 'bytes': e['bytes'], 'sha256': e['sha256'],
                       'nativePid': m['nativePid'], 'profile': m['profile']})
    if (manifests[0]['nativePid'] == manifests[1]['nativePid'] or
            manifests[0]['profile'] == manifests[1]['profile'] or
            exports[0]['receiptSha256'] != exports[1]['receiptSha256'] or
            exports[0]['manifest'] != exports[1]['manifest'] or exports[0]['owner'] != exports[1]['owner']):
        raise ValueError('Require separate original processes and identical ownership transaction')
    if source['input']['sha256'] != exports[0]['sha256'] or destination['originalLoadedUnits'] != 481:
        raise ValueError('Incorrect selected source/destination original loads')
    owner = exports[0]['owner']
    if (owner['region'], owner['unitId'], owner['agentId']) != ('1_0', 510, 79):
        raise ValueError('Unexpected published destination owner')
    files = [source_manifest, destination_manifest, receipt,
             Path(source['sourceDepartureReport']), Path(manifests[1]['scheduledCheckpointReport'])]
    code = ['scripts/check-native-entity-pair-reload.py', 'scripts/native_entity_pair.py',
            'scripts/export-native-entity-pair.mjs', 'scripts/lib/stopped-entity-io.mjs',
            'scripts/run-native-original-source-departure.py', 'scripts/run-native-joint-reload.py',
            'web/world/entity-export.mjs', 'web/world/entity-pair.mjs', 'web/world/transfer-store.mjs']
    return {
        'qualified': True,
        'scope': 'One stopped published NPC transfer, exported under selected leases, then serial original source-absence/full-save and destination-AI reloads from the same receipt. Repeated gameplay crossings, simultaneous regions, general references, browser recovery and browser memory remain unqualified.',
        'sourceManifest': str(source_manifest), 'destinationManifest': str(destination_manifest),
        'receipt': str(receipt), 'receiptSha256': exports[0]['receiptSha256'], 'owner': owner, 'worlds': worlds,
        'selectedPairNativeReloadQualified': True,
        'originalSourceAbsenceAndFullSaveQualified': True,
        'originalDestinationQueueAndAiReloadQualified': True,
        'sourceUnchangedSurvivingEntityRecords': source['unchangedSurvivingEntityRecords'],
        'destinationObservedTicks': destination['observedTicks'],
        'destinationOriginalContextActions': destination['originalContextActions'],
        'destinationOriginalPathCalls': destination['originalPathCalls'],
        'browserUsed': False, 'nativeBuildPerformed': False,
        'repeatedGameplayCrossingsQualified': False, 'completeReferenceClosureQualified': False,
        'simultaneousNativeRegionsQualified': False, 'browserPairedPublicationRecoveryQualified': False,
        'wholeBrowserMemoryBoundQualified': False,
        'evidenceSha256': {str(f.relative_to(ROOT)): sha(f) for f in files},
        'sourceSha256': {f: sha(ROOT / f) for f in code},
    }


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('source_manifest', type=Path)
    p.add_argument('destination_manifest', type=Path)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    result = verify(a.source_manifest.resolve(), a.destination_manifest.resolve())
    with a.output.open('x') as f:
        json.dump(result, f, indent=2)
        f.write('\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'selectedPairNativeReloadQualified',
        'sourceUnchangedSurvivingEntityRecords', 'destinationObservedTicks', 'destinationOriginalContextActions']}))
