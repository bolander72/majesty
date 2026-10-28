#!/usr/bin/env python3
"""Append the source-bound test-only GPL helper to an isolated native probe."""
import argparse
from dataclasses import replace
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import read_cam
import importlib.util
spec = importlib.util.spec_from_file_location('expansion_probe_policy',
    ROOT / 'scripts/prepare-community-expansion-runtime-probe.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)
COMPILER = '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4'


def stage(engine, compiled):
    receipt_path = engine / 'test-controls-stage.json'
    if receipt_path.exists():
        raise ValueError('Preserve prior test controls; use a fresh probe')
    probe = policy.document(engine / 'probe-stage.json')
    proof = policy.document(compiled / 'compile.json')
    source = ROOT / 'native/community/expansion_panel_probe.gpl'
    bytecode = compiled / 'probe.bcd'
    if (probe.get('format') != 'majesty-community-expansion-runtime-probe-v2'
            or not probe.get('privateProbeOnly') or probe.get('published')
            or proof.get('exitCode') != 0 or proof['bytecode'] != policy.digest(bytecode)
            or policy.digest(compiled / 'probe.gpl') != policy.digest(source)
            or policy.digest(compiled / 'Gplbcc.exe')['sha256'] != COMPILER
            or (compiled / 'probe.gplproj').read_bytes() != b'source="probe.gpl"\r\n'):
        raise ValueError('Require an isolated probe and exact original-SDK test helper')
    outputs, groups = {}, {}
    for directory, prefix in (('Data', ''), ('DataMX', 'mx_')):
        name = directory + '/' + prefix + 'miscdata.cam'
        target = engine / 'game' / name
        if policy.digest(target) != probe['gameFiles'][name]:
            raise ValueError('Probe load groups already changed')
        archive = read_cam(target.read_bytes())
        sections, changed = [], []
        for section in archive.sections:
            entries = []
            for entry in section.entries:
                if section.extension == b'DATA' and entry.name[:4] == b'XML1':
                    if b'<!DOCTYPE' in entry.data.upper() or b'<!ENTITY' in entry.data.upper():
                        raise ValueError('Unsafe XML declaration')
                    root = ET.fromstring(entry.data)
                    for group in root.findall('./DataGroups/LoadData/*'):
                        if any(child.text == 'Expansion_Probe.bcd' for child in group):
                            raise ValueError('Test helper already loaded')
                        if any(child.tag == 'LoadGPL' for child in group):
                            ET.SubElement(group, 'LoadGPL').text = 'Expansion_Probe.bcd'
                            changed.append(group.tag)
                    entry = replace(entry, data=ET.tostring(root, encoding='utf-8'))
                entries.append(entry)
            sections.append(replace(section, entries=tuple(entries)))
        if not changed:
            raise ValueError('Original GPL load groups unavailable')
        outputs[name] = replace(archive, sections=tuple(sections)).to_bytes()
        helper = directory + '/Expansion_Probe.bcd'
        if (engine / 'game' / helper).exists():
            raise ValueError('Preserve existing probe helper')
        outputs[helper] = bytecode.read_bytes()
        groups[directory] = changed
    files = {}
    for name, raw in outputs.items():
        target = engine / 'game' / name
        if target.is_symlink(): target.unlink()
        target.write_bytes(raw)
        files[name] = policy.digest(target)
    result = dict(format='majesty-expansion-native-test-controls-v2',
        engineStage=policy.digest(engine / 'probe-stage.json'), source=policy.digest(source),
        compiler=policy.digest(compiled / 'Gplbcc.exe'), compile=proof, files=files,
        groups=groups, policy=policy.digest(Path(__file__)), testOnly=True,
        runtimeFlag='RECOMP_COMMUNITY_TEST_EXPANSION_PANELS=20261028', productionChanged=False)
    receipt_path.write_text(json.dumps(result, indent=2) + '\n')
    return dict(testOnly=True, files=len(files), productionChanged=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--engine', type=Path, required=True)
    parser.add_argument('--compiled', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(stage(args.engine, args.compiled)))
