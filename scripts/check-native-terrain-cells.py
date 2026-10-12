#!/usr/bin/env python3
"""Original cell routines on bounded synthetic rules; no game host or stubs."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import pefile
from unicorn import (Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE,
                     UC_HOOK_MEM_READ, UC_HOOK_MEM_WRITE)
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('cell_audit', ROOT/'scripts/audit-native-terrain-cells.py')
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
EXE = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
audit = AUDIT.audit(EXE)
data = EXE.read_bytes()
if hashlib.sha256(data).hexdigest() != AUDIT.PIN:
    raise RuntimeError('Cell executable changed before CPU setup')
PE = pefile.PE(data=data)
BASE = PE.OPTIONAL_HEADER.ImageBase
IMAGE_BYTES = (PE.OPTIONAL_HEADER.SizeOfImage+4095)//4096*4096
if IMAGE_BYTES > 4*1024*1024:
    raise RuntimeError('Cell guest image budget exceeded')
STATE, STACK, STOP = 0x01000000, 0x02000000, 0x03000000
TERRAIN, CELLS, VERTICES, RECT = STATE, STATE+0x1000, STATE+0x2000, STATE+0x2f00
DICTIONARY, RULE_WRAPPER, RULES = STATE+0x3000, STATE+0x3100, STATE+0x3200
KINDS, DESCRIPTIONS = STATE+0x4000, STATE+0x10000
CPU = Uc(UC_ARCH_X86, UC_MODE_32)
CPU.mem_map(BASE, IMAGE_BYTES)
CPU.mem_write(BASE, PE.get_memory_mapped_image())
CPU.mem_map(STATE, 1024*1024)
CPU.mem_map(STACK, 32768)
CPU.mem_map(STOP, 4096)
MAX_INSTRUCTIONS, MAX_TIME = 800_000, 2_000_000
instructions, rng_calls, cell_writes, rect_writes, vertex_reads = 0, 0, 0, 0, 0
propagation_calls, lowest_stack, initial_stack = 0, 0, 0
visited = set()
cell_size, vertex_size = 0, 0


def word(at, value=None):
    if value is not None:
        CPU.mem_write(at, struct.pack('<I', value & 0xffffffff))
    return struct.unpack('<I', CPU.mem_read(at, 4))[0]


def code(cpu, address, size, context):
    global instructions, rng_calls, propagation_calls, lowest_stack
    instructions += 1
    if instructions > MAX_INSTRUCTIONS or not any(start <= address < end for start, end in AUDIT.RANGES):
        raise RuntimeError(f'Unexpected or over-budget cell instruction {address:08x}')
    current_stack = cpu.reg_read(UC_X86_REG_ESP)
    lowest_stack = min(lowest_stack, current_stack)
    if not STACK+4096 <= current_stack <= STACK+28672:
        raise RuntimeError('Cell stack budget exceeded')
    visited.add(address)
    if address == 0x004f6690:
        rng_calls += 1
    if address == 0x005cae10:
        propagation_calls += 1


def read(cpu, access, address, size, value, context):
    global vertex_reads
    if address < VERTICES+vertex_size and address+size > VERTICES:
        vertex_reads += 1
        raise RuntimeError('Cell routine unexpectedly reads vertex geometry')


def write(cpu, access, address, size, value, context):
    global cell_writes, rect_writes
    if STACK <= address and address+size <= STACK+32768:
        return
    if CELLS <= address and address+size <= CELLS+cell_size:
        if address % 8 < 4 or address % 8+size > 8:
            raise RuntimeError('Cell routine overwrites primary pointer word')
        cell_writes += 1
        return
    if RECT <= address and address+size <= RECT+16:
        rect_writes += 1
        return
    if address == 0x006d8e84 and size == 4:
        return
    raise RuntimeError(f'Unexpected cell guest write {address:08x} size {size}')


CPU.hook_add(UC_HOOK_CODE, code)
CPU.hook_add(UC_HOOK_MEM_READ, read)
CPU.hook_add(UC_HOOK_MEM_WRITE, write)


def fixture(width, height, kind, seed):
    global cell_size, vertex_size
    if not 1 <= width <= 8 or not 1 <= height <= 8:
        raise RuntimeError('Synthetic cell dimensions exceed fixture budget')
    CPU.mem_write(STATE, bytes(1024*1024))
    # Separate synthetic primary/secondary descriptor lists, sharing read-only
    # one-row rules. They qualify these cases, not imported asset definitions.
    word(TERRAIN, DICTIONARY)
    word(TERRAIN+4, DICTIONARY)
    word(DICTIONARY+0xc, 18)
    word(DICTIONARY+0x10, KINDS)
    word(RULE_WRAPPER+4, RULES)
    for column in range(4):
        CPU.mem_write(RULES+column*8, struct.pack('<Ihh', 0, 1, 1))
    for terrain_kind in range(18):
        entry = KINDS+terrain_kind*44
        descriptions = DESCRIPTIONS+terrain_kind*256*92
        word(entry, 5000+terrain_kind)
        word(entry+8, 256)
        word(entry+0x20, descriptions)
        for index in range(256):
            descriptor = descriptions+index*92
            word(descriptor+0x48, RULE_WRAPPER)
            CPU.mem_write(descriptor+0x56, struct.pack('<hh', 1, 4))
    # Explicit synthetic compatibility masks rather than assuming that the
    # original startup initialized this BSS table inside the CPU experiment.
    for group in range(16):
        for terrain_kind in range(18):
            word(0x006ce750+(group*18+terrain_kind)*4, 1 << terrain_kind)
    for offset, value in [(0x30, width), (0x34, height), (0x38, width+1),
                          (0x3c, height+1), (0x48, CELLS), (0x4c, VERTICES)]:
        word(TERRAIN+offset, value)
    cell_size, vertex_size = width*height*8, (width+1)*(height+1)*24
    cells = bytearray()
    for y in range(height):
        for x in range(width):
            tile_kind = (0 if (x+y)%3 else 2) if kind == 'mixed' else kind
            cells.extend(struct.pack('<IBBBB', 0x12340000+x+y*width, 0, 0, tile_kind, 1))
    CPU.mem_write(CELLS, bytes(cells))
    vertices = bytes((i*17+23)%256 for i in range(vertex_size))
    CPU.mem_write(VERTICES, vertices)
    CPU.mem_write(RECT, struct.pack('<4i', 0, 0, 0, 0))
    CPU.mem_write(0x006d8e88, b'\x01')  # RNG already initialized by original startup.
    word(0x006d8e80, seed)
    word(0x006d8e84, seed)
    return bytes(cells), vertices


def run(width, height, kind, seed, operation='post-generation', point=(1, 1), stack_fill=0):
    global instructions, rng_calls, cell_writes, rect_writes, vertex_reads
    global propagation_calls, lowest_stack, initial_stack
    original_cells, original_vertices = fixture(width, height, kind, seed)
    instructions, rng_calls, cell_writes, rect_writes, vertex_reads = 0, 0, 0, 0, 0
    visited.clear()
    propagation_calls = 0
    CPU.mem_write(STACK, bytes([stack_fill])*32768)
    sp = STACK+16384
    initial_stack = lowest_stack = sp
    args = [-1]
    entry = 0x005cc330
    if operation in ('placement-cell', 'placement-group'):
        CPU.mem_write(RECT-16, struct.pack('<2i', *point))
        args = [RECT-16, 17 if operation == 'placement-group' else 1, 2, -1, RECT]
        entry = 0x005cc0e0
    for index, value in enumerate([STOP, *args]):
        word(sp+index*4, value)
    CPU.reg_write(UC_X86_REG_ESP, sp)
    CPU.reg_write(UC_X86_REG_ECX, TERRAIN)
    CPU.emu_start(entry, STOP, timeout=MAX_TIME, count=MAX_INSTRUCTIONS)
    if CPU.reg_read(UC_X86_REG_EIP) != STOP or CPU.reg_read(UC_X86_REG_ESP) != sp+4*(1+len(args)):
        raise RuntimeError('Original cell method did not return within budget')
    observed = bytes(CPU.mem_read(CELLS, cell_size))
    vertices = bytes(CPU.mem_read(VERTICES, vertex_size))
    if vertices != original_vertices:
        raise RuntimeError('Cell method changed vertex data')
    for at in range(0, cell_size, 8):
        if original_cells[at:at+4] != observed[at:at+4]:
            raise RuntimeError('Cell method changed opaque pointer word')
    changed = sum(original_cells[at:at+8] != observed[at:at+8] for at in range(0, cell_size, 8))
    altered = [(index % width, index // width) for index in range(width*height)
               if original_cells[index*8:index*8+8] != observed[index*8:index*8+8]]
    bounds = None if not altered else [min(x for x, y in altered), min(y for x, y in altered),
                                      max(x for x, y in altered)+1, max(y for x, y in altered)+1]
    return dict(width=width, height=height, kind=kind, seed=seed, operation=operation,
                point=point, propagationCalls=propagation_calls,
                stackBytesUsed=initial_stack-lowest_stack, changedCellBounds=bounds,
                instructions=instructions, rngCalls=rng_calls,
                rngAfter=word(0x006d8e84), changedCells=changed,
                cellWrites=cell_writes, rectangleWrites=rect_writes,
                rectangle=struct.unpack('<4i', CPU.mem_read(RECT, 16)),
                verticesUnchanged=True, vertexReads=vertex_reads,
                primaryCellWordsUnchanged=True,
                reachedCellUpdate=0x005cb8b0 in visited,
                reachedPropagation=0x005cae10 in visited,
                cellsSha256=hashlib.sha256(observed).hexdigest())


cases = []
for args in [(8, 8, 0, 0x1234), (5, 7, 'mixed', 0xabc), (4, 3, 2, 0x456),
             (6, 6, 0, 0x789, 'placement-cell'), (6, 6, 0, 0x789, 'placement-group'),
             (6, 6, 0, 0x789, 'placement-group', (0, 0)),
             (6, 6, 0, 0x789, 'placement-group', (5, 5)),
             (6, 6, 0, 0x789, 'placement-group', (-1, 2)),
             (6, 6, 0, 0x789, 'placement-group', (6, 2))]:
    first = run(*args)
    repeated = run(*args, stack_fill=0xa5)
    if first != repeated:
        raise RuntimeError('Original cell synthetic replay differs')
    cases.append(first)
if not cases[0]['changedCells'] or not cases[0]['rngCalls'] or not cases[0]['reachedCellUpdate']:
    raise RuntimeError('Post-generation fixture did not exercise real cell updates and RNG')
if not cases[1]['changedCells'] or not cases[1]['reachedCellUpdate']:
    raise RuntimeError('Mixed fixture did not exercise real cell updates')
if not cases[3]['changedCells'] or cases[3]['rectangle'] != (1, 1, 2, 2):
    raise RuntimeError('Placement fixture did not update its cell and affected rectangle')
if cases[2]['rngCalls'] or cases[2]['changedCells']:
    raise RuntimeError('Nonzero cell kind should bypass the post-generation random update')
if not cases[4]['reachedPropagation']:
    raise RuntimeError('Group-changing placement did not reach propagation')
for case in cases[4:7]:
    if not case['propagationCalls'] or case['changedCellBounds'] != [0, 0, 6, 6] or case['rectangle'] != (0, 0, 6, 6):
        raise RuntimeError('Group-changing case did not expose whole-grid propagation')
for case in cases[7:]:
    if case['changedCells'] or case['cellWrites'] or case['rectangleWrites'] or case['propagationCalls'] or case['rngCalls']:
        raise RuntimeError('Invalid placement coordinates affected state')
if hashlib.sha256(EXE.read_bytes()).hexdigest() != AUDIT.PIN:
    raise RuntimeError('Cell executable pin changed')
report = dict(qualification='original post-generation cell paths on synthetic descriptors',
              executableSha256=AUDIT.PIN, pinUnchanged=True,
              sourceSha256={name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest()
                            for name in ['scripts/audit-native-terrain-cells.py',
                                         'scripts/check-native-terrain-cells.py']},
              verifiedInstructionAnchors=audit['verifiedInstructionAnchors'],
              cases=cases, deterministicReplay=True, calls=2*len(cases),
              guestMappedBytes=IMAGE_BYTES+1024*1024+32768+4096,
              maxCallInstructions=MAX_INSTRUCTIONS, maxCallTimeMicros=MAX_TIME,
              largestCallInstructions=max(c['instructions'] for c in cases),
              largestCallStackBytes=max(c['stackBytesUsed'] for c in cases),
              noAllocatorOrImportStubs=True, gameLaunches=0, browserLaunches=0, builds=0,
              propagationQualified=False, syntheticKindZeroPropagationQualified=True,
              stackPoisonReplay=True, safeBorderMutationHookQualified=False,
              limitations=['synthetic small rules and compatibility masks; imported asset behavior unqualified',
                           'RNG preinitialized; time and CRT initialization do not execute',
                           'only synthetic kind-zero propagation is exercised; other branches and imported rules unqualified',
                           'actor-placement stages, safe height mutation hook and live paging unqualified'])
(ROOT/'output/native-terrain-cells-emulated-observed.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(dict(passed=True, calls=report['calls'], changedCells=[c['changedCells'] for c in cases],
                     largestCallInstructions=report['largestCallInstructions'], gameLaunches=0)))
