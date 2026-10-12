#!/usr/bin/env python3
"""Verify the pinned camera scroll input, origin and clamp layout without a game."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
ANCHORS = [
    (0x00437e44, 'mov', 'ecx, dword ptr [ecx + 0xc]'),
    (0x00437e48, 'call', '0x5c3490'),
    (0x00437e51, 'mov', 'eax, dword ptr [eax + 0x50]'),
    (0x004392a0, 'cmp', 'dword ptr [ecx + 4], 1'),
    (0x004392a6, 'mov', 'eax, dword ptr [ecx + 8]'),
    (0x004392b1, 'mov', 'dword ptr [eax + 0x54], ecx'),
    (0x004392b4, 'mov', 'dword ptr [eax + 0x58], edx'),
    (0x005c2988, 'mov', 'dword ptr [ecx + 0x34], eax'),
    (0x005c298d, 'mov', 'dword ptr [ecx + 0x38], edx'),
    (0x005c40b5, 'mov', 'dword ptr [esi], 0x68a784'),
    (0x0043a4ce, 'call', '0x5c4040'),
    (0x0043a4d3, 'mov', 'dword ptr [esi], 0x680e14'),
    (0x0043a924, 'call', '0x5c2980'),
    (0x00438043, 'mov', 'edx, dword ptr [esp + 0xc]'),
    (0x00438054, 'mov', 'ecx, dword ptr [esp + 8]'),
    (0x00438058, 'mov', 'edx, dword ptr [esp + 4]'),
    (0x00438061, 'call', '0x4392a0'),
    (0x005c4fa4, 'mov', 'dword ptr [esi + 0x54], eax'),
    (0x005c4fa7, 'mov', 'dword ptr [esi + 0x58], eax'),
    (0x00415dd0, 'mov', 'al, byte ptr [0x6d766c]'),
    (0x00415dda, 'jne', '0x415e39'),
    (0x004f6438, 'call', 'dword ptr [0x67f2d0]'),
    (0x004f6476, 'call', 'dword ptr [0x67f2cc]'),
    (0x005c4eec, 'mov', 'ebp, dword ptr [esi + 0x30]'),
    (0x005c4eef, 'mov', 'eax, dword ptr [esi + 0x28]'),
    (0x005c4ef2, 'mov', 'ecx, dword ptr [esi + 0x2c]'),
    (0x005c4ef5, 'mov', 'edx, dword ptr [esi + 0x24]'),
    (0x005c4f04, 'mov', 'eax, dword ptr [esi + 0xe4]'),
    (0x005c4f11, 'sub', 'eax, ebp'),
    (0x005c4f1d, 'mov', 'eax, dword ptr [esi + 0xe0]'),
    (0x005c4f2a, 'sub', 'eax, ecx'),
    (0x005c4f2e, 'mov', 'edx, dword ptr [esi + 0x34]'),
    (0x005c4f35, 'cmp', 'dword ptr [esi + 0x38], edi'),
    # Original GSGL writer: view zero's origin supplies its first two DWORDs.
    (0x00436210, 'mov', 'esi, ecx'),
    (0x00436212, 'xor', 'ebx, ebx'),
    (0x00436275, 'push', 'ebx'),
    (0x0043627a, 'call', '0x437e40'),
    (0x00436291, 'mov', 'ecx, dword ptr [eax + 8]'),
    (0x00436294, 'mov', 'edx, dword ptr [ecx + 0x34]'),
    (0x00436297, 'mov', 'ecx, dword ptr [ecx + 0x38]'),
    (0x0043629a, 'mov', 'dword ptr [esi], edx'),
    (0x0043629c, 'mov', 'dword ptr [esi + 4], ecx'),
    (0x0043632c, 'mov', 'ecx, dword ptr [esi]'),
    (0x00436333, 'push', 'ecx'),
    (0x00436339, 'call', '0x4eed10'),
    (0x0043633e, 'mov', 'edx, dword ptr [esi + 4]'),
    (0x00436343, 'push', 'edx'),
    (0x00436344, 'call', '0x4eed10'),
]


def audit(path):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Camera audit requires the pinned executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    for address, mnemonic, operands in ANCHORS:
        instruction = next(decoder.disasm(pe.get_data(address-base, 16), address))
        if (instruction.mnemonic, instruction.op_str) != (mnemonic, operands):
            raise ValueError(f'Camera anchor changed at {address:08x}')
    slots = [(0x0068a784, 0x54, 0x005c2bc0), (0x0068a784, 0x6c, 0x005c2980),
             (0x00680e14, 0x54, 0x005c2bc0), (0x00680e14, 0x6c, 0x0043a910),
             (0x00680e14, 0xb8, 0x005c67d0)]
    for vtable, offset, target in slots:
        if struct.unpack('<I', pe.get_data(vtable+offset-base, 4))[0] != target:
            raise ValueError('Camera vtable changed')
    return dict(executableSha256=PIN, instructionAnchors=len(ANCHORS), vtableSlots=len(slots),
                viewGetter='00437e40', cameraVtable='0068a784', originOffsets=[0x34, 0x38],
                gameplayCameraVtable='00680e14', gameplayOriginSetter='0043a910',
                originalGlobalWriter='00436200', globalCameraPayloadOffsets=[0,4],
                globalCameraViewIndex=0, originalDwordWriter='004eed10',
                originalScrollGateway='00438040', scrollGatewayStackOffsets=[4,8,12],
                scrollInputOffsets=[0x54, 0x58], worldExtentOffsets=[0xe0, 0xe4],
                viewportLTRBOffsets=[0x24, 0x28, 0x2c, 0x30],
                browserUsed=False, gameProcessesStarted=0, spatialTravelQualified=False,
                scope='Pinned original camera input/origin/clamp layout only; no live movement or activation.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    result = audit(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    with args.output.open('x') as file:
        file.write(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=result['instructionAnchors'], vtableSlots=result['vtableSlots'])))
