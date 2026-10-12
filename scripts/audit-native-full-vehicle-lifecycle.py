#!/usr/bin/env python3
"""Pin private vehicle construction, CRT pool accounting and GPL teardown."""
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
    cs = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = [('vehicle-allocator-constructor', 0x433af0, 0x433b77),
              ('vehicle-deleting-destructor', 0x433600, 0x43361e),
              ('vehicle-destructor', 0x433620, 0x433691),
              ('mobile-base-constructor', 0x42ff80, 0x430007),
              ('mobile-base-destructor', 0x430030, 0x4300de),
              ('crt-small-block-region-find', 0x65488f, 0x6548ba),
              ('crt-small-block-free', 0x6548ba, 0x654be3),
              ('gpl-runtime-getter', 0x623b20, 0x623b29),
              ('gpl-resource-getter', 0x628c60, 0x628d5b),
              ('gpl-resource-delete-reset', 0x628e60, 0x628e91)]
    decoded, methods = {}, []
    for name, start, end in ranges:
        raw = pe.get_data(start - base, end - start)
        rows = list(cs.disasm(raw, start))
        assert sum(row.size for row in rows) == len(raw)
        assert rows[-1].mnemonic == 'ret', name
        decoded.update({row.address: row for row in rows})
        methods.append(dict(name=name, start=f'{start:08x}', end=f'{end:08x}',
                            sha256=hashlib.sha256(raw).hexdigest(), instructions=len(rows)))
    anchors = [(0x433b07, 'push', '0x164'),
               (0x433b0c, 'call', '0x64c616'),
               (0x433b2a, 'push', '1'),
               (0x433b2f, 'call', '0x42ff80'),
               (0x433b4d, 'mov', 'dword ptr [esi], 0x68098c'),
               (0x433603, 'call', '0x433620'),
               (0x433610, 'call', '0x645bc0'),
               (0x43367b, 'call', '0x430030'),
               (0x430061, 'call', '0x5b2de0'),
               (0x65488f, 'mov', 'eax, dword ptr [0x723a7c]'),
               (0x654897, 'mov', 'eax, dword ptr [0x723a80]'),
               (0x6548a7, 'sub', 'edx, dword ptr [eax + 0xc]'),
               (0x6548aa, 'cmp', 'edx, 0x100000'),
               (0x6548b2, 'add', 'eax, 0x14'),
               (0x6548c8, 'mov', 'eax, dword ptr [ecx + 0x10]'),
               (0x6548d4, 'shr', 'edi, 0xf'),
               (0x6548d9, 'imul', 'ecx, ecx, 0x204'),
               (0x6548df, 'lea', 'ecx, [ecx + eax + 0x144]'),
               (0x6548e9, 'mov', 'ecx, dword ptr [esi]'),
               (0x6548eb, 'dec', 'ecx'),
               (0x6548ec, 'test', 'cl, 1'),
               (0x654adf, 'dec', 'dword ptr [eax]'),
               (0x623b20, 'call', '0x628c60'),
               (0x628d46, 'mov', 'dword ptr [0x7218b4], eax'),
               (0x628e6d, 'call', '0x628110'),
               (0x628e73, 'call', '0x645bc0'),
               (0x628e78, 'mov', 'eax, dword ptr [esp + 0xc]'),
               (0x628e7f, 'mov', 'dword ptr [0x7218b4], eax')]
    for pc, mnemonic, operand in anchors:
        assert (decoded[pc].mnemonic, decoded[pc].op_str) == (mnemonic, operand), hex(pc)
    assert int.from_bytes(pe.get_data(0x68098c - base, 4), 'little') == 0x433600
    config = tomllib.loads((game / 'game.toml').read_text())
    assert 0x628e60 in config['translate']['entry_points']
    catalogue = json.loads((game / 'build/recomp/symbols.json').read_text())
    assert catalogue['exe_sha256'] == PIN
    catalogue_entries = {}
    for address in ['00433af0', '00433600', '00623b20', '00628e60']:
        entry = next(row for row in catalogue['functions'] if row['addr'] == address)
        assert entry['hookable'] and entry['kind'] == 'entry'
        catalogue_entries[address] = entry['provenance']
    assert catalogue_entries['00628e60'] == 'config'
    sources = [Path(__file__), game / 'game.toml']
    report = dict(qualified=True, scope='static complete private vehicle and CRT pool lifecycle',
                  executableSha256=PIN, methods=methods, instructionSites=len(anchors),
                  catalogueEntries=catalogue_entries, vehicleObjectBytes=0x164,
                  poolRegionBytes=0x100000, poolGroupBytes=0x8000,
                  poolGroupHeaderStride=0x204, poolGroupCounterOffset=0x144,
                  gplResourceGlobal='007218b4', resourceDelete='00628e60',
                  staticAuditOnly=True, originalVehicleExecuted=False,
                  browserUsed=False, goalCompleted=False,
                  sourceSha256={str(p.relative_to(ROOT)): sha(p) for p in sources})
    (ROOT / 'output/native-full-vehicle-lifecycle-audit.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, methods=len(methods), instructionSites=len(anchors),
                         resourceDeleteCatalogueHookable=True)))


if __name__ == '__main__':
    main()
