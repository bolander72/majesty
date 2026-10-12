#!/usr/bin/env python3
"""Prepare a private legacy menu/config copy; never modify an installation."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('native_resources', ROOT / 'scripts/prepare-wayfinder-native-resources.py')
RESOURCES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RESOURCES)
SOURCE = ROOT / 'upstream/majesty-recomp/original/gog/DataMX/mx_miscdata.cam'


def extend_dependencies(raw, base='ABW1', addition='ABs1'):
    """Copy the original Ranger's rule, preserving every original byte and EOF blank line."""
    if not re.fullmatch(r'[A-Za-z0-9]{4}', addition) or base == addition:
        raise ValueError('Invalid new building identity')
    text = raw.decode('ascii')
    if not text.endswith('\r\n\r\n'):
        raise ValueError('Native dependencies require a final blank line')
    entries = {}
    for line in text.splitlines():
        line = line.split('#', 1)[0].strip()
        if not line:
            continue
        match = re.fullmatch(r'([A-Za-z0-9]{4})(\s*:.*)?', line)
        if not match or match[1] in entries:
            raise ValueError('Malformed or duplicate native dependency entry')
        entries[match[1]] = match[2] or ''
    if base not in entries or addition in entries:
        raise ValueError('Missing inherited rule or new identity collision')
    return raw + ('# Trail Lodge: inherited Ranger construction requirements\r\n' + addition + entries[base] + '\r\n\r\n').encode('ascii')


def replace_records(raw, replacements):
    """Reindex the original uncompressed archive; preserve labels, order and all other bytes."""
    original = RESOURCES.cam_records(raw)
    if not set(replacements) <= set(original):
        raise ValueError('Replacement resource absent')
    count, directory = struct.unpack_from('<II', raw, 12)
    cursor = 20 + count * 8 + directory
    result = bytearray(raw[:cursor])
    for i in range(count):
        kind, index = struct.unpack_from('<4sI', raw, 20 + i * 8)
        items, flags = struct.unpack_from('<II', raw, index)
        if flags:
            raise ValueError('Compressed sections are unsupported')
        for j in range(items):
            at = index + 8 + j * 28
            label, _, _ = struct.unpack_from('<20sII', raw, at)
            key = kind, label[:4]
            payload = replacements.get(key, original[key])
            struct.pack_into('<II', result, at + 20, cursor, len(payload))
            result.extend(payload)
            cursor += len(payload)
    rebuilt = RESOURCES.cam_records(result)
    if rebuilt != {k: replacements.get(k, v) for k, v in original.items()}:
        raise ValueError('Archive resource preservation failed')
    return bytes(result)


def extend_load_groups(raw):
    """Load descriptions once and rebind GPL after each stock mission dataset.

    The original engine replaces its GPL initialization tables on mission entry
    and save restoration. Loading only the common startup group exposes the
    building menu but leaves CreateAgent without the new initialization data.
    Preserve stock ordering and append our GPL after the selected stock scripts.
    """
    xml = ET.fromstring(raw)
    if xml.tag != 'XmlDataRoot':
        raise ValueError('Require the original legacy load configuration')
    load = xml.find('./DataGroups/LoadData')
    if load is None:
        raise ValueError('Missing original load groups')
    groups = []
    for name in ('MajXCommonData', 'Rel0', 'Rel2', 'Relp', 'Rel3'):
        found = load.findall(name)
        if len(found) != 1:
            raise ValueError('Require the original supported dataset groups')
        groups.append(found[0])
    if any(node.text and 'Wayfinder' in node.text for group in groups for node in group):
        raise ValueError('Pack already referenced')
    ET.SubElement(groups[0], 'LoadCAM').text = 'Wayfinder-units.cam'
    ET.SubElement(groups[0], 'LoadCAM').text = 'Wayfinder-interface.cam'
    for group in groups:
        ET.SubElement(group, 'LoadGPL').text = 'Wayfinder.bcd'
    return ET.tostring(xml, encoding='utf-8')


def prepare(pack):
    metadata = json.loads(RESOURCES.resident(pack / 'native-resources.json'))
    if metadata.get('resourceIds') != ['AVz1', 'ABs1'] or metadata.get('installed') is not False:
        raise ValueError('Require the separate uninstalled new identities')
    if metadata.get('interfaceId') != 'APw1' or 'Data/Wayfinder-interface.cam' not in metadata['files']:
        raise ValueError('Require the separate native Trail Lodge interface pack')
    for name, record in metadata['files'].items():
        payload = RESOURCES.resident(pack / name)
        if RESOURCES.sha(payload) != record['sha256'] or len(payload) != record['bytes']:
            raise ValueError('Native resource pack changed')
    source = RESOURCES.resident(SOURCE)
    records = RESOURCES.cam_records(source)
    dependencies = extend_dependencies(records[b'DATA', b'BDEP'])
    modified = replace_records(source, {(b'DATA', b'BDEP'): dependencies,
                                        (b'DATA', b'XML1'): extend_load_groups(records[b'DATA', b'XML1'])})
    return modified, dict(version=1, scope='Private expansion menu/config copy; not an installation',
                         installed=False, published=False, nativeMenuQualified=False,
                         building='ABs1', inheritedBuilding='ABW1',
                         originalDependencyBytesPreserved=True, finalBlankLinePreserved=True,
                         missionBytecodeReloadGroups=['Rel0', 'Rel2', 'Relp', 'Rel3'],
                         sourceSha256=RESOURCES.sha(source), originalDependenciesSha256=RESOURCES.sha(records[b'DATA', b'BDEP']),
                         dependenciesSha256=RESOURCES.sha(dependencies), configSha256=RESOURCES.sha(modified),
                         nativeResourceReceiptSha256=RESOURCES.sha(RESOURCES.resident(pack / 'native-resources.json')))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native-pack', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Preserve existing output')
    data, receipt = prepare(args.native_pack)
    args.output.mkdir()
    (args.output / 'mx_miscdata.cam').write_bytes(data)
    (args.output / 'menu.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({k: receipt[k] for k in ('building', 'installed', 'nativeMenuQualified')}))


if __name__ == '__main__':
    main()
