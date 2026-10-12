#!/usr/bin/env python3
"""Verify the pinned complete single-vertex writer's arguments, store and RET."""
import argparse
import hashlib
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'

def audit():
    raw = (ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Boundary writer requires the pinned executable')
    pe = pefile.PE(data=raw)
    start, end = 0x00428d70, 0x00428d91
    data = pe.get_data(start-pe.OPTIONAL_HEADER.ImageBase,end-start)
    instructions = list(capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32).disasm(data,start))
    expected = [
        ('mov','edx, dword ptr [esp + 4]'),('mov','eax, dword ptr [ecx + 0x38]'),
        ('mov','ecx, dword ptr [ecx + 0x4c]'),('push','esi'),
        ('imul','eax, dword ptr [edx + 4]'),('mov','esi, dword ptr [edx]'),
        ('mov','edx, dword ptr [esp + 0xc]'),('add','eax, esi'),('pop','esi'),
        ('lea','eax, [eax + eax*2]'),('mov','dword ptr [ecx + eax*8], edx'),('ret','8')]
    if sum(i.size for i in instructions) != len(data) or [(i.mnemonic,i.op_str) for i in instructions] != expected:
        raise ValueError('Complete original boundary writer differs')
    return dict(version=1,qualified=True,executableSha256=PIN,entry='00428d70',argumentBytes=8,
        vertexBytes=24,pointArgument=1,heightArgument=2,returnedEax='3 * (stride * y + x)',
        instructions=[dict(address=f'{i.address:08x}',bytes=i.bytes.hex(),mnemonic=i.mnemonic,operands=i.op_str) for i in instructions],
        scope='Complete original single-vertex writer only. Other terrain writers and navigation are not qualified.',
        browserUsed=False,nativeProcessesStarted=0)

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    report=audit()
    with args.output.open('x') as f: json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps(dict(qualified=True,instructions=len(report['instructions']),nativeProcessesStarted=0)))
