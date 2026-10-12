#!/usr/bin/env python3
"""Pin original world identity publication, lookup and registry retirement boundaries."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [('native-id-generator', 0x5bad20, 0x5bad39),
          ('native-unit-registration', 0x5a12e0, 0x5a1347),
          ('native-unit-registry-removal-and-destruction', 0x5baf20, 0x5baf66),
          ('agent-native-id-setter', 0x6263b0, 0x6263ba),
          ('agent-native-getter', 0x626310, 0x62633c),
          ('registry-publication-dispatch', 0x596a40, 0x596a70),
          ('registry-filter-and-membership-insertion', 0x596570, 0x5965ef),
          ('orders-registry-filter', 0x5f2920, 0x5f294a),
          ('unit-any-command-predicate', 0x5b2b50, 0x5b2b77),
          ('unit-command-bank-presence', 0x5b2f40, 0x5b2f55),
          ('unit-nonempty-command-bank', 0x5b2b80, 0x5b2ba7)]
ANCHORS = [(0x5bad20, 'mov', 'eax, dword ptr [ecx + 0x28]'),
           (0x5bad23, 'inc', 'eax'), (0x5bad29, 'mov', 'dword ptr [ecx + 0x28], eax'),
           (0x5a12fd, 'call', 'dword ptr [eax + 0x48]'),
           (0x5a1303, 'mov', 'dword ptr [esi + 0x60], eax'),
           (0x5a1330, 'mov', 'dword ptr [esi + 0x84], edi'),
           (0x5a133d, 'call', '0x596a40'),
           (0x5baf30, 'mov', 'ebx, dword ptr [ebp + 0x60]'),
           (0x5baf42, 'call', 'dword ptr [edx + 4]'),
           (0x5baf59, 'push', '1'), (0x5baf5d, 'call', 'dword ptr [edx]'),
           (0x6263b4, 'mov', 'dword ptr [ecx + 0x20], eax'),
           (0x6263b7, 'ret', '4'),
           (0x626329, 'jle', '0x626337'), (0x62632f, 'call', '0x5a10d0'),
           (0x626334, 'mov', 'dword ptr [esi + 0x24], eax'),
           (0x596584, 'call', 'dword ptr [eax + 0xc]'),
           (0x5f2929, 'call', 'dword ptr [eax + 0x194]'),
           (0x5f2933, 'mov', 'ecx, dword ptr [esi + 0x40]'),
           (0x5f293b, 'or', 'ecx, eax'),
           (0x5f293d, 'mov', 'dword ptr [esi + 0x40], ecx'),
           (0x5b2b5e, 'call', 'dword ptr [eax + 0x190]'),
           (0x5b2f47, 'call', 'dword ptr [eax + 0x16c]'),
           (0x5b2b85, 'mov', 'esi, dword ptr [ecx + eax*4 + 0x88]'),
           (0x5b2b94, 'call', 'dword ptr [edx + 0x54]')]


def audit():
    raw = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('World identity audit requires pinned executable')
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, decoded = [], {}
    for label, start, end in RANGES:
        values = [dict(address=i.address, mnemonic=i.mnemonic, operands=i.op_str, bytes=i.bytes.hex())
                  for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(v['bytes'])) for v in values) != end-start or values[-1]['mnemonic'] != 'ret':
            raise ValueError('Incomplete original world identity method: ' + label)
        decoded.update({v['address']: v for v in values})
        ranges.append(dict(label=label, start=start, end=end, instructions=values))
    for at, mnemonic, operands in ANCHORS:
        if (decoded[at]['mnemonic'], decoded[at]['operands']) != (mnemonic, operands):
            raise ValueError(f'Unexpected identity anchor {at:08x}')
    slots = [(0x682950, 0x48, 0x5bad20), (0x68098c, 0, 0x433600),
             (0x68b6f0, 0, 0x596570), (0x68b6f0, 0xc, 0x5f2920),
             (0x68098c, 0x194, 0x5b2b50), (0x68098c, 0x190, 0x5b2f40),
             (0x68098c, 0x16c, 0x5b2b80)]
    for table, slot, target in slots:
        if struct.unpack('<I', pe.get_data(table+slot-base, 4))[0] != target:
            raise ValueError('Unexpected original identity/destruction vtable')
    return dict(qualified=True, executableSha256=PIN, verifiedInstructionAnchors=len(ANCHORS),
                ranges=ranges, slots=[dict(table=t, slot=s, target=f) for t,s,f in slots],
                factoryRemovalErasesRegistryBeforeDestructor=True, nativeIdGeneratorCounterOffset=0x28,
                nativeIdentityOffset=0x60, nativeWorldOffset=0x84, agentNativeIdOffset=0x20,
                ordersRegistryTable=0x68b6f0, ordersRegistryKind=0x5244524f,
                originalOrdersRegistrySetsUnitBit=dict(offset=0x40, mask=1,
                    condition='at least one nonempty original command bank'),
                browserUsed=False, nativeProcessesStarted=0,
                scope='Original identity and retirement boundaries only; runtime publication, lookup and cleanup unqualified')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = audit()
    with args.output.open('x') as file:
        json.dump(result, file, indent=2)
        file.write('\n')
    print(json.dumps(dict(qualified=True, anchors=result['verifiedInstructionAnchors'])))
