#!/usr/bin/env python3
"""Pin native family finalization and script queue insertion/unlink operations."""
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
        raise ValueError('Actor post-load audit requires the pinned DirectDraw executable')
    pair=dependency('audit-native-actor-pair').audit(executable)
    pe=pefile.PE(data=data);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    slots=[]
    for table,slot,target in [(0x68098c,0x1b4,0x5a2370),(0x68098c,0x40,0x5a1960),
                              (0x68098c,0x48,0x5a1a00),(0x68098c,0x3c,0x5a1920),
                              (0x68098c,0xc4,0x5b36c0),(0x68b4d4,4,0x5b54d0),
                              (0x68098c,0xb8,0x5b3550),(0x68098c,0x1e0,0x5a21a0),
                              (0x68b4d4,0x30,0x5b57a0),(0x68b4d4,0x18,0x5efef0),
                              (0x68b4d4,0x20,0x5efee0),(0x68b4d4,0x90,0x5ef470),
                              (0x68b46c,0x38,0x5eef50),(0x68b608,8,0x5f1830),
                              (0x68b608,0x18,0x5f17e0),(0x68a640,8,0x5c33d0)]:
        actual,=struct.unpack('<I',pe.get_data(table+slot-base,4))
        if actual!=target:raise ValueError('Unexpected original post-load dispatch')
        slots.append(dict(table=f'{table:08x}',slot=slot,target=f'{target:08x}'))
    ranges=[];decoded={}
    for label,start,end in [
        ('native-family-postload',0x5a2370,0x5a241b),
        ('description-parent-by-index',0x5a1960,0x5a19aa),
        ('description-parent-by-key',0x5a1920,0x5a195e),
        ('description-parent-binding',0x5a1a00,0x5a1a26),
        ('native-helper-finalization',0x5b54d0,0x5b5711),
        ('native-rendering-finalization',0x5ad540,0x5ad5aa),
        ('vehicle-rendering-notification',0x5b36c0,0x5b37bb),
        ('vehicle-helper-rendering-notification',0x5ef6b0,0x5ef820),
        ('original-gameplay-removal-order',0x5a21b0,0x5a224a),
        ('vehicle-rendering-removal-notification',0x5b3550,0x5b3565),
        ('rendering-removal-notification-broadcast',0x5c33d0,0x5c3421),
        ('vehicle-helper-reset-dispatch',0x5a21a0,0x5a21ad),
        ('native-helper-reset',0x5b57a0,0x5b5801),
        ('vehicle-helper-has-models',0x5efef0,0x5eff07),
        ('vehicle-helper-model-by-index',0x5efee0,0x5efeef),
        ('vehicle-helper-model-array-clear',0x5ef470,0x5ef48c),
        ('vehicle-model-constructor',0x5eeec0,0x5eeee6),
        ('vehicle-model-rendering-unlink',0x5eef50,0x5eef92),
        ('rendering-bank-node-insert',0x5f1360,0x5f1520),
        ('rendering-bank-unit-update',0x5f17e0,0x5f1822),
        ('rendering-bank-model-unlink',0x5f1830,0x5f187f),
        ('script-queue-append',0x633fd0,0x634027),
        ('script-queue-unlink',0x6332c0,0x633362),
        ('script-agent-create-and-queue',0x632e60,0x633014),
    ]:
        raw=pe.get_data(start-base,end-start)
        rows=[dict(address=f'{i.address:08x}',bytes=i.bytes.hex(),mnemonic=i.mnemonic,operands=i.op_str)
              for i in decoder.disasm(raw,start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in rows)!=len(raw) or rows[-1]['mnemonic']!='ret':
            raise ValueError('Incomplete original post-load method: '+label)
        ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=rows))
        decoded.update({row['address']:row for row in rows})
    checks=[('resolve-description','005a2393','call','0x426600'),
            ('bind-description','005a23ba','mov','dword ptr [esi + 0x80], eax'),
            ('finalize-helper','005a23fb','call','dword ptr [eax + 4]'),
            ('finalize-rendering','005a2404','call','0x5ad540'),
            ('queue-payload','00634010','mov','dword ptr [ecx], edx'),
            ('queue-count','00634018','mov','dword ptr [ebx + 8], ecx'),
            ('unlink-inactive-agent-guard','006332d0','cmp','eax, -6'),
            ('unlink-first-list','006332d9','lea','edi, [esi + 0x10]'),
            ('normal-render-notify-before-delete','005a21fa','call','dword ptr [eax + 0xb8]'),
            ('normal-helper-reset-before-delete','005a2236','call','dword ptr [eax + 0x1e0]'),
            ('helper-reset-model-dispatch','005b57d8','call','dword ptr [edx + 0x38]'),
            ('model-unlink-bank-dispatch','005eef85','call','dword ptr [edx + 8]'),
            ('bank-node-unit-field','005f1509','mov','dword ptr [eax + 0xc], ebx'),
            ('bank-node-model-index','005f1506','mov','dword ptr [eax + 0x10], ecx'),
            ('bank-unlink-count','005f1868','mov','dword ptr [ecx + 0x38], edi'),
            ('bank-unlink-clear-model-node','005f1873','mov','dword ptr [esi + 0x3c], 0')]
    for label,address,mnemonic,operands in checks:
        if (decoded[address]['mnemonic'],decoded[address]['operands'])!=(mnemonic,operands):
            raise ValueError('Unexpected original post-load instruction: '+label)
    return dict(executableSha256=PIN,slots=slots,ranges=ranges,
                pairInstructions=sum(len(row['instructions']) for row in pair['ranges']),
                savedStateInstructions=pair['savedStateInstructions'],typedValueInstructions=pair['typedValueInstructions'],
                checkedInstructions=[dict(label=label,**decoded[address]) for label,address,_,_ in checks],
                limitations='Native family finalization and synchronous script queue staging only. '
                'No scheduled clone executes across a frame, no script continuation, timers or '
                'destination-world reference binding, orders/containers/inventory migration or regional travel.')
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe',type=Path,default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output',type=Path,default=ROOT/'output/native-actor-postload-audit.json')
    args=parser.parse_args();result=audit(args.exe)
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print('Pinned actor finalization/queue operations verified;',sum(len(row['instructions']) for row in result['ranges']),'instructions')
if __name__=='__main__':main()
