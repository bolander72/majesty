#!/usr/bin/env python3
"""Distinguish authentic Laboratory stages in the native display string table."""
from dataclasses import replace
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
from majesty_cam.cam import read_cam, CamArchive
from majesty_cam.strt import parse_strt, StrtTable

LABELS = {int.from_bytes(b'ABx1', 'little'): b'Alchemy Lab',
          int.from_bytes(b'ABx2', 'little'): b'Alchemy Lab Level 2',
          int.from_bytes(b'ABx3', 'little'): b'Alchemy Lab Level 3'}


def label_archive(raw):
    original = read_cam(raw)
    changed = 0
    sections = []
    for section in original.sections:
        entries = []
        for entry in section.entries:
            data = entry.data
            if section.extension == b'STRT' and entry.name[:4] == b'UNTN':
                table = parse_strt(data)
                matches = [record for record in table.records if record.string_id in LABELS]
                if matches:
                    if len(matches) != 3 or any(record.text != b'Alchemy Lab' for record in matches):
                        raise ValueError('Require the three original ambiguous Laboratory titles')
                    data = StrtTable(table.version, tuple(replace(record, text=LABELS[record.string_id])
                        if record.string_id in LABELS else record for record in table.records)).to_bytes()
                    changed += 1
            entries.append(replace(entry, data=data))
        sections.append(replace(section, entries=tuple(entries)))
    if changed != 1:
        raise ValueError('Require exactly one Laboratory title table')
    return CamArchive(tuple(sections)).to_bytes()


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve existing resource output')
    args.output.write_bytes(label_archive(args.input.read_bytes()))
