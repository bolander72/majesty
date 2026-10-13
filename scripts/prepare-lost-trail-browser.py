#!/usr/bin/env python3
"""Prepare source-bound private browser patches without changing game collections."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('wayfinder_import', ROOT / 'scripts/prepare-wayfinder-browser-import.py')
WAYFINDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WAYFINDER)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def bindings(replacements=False):
    text = (ROOT / 'web/content/lost-trail-files.mjs').read_text()
    section = text.split('export const LOST_TRAIL_REPLACEMENTS')[1 if replacements else 0]
    return dict(re.findall(r"'([^']+)': '([a-f0-9]{64})'", section))


def prepare(base, pack, menu, candidate, qualification, output):
    if output.exists():
        raise ValueError('Preserve prior releases; choose a new private output directory')
    record = json.loads(WAYFINDER.resident(candidate / 'candidate.json'))
    qualified = json.loads(WAYFINDER.resident(qualification))
    proof_path = ROOT / record['compilerEvidence']
    proof = json.loads(WAYFINDER.resident(proof_path))
    stage = json.loads(WAYFINDER.resident(ROOT / proof['inputStage']))
    script_hash = record['files']['DataMX/TheLostTrail.bcd']['sha256']
    if (record.get('canonicalGuid') != '{8BC7C549-E5A2-4D0F-A726-83B16BF19E42}'
            or record.get('legacyQuestId') != 'XQD2'
            or record.get('initializer') != 'DOWNLOADABLE_QUEST_2'
            or record.get('requiredRuntimeEnvironment') != {'RECOMP_RULE_INVENTORY_COMPAT': '1'}
            or qualified.get('nativeContentMilestoneQualified') is not True
            or qualified.get('ordinaryCampaignVictoryQualified') is not True
            or qualified.get('completionPersistenceQualified') is not True
            or qualified.get('controlledObjectiveInputsUsed') is not False
            or qualified.get('gameScriptSha256') != script_hash
            or proof.get('originalCompilerSucceeded') is not True
            or proof.get('bytecodeCompiled') is not True
            or proof.get('sha256') != script_hash):
        raise ValueError('Require the source-bound, native-qualified canonical Lost Trail')
    for name, expected in stage['sourceSha256'].items():
        if name not in ('TheLostTrail.gpl', 'TheLostTrail.gplproj'):
            raise ValueError('Unexpected compiler source')
        if sha(WAYFINDER.resident(ROOT / 'content/the-lost-trail' / name)) != expected:
            raise ValueError('Authored mission source differs from the original compiler input')
    additions, _ = WAYFINDER.resources(pack, menu)
    additions.pop(WAYFINDER.CONFIG)  # Candidate binds the same pack plus XQD2.
    for path, expected in record['files'].items():
        if path not in bindings():
            raise ValueError('Unexpected native candidate resource')
        data = WAYFINDER.resident(candidate / path)
        if len(data) != expected['bytes'] or sha(data) != expected['sha256']:
            raise ValueError('Changed native candidate resource: ' + path)
        additions[path] = data
    if {path: sha(data) for path, data in additions.items()} != bindings():
        raise ValueError('Browser bindings differ from the qualified native content')
    originals = {}
    with zipfile.ZipFile(base) as archive:
        entries = WAYFINDER.source_entries(archive)
        if sha(archive.read(WAYFINDER.EXE)) != WAYFINDER.EXE_SHA256:
            raise ValueError('Unsupported original executable')
        for path in additions.keys() & entries.keys():
            originals[path] = sha(archive.read(path))
        if originals != bindings(replacements=True):
            raise ValueError('Original text/configuration differs; existing game files were preserved')
    # Only the twelve small resources are copied; no 685 MiB duplicate game ZIP.
    output.mkdir(parents=True)
    patches = []
    for path, data in sorted(additions.items()):
        target = output / 'patches' / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        patches.append(dict(path=path, bytes=len(data), sha256=sha(data)))
    report = dict(format='majesty-lost-trail-browser-candidate-v1',
        contentSet='lost-trail-v1', storageId='majesty-lost-trail', baseId='majesty',
        engineSha256='4f36119bda15e259a49cb3fc8d8032e94613b808030e30af476d10a5e27eba5a',
        canonicalGuid=record['canonicalGuid'], legacyQuestId='XQD2',
        requiredRuntimeEnvironment=record['requiredRuntimeEnvironment'],
        sourceSha256=stage['sourceSha256'], candidateSha256=sha(WAYFINDER.resident(candidate / 'candidate.json')),
        nativeQualification=str(qualification.resolve()), nativeQualificationSha256=sha(WAYFINDER.resident(qualification)),
        originals=originals, patches=patches, patchBytes=sum(p['bytes'] for p in patches),
        originalCollectionsModified=False, profilesAccessed=False,
        browserMissionQualified=False, published=False,
        newTerrainAuthored=False, menuArtworkInherited=True)
    (output / 'browser-candidate.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['base', 'native-pack', 'menu', 'candidate', 'qualification', 'output']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    result = prepare(args.base, args.native_pack, args.menu, args.candidate, args.qualification, args.output)
    print(json.dumps({key: result[key] for key in ['contentSet', 'patchBytes', 'browserMissionQualified', 'published']}))
