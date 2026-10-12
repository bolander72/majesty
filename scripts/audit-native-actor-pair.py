#!/usr/bin/env python3
"""Pin the original script ID-tree insertion/erasure used by the pair fixture."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import capstone
import pefile

ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def dependency(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

def audit(executable):
    data=executable.read_bytes()
    if hashlib.sha256(data).hexdigest()!=PIN:
        raise ValueError('Actor-pair audit requires the pinned DirectDraw executable')
    state=dependency('audit-native-agent-state').audit(executable)
    values=dependency('audit-native-script-values').audit(executable)
    pe=pefile.PE(data=data);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    ranges=[];decoded={}
    for label,start,end in [
        ('id-tree-insert',0x634460,0x63469e),('id-tree-erase',0x6346a0,0x634a6f),
        ('id-tree-find',0x634ae0,0x634b48),('id-tree-create-entry',0x635160,0x6353c5),
        ('id-tree-rotate-left',0x6353d0,0x635422),('id-tree-rotate-right',0x635430,0x635486),
        ('id-tree-node-allocate',0x6357a0,0x6357bb),('id-tree-pair-copy',0x635820,0x635837),
        ('agent-native-backlink',0x626310,0x62633c),
    ]:
        raw=pe.get_data(start-base,end-start)
        rows=[dict(address=f'{i.address:08x}',bytes=i.bytes.hex(),mnemonic=i.mnemonic,operands=i.op_str)
              for i in decoder.disasm(raw,start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in rows)!=len(raw) or rows[-1]['mnemonic']!='ret':
            raise ValueError('Incomplete pinned pair method: '+label)
        ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=rows))
        decoded.update({row['address']:row for row in rows})
    checks=[('insert-copy','006344c8','call','0x635820'),
            ('insert-count','006344d9','mov','dword ptr [edi + 0xc], ecx'),
            ('erase-node-free','00634a4e','call','0x645bc0'),
            ('erase-count','00634a5e','mov','dword ptr [ebp + 0xc], eax'),
            ('copy-key','0063582e','mov','dword ptr [eax], edx'),
            ('copy-agent-pointer','00635833','mov','dword ptr [eax + 4], ecx'),
            ('backlink-registry','0062632f','call','0x5a10d0')]
    for label,address,mnemonic,operands in checks:
        if (decoded[address]['mnemonic'],decoded[address]['operands'])!=(mnemonic,operands):
            raise ValueError('Unexpected pair instruction: '+label)
    return dict(executableSha256=PIN,ranges=ranges,
                savedStateInstructions=sum(len(row['instructions']) for row in state['ranges']),
                typedValueInstructions=sum(len(row['instructions']) for row in values['ranges']),
                checkedInstructions=[dict(label=label,**decoded[address]) for label,address,_,_ in checks],
                limitations='ID-tree-only insertion/erasure of an unactivated paired clone. '
                'No name-index insertion, gameplay death callback, active/deferred queues, '
                'timers, family post-load, regional terrain or hero crossing.')
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe',type=Path,default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output',type=Path,default=ROOT/'output/native-actor-pair-audit.json')
    args=parser.parse_args();result=audit(args.exe)
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print('Pinned paired actor ID tree verified;',sum(len(row['instructions']) for row in result['ranges']),'instructions')
if __name__=='__main__':main()
