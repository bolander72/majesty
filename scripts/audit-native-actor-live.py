#!/usr/bin/env python3
"""Pin live actor scheduling, context timing, activation and parent removal."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import capstone
import pefile

ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def dependency(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
def audit(executable):
    data=executable.read_bytes()
    if hashlib.sha256(data).hexdigest()!=PIN:
        raise ValueError('Live actor audit requires the pinned DirectDraw executable')
    prior=dependency('audit-native-actor-postload').audit(executable)
    pe=pefile.PE(data=data);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    slots=[]
    for table,slot,target in [(0x68098c,0x1b8,0x5a2420),
                              (0x68098c,0x1c0,0x5b21c0)]:
        actual,=struct.unpack('<I',pe.get_data(table+slot-base,4))
        if actual!=target:raise ValueError('Unexpected original post-load dispatch')
        slots.append(dict(table=f'{table:08x}',slot=slot,target=f'{target:08x}'))
    ranges=[];decoded={}
    for label,start,end in [
        ('original-factory-second-finalization',0x5bbbb0,0x5bbbfc),
        ('vehicle-second-finalization-dispatch',0x5a2420,0x5a242d),
        ('vehicle-animation-controller-activation',0x5b21c0,0x5b22c8),
        ('original-script-manager-update',0x633430,0x6336a9),
        ('original-script-agent-update',0x626cf0,0x626daf),
        ('original-script-context-resume',0x626e30,0x626ea7),
        ('original-runtime-context-resume-clock',0x6237b0,0x623826),
        ('original-context-update-and-delay',0x639220,0x6392eb),
        ('physical-parent-detachment',0x5a2280,0x5a22af),
        ('parent-container-pointer-removal',0x598f80,0x598fe4),
        ('original-gameplay-tick-clock',0x417730,0x417be9),
        ('rendering-bank-node-unit-and-model-fields',0x5f1360,0x5f1520),
    ]:
        raw=pe.get_data(start-base,end-start)
        rows=[dict(address=f'{i.address:08x}',bytes=i.bytes.hex(),mnemonic=i.mnemonic,operands=i.op_str)
              for i in decoder.disasm(raw,start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in rows)!=len(raw) or rows[-1]['mnemonic']!='ret':
            raise ValueError('Incomplete original live actor method: '+label)
        ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=rows))
        decoded.update({row['address']:row for row in rows})
    checks=[('second-finalization-dispatch','005bbbdc','call','dword ptr [edx + 0x1b8]'),
            ('animation-dispatch','005a2424','call','dword ptr [eax + 0x1c0]'),
            ('manager-agent-step','00633543','call','0x626cf0'),
            ('agent-current-owner','00626d05','mov','dword ptr [0x720304], edi'),
            ('agent-context-step','00626d4d','call','0x639220'),
            ('resume-paused-context','00626e9c','and','cl, 0x7f'),
            ('resume-clear-remainder','00626e8f','mov','dword ptr [eax + 0xc], 0'),
            ('resume-clock-adjustment','00626e96','mov','dword ptr [eax + 4], ecx'),
            ('runtime-resume-clock','006237e2','mov','eax, dword ptr [0x71c6a8]'),
            ('runtime-resume-dispatch','006237fd','call','0x626e30'),
            ('render-node-unit-field','005f1506','mov','dword ptr [eax + 0x10], ecx'),
            ('context-stamp-read','0063926c','mov','edx, dword ptr [esi + 0x38]'),
            ('context-delay-read','00639273','mov','edx, dword ptr [esi + 0x34]'),
            ('context-dispatch','006392cb','call','0x6381b0'),
            ('context-stamp-update','006392d0','mov','dword ptr [esi + 0x38], edi'),
            ('context-running-clear','006392d3','mov','byte ptr [esi + 0x44], bl'),
            ('parent-unit-lookup','005a2291','call','0x5a10d0'),
            ('parent-pointer-removal','005a22a8','call','0x598f80'),
            ('container-entry-removal','00598fcd','call','0x598030'),
            ('game-tick-increment','00417923','inc','eax'),
            ('game-tick-store','00417924','mov','dword ptr [edi + 0x28], eax')]
    for label,address,mnemonic,operands in checks:
        if (decoded[address]['mnemonic'],decoded[address]['operands'])!=(mnemonic,operands):
            raise ValueError('Unexpected original live actor instruction: '+label)
    return dict(executableSha256=PIN,slots=slots,ranges=ranges,
                postloadInstructions=sum(len(row['instructions']) for row in prior['ranges']),
                pairInstructions=prior['pairInstructions'],
                savedStateInstructions=prior['savedStateInstructions'],typedValueInstructions=prior['typedValueInstructions'],
                checkedInstructions=[dict(label=label,**decoded[address]) for label,address,_,_ in checks],
                limitations='Pinned scheduling and activation methods only; runtime must separately prove '
                'the restored actor actually executes and cleans up. Same-world borrowed parent and '
                'external references, not destination-world rebinding or hero travel. No total-browser '
                'memory bound or independent internet match.')
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe',type=Path,default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output',type=Path,default=ROOT/'output/native-actor-live-audit.json')
    args=parser.parse_args();result=audit(args.exe)
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print('Pinned live actor operations verified;',sum(len(row['instructions']) for row in result['ranges']),'instructions')
if __name__=='__main__':main()
