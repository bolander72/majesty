#!/usr/bin/env python3
"""Verify the pinned original extent setter and its generation data path."""
import argparse
import hashlib
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [(0x004ae120, 0x004ae132), (0x004ae140, 0x004ae151),
          (0x004aef20, 0x004afe98), (0x004b23d0, 0x004b2b70)]
EXPECTED = {
    0x004ae120: ('mov', 'eax, dword ptr [esp + 4]'),
    0x004ae124: ('mov', 'edx, dword ptr [ecx + 0x24]'),
    0x004ae127: ('mov', 'dword ptr [eax], edx'),
    0x004ae129: ('mov', 'ecx, dword ptr [ecx + 0x28]'),
    0x004ae12c: ('mov', 'dword ptr [eax + 4], ecx'),
    0x004ae12f: ('ret', '4'),
    0x004ae140: ('mov', 'eax, dword ptr [esp + 4]'),
    0x004ae144: ('mov', 'edx, dword ptr [esp + 8]'),
    0x004ae148: ('mov', 'dword ptr [ecx + 0x24], eax'),
    0x004ae14b: ('mov', 'dword ptr [ecx + 0x28], edx'),
    0x004ae14e: ('ret', '8'),
    0x004aefdd: ('mov', 'ecx, dword ptr [esp + 0x134]'),
    0x004aefea: ('lea', 'eax, [esi + 0x8c]'),
    0x004aeff0: ('push', 'eax'),
    0x004aeff1: ('call', '0x4ae120'),
    0x004af7f7: ('test', 'al, 2'),
    0x004af814: ('test', 'al, 4'),
    0x004af834: ('mov', 'dword ptr [esi + 0x8c], eax'),
    0x004af83a: ('mov', 'dword ptr [esi + 0x90], ecx'),
    0x004afe82: ('mov', 'eax, esi'),
    0x004afe95: ('ret', '8'),
    0x004b2962: ('mov', 'ecx, dword ptr [esi + 0x90]'),
    0x004b296a: ('mov', 'edx, dword ptr [esi + 0x8c]'),
    0x004b2971: ('shl', 'ecx, 5'),
    0x004b2974: ('shl', 'edx, 5'),
    0x004b2977: ('push', 'ecx'),
    0x004b2978: ('push', 'edx'),
    0x004b2979: ('call', '0x491c70'),
}


def verify_paths(data):
    pe = pefile.PE(data=data)
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    instructions = {}
    for start, end in RANGES:
        for i in decoder.disasm(pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase, end - start), start):
            instructions[i.address] = i
    records = []
    for address, expected in EXPECTED.items():
        i = instructions.get(address)
        if i is None or (i.mnemonic, i.op_str) != expected:
            raise ValueError(f'Original extent path differs at {address:08x}')
        records.append(dict(address=f'{address:08x}', mnemonic=i.mnemonic,
                            operands=i.op_str, bytes=i.bytes.hex()))
    return pe, records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve previous evidence')
    source = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Require the pinned original executable before decoding')
    pe, records = verify_paths(data)
    controls = []
    # Change actual displacement, cleanup, receiver, output and scale bytes.
    # The full input is pinned above; every altered control must fail the path.
    for address in [0x004ae124, 0x004ae129, 0x004ae148, 0x004ae14b,
                    0x004ae14e, 0x004aefea, 0x004af834, 0x004af83a,
                    0x004afe95, 0x004b2971, 0x004b2974]:
        record = next(r for r in records if r['address'] == f'{address:08x}')
        at = pe.get_offset_from_rva(address - pe.OPTIONAL_HEADER.ImageBase) + len(bytes.fromhex(record['bytes'])) - 1
        changed = bytearray(data)
        changed[at] ^= 1
        try:
            verify_paths(bytes(changed))
        except ValueError:
            controls.append(dict(address=f'{address:08x}', refused=True))
        else:
            raise AssertionError('Altered extent instruction accepted')
    report = dict(version=1, qualified=True, originalExecutableSha256=PIN,
                  scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  checkedInstructions=records, contradictoryInstructionControls=controls,
                  configurationExtentOffsets=[0x24, 0x28], generatorExtentOffsets=[0x8c, 0x90],
                  originalSetter='004ae140', setterArgumentBytes=8,
                  originalExtentGetter='004ae120', initializerArgumentBytes=8,
                  landscapeOverridesRequestedExtent=True,
                  worldFactory='00491c70', worldScaleShift=5,
                  browserUsed=False, nativeProcessesStarted=0,
                  scope='Original extent setter/getter and generation input path only; runtime generation, placement, disposal and multiplayer require actual trials.')
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, instructions=len(records), refusalControls=len(controls))))


if __name__ == '__main__':
    main()
