#!/usr/bin/env python3
"""Verify typed GPL saved payloads against the pinned readers and writers."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
TABLES = [(0,0x67f540,0x624690,0x6246a0),(1,0x68c4fc,0x644770,0x644780),
          (2,0x68c478,0x643f10,0x643f20),(3,0x67f8ac,0x62a430,0x62a440),
          (4,0x68c2e0,0x639fd0,0x63a080),(5,0x68c054,0x625d10,0x625d60),
          (6,0x68c3f4,0x6437d0,0x6437e0),(7,0x68c23c,0x635c20,0x635c50),
          (8,0x68bfa8,0x6394c0,0x6395c0)]


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('The script-value audit requires the pinned DirectDraw executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    tables = []
    for type_id, table, writer, reader in TABLES:
        actual = struct.unpack('<2I', pe.get_data(table-base+32,8))
        if actual != (writer,reader):
            raise ValueError(f'Unexpected typed value dispatch: {type_id}')
        tables.append(dict(type=type_id, table=f'{table:08x}',writer=f'{writer:08x}',reader=f'{reader:08x}'))
    constructors = []
    for type_id, address, register in [(1,0x6440b8,'eax'),(2,0x643998,'eax'),
                                      (3,0x629e9c,'esi'),(4,0x639807,'esi'),
                                      (5,0x6254a8,'eax'),(6,0x6434e8,'eax'),
                                      (7,0x6358da,'eax'),(8,0x638cbd,'esi')]:
        decoded_type = list(decoder.disasm(pe.get_data(address-base,7),address))
        if len(decoded_type) != 1 or decoded_type[0].size != 7 or decoded_type[0].mnemonic != 'mov' or decoded_type[0].op_str != f'dword ptr [{register} + 4], {type_id}':
            raise ValueError(f'Unexpected constructor type identifier: {type_id}')
        constructors.append(dict(type=type_id,address=f'{address:08x}',bytes=decoded_type[0].bytes.hex()))
    records, decoded = [], {}
    for label,start,end in [
        ('null-write',0x624690,0x624696),('null-read',0x6246a0,0x6246a6),
        ('integer-write',0x644770,0x644780),('integer-read',0x644780,0x6447a7),
        ('float-write',0x643f10,0x643f20),('float-read',0x643f20,0x643f47),
        ('string-write',0x62a430,0x62a440),('string-read',0x62a440,0x62a450),
        ('list-write',0x639fd0,0x63a075),('list-read',0x63a080,0x63a18d),
        ('agent-reference-write',0x625d10,0x625d5b),('agent-reference-read',0x625d60,0x625db0),
        ('boolean-write',0x6437d0,0x6437e0),('boolean-read',0x6437e0,0x6437f0),
        ('pair-write',0x635c20,0x635c43),('pair-read',0x635c50,0x635c73),
        ('function-context-write',0x6394c0,0x6395b6),('function-context-read',0x6395c0,0x6396b1),
        ('function-arguments-write',0x636df0,0x636ea2),('function-arguments-read',0x636eb0,0x636fec),
        ('function-state-write',0x644940,0x64497f),('function-state-read',0x644980,0x6449cd),
        ('attribute-value-write',0x626900,0x626984),('attribute-value-read',0x626c10,0x626c51),
    ]:
        raw = pe.get_data(start-base,end-start)
        instructions = [dict(address=f'{i.address:08x}',bytes=i.bytes.hex(),mnemonic=i.mnemonic,operands=i.op_str)
                        for i in decoder.disasm(raw,start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in instructions) != len(raw) or instructions[-1]['mnemonic'] != 'ret':
            raise ValueError(f'Incomplete typed value method: {label}')
        records.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=instructions))
        decoded.update({i['address']:i for i in instructions})
    checks = [
        ('integer-payload','00644778','call','0x4eed10'),
        ('float-payload','00643f18','call','0x4eecc0'),
        ('string-payload','0062a438','call','0x4e6730'),
        ('agent-id-payload','00625d10','push','esi'),
        ('boolean-payload','006437d8','call','0x4eef00'),
        ('context-arguments','006394e4','call','0x636df0'),
        ('context-state','006394ed','call','0x644940'),
        ('context-first-flag','006394f8','call','0x4eef00'),
        ('context-state-float-one','0064494d','call','0x4eecc0'),
        ('context-state-float-two','00644958','call','0x4eecc0'),
        ('context-state-word-one','00644963','call','0x4eed10'),
        ('context-state-word-two','0064496e','call','0x4eed10'),
        ('read-typed-value','00626c4a','call','dword ptr [edx + 0x24]'),
    ]
    for label,address,mnemonic,operands in checks:
        actual = decoded[address]
        if (actual['mnemonic'],actual['operands']) != (mnemonic,operands):
            raise ValueError(f'Unexpected typed value instruction: {label}')
    return dict(executableSha256=PIN,tables=tables,constructorTypeAssignments=constructors,ranges=records,
                checkedInstructions=[dict(label=label,**decoded[address]) for label,address,_,_ in checks],
                limitations='Typed record ranges/reference plans only. Ordinary integer semantics and '
                'context state words remain opaque. No engine registration, timers, native actor activation or region transfer.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe',type=Path,default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output',type=Path,default=ROOT/'output/native-script-values-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print('Pinned typed GPL payloads verified;',sum(len(r['instructions']) for r in result['ranges']),'instructions')


if __name__ == '__main__':
    main()
