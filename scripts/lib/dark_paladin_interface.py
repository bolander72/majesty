"""Independent native upgradable guild panel; stock AP05 stays byte-identical."""
from dataclasses import replace
import hashlib
import struct

from majesty_cam.cam import CamEntry
from majesty_cam.strt import parse_strt

PANEL = b'CGDP'
BASELINE = {
    b'SMNU': '63ff3a9fca62c00331cd3117f5cbff075f21fd9b14d8993dea126971f50e82cd',
    b'STRT': 'e4471153e6c16f2a9b14686127c77e8c010229b66721a9b49485e325901d3ad0',
}


def panel_resources(stock):
    source = {(s.extension, e.name[:4]): e for s in stock.sections for e in s.entries}
    records = {}
    for kind, expected in BASELINE.items():
        raw = source[kind, b'AP05'].data
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError('Native single-choice panel baseline changed')
        records[kind] = raw
    body = bytearray(records[b'SMNU'])
    # Native member-counter portrait (25px), and the recruitment button's
    # native small font: the full class name fits beside the live price.
    if body[498*4:499*4] != b'AVE1' or body[123*4:124*4] != b'fnt4':
        raise ValueError('Native counter or recruitment caption binding changed')
    body[498*4:499*4] = b'NDH1'
    body[123*4:124*4] = b'fnt7'
    if body[78*4:79*4] != b'fnt4':
        raise ValueError('Native title caption binding changed')
    body[78*4:79*4] = b'fnt7'
    records[b'SMNU'] = bytes(body)
    text = parse_strt(records[b'STRT'])
    edits = {0: b"DARK PALADIN'S DOMAIN", 1: b'RECRUIT Dark Paladin',
             2: b'Recruit a Dark Paladin ', 3: b"Destroy this Dark Paladin's Domain."}
    text = replace(text, records=tuple(replace(r, text=edits.get(r.string_id, r.text))
                                      for r in text.records))
    records[b'STRT'] = text.to_bytes()
    return {kind: CamEntry(PANEL.ljust(20, b'\0'), data) for kind, data in records.items()}


def append_panel(archive, resources):
    if any(e.name[:4] == PANEL for s in archive.sections for e in s.entries):
        raise ValueError('Private guild panel identity already occupied')
    if not resources.keys() <= {s.extension for s in archive.sections}:
        raise ValueError('Native text archive is missing a panel section')
    return replace(archive, sections=tuple(replace(s, entries=(*s.entries, resources[s.extension]))
                   if s.extension in resources else s for s in archive.sections))
