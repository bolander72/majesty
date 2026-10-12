#!/usr/bin/env python3
"""Bind the pinned Wait factory allocation return before its native reader test."""
import hashlib,json,struct
from pathlib import Path
import capstone,pefile
root=Path(__file__).resolve().parents[1]
original=root/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
pin='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
with original.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==pin
pe=pefile.PE(str(original));base=pe.OPTIONAL_HEADER.ImageBase
code=pe.get_data(0x5da6b6-base,0x36)
rows=list(capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32).disasm(code,0x5da6b6))
assert sum(i.size for i in rows)==len(code)
instructions={i.address:(i.mnemonic,i.op_str) for i in rows}
assert instructions[0x5da6b6]==('push','0x34')
assert instructions[0x5da6b8]==('call','0x64c616')
assert instructions[0x5da6bd]==('add','esp, 4')
assert instructions[0x5da6d6]==('call','0x5df030')
assert struct.unpack('<I',pe.get_data(0x5da870+8*4-base,4))[0]==0x5da6b6
result=dict(version=1,waitAllocationReturnQualified=True,executableSha256=pin,
  kind=9,objectBytes=52,call='005da6b8',allocator='0064c616',returnPc='005da6bd',
  factoryRangeSha256=hashlib.sha256(code).hexdigest(),instructions=len(rows),
  sourceSha256={'scripts/audit-native-wait-allocation.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
  browserUsed=False,nativeProcessStarted=False)
out=root/'output/native-wait-allocation-001-audit.json'
with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:result[k] for k in ['waitAllocationReturnQualified','objectBytes','returnPc']}))
