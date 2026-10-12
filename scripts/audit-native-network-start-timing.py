#!/usr/bin/env python3
"""Bind the GameStart timing source and missing constructor write to the pin."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
from capstone.x86 import X86_OP_MEM, X86_OP_REG, X86_REG_EBP
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit():
    raw = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:raise ValueError('Requires pinned original timing ABI')
    pe = pefile.PE(data=raw);base = pe.OPTIONAL_HEADER.ImageBase
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32);md.detail = True
    methods = {}
    def decode(name, start, end):
        body = pe.get_data(start-base, end-start);rows = list(md.disasm(body, start))
        if sum(i.size for i in rows) != len(body):raise ValueError('Timing range incompletely decoded')
        methods[name] = dict(address=f'{start:08x}', bytes=len(body),
            sha256=hashlib.sha256(body).hexdigest(), instructions=len(rows))
        return rows
    ctor = decode('managerConstructor', 0x00497a00, 0x00497c6a)
    if len(ctor) != 150 or ctor[-1].mnemonic != 'ret':raise ValueError('Constructor range differs')
    if not any(i.mnemonic=='mov' and i.op_str=='ebp, ecx' for i in ctor):
        raise ValueError('Constructor self register differs')
    for i in ctor:
        if not i.operands:continue
        dst = i.operands[0]
        if dst.type == X86_OP_REG and dst.reg == X86_REG_EBP and i.mnemonic not in ('push','pop'):
            if (i.mnemonic,i.op_str)!=('mov','ebp, ecx'):raise ValueError('Constructor self register changes')
        if dst.type == X86_OP_MEM and dst.mem.base == X86_REG_EBP and dst.mem.disp == 0x88:
            raise ValueError('Original constructor now touches the timing member')
    sender = decode('gameStartTimingRead', 0x0045303a, 0x0045305f)
    expected = [('call','0x497990'), ('mov','ecx, dword ptr [0x6d8564]'),
        ('mov','ebp, dword ptr [0x6d8548]'), ('mov','eax, dword ptr [eax + 0x88]'),
        ('neg','ecx'),('sbb','ecx, ecx'),('mov','dword ptr [esp + 0x50], eax'),
        ('and','ecx, ebp'),('mov','dword ptr [esp + 0x54], ecx')]
    if [(i.mnemonic,i.op_str) for i in sender]!=expected:raise ValueError('Original GameStart timing read differs')
    seed = decode('gameStartScenarioSeedRead', 0x00453028, 0x0045303a)
    if [(i.mnemonic,i.op_str) for i in seed]!=[
        ('call','0x4ba7e0'),('add','eax, 0x74'),
        ('mov','eax, dword ptr [eax + 0xd0]'),
        ('mov','dword ptr [esp + 0x4c], eax')]:
        raise ValueError('Original GameStart scenario seed read differs')
    arguments = decode('gameStartPacketArguments', 0x0045309e, 0x004530b2)
    if [(i.mnemonic,i.op_str) for i in arguments]!=[
        ('lea','edx, [esp + 0x34]'),('push','eax'),('push','0x1bc'),
        ('push','edx'),('push','3'),('mov','ecx, esi'),('call','0x588300')]:
        raise ValueError('GameStart data pointer/body size differs')
    initialized = decode('originalMatchTimingAssignment', 0x00499290, 0x004992a5)
    if [(i.mnemonic,i.op_str) for i in initialized]!=[
        ('mov','edx, dword ptr [0x6c0ea0]'),('mov','dword ptr [ebp + 0x234], eax'),
        ('imul','eax, edx'),('mov','dword ptr [ebp + 0x88], edx')]:
        raise ValueError('Original match initialization timing differs')
    defaults = struct.unpack('<4I',pe.get_data(0x006c0ea0-base,16))
    if defaults!=(50,10,2,60000):raise ValueError('Original network timing defaults differ')
    label = pe.get_data(0x006c131c-base,32).split(b'\0',1)[0].decode('ascii')
    if label!='\r\nTime per Frame = %dms':raise ValueError('Original timing label differs')
    return dict(originalNetworkStartTimingAbiQualified=True, originalExecutableSha256=PIN,
        constructorLeavesTimingMemberUninitialized=True, managerTimingOffset=0x88,
        originalConfiguredTimingGlobal='006c0ea0', originalDefaultIntervalMs=50,
        gameStartBodyTimingOffset=28, methods=methods,
        gameStartBodyScenarioSeedOffset=24, settingsScenarioSeedOffset=0x144,
        scope='Pinned constructor/sender/match initialization and default field only; runtime evidence must prove timing and vote admission.')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True)
    args=p.parse_args();result=audit()
    with args.output.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(dict(originalNetworkStartTimingAbiQualified=True,methods=len(result['methods']))))
