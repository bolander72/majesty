#!/usr/bin/env python3
"""Compare original normal/shading finalization on bounded halo/reference grids."""
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct

import capstone
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESP,
                              UC_X86_REG_EIP, UC_X86_REG_FPCW, UC_X86_REG_FPSW,
                              UC_X86_REG_FPTAG)

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('normal_audit', ROOT/'scripts/audit-native-terrain-lifecycle.py')
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
EXE = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
audit = AUDIT.audit(EXE)
data = EXE.read_bytes()
if hashlib.sha256(data).hexdigest() != AUDIT.PIN:
    raise RuntimeError('Pinned executable changed before normal CPU setup')
PE = pefile.PE(data=data)
BASE = PE.OPTIONAL_HEADER.ImageBase
IMAGE_BYTES = (PE.OPTIONAL_HEADER.SizeOfImage+4095)//4096*4096
if IMAGE_BYTES > 4*1024*1024:
    raise RuntimeError('Normal guest image budget exceeded')
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
addresses = {int(row['address'], 16): row for group in audit['ranges'] for row in group['instructions']}
for insn in decoder.disasm(PE.get_data(0x0064cc94-BASE, 0x27), 0x0064cc94):
    addresses[insn.address] = dict(address=f'{insn.address:08x}', mnemonic=insn.mnemonic, operands=insn.op_str, bytes=insn.bytes.hex())
extra_anchors = [
    (0x005aecc5, 'fld', 'dword ptr [eax + 0x14]'),
    (0x005aeccc, 'fld', 'dword ptr [eax + 0x18]'),
    (0x005aecd3, 'fld', 'dword ptr [eax + 0x1c]'),
    (0x005aed2f, 'jge', '0x5aeff6'),
    (0x005aefea, 'cmp', 'ebp, eax'),
    (0x005af142, 'xor', 'edx, ebp'),
    (0x005af14b, 'test', 'dl, 1'),
    (0x0064cca3, 'or', 'ah, 0xc'),
    (0x0064ccad, 'fistp', 'qword ptr [ebp - 0xc]'),
    (0x0064ccb0, 'fldcw', 'word ptr [ebp - 2]'),
    (0x0064ccba, 'ret', ''),
]
for at, mnemonic, operands in extra_anchors:
    row = addresses.get(at)
    if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
        raise RuntimeError(f'Pinned normal anchor changed at {at:08x}')
inputs_path = ROOT/'output/native-normal-halo-inputs.json'
inputs = json.loads(inputs_path.read_text())
if inputs.get('synthetic') is not True or len(inputs.get('cases', [])) != 3:
    raise RuntimeError('Invalid normal input cases')
for name, digest in inputs['sourcesSha256'].items():
    if name not in ['web/world/terrain-halo.mjs', 'web/world/native-height.mjs'] or hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != digest:
        raise RuntimeError('Shipped normal input sources changed; prepare again')
STATE, STACK, ARENA, STOP = 0x01000000, 0x02000000, 0x03000000, 0x04000000
TERRAIN, CONFIG, VERTICES = STATE, STATE+0x100, STATE+0x1000
CPU = Uc(UC_ARCH_X86, UC_MODE_32)
CPU.mem_map(BASE, IMAGE_BYTES)
CPU.mem_write(BASE, PE.get_memory_mapped_image())
for at, size in [(STATE, 131072), (STACK, 65536), (ARENA, 8192), (STOP, 4096)]:
    CPU.mem_map(at, size)
ALLOWED = [(0x005aebe0, 0x005af010), (0x005af010, 0x005af1cc),
           (0x005685b0, 0x00568653), (0x0064cc94, 0x0064ccbb)]
calls, allocations, frees = 0, 0, 0
total_instructions, call_instructions, largest_call = 0, 0, 0
allocated, allocation_bytes, largest_workspace = False, 0, 0


def word(at, value=None):
    if value is not None:
        CPU.mem_write(at, struct.pack('<I', value & 0xffffffff))
    return struct.unpack('<I', CPU.mem_read(at, 4))[0]


