#!/usr/bin/env python3
"""Pin the original UNIT reader and its guarded bank allocation/observer sites."""
import hashlib
import json
from pathlib import Path
import tomllib

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def sha(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def main():
    game = ROOT / 'upstream/majesty-recomp'
    exe = game / 'original/gog/MajestyHD - Old.exe'
    assert sha(exe) == PIN
    pe = pefile.PE(str(exe))
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = [('unit-reader', 0x5b1b90, 0x5b1bd8),
              ('unit-bank-getter', 0x4300e0, 0x43014f),
              ('bank-constructor', 0x4abcc0, 0x4abcd9),
              ('bank-reader', 0x5e4d20, 0x5e4e1b)]
    methods, decoded = [], {}
    for name, start, end in ranges:
        raw = pe.get_data(start - base, end - start)
        rows = list(decoder.disasm(raw, start))
        assert sum(row.size for row in rows) == len(raw)
        assert rows[-1].mnemonic == 'ret'
        decoded.update({row.address: row for row in rows})
        methods.append(dict(name=name, start=f'{start:08x}', end=f'{end:08x}',
                            sha256=hashlib.sha256(raw).hexdigest(), instructions=len(rows)))
    anchors = [(0x5b1b9c, 'call', 'dword ptr [eax + 0x164]'),
               (0x5b1bb3, 'call', 'dword ptr [edx + 0x160]'),
               (0x5b1bb9, 'mov', 'edx, dword ptr [eax]'),
               (0x5b1bbe, 'call', 'dword ptr [edx + 4]'),
               (0x430108, 'push', '0x14'),
               (0x43010a, 'call', '0x64c616'),
               (0x43010f, 'add', 'esp, 4'),
               (0x430125, 'call', '0x4abcc0'),
               (0x43012e, 'mov', 'dword ptr [esi + edi*4 + 0x88], eax')]
    for pc, mnemonic, operand in anchors:
        assert (decoded[pc].mnemonic, decoded[pc].op_str) == (mnemonic, operand)
    assert int.from_bytes(pe.get_data(0x683148 + 4 - base, 4), 'little') == 0x5e4d20
    config = tomllib.loads((game / 'game.toml').read_text())
    assert 0x5e4d20 in config['translate']['entry_points']
    catalogue = json.loads((game / 'build/recomp/symbols.json').read_text())
    assert catalogue['exe_sha256'] == PIN
    entry = next(row for row in catalogue['functions'] if row['addr'] == '005e4d20')
    assert entry['hookable'] and entry['kind'] == 'entry' and entry['provenance'] == 'config'
    sources = [Path(__file__), game / 'game.toml']
    report = dict(qualified=True, scope='static UNIT reader lineage and configured bank-reader entry',
                  executableSha256=PIN, methods=methods, instructionSites=len(anchors),
                  bankAllocateReturn='0043010f', bankReader='005e4d20',
                  bankReaderCatalogueHookable=True, staticAuditOnly=True,
                  nativeUnitReaderExecuted=False, browserUsed=False,
                  sourceSha256={str(path.relative_to(ROOT)): sha(path) for path in sources})
    (ROOT / 'output/native-unit-order-reader-sites-audit.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, methods=len(methods), instructionSites=len(anchors),
                         bankReaderCatalogueHookable=True)))


if __name__ == '__main__':
    main()
