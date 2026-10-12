#!/usr/bin/env python3
"""Pin container import, reciprocal insertion/removal and their exact argument contracts."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import capstone
import pefile

ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'

def audit(executable):
    data=executable.read_bytes()
    if hashlib.sha256(data).hexdigest()!=PIN:
        raise ValueError('Actor import audit requires the pinned DirectDraw executable')
    spec=importlib.util.spec_from_file_location('arrival',ROOT/'scripts/audit-native-actor-arrival.py')
    prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior)
    preparation=prior.audit(executable)
    pe=pefile.PE(data=data);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    ranges=[];decoded={}
    for label,start,end in [
        ('original-container-state-read',0x599460,0x5995bb),
        ('original-container-state-write',0x5995c0,0x599729),
        ('original-container-read-caller',0x5bfb30,0x5bfb59),
        ('original-container-write-caller',0x5bfc40,0x5bfcc7),
        ('original-container-member-insert',0x598e20,0x598e9a),
        ('original-container-group-insert',0x5983d0,0x5985a2),
        ('original-container-member-remove-by-kind',0x598ff0,0x599046),
        ('original-container-member-remove',0x598030,0x598164),
        ('original-container-reciprocal-remove',0x598170,0x59819e),
        ('original-unit-container-clear',0x5a22b0,0x5a22bb),
        ('original-container-clear',0x598bc0,0x598c62),
        ('original-container-group-storage-clear',0x598b00,0x598b29),
        ('original-container-vector-storage-clear',0x598c70,0x598c92),
    ]:
        raw=pe.get_data(start-base,end-start)
        rows=[dict(address=f'{i.address:08x}',bytes=i.bytes.hex(),mnemonic=i.mnemonic,operands=i.op_str)
              for i in decoder.disasm(raw,start)]
        if sum(len(bytes.fromhex(r['bytes'])) for r in rows)!=len(raw) or rows[-1]['mnemonic'] != ('jmp' if label == 'original-unit-container-clear' else 'ret'):
            raise ValueError('Incomplete original import method: '+label)
        ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=rows))
        decoded.update({r['address']:r for r in rows})
    checks=[
        ('read-factory-argument','005bfb4c','push','eax'),
        ('read-stream-argument','005bfb4b','push','edx'),
        ('read-native-container-field','005bfb4d','add','ecx, 0x94'),
        ('read-two-argument-return','005995b8','ret','8'),
        ('write-stream-argument','005bfc9a','push','esi'),
        ('write-factory-argument','005bfca1','push','ecx'),
        ('write-native-container-field','005bfca2','lea','ecx, [eax + 0x94]'),
        ('write-two-argument-return','00599726','ret','8'),
        ('read-owner-resolve','00599552','call','0x5a10d0'),
        ('read-member-resolve','0059956c','call','0x5a10d0'),
        ('write-owner-restore','005996c2','call','0x5a10d0'),
        ('write-member-restore','005996dc','call','0x5a10d0'),
        ('insert-three-argument-return','00598e90','ret','0xc'),
        ('insert-group-dispatch','00598e86','call','0x5983d0'),
        ('physical-pre-insert-detach','0059840a','call','0x5a2280'),
        ('logical-parent-kind','0059844c','push','0x65'),
        ('physical-parent-bind','00598572','mov','dword ptr [edi + 0x74], edx'),
        ('remove-kind-group-dispatch','0059903d','call','0x598030'),
        ('remove-logical-reciprocal','00598106','call','0x598170'),
        ('remove-physical-parent-clear','0059814c','mov','dword ptr [ebx + 0x74], eax'),
        ('clear-native-container-field','005a22b0','add','ecx, 0x94'),
        ('clear-native-container-dispatch','005a22b6','jmp','0x598bc0'),
        ('clear-reciprocal-members','00598be9','call','0x598030'),
        ('clear-group-storage','00598c00','call','0x598b00'),
        ('free-group','00598c06','call','0x645bc0'),
        ('clear-group-vector','00598c4a','call','0x598c70'),
        ('free-container','00598c50','call','0x645bc0'),
        ('reset-container-pointer','00598c58','mov','dword ptr [ebx], 0'),
        ('free-member-vector','00598b13','call','0x645bc0'),
        ('free-group-vector','00598c7c','call','0x645bc0'),
    ]
    for label,address,mnemonic,operands in checks:
        if (decoded[address]['mnemonic'],decoded[address]['operands'])!=(mnemonic,operands):
            raise ValueError('Unexpected original import instruction: '+label)
    return dict(executableSha256=PIN,ranges=ranges,
                checkedInstructions=[dict(label=label,**decoded[address]) for label,address,_,_ in checks],
                preparationAdditionalInstructions=sum(len(r['instructions']) for r in preparation['ranges']),
                argumentContract={'stateRead':'this=UNIT+94; args=(factory,stream); RET 8',
                                  'stateWrite':'this=UNIT+94; args=(factory,stream); RET 8',
                                  'memberInsert':'this=owner+94; args=(member,owner,kind); RET 12',
                                  'containerClear':'this=UNIT; no args; original +94 wrapper tail-calls full clear'},
                limitations='Pinned native container import contract only. Requires a separate live engine '
                'trial with original readers, script execution and cleanup; not atomic source removal, '
                'hero travel, terrain streaming, full-browser memory or multiplayer qualification.')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe',type=Path,default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output',type=Path,default=ROOT/'output/native-actor-import-audit.json')
    args=parser.parse_args();result=audit(args.exe)
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print('Pinned native actor import verified;',sum(len(r['instructions']) for r in result['ranges']),'instructions')
if __name__=='__main__':main()
