#!/usr/bin/env python3
"""Qualify original native identity publication, natural backlink and registry retirement."""
import argparse
import json
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]


def verify(manifest):
    spec = spec_from_file_location('world_identity_composition', ROOT / 'scripts/check-native-script-composed-arrival.py')
    value = module_from_spec(spec)
    spec.loader.exec_module(value)
    result = value.verify(manifest, publication=True)
    result['sourceSha256'][str(Path(__file__).relative_to(ROOT))] = value.module('check-native-actor-script-witness').sha(Path(__file__))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = verify(args.manifest)
    with args.output.open('x') as file:
        json.dump(result, file, indent=2)
        file.write('\n')
    print(json.dumps({key: result[key] for key in ['qualified', 'cycles', 'actualJointWriterRecords',
                    'naturalNativeRegistryResolutionQualified', 'monotonicNativeReservations', 'actorActivationQualified']}))
