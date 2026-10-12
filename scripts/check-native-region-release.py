#!/usr/bin/env python3
"""Bounded original component construction/release with controlled guest data.

Allocator reuse is a model; these checks establish original component frees,
not complete world/GPL eviction or real host/WASM allocator behaviour.
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
SPEC = importlib.util.spec_from_file_location('release_audit', ROOT/'scripts/audit-native-region-release.py')
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
    raise RuntimeError('Image budget exceeded')
STATE, STACK, HEAP, STOP = 0x01000000, 0x02000000, 0x03000000, 0x04000000
ARENA_BYTES = 3*1024*1024
MAPPINGS = [(0, 4096), (STATE, 65536), (STACK, 65536), (HEAP, ARENA_BYTES), (STOP, 4096)]
ALLOWED = [
    (0x005f19c0, 0x005f19e5), (0x005fda70, 0x005fdb60),
    (0x005aeb70, 0x005aeb9b), (0x005c9d80, 0x005c9dad),
    (0x005fdcc0, 0x005fdd3d), (0x00601690, 0x006016d4),
    (0x005c9db0, 0x005c9dc8), (0x005b7f00, 0x005b7fd1),
    (0x005b8000, 0x005b8036), (0x005f0a90, 0x005f0ab2),
    (0x005f0ae0, 0x005f0b11), (0x005f0570, 0x005f05d3),
    (0x005f0630, 0x005f068c), (0x005fce00, 0x005fce0d),
    (0x005fce10, 0x005fce2c), (0x00501850, 0x005019a0),
]
CPU = Uc(UC_ARCH_X86, UC_MODE_32)
CPU.mem_map(BASE, IMAGE_BYTES)
CPU.mem_write(BASE, PE.get_memory_mapped_image())
for address, size in MAPPINGS:
    CPU.mem_map(address, size)
allocated, holes = {}, [(HEAP, ARENA_BYTES)]
metrics = dict(liveBytes=0, peakLiveBytes=0, allocationCalls=0, freeCalls=0,
               callInstructions=0, peakCallInstructions=0, totalInstructions=0)


def word(at, value=None):
    if value is not None:
        CPU.mem_write(at, struct.pack('<I', value & 0xffffffff))
    return struct.unpack('<I', CPU.mem_read(at, 4))[0]


def allocate(size):
    if not 0 < size <= 530456:
        raise RuntimeError('Unexpected component allocation')
    aligned = (size+15)//16*16
    for index, (pointer, available) in enumerate(holes):
        if aligned > available:
            continue
        holes[index:index+1] = [(pointer+aligned, available-aligned)] if aligned < available else []
        allocated[pointer] = (size, aligned)
        metrics['allocationCalls'] += 1
        metrics['liveBytes'] += size
        metrics['peakLiveBytes'] = max(metrics['peakLiveBytes'], metrics['liveBytes'])
        # Poison new storage; the original constructors must initialize it.
        for at in range(0, size, 4096):
            CPU.mem_write(pointer+at, bytes([0x5a])*min(4096, size-at))
        return pointer
    raise RuntimeError('Controlled guest arena exhausted')


def release(pointer):
    if not pointer:
        return  # CRT free(NULL) is valid.
    if pointer not in allocated:
        raise RuntimeError('Unowned component free')
    size, aligned = allocated.pop(pointer)
    metrics['liveBytes'] -= size
    metrics['freeCalls'] += 1
    holes.append((pointer, aligned))
    holes.sort()
    merged = []
    for start, length in holes:
        if merged and merged[-1][0]+merged[-1][1] == start:
            merged[-1] = (merged[-1][0], merged[-1][1]+length)
        else:
            merged.append((start, length))
    holes[:] = merged


def hook(cpu, address, size, context):
    metrics['callInstructions'] += 1
    metrics['totalInstructions'] += 1
    if metrics['callInstructions'] > 1000000:
        raise RuntimeError('Component instruction budget exceeded')
    if address in (0x0064c616, 0x0064d59f, 0x00645bc0, 0x0064d4b6):
        sp = cpu.reg_read(UC_X86_REG_ESP)
        argument = word(sp+4)
        if address in (0x0064c616, 0x0064d59f):
            cpu.reg_write(UC_X86_REG_EAX, allocate(argument))
        else:
            release(argument)
        cpu.reg_write(UC_X86_REG_EIP, word(sp))
        cpu.reg_write(UC_X86_REG_ESP, sp+4)
    elif not any(start <= address < end for start, end in ALLOWED):
        raise RuntimeError(f'Unexpected original component path {address:08x}')


CPU.hook_add(UC_HOOK_CODE, hook)


def invoke(function, receiver, *args):
    sp = STACK+0x8000
    for register in (UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_EDX, UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP):
        CPU.reg_write(register, 0)
    for index, value in enumerate([STOP, *args]):
        word(sp+index*4, value)
    CPU.reg_write(UC_X86_REG_ESP, sp)
    CPU.reg_write(UC_X86_REG_ECX, receiver)
    metrics['callInstructions'] = 0
    CPU.emu_start(function, STOP, timeout=1000000, count=1000000)
    if CPU.reg_read(UC_X86_REG_EIP) != STOP:
        raise RuntimeError('Component call did not return within its budget')
    assert CPU.reg_read(UC_X86_REG_ESP) == sp+4+4*len(args)
    metrics['peakCallInstructions'] = max(metrics['peakCallInstructions'], metrics['callInstructions'])
    return CPU.reg_read(UC_X86_REG_EAX)


def digest_allocations(pointers):
    sha = hashlib.sha256()
    for pointer in pointers:
        size = allocated[pointer][0]
        for at in range(0, size, 4096):
            sha.update(CPU.mem_read(pointer+at, min(4096, size-at)))
    return sha.hexdigest()


def construct(slot, sequence):
    terrain, grid = STATE+slot*0x400+0x100, STATE+slot*0x400+0x200
    CPU.mem_write(terrain, bytes(0x100))
    CPU.mem_write(grid, bytes(0x100))
    assert invoke(0x005f19c0, terrain, 128, 128, 0) == terrain
    assert (word(terrain+0x30), word(terrain+0x34), word(terrain+0x38)) == (128, 128, 129)
    cells, vertices = word(terrain+0x48), word(terrain+0x4c)
    assert allocated[cells][0] == 128*128*8
    assert allocated[vertices][0] == 129*129*24
    assert invoke(0x005b7f00, grid, 256, 256) == grid
    tables = [word(grid+0x14), word(grid+0x18)]
    assert all(allocated[pointer][0] == 256*256*4 for pointer in tables)
    arrays = [cells, vertices, *tables]
    for pointer in arrays:
        size = allocated[pointer][0]
        for at in range(0, size, 4096):
            assert bytes(CPU.mem_read(pointer+at, min(4096, size-at))) == bytes(min(4096, size-at))
    # Synthetic populated actor-list pool: test the original destructor's
    # ownership, without creating live actors or claiming pool insertion.
    pool = grid+0x1c
    page, directory, free_list = allocate(131072), allocate(4), allocate(16384)
    word(directory, page)
    word(pool+0x10, directory)
    word(pool+0x14, directory+4)
    word(pool+0x18, directory+4)
    word(pool+0x24, free_list)
    pointers = [*arrays, page, directory, free_list]
    word(cells, sequence+1)
    word(vertices, (sequence+1)*65536)
    return dict(slot=slot, terrain=terrain, grid=grid, pointers=pointers,
                sha256=digest_allocations(pointers))


def destroy(component):
    invoke(0x005fdcc0, component['terrain'])
    invoke(0x005b8000, component['grid'])
    assert all(pointer not in allocated for pointer in component['pointers'])


active = construct(0, 0)
per_components = 1202204
assert metrics['liveBytes'] == per_components
transitions = []
for sequence in range(1, 6):
    if sequence == 2:
        cancelled = construct(1-active['slot'], 100)
        assert metrics['liveBytes'] == 2*per_components
        assert digest_allocations(active['pointers']) == active['sha256']
        destroy(cancelled)
        assert metrics['liveBytes'] == per_components
        assert digest_allocations(active['pointers']) == active['sha256']
    incoming = construct(1-active['slot'], sequence)
    assert metrics['liveBytes'] == 2*per_components
    assert digest_allocations(active['pointers']) == active['sha256']
    destroy(active)
    assert metrics['liveBytes'] == per_components
    assert digest_allocations(incoming['pointers']) == incoming['sha256']
    active = incoming
    transitions.append(dict(sequence=sequence, liveBytesAfterOldRelease=metrics['liveBytes']))
destroy(active)
assert not allocated and metrics['liveBytes'] == 0 and holes == [(HEAP, ARENA_BYTES)]
assert metrics['allocationCalls'] == metrics['freeCalls'] == 49
assert metrics['peakLiveBytes'] == 2*per_components
if hashlib.sha256(EXE.read_bytes()).hexdigest() != AUDIT.PIN:
    raise RuntimeError('Pinned executable changed during component checks')
proof = dict(passed=True, executableSha256=AUDIT.PIN, verifiedInstructionAnchors=REPORT['verifiedInstructionAnchors'],
             constructorCycles=7, cancelledIncomingComponents=1,
             transitions=transitions, metrics=metrics, terrainCellSide=128, spatialGridSide=256,
             componentArrayBytes=1054744, syntheticPopulatedPoolBytes=147460,
             emulatorInstances=1, mappedGuestBytes=IMAGE_BYTES+sum(size for _, size in MAPPINGS),
             allocatorArenaBytes=ARENA_BYTES, allocatorStubbed=True, allocatorReuseModel='first fit with coalescing',
             originalComponentConstructorsAndDestructorsExecuted=True, syntheticGuestState=True,
             activeBytesPreservedWhileIncomingConstructs=True, incomingBytesPreservedWhileOldReleases=True,
             activeBytesPreservedAfterIncomingCancellation=True,
             allOwnedComponentAllocationsReleased=True, pinnedExecutableHashBeforeAfterMatches=True,
             perCallInstructionLimit=1000000, perCallTimeoutMicroseconds=1000000,
             browserUsed=False, newGameProcessesLaunched=0, heavyBuildUsed=False, originalFilesChanged=False,
             limitations='Selected original terrain/grid constructors and destructors with synthetic isolated state and controlled allocators. Populated pool buffers are synthetic. No full world/actor/GPL teardown, checkpoint before unload, loader rollback, native/CRT/WASM fragmentation, GPU release, live region handoff or whole-process browser memory qualification.')
(ROOT/'output/native-region-release-emulated-observed.json').write_text(json.dumps(proof, indent=2)+'\n')
print(json.dumps(dict(passed=True, constructorCycles=7, componentExchanges=len(transitions),
                     cancelledIncomingComponents=1,
                     peakLiveOwnedBytes=metrics['peakLiveBytes'], finalLiveOwnedBytes=metrics['liveBytes'],
                     peakCallInstructions=metrics['peakCallInstructions'], browserUsed=False)))