def hook(cpu, address, size, context):
    global total_instructions, call_instructions, allocated, allocation_bytes
    global allocations, frees, largest_workspace
    total_instructions += 1
    call_instructions += 1
    if call_instructions > 3_000_000:
        raise RuntimeError('Original normal instruction budget exceeded')
    if address in (0x0064d59f, 0x0064d4b6):
        sp = cpu.reg_read(UC_X86_REG_ESP)
        arg = word(sp+4)
        if address == 0x0064d59f:
            if allocated or not 0 < arg <= 3264:
                raise RuntimeError('Normal workspace allocation budget exceeded')
            allocated, allocation_bytes = True, arg
            CPU.mem_write(ARENA, bytes([0x5a])*8192)
            cpu.reg_write(UC_X86_REG_EAX, ARENA)
            allocations += 1
            largest_workspace = max(largest_workspace, arg)
        else:
            if not allocated or arg != ARENA:
                raise RuntimeError('Unexpected normal workspace free')
            allocated, allocation_bytes = False, 0
            frees += 1
        cpu.reg_write(UC_X86_REG_EIP, word(sp))
        cpu.reg_write(UC_X86_REG_ESP, sp+4)
        return
    if not any(start <= address < end for start, end in ALLOWED):
        raise RuntimeError(f'Unexpected original normal code {address:08x}')


CPU.hook_add(UC_HOOK_CODE, hook)


def guest_bytes(at, size):
    parts = bytearray()
    for offset in range(0, size, 4096):
        parts.extend(CPU.mem_read(at+offset, min(4096, size-offset)))
    return bytes(parts)


def finalize(grid, light):
    global calls, call_instructions, largest_call
    width, height, stride = grid['width'], grid['height'], grid['stride']
    if not 1 <= width <= 68 or not 1 <= height <= 68 or stride != width+1 or len(grid['heights']) != stride*(height+1):
        raise RuntimeError('Invalid bounded normal grid')
    if len(light) != 3 or any(not math.isfinite(value) for value in light):
        raise RuntimeError('Invalid normal light fixture')
    payload = bytearray([0x5a])*(stride*(height+1)*24)
    for index, value in enumerate(grid['heights']):
        if not isinstance(value, int) or not -2147483648 <= value <= 2147483520:
            raise RuntimeError('Invalid normal Q16 fixture height')
        struct.pack_into('<iI3fB', payload, index*24, value, 0x12345678, 0, 1, 0, 17)
    CPU.mem_write(VERTICES, bytes(payload))
    for offset, value in [(0x30, width), (0x34, height), (0x38, stride), (0x3c, height+1), (0x4c, VERTICES)]:
        word(TERRAIN+offset, value)
    CPU.mem_write(CONFIG+0x14, struct.pack('<3f', *light))
    sp = STACK+32768
    for index, value in enumerate([STOP, CONFIG, 0]):
        word(sp+index*4, value)
    CPU.reg_write(UC_X86_REG_ESP, sp)
    CPU.reg_write(UC_X86_REG_ECX, TERRAIN)
    CPU.reg_write(UC_X86_REG_FPCW, 0x037f)
    CPU.reg_write(UC_X86_REG_FPSW, 0)
    CPU.reg_write(UC_X86_REG_FPTAG, 0xffff)
    call_instructions = 0
    CPU.emu_start(0x005aebe0, STOP, timeout=3_000_000, count=3_000_000)
    if CPU.reg_read(UC_X86_REG_EIP) != STOP or CPU.reg_read(UC_X86_REG_ESP) != sp+12 or allocated:
        raise RuntimeError('Normal finalization did not return and release workspace')
    largest_call = max(largest_call, call_instructions)
    calls += 1
    observed = guest_bytes(VERTICES, len(payload))
    for at in range(0, len(payload), 24):
        if observed[at:at+8] != payload[at:at+8] or observed[at+21:at+24] != payload[at+21:at+24]:
            raise RuntimeError('Normal finalizer changed a primary/reserved vertex field')
    return observed


def sample(payload, grid, gx, gy):
    x, y = gx-grid['originX'], gy-grid['originY']
    if not 0 <= x <= grid['width'] or not 0 <= y <= grid['height']:
        raise RuntimeError('Normal sample outside captured grid')
    at = (y*grid['stride']+x)*24
    return payload[at+8:at+21]


