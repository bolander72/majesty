#!/usr/bin/env python3
"""Require serial original-engine reloads from one selected evolved revision."""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path
from native_entity_pair import selected_revision_input

ROOT=Path(__file__).resolve().parents[1]


def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(4096),b''):
            h.update(b)
    return h.hexdigest()


def verify(source_name,destination_name):
    source=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/check-native-npc-departed-reload.mjs'),str(source_name),'--stdout']))
    spec=importlib.util.spec_from_file_location('motion',ROOT/'scripts/check-native-joint-motion.py')
    motion=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(motion)
    destination=motion.verify(destination_name)
    if (source.get('originalBrashnardSourceReloadQualified') is not True or
            destination.get('freshEvolvedWorldReloadQualified') is not True or
            destination.get('originalAiExecutionQualified') is not True):
        raise ValueError('Require original source absence and evolved destination AI reloads')
    manifests=[source['fixture'],destination['fixture']]
    exports=[m.get('selectedRevisionExport') for m in manifests]
    if any(not e for e in exports) or exports[0]['receipt']!=exports[1]['receipt']:
        raise ValueError('Both native runs must load the same selected revision receipt')
    worlds=[]
    for side,(m,e) in enumerate(zip(manifests,exports)):
        checked=selected_revision_input(Path(e['receipt']),side,e['sha256'],require_current=False)
        if checked!=e:
            raise ValueError('Selected revision native provenance differs')
        file=Path(m['profile'])/'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'
        if (sha(file)!=e['sha256'] or file.stat().st_size!=e['bytes'] or
                m['inputHashes']['Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP']!=e['sha256']):
            raise ValueError('Original engine copied another revision snapshot')
        worlds.append({'side':side,'bytes':e['bytes'],'sha256':e['sha256'],'nativePid':m['nativePid'],'profile':m['profile']})
    for key in ['receiptSha256','manifest','owner','revision','identitySha256','stateSha256','revisionReportSha256']:
        if exports[0][key]!=exports[1][key]:
            raise ValueError('Original engines loaded different revision metadata: '+key)
    if manifests[0]['nativePid']==manifests[1]['nativePid'] or manifests[0]['profile']==manifests[1]['profile']:
        raise ValueError('Require separate original processes/profiles')
    owner=exports[0]['owner']
    if (owner['region'],owner['unitId'],owner['agentId'])!=('1_0',510,79) or source['input']['sha256']!=exports[0]['sha256']:
        raise ValueError('Wrong selected revision owner or source snapshot')
    captured=json.loads(Path(manifests[1]['evolvedCheckpointReport']).read_text())
    position=captured['after']['actor']['position']
    if (destination['motionSamples'][0][1:4]!=[captured['clock'],position['x'],position['y']] or
            destination['originalLoadedUnits']!=captured['after']['counts']['units']):
        raise ValueError('Original engine reset selected evolved state')
    files=[source_name,destination_name,Path(exports[0]['receipt']),Path(manifests[1]['evolvedCheckpointReport'])]
    code=['scripts/check-native-entity-revision-reload.py','scripts/export-native-entity-revision.mjs',
          'scripts/native_entity_pair.py','scripts/run-native-original-source-departure.py','scripts/run-native-joint-reload.py',
          'scripts/check-native-joint-reload.py','scripts/check-native-joint-motion.py','web/world/entity-revisions.mjs',
          'web/world/entity-ownership.mjs','web/world/entity-export.mjs','scripts/lib/stopped-revision-io.mjs','scripts/lib/stopped-entity-io.mjs']
    return {
        'qualified':True,
        'scope':'One selected stopped evolved revision exported under leases, then serial original source-absence/full-save and evolved destination AI/movement reloads from the same receipt. Original revision manifest parsing, player/browser integration and cross-region return remain unqualified.',
        'sourceManifest':str(source_name),'destinationManifest':str(destination_name),
        'receipt':exports[0]['receipt'],'receiptSha256':exports[0]['receiptSha256'],
        'revision':exports[0]['revision'],'owner':owner,'worlds':worlds,
        'selectedRevisionNativeReloadQualified':True,'sourceUnchangedSurvivingEntityRecords':source['unchangedSurvivingEntityRecords'],
        'originalDestinationLoadedUnits':destination['originalLoadedUnits'],'evolvedStartingClock':captured['clock'],
        'evolvedStartingPosition':position,'destinationObservedTicks':destination['observedTicks'],
        'destinationOriginalAiActions':destination['originalContextActions'],'destinationOriginalPathCalls':destination['originalPathCalls'],
        'browserUsed':False,'nativeBuildPerformed':False,'originalRevisionManifestParserQualified':False,
        'repeatedGameplayCrossingsQualified':False,'simultaneousNativeRegionsQualified':False,'completeReferenceClosureQualified':False,
        'browserPairedPublicationRecoveryQualified':False,'wholeBrowserMemoryBoundQualified':False,
        'evidenceSha256':{str(f.relative_to(ROOT)):sha(f) for f in files},
        'sourceSha256':{f:sha(ROOT/f) for f in code},
    }


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('source_manifest',type=Path)
    p.add_argument('destination_manifest',type=Path)
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    result=verify(a.source_manifest.resolve(),a.destination_manifest.resolve())
    with a.output.open('x') as f:
        json.dump(result,f,indent=2)
        f.write('\n')
    print(json.dumps({k:result[k] for k in ['qualified','selectedRevisionNativeReloadQualified','revision','originalDestinationLoadedUnits','destinationOriginalAiActions']}))
