#!/usr/bin/env python3
"""Pin the original cached native-link setter used only on an owned private script."""
import argparse
import hashlib
import json
from pathlib import Path
import capstone
import pefile
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit():
    exe = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    raw = exe.read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Private script composition requires pinned executable')
    spec = spec_from_file_location('composed_pair_audit', ROOT / 'scripts/audit-native-actor-pair.py')
    pair = module_from_spec(spec)
    spec.loader.exec_module(pair)
    prior = pair.audit(exe)
    pe = pefile.PE(data=raw)
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    rows = [dict(address=i.address, mnemonic=i.mnemonic, operands=i.op_str, bytes=i.bytes.hex())
            for i in decoder.disasm(pe.get_data(0x626340 - pe.OPTIONAL_HEADER.ImageBase, 10), 0x626340)]
    expected = [(0x626340, 'mov', 'eax, dword ptr [esp + 4]'),
                (0x626344, 'mov', 'dword ptr [ecx + 0x24], eax'), (0x626347, 'ret', '4')]
    if [(r['address'], r['mnemonic'], r['operands']) for r in rows] != expected:
        raise ValueError('Unexpected original cached backlink setter')
    return dict(qualified=True, executableSha256=PIN, setterInstructions=rows,
                verifiedSetterInstructionAnchors=3, originalPairInstructionAnchors=len(prior['checkedInstructions']),
                cachedSetterWritesOnlyAgentHeaderOffset=0x24, originalSetterStackCleanupBytes=4,
                nativeUnitIdentityRemainsZero=True, naturalNativeRegistryResolutionQualified=False,
                privateAssociationOnly=True, browserUsed=False, nativeProcessesStarted=0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = audit()
    with args.output.open('x') as file:
        json.dump(result, file, indent=2)
        file.write('\n')
    print(json.dumps(dict(qualified=True, setterAnchors=3)))
