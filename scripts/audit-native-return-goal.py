#!/usr/bin/env python3
"""Verify the pinned occupied-goal resolver ABI and original command-bank drain."""
import argparse,hashlib,json
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def audit():
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Require pinned original executable')
    pe=pefile.PE(data=raw);decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    ranges=[];instructions={}
    for label,start,end in [('route-search-caller',0x5eaf50,0x5eb146),('occupied-goal-resolver',0x5e9b00,0x5e9cc3),('bank-drain',0x5e4ff0,0x5e5012),('unit-bank-clear',0x5b2de0,0x5b2e09)]:
        rows=[]
        for i in decoder.disasm(pe.get_data(start-pe.OPTIONAL_HEADER.ImageBase,end-start),start):
            row=dict(address=f'{i.address:08x}',mnemonic=i.mnemonic,operands=i.op_str,bytes=i.bytes.hex());rows.append(row);instructions[i.address]=row
        ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=rows))
    anchors=[(0x5eafa1,'call','0x5e9b00'),(0x5eafa6,'mov','edx, dword ptr [eax]'),(0x5eafae,'mov','eax, dword ptr [eax + 4]'),
        (0x5e9b0f,'mov','eax, dword ptr [esp + 0x24]'),(0x5e9b17,'mov','ebx, dword ptr [eax + 0x88]'),
        (0x5e9ca5,'mov','eax, dword ptr [esp + 0x2c]'),(0x5e9cb7,'mov','dword ptr [eax], ecx'),(0x5e9cb9,'mov','dword ptr [eax + 4], edx')]
    for address,mnemonic,operands in anchors:
        row=instructions.get(address)
        if not row or (row['mnemonic'],row['operands'])!=(mnemonic,operands):raise ValueError(f'Resolver anchor changed {address:08x}')
    resolver=ranges[1]['instructions'];returns=[r['operands'] for r in resolver if r['mnemonic']=='ret']
    if returns!=['0x2c']:raise ValueError('Resolver does not consume exactly eleven DWORD arguments')
    # Original drain invokes bank +48 for each still-linked command until empty;
    # clear only invokes the bank scalar destructor and nulls the UNIT field.
    drain=ranges[2]['instructions'];clear=ranges[3]['instructions']
    if not any(r['mnemonic']=='call' and r['operands']=='dword ptr [edx + 0x48]' for r in drain):raise ValueError('Missing original populated-bank retirement')
    if not any(r['mnemonic']=='call' and r['operands']=='dword ptr [eax]' for r in clear):raise ValueError('Missing original bank destructor')
    return dict(qualified=True,scope='Pinned static original goal-resolver observer ABI and distinction between populated bank drain and scalar bank deletion; native evidence remains required',
        executableSha256=PIN,verifiedInstructionAnchors=len(anchors),resolver='005e9b00',observerReturnPc='005eafa6',
        argumentOffsets=dict(output=4,factory=8,unit=12,startX=16,startY=20,requestedX=24,requestedY=28),
        originalOccupiedGoalResolutionIdentified=True,originalPopulatedBankDrain='005e4ff0',originalUnitBankClear='005b2de0',
        ranges=ranges,nativeProcessesStarted=0,browserUsed=False)
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args();r=audit()
    with a.output.open('x') as f:json.dump(r,f,indent=2);f.write('\n')
    print(json.dumps(dict(qualified=True,verifiedInstructionAnchors=r['verifiedInstructionAnchors'],nativeProcessesStarted=0)))
if __name__=='__main__':main()
