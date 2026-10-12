#!/usr/bin/env python3
"""Prepare a new owned Brashnard baseline for the native fixed-load fixture."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
GMP = 'Documents/My Games/MajestyHD/SaveGame/(Scions of Chaos) 0 Days.GMP'
ALLOWED = {'mod-settings.json', 'Documents/My Games/MajestyHD/MajXPrefs',
           'Documents/My Games/MajestyHD/questdata_majx.sav', GMP}
PIN = '31059d44ebf165c25bf1fd91f8ef00d5c5e3733d2d6177ca8e05956026650e13'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_manifest', type=Path)
    args = parser.parse_args()
    previous = json.loads(args.source_manifest.read_text())
    source = Path(previous['source']).resolve()
    manifest = ROOT / 'output/native-actor-target-stage-source.json'
    if manifest.exists():
        raise ValueError('Preserve the existing owned source fixture')
    if (set(previous['sourceHashes']) != ALLOWED or source.name != 'frontier_0_0' or
            not source.is_relative_to((GAME / 'build').resolve())):
        raise ValueError('Expected a known owned four-file baseline')
    for name, digest in previous['sourceHashes'].items():
        if sha(source / name) != digest:
            raise ValueError('The source profile changed: ' + name)
    checkpoint = ROOT / 'output/checkpoint-unit-reference-browser/brashnard.GMP'
    if checkpoint.stat().st_size != 1298525 or sha(checkpoint) != PIN:
        raise ValueError('The copied Brashnard world changed')
    pack = json.loads((ROOT / 'output/native-actor-target-stage-fixtures.json').read_text())
    if pack['sourceSha256'] != PIN or [c['unitId'] for c in pack['cases']] != [2062, 2063, 2067, 2073]:
        raise ValueError('The selected actor pack does not match this world')
    run = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-target-source-', dir=GAME / 'build'))
    profile = run / 'frontier_0_0'
    hashes = {}
    for name in ALLOWED:
        target = profile / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(checkpoint if name == GMP else source / name, target)
        hashes[name] = sha(target)
        if hashes[name] != (PIN if name == GMP else previous['sourceHashes'][name]):
            raise ValueError('The copied fixture changed')
    data = dict(source=str(profile), sourceHashes=hashes, actualWorld='Brashnard copied checkpoint',
                selectedSmokeFilename=GMP, checkpointSource=str(checkpoint),
                expectedWorldUnitVisits=1960, nativeRestorationQualified=False,
                browserUsed=False, originalProfilesModified=False)
    manifest.write_text(json.dumps(data, indent=2) + '\n')
    print(json.dumps(dict(source=run.name, worldUnitVisits=1960, originalProfilesModified=False)))


if __name__ == '__main__':
    main()
