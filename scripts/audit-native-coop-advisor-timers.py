#!/usr/bin/env python3
"""Pin original local advisor ticking and its saved notification clock."""
import argparse
import hashlib
import json
import struct
from pathlib import Path
import capstone
import pefile
ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'

def audit():
    raw = (ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == PIN
    pe = pefile.PE(data=raw); md = capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    decoded = {}; ranges = []
    for label,start,end in [
        ('original-tick-local-advisors',0x417730,0x417be9),
        ('local-player-getter',0x416980,0x416994),
        ('player-constructor',0x42d0f0,0x42d35b),
        ('player-writer',0x42cde0,0x42cea1),
        ('advisor-writer',0x42d8a0,0x42d8e9),
        ('advisor-reader',0x42d8f0,0x42d94d),
        ('elves-notification',0x492080,0x4921b9),
        ('dwarves-notification',0x4921c0,0x4922f9),
    ]:
        code = list(md.disasm(pe.get_data(start-0x400000,end-start),start))
        assert code[-1].mnemonic == 'ret' and code[-1].address+code[-1].size == end
        rows = [dict(address=f'{i.address:08x}',mnemonic=i.mnemonic,operands=i.op_str,bytes=i.bytes.hex())for i in code]
        decoded.update({r['address']:r for r in rows});ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=rows))
    anchors = [
        ('00417958','call','0x416980'),
        ('00417977','lea','ecx, [esi + 0x8c]'),
        ('0041797d','call','dword ptr [eax + 4]'),
        ('00417986','lea','ecx, [esi + 0xac]'),
        ('0041798c','call','dword ptr [edx + 4]'),
        ('0042ce60','lea','ecx, [edi + 0x8c]'),
        ('0042ce67','call','dword ptr [edx + 8]'),
        ('0042ce70','lea','ecx, [edi + 0xac]'),
        ('0042ce77','call','dword ptr [eax + 8]'),
        ('0042d8c7','mov','edx, dword ptr [edi + 0x10]'),
        ('0042d8cd','call','0x4eed10'),
        ('0042d92a','lea','eax, [edi + 0x10]'),
        ('0042d930','call','0x4ef790'),
        ('004920b4','mov','dword ptr [ebx + 0x10], eax'),
        ('004921f4','mov','dword ptr [ebx + 0x10], eax'),
        ('00492183','push','0x35535647'),
        ('0049218a','push','0x32304152'),
        ('004922c3','push','0x35535647'),
        ('004922ca','push','0x33304152'),
    ]
    for at,mnemonic,operands in anchors:
        assert (decoded[at]['mnemonic'],decoded[at]['operands']) == (mnemonic,operands),at
    tables = []
    for address,update in [(0x680120,0x492080),(0x68010c,0x4921c0)]:
        words = struct.unpack('<4I',pe.get_data(address-0x400000,16))
        assert words[1:] == (update,0x42d8a0,0x42d8f0)
        tables.append(dict(address=f'{address:08x}',words=[f'{n:08x}'for n in words]))
    for address,text in [(0x6bd520,b'#advisor_timeout_elves_available'),(0x6bd4fc,b'#advisor_timeout_dwarves_available')]:
        actual=pe.get_data(address-0x400000,64).split(b'\0',1)[0]
        assert actual == text,(hex(address),actual)
    return dict(version=1,executableSha256=PIN,ranges=ranges,vtables=tables,
        checkedInstructions=[decoded[at]for at,_,_ in anchors],nativeObjectField=16,serializedAdvisorField=12,
        originalTickUsesLocalKingdomOnly=True,originalReaderRestoresClockUnchanged=True,
        comparisonScope='Only owned two-kingdom level2 clock500 GSGL1792 layout; four version1 advisor records with timeout20000, zero auxiliary word, enabled1 and local500/remote0 notification clocks. All other bytes remain exact. Never change game saves or engine fields.',
        browserUsed=False,nativeProcessesStarted=0,fullWorldEqualityQualified=False)

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    result=audit()
    with a.output.open('x')as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(dict(pinned=True,ranges=len(result['ranges']),anchors=len(result['checkedInstructions']))))
