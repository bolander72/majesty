#!/usr/bin/env python3
"""Execute audited original height conversion blocks with bounded guest state."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
from unittest.mock import patch

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESI,
                              UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_FPCW,
                              UC_X86_REG_FPSW, UC_X86_REG_FPTAG)

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('height_audit', ROOT/'scripts/audit-native-height.py')
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
EXE = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
REPORT = AUDIT.audit(EXE)
data = EXE.read_bytes()
if hashlib.sha256(data).hexdigest() != AUDIT.PIN:
    raise RuntimeError('Pinned executable changed before CPU setup')
PE = pefile.PE(data=data)
BASE = PE.OPTIONAL_HEADER.ImageBase
IMAGE_BYTES = (PE.OPTIONAL_HEADER.SizeOfImage+4095)//4096*4096
if IMAGE_BYTES > 4*1024*1024:
    raise RuntimeError('Height guest image budget exceeded')
STATE, STACK, STOP = 0x01000000, 0x02000000, 0x03000000
TERRAIN, POINT, CONFIG, VERTEX = STATE, STATE+0x100, STATE+0x200, STATE+0x1000
CPU = Uc(UC_ARCH_X86, UC_MODE_32)
CPU.mem_map(BASE, IMAGE_BYTES)
CPU.mem_write(BASE, PE.get_memory_mapped_image())
for address, size in [(STATE, 8192), (STACK, 8192), (STOP, 4096)]:
    CPU.mem_map(address, size)
ALLOWED = [(0x005f2b4b, 0x005f2bae), (0x005f3045, 0x005f3058),
           (0x005f1a40, 0x005f1ae0), (0x005aeb70, 0x005aeb9b)]
instructions, largest, call_count = 0, 0, 0


def word(at, value=None):
    if value is not None:
        CPU.mem_write(at, struct.pack('<I', value & 0xffffffff))
    return struct.unpack('<I', CPU.mem_read(at, 4))[0]


def signed(value):
    return struct.unpack('<i', struct.pack('<I', value & 0xffffffff))[0]


def hook(cpu, address, size, context):
    global instructions, call_count
    instructions += 1
    call_count += 1
    if call_count > 2000 or not any(start <= address < end for start, end in ALLOWED):
        raise RuntimeError(f'Unexpected or over-budget height instruction {address:08x}')


CPU.hook_add(UC_HOOK_CODE, hook)


def run(start, end, *, ecx=0, esi=0, args=()):
    global call_count, largest
    sp = STACK+4096
    CPU.mem_write(sp, bytes(64))
    for index, value in enumerate([STOP, *args]):
        word(sp+4*index, value)
    CPU.reg_write(UC_X86_REG_ESP, sp)
    CPU.reg_write(UC_X86_REG_ECX, ecx)
    CPU.reg_write(UC_X86_REG_ESI, esi)
    CPU.reg_write(UC_X86_REG_FPCW, 0x037f)  # Round to nearest; masked exceptions.
    CPU.reg_write(UC_X86_REG_FPSW, 0)
    CPU.reg_write(UC_X86_REG_FPTAG, 0xffff)
    call_count = 0
    CPU.emu_start(start, end, timeout=1_000_000, count=2000)
    if CPU.reg_read(UC_X86_REG_EIP) != end:
        raise RuntimeError('Original height code did not reach the audited boundary')
    largest = max(largest, call_count)
    return sp


def reader(bits):
    run(0x005f2b4b, 0x005f2bae, ecx=bits)
    return signed(CPU.reg_read(UC_X86_REG_EAX))


def writer(q16):
    word(VERTEX, q16)
    sp = run(0x005f3045, 0x005f3058, esi=VERTEX)
    if CPU.reg_read(UC_X86_REG_ESP) != sp-8:
        raise RuntimeError('Inline writer stack changed')
    return word(sp+16)


vectors = []
for bits in [0, 0x80000000, 0x37800000, 0xb7800000, 0x37000000, 0xb7000000,
             0x3fc00000, 0xbfc00000, 0x3dcccccd, 0xbdcccccd, 0x46ffffff,
             0xc7000000, 0x47000000, 0xc7000001, 0x7149f2ca,
             0x7f800000, 0xff800000, 0x7fc00000]:
    height = struct.unpack('<f', struct.pack('<I', bits))[0]
    q16 = reader(bits)
    encoded = writer(q16)
    safe_range = -32768 <= height < 32768
    canonical = safe_range and encoded == bits
    if safe_range:
        if q16 != int(height*65536):
            raise RuntimeError('Original native reader disagrees with exact Q16 truncation')
    vectors.append(dict(bits=bits, nativeQ16=q16, writerBits=encoded,
                        safeRange=safe_range, stable=canonical))
if reader(0x47000000) != -2147483648:
    raise RuntimeError('Pinned positive overflow observation changed')
writer_extremes = [dict(nativeQ16=q, writerBits=writer(q)) for q in
                   [-2147483648, -98304, -1, 0, 1, 98304, 2147483520, 2147483647]]

# Original delta-method calls operate only on one validated synthetic point.
# Their results are separate from full generation or live world mutation.
word(TERRAIN+0x38, 10)
word(TERRAIN+0x3c, 9)
word(TERRAIN+0x4c, VERTEX)
delta_cases = []
for old, delta, scale, x, y in [(655360, 2, 2, 0, 0), (655360, -3, 2, 8, 8),
                              (0, -1, 3, 3, 4), (0, 1, 3, 4, 3),
                              (65536, 2, 2, 8, 0), (-65536, -2, 2, 0, 8)]:
    assert 0 <= x < 9 and 0 <= y < 9 and scale > 0
    payload = bytearray((index*17+37) % 256 for index in range(90*24))
    at = (y*10+x)*24
    struct.pack_into('<i', payload, at, old)
    CPU.mem_write(VERTEX, bytes(payload))
    word(POINT, x)
    word(POINT+4, y)
    CPU.mem_write(CONFIG+8, struct.pack('<f', scale))
    sp = run(0x005f1a40, STOP, ecx=TERRAIN, args=(POINT, delta, CONFIG))
    assert CPU.reg_read(UC_X86_REG_ESP) == sp+16
    observed = bytes(CPU.mem_read(VERTEX, len(payload)))
    height = struct.unpack('<f', struct.pack('<f', old/65536-delta/scale))[0]
    expected = int(height*65536)
    struct.pack_into('<i', payload, at, expected)
    assert observed == bytes(payload), 'Delta method altered another vertex or opaque/derived fields'
    delta_cases.append(dict(oldQ16=old, integerDelta=delta, scale=scale, x=x, y=y,
                           observedQ16=signed(word(VERTEX+at)), otherBytesUnchanged=True))

payload = bytearray((index*17+37) % 256 for index in range(90*24))
CPU.mem_write(VERTEX, bytes(payload))
sp = run(0x005aeb70, STOP, ecx=TERRAIN)
assert CPU.reg_read(UC_X86_REG_ESP) == sp+4
for at in range(0, len(payload), 24):
    payload[at:at+4] = bytes(4)
assert bytes(CPU.mem_read(VERTEX, len(payload))) == bytes(payload)
assert hashlib.sha256(EXE.read_bytes()).hexdigest() == AUDIT.PIN
with tempfile.TemporaryDirectory(prefix='height-pin-', dir=ROOT/'output') as temporary:
    wrong = Path(temporary)/'wrong.exe'
    wrong.write_bytes(b'unpinned height input')
    with patch.object(AUDIT.pefile, 'PE', side_effect=RuntimeError('must not decode')) as parser:
        try:
            AUDIT.audit(wrong)
            raise AssertionError('Unpinned height input accepted')
        except ValueError as error:
            assert 'pinned executable' in str(error)
        assert parser.call_count == 0
result = dict(executableSha256=AUDIT.PIN, pinUnchanged=True,
              qualification='original audited inline conversion blocks and two methods in one isolated CPU emulator',
              vectors=vectors, writerExtremes=writer_extremes, deltaCases=delta_cases,
              unpinnedInputRejectedBeforePeDecode=True,
              clear=dict(vertices=90, onlyHeightFieldsChanged=True),
              resources=dict(guestMappedBytes=IMAGE_BYTES+8192+8192+4096, heapAllocations=0,
                             maxInstructionsPerCall=2000, largestCallInstructions=largest,
                             totalInstructions=instructions, maxCallTimeMicros=1_000_000),
              gameLaunches=0, browserLaunches=0, builds=0,
              limitations=['inline checks bypass surrounding file parsing, not a full engine reload',
                           'delta calls use synthetic validated points; ordering relative to actors remains unknown',
                           'round-to-nearest x87 control; other control modes not qualified',
                           'no normals/shading, paging, generated seam or co-op qualification'])
(ROOT/'output/native-height-emulated-observed.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(dict(passed=True, vectors=len(vectors), deltaCases=len(delta_cases),
                      positiveOverflowWraps=True, largestCallInstructions=largest,
                      guestMappedBytes=result['resources']['guestMappedBytes'], gameLaunches=0)))