reports = []
for case in inputs['cases']:
    reference = case['reference']
    result = finalize(reference, case['light'])
    halo_results, matches, independent_differences, independent_interior = [], 0, 0, 0
    first_independent_difference = None
    if len(case['halos']) != 4 or len(case['independent']) != 4:
        raise RuntimeError('Invalid four-window normal fixture')
    for halo, separate in zip(case['halos'], case['independent']):
        derived, independent = finalize(halo, case['light']), finalize(separate, case['light'])
        core_hash = hashlib.sha256()
        for y in range(33):
            for x in range(33):
                gx, gy = separate['originX']+x, separate['originY']+y
                expected = sample(result, reference, gx, gy)
                observed = sample(derived, halo, gx, gy)
                if observed != expected:
                    raise RuntimeError(f'Native halo differs from reference at {gx},{gy}')
                core_hash.update(observed)
                matches += 1
                if sample(independent, separate, gx, gy) != expected:
                    independent_differences += 1
                    if first_independent_difference is None:
                        first_independent_difference = dict(x=x, y=y, expected=expected.hex(),
                            independent=sample(independent, separate, gx, gy).hex())
                    if 0 < x < 32 and 0 < y < 32:
                        independent_interior += 1
        halo_results.append(dict(originX=halo['originX'], originY=halo['originY'], coreSha256=core_hash.hexdigest()))
    if independent_differences == 0:
        raise RuntimeError('Normal fixture did not expose missing-neighbour geometry')
    # Keep the failed one-cell experiment as a boundary regression. Both
    # origins have even x^y parity, so diagonal selection stays aligned.
    baseline = case['oneCellBaseline']
    if (baseline['originX'], baseline['originY'], baseline['width'], baseline['height']) != (
            case['baseX']*32-1, case['baseY']*32-1, 34, 34):
        raise RuntimeError('Invalid one-cell boundary regression')
    baseline_result = finalize(baseline, case['light'])
    baseline_differences, first_baseline_difference = 0, None
    for y in range(33):
        for x in range(33):
            gx, gy = case['baseX']*32+x, case['baseY']*32+y
            if sample(baseline_result, baseline, gx, gy) != sample(result, reference, gx, gy):
                baseline_differences += 1
                if first_baseline_difference is None:
                    first_baseline_difference = dict(x=x, y=y)
    if baseline_differences == 0 or first_baseline_difference['y'] != 32:
        raise RuntimeError('One-cell fixture did not expose the final-row normal boundary')
    reports.append(dict(baseX=case['baseX'], baseY=case['baseY'], haloCoreMatches=matches,
                        independentDifferences=independent_differences,
                        independentInteriorDifferences=independent_interior,
                        firstIndependentDifference=first_independent_difference,
                        oneCellBaselineDifferences=baseline_differences,
                        firstOneCellBaselineDifference=first_baseline_difference,
                        allFourCoresReferenceExact=True, sharedEdgesAndCornerReferenceExact=True, cores=halo_results))
if allocations != frees or allocated or hashlib.sha256(EXE.read_bytes()).hexdigest() != AUDIT.PIN:
    raise RuntimeError('Normal workspace or executable pin not preserved')
report = dict(qualification='original normal/shading finalizer with synthetic grid data in one bounded CPU emulator',
              executableSha256=AUDIT.PIN, pinUnchanged=True, sourcesSha256=inputs['sourcesSha256'],
              inputSha256=hashlib.sha256(inputs_path.read_bytes()).hexdigest(),
              verifiedInstructionAnchors=audit['verifiedInstructionAnchors']+len(extra_anchors),
              cases=reports, coreSamples=sum(case['haloCoreMatches'] for case in reports),
              primaryAndReservedFieldsUnchanged=True,
              resources=dict(guestMappedBytes=IMAGE_BYTES+131072+65536+8192+4096,
                             finalizerCalls=calls, workspaceAllocations=allocations, workspaceFrees=frees,
                             largestWorkspaceBytes=largest_workspace, finalWorkspaceBytes=allocation_bytes,
                             largestCallInstructions=largest_call, totalInstructions=total_instructions,
                             maxCallInstructions=3_000_000, maxCallTimeMicros=3_000_000,
                             haloQ16InputBytes=5476, haloNativeVertexBytes=37*37*24),
              gameLaunches=0, browserLaunches=0, builds=0,
              limitations=['synthetic geometry; no newly generated or modified saved kingdom is loaded',
                           'common synthetic light and even window parity; other light/control settings not qualified',
                           'no native hook, actor/navigation changes, material joins, world paging or co-op handoff',
                           'allocator is a controlled workspace stub; not browser/native heap or GPU accounting'])
(ROOT/'output/native-normal-halo-emulated-observed.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(dict(passed=True, coreSamples=report['coreSamples'], largestWorkspaceBytes=largest_workspace,
                      finalWorkspaceBytes=allocation_bytes, largestCallInstructions=largest_call, gameLaunches=0)))
