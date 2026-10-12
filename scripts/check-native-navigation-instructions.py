#!/usr/bin/env python3
"""Bounded original x86 function checks with synthetic isolated guest state.

This runs no game/runtime, filesystem imports, renderer, WASM or browser.
Only listed original function ranges execute, plus controlled allocator stubs.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDX
from unicorn.x86_const import UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_EIP

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('navigation_audit', ROOT/'scripts/audit-native-navigation.py')
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
EXE = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
REPORT = AUDIT.audit(EXE)  # Pin verified before decoding or CPU construction.
image = EXE.read_bytes()
if hashlib.sha256(image).hexdigest() != AUDIT.PIN:
    raise RuntimeError('Pinned executable changed before CPU setup')
PE = pefile.PE(data=image)
BASE = PE.OPTIONAL_HEADER.ImageBase
IMAGE_BYTES = (PE.OPTIONAL_HEADER.SizeOfImage+4095)//4096*4096
if IMAGE_BYTES > 4*1024*1024:
    raise RuntimeError('Guest image budget exceeded')
STATE, STACK, HEAP, STOP = 0x01000000, 0x02000000, 0x03000000, 0x04000000
GRID, SCRATCH, ACTORS = STATE+0x100, STATE+0x1000, STATE+0x2000
ACTOR_LIST, FOOTPRINT, MASK = STATE+0x3000, STATE+0x3100, STATE+0x3200
QUERY, TARGET = STATE+0x4000, STATE+0x4200
ALLOWED = [(0x00420c50, 0x00420c63), (0x00501850, 0x005019a0)]
ALLOWED += [(start, end) for _, start, end in AUDIT.RANGES if start in {
    0x005ebfc0, 0x005ec0f0, 0x005eaf10, 0x005b8040, 0x005b7e30,
    0x005b8eb0, 0x005b8bc0, 0x005b8d50, 0x005f0db0}]

CPU = Uc(UC_ARCH_X86, UC_MODE_32)
CPU.mem_map(BASE, IMAGE_BYTES)
CPU.mem_write(BASE, PE.get_memory_mapped_image())
GUEST_MAPPINGS = [(0, 4096), (STATE, 65536), (STACK, 65536), (HEAP, 262144), (STOP, 4096)]
for address, size in GUEST_MAPPINGS:
    CPU.mem_map(address, size)
COUNTERS = dict(callInstructions=0, largestCallInstructions=0, totalInstructions=0,
                allocatorCalls=0, freeCalls=0, callbackCalls=0)
allocations, next_heap = {}, HEAP


def word(at, value=None):
    if value is not None:
        CPU.mem_write(at, struct.pack('<I', value & 0xffffffff))
    return struct.unpack('<I', CPU.mem_read(at, 4))[0]


def words(at, values):
    for index, value in enumerate(values):
        word(at+4*index, value)


def hook(cpu, address, size, context):
    global next_heap
    COUNTERS['callInstructions'] += 1
    COUNTERS['totalInstructions'] += 1
    if COUNTERS['callInstructions'] > 200000:
        raise RuntimeError('Instruction budget exceeded')
    if address in (0x0064c616, 0x00645bc0):
        sp = cpu.reg_read(UC_X86_REG_ESP)
        argument = word(sp+4)
        if address == 0x0064c616:
            pointer = (next_heap+15)//16*16
            if not 0 < argument <= 229376 or pointer+argument > HEAP+262144:
                raise RuntimeError('Guest allocation budget exceeded')
            allocations[pointer] = argument
            next_heap = pointer+argument
            cpu.mem_write(pointer, bytes(argument))
            cpu.reg_write(UC_X86_REG_EAX, pointer)
            COUNTERS['allocatorCalls'] += 1
        else:
            if argument not in allocations:
                raise RuntimeError('Unexpected guest free')
            del allocations[argument]
            COUNTERS['freeCalls'] += 1
        cpu.reg_write(UC_X86_REG_EIP, word(sp))
        cpu.reg_write(UC_X86_REG_ESP, sp+4)  # Original allocator ABI is cdecl.
        return
    if address == 0x005f0db0:
        COUNTERS['callbackCalls'] += 1
    if not any(start <= address < end for start, end in ALLOWED):
        raise RuntimeError(f'Unexpected original code path {address:08x}')


CPU.hook_add(UC_HOOK_CODE, hook)


def invoke(function, receiver, *args):
    sp = STACK+0x8000
    for register in (UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_EDX, UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP):
        CPU.reg_write(register, 0)
    words(sp, [STOP, *args])
    CPU.reg_write(UC_X86_REG_ESP, sp)
    CPU.reg_write(UC_X86_REG_ECX, receiver)
    COUNTERS['callInstructions'] = 0
    CPU.emu_start(function, STOP, timeout=1000000, count=200000)
    if CPU.reg_read(UC_X86_REG_EIP) != STOP:
        raise RuntimeError('Emulated call did not return before its budget')
    assert CPU.reg_read(UC_X86_REG_ESP) == sp+4+4*len(args)
    COUNTERS['largestCallInstructions'] = max(COUNTERS['largestCallInstructions'], COUNTERS['callInstructions'])
    return CPU.reg_read(UC_X86_REG_EAX)


def reset_grid():
    CPU.mem_write(STATE, bytes(65536))
    words(GRID+4, [-1, -1, -1, -1])
    word(GRID+0x14, SCRATCH)
    word(GRID+0x18, ACTORS)
    word(GRID+0x48, 8)
    word(GRID+0x4c, 8)


cases = []
reset_grid()
for x, y, blocked in [(0, 0, 0), (7, 7, 0), (-1, 0, 1), (0, -1, 1), (8, 0, 1), (0, 8, 1), (1000000, 0, 1)]:
    assert invoke(0x005b8eb0, GRID, 0, x, y, 0, 0, 0) & 255 == blocked
cases.append('Original point collision rejects each outside edge and accepts endpoints')

reset_grid()
word(SCRATCH, 0x11111111)  # Outside the dirty rectangle; preserve it.
CPU.mem_write(ACTORS, bytes([0x5a])*256)
actors_before = bytes(CPU.mem_read(ACTORS, 256))
for x, y, value in [(1, 2, 0x12340000), (5, 6, 0xfffffff0)]:
    invoke(0x005b8040, GRID, x, y, value)
    assert word(SCRATCH+(y*8+x)*4) == value
assert [word(GRID+offset) for offset in (4, 8, 12, 16)] == [1, 2, 6, 7]
baseline = bytes(CPU.mem_read(GRID, 80)), bytes(CPU.mem_read(SCRATCH, 256))
for x, y in [(-1, 2), (8, 2), (2, -1), (2, 8)]:
    invoke(0x005b8040, GRID, x, y, 0x22222222)
    assert baseline == (bytes(CPU.mem_read(GRID, 80)), bytes(CPU.mem_read(SCRATCH, 256)))
invoke(0x005b7e30, GRID)
for y in range(8):
    for x in range(8):
        assert word(SCRATCH+(y*8+x)*4) == (0x11111111 if (x, y) == (0, 0) else 0)
assert [word(GRID+offset) for offset in (4, 8, 12, 16)] == [0xffffffff]*4
assert bytes(CPU.mem_read(ACTORS, 256)) == actors_before
invoke(0x005b7e30, GRID)
assert bytes(CPU.mem_read(ACTORS, 256)) == actors_before and word(SCRATCH) == 0x11111111
cases.append('Original scratch writes reject outside coordinates; clear preserves actor table and untouched cells')

reset_grid()
words(FOOTPRINT, [1, 1, 1, 0, 0, MASK])
CPU.mem_write(MASK, b'\x01')
for actor in (QUERY, TARGET):
    description, traits = actor+0x100, actor+0x180
    word(actor+0x80, description)
    word(description+0x14, traits)
    word(traits+0x64, 0x10)


def masked(x=3, y=3, flags=0x800):
    return invoke(0x005b8d50, GRID, 0x005f0db0, QUERY, x, y, flags, FOOTPRINT) & 255


assert masked() == 0 and masked(7, 7) == 0
for x, y in [(-1, 3), (8, 3), (3, -1), (3, 8)]:
    assert masked(x, y) == 1
cases.append('Original masked-footprint collision blocks outside grid cells')
index = (3*8+3)*4
word(ACTORS+index, ACTOR_LIST)
words(ACTOR_LIST, [TARGET, 0])
assert masked() == 1 and COUNTERS['callbackCalls'] > 0
word(TARGET+0x180+0x64, 0x20)
assert masked() == 0  # No overlapping native collision mask.
word(TARGET+0x180+0x64, 0x10)
word(ACTOR_LIST, QUERY)
assert masked() == 0  # Original callback ignores the querying actor itself.
saturated = [STATE+0x5000+index*0x200 for index in range(8)]
for actor in saturated:
    word(actor+0x80, actor+0x100)
    word(actor+0x100+0x14, actor+0x180)
    word(actor+0x180+0x64, 0x20)  # Each callback passes; the bucket is full.
words(ACTOR_LIST, saturated)
assert masked() == 1  # Full bucket blocks even when no callback blocks.
words(ACTOR_LIST, [0]*8)
word(SCRATCH+index, 0xfffffff0)
assert masked(flags=4) == 1 and masked(flags=8) == 1 and masked(flags=0) == 0
CPU.mem_write(MASK, b'\x00')
assert masked(flags=4) == 0
cases.append('Original actor masks/self exclusion/full buckets/search exclusion markers and footprint bits')

word(0x0071ca10, 0)
invoke(0x005ebfc0, 0)
manager = word(0x0071ca10)
assert manager in allocations and allocations[manager] == 28
node_array = word(manager+8)
assert allocations[node_array] == 229376
assert word(manager+0xc) == 8192 and word(manager+0x14) == 1024
assert bytes(CPU.mem_read(node_array, 229376)) == bytes(229376)
allocation_count = COUNTERS['allocatorCalls']
invoke(0x005ebfc0, 0)
assert word(0x0071ca10) == manager and COUNTERS['allocatorCalls'] == allocation_count == 2
reset_grid()
for index, (x, y) in enumerate([(1, 1), (2, 3)]):
    node = invoke(0x005eaf10, manager, GRID, x, y)
    assert node == node_array+index*28 and word(manager+0x10) == index+1
    assert (word(node+0xc), word(node+0x10)) == (x, y)
    assert word(SCRATCH+(y*8+x)*4) == node
invoke(0x005b7e30, GRID)
assert bytes(CPU.mem_read(SCRATCH, 256)) == bytes(256)
assert COUNTERS['allocatorCalls'] == allocation_count
cases.append('Original path-node allocation writes grid scratch pointers; native clear removes them')
invoke(0x005ec0f0, 0)
assert word(0x0071ca10) == 0 and not allocations and COUNTERS['freeCalls'] == 2
cases.append('Original default path pool initializes once, reuses its allocation and releases it')
if hashlib.sha256(EXE.read_bytes()).hexdigest() != AUDIT.PIN:
    raise RuntimeError('Pinned executable changed during instruction checks')

proof = dict(passed=True, executableSha256=AUDIT.PIN, verifiedInstructionAnchors=REPORT['verifiedInstructionAnchors'],
             cases=cases, counters=COUNTERS, emulatorInstances=1,
             mappedGuestBytes=IMAGE_BYTES+sum(size for _, size in GUEST_MAPPINGS),
             perCallInstructionLimit=200000, perCallTimeoutMicroseconds=1000000, guestAllocatorLimit=262144,
             allocatorStubbed=True, syntheticGuestState=True, browserUsed=False, newGameProcessesLaunched=0,
             pinnedExecutableSha256BeforeAfterMatches=True,
             heavyBuildUsed=False, originalFilesChanged=False,
             limitations='Selected original x86 functions with synthetic guest state and controlled allocator stubs. Not full game execution, complete path search, real actor placement, multiregion movement, terrain-height independence or whole-process memory qualification.')
(ROOT/'output/native-navigation-emulated-observed.json').write_text(json.dumps(proof, indent=2)+'\n')
print(json.dumps(dict(passed=True, caseGroups=len(cases), totalInstructions=COUNTERS['totalInstructions'],
                     largestCallInstructions=COUNTERS['largestCallInstructions'], mappedGuestBytes=proof['mappedGuestBytes'],
                     browserUsed=False, newGameProcessesLaunched=0)))
