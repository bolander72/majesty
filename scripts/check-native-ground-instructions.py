#!/usr/bin/env python3
"""Execute pinned original ground interpolation in a bounded CPU emulator."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
from unittest.mock import patch
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_READ, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('ground_audit', ROOT / 'scripts/audit-native-ground.py')
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
STATE, STACK, STOP = 0x01000000, 0x02000000, 0x03000000
TERRAIN, OUTPUT, VERTICES = STATE, STATE + 0x100, STATE + 0x200


def signed(n):
    return (n + 2147483648) % 4294967296 - 2147483648


def oracle(x, y, heights):
    a, b, c, d = heights
    fx, fy = x & 65535, y & 65535
    if ((x >> 16) ^ (y >> 16)) & 1:
        if fx + fy < 65536:
            base, terms = a, [(fy, c), (fx, b)]
        else:
            base, terms = d, [(65536 - fy, b), (65536 - fx, c)]
    elif fx > fy:
        base, terms = b, [(fy, d), (65536 - fx, a)]
    else:
        base, terms = c, [(65536 - fy, a), (fx, d)]
    return signed(base + sum(signed((weight * signed(height - base)) >> 16) for weight, height in terms))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Preserve prior ground evidence')
    audit = AUDIT.audit()
    executable = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    raw = executable.read_bytes()
    if hashlib.sha256(raw).hexdigest() != AUDIT.PIN:
        raise ValueError('Pin changed before CPU construction')
    pe = pefile.PE(data=raw)
    base, image = pe.OPTIONAL_HEADER.ImageBase, pe.get_memory_mapped_image()
    size = (pe.OPTIONAL_HEADER.SizeOfImage + 4095) // 4096 * 4096
    if size > 4 * 1024 * 1024:
        raise ValueError('CPU image budget exceeded')
    cpu = Uc(UC_ARCH_X86, UC_MODE_32)
    mappings = [(base, size), (STATE, 4096), (STACK, 4096), (STOP, 4096)]
    for address, length in mappings:
        cpu.mem_map(address, length)
    cpu.mem_write(base, image)
    steps, largest, total, read_count, writes = 0, 0, 0, 0, []
    mode = 'query'
    allowed = [(start, end) for _, start, end in AUDIT.RANGES[:4]]

    def code(uc, at, length, context):
        nonlocal steps
        steps += 1
        ranges = allowed if mode == 'query' else [(0x5f2b4b, 0x5f2bae)]
        if steps > 400 or not any(start <= at < end for start, end in ranges):
            raise ValueError(f'Unexpected/over-budget original ground instruction {at:08x}')

    def read(uc, access, at, length, value, context):
        nonlocal read_count
        read_count += 1
        ranges = [(STACK, STACK + 4096), (STATE, STATE + 4096)]
        if mode == 'reader':
            ranges.append((base, base + size))
        if not any(start <= at and at + length <= end for start, end in ranges):
            raise ValueError('Unexpected original ground data read')

    def write(uc, access, at, length, value, context):
        if not (STACK <= at and at + length <= STACK + 4096) and not (mode == 'query' and at == OUTPUT and length == 4):
            raise ValueError('Unexpected original ground data write')
        if at == OUTPUT:
            writes.append((at, length))

    handles = [cpu.hook_add(UC_HOOK_CODE, code), cpu.hook_add(UC_HOOK_MEM_READ, read), cpu.hook_add(UC_HOOK_MEM_WRITE, write)]

    def word(at, n):
        cpu.mem_write(at, struct.pack('<I', n & 0xffffffff))

    def run(start, end, ecx, parameters=()):
        nonlocal steps, largest, total
        sp = STACK + 2048
        cpu.mem_write(STACK, bytes([0xc3]) * 4096)
        for i, n in enumerate([STOP, *parameters]):
            word(sp + i * 4, n)
        cpu.reg_write(UC_X86_REG_ECX, ecx)
        cpu.reg_write(UC_X86_REG_ESP, sp)
        cpu.reg_write(UC_X86_REG_FPCW, 0x037f)
        cpu.reg_write(UC_X86_REG_FPSW, 0)
        cpu.reg_write(UC_X86_REG_FPTAG, 0xffff)
        steps = 0
        cpu.emu_start(start, end, timeout=100000, count=401)
        if cpu.reg_read(UC_X86_REG_EIP) != end:
            raise ValueError('Original ground routine did not finish')
        largest, total = max(largest, steps), total + steps
        return sp

    def query(x, y, heights, outside=False):
        nonlocal mode
        mode = 'query'
        cpu.mem_write(STATE, bytes([0xa5]) * 4096)
        for offset, value in [(0x30, 4), (0x34, 4), (0x38, 5), (0x4c, VERTICES)]:
            word(TERRAIN + offset, value)
        # Only the four actual corner heights are initialized. Local cell parity
        # is preserved without constructing an entire terrain or game world.
        cellx, celly = (x >> 16) & 1, (y >> 16) & 1
        qx, qy = cellx * 65536 + (x & 65535), celly * 65536 + (y & 65535)
        for (dx, dy), value in zip([(0, 0), (1, 0), (0, 1), (1, 1)], heights):
            word(VERTICES + ((celly + dy) * 5 + cellx + dx) * 24, value)
        before = bytes(cpu.mem_read(STATE, 4096))
        writes.clear()
        sp = run(0x5af220, STOP, TERRAIN, (OUTPUT, x if outside else qx, y if outside else qy))
        result = struct.unpack('<i', cpu.mem_read(OUTPUT, 4))[0]
        after = bytearray(cpu.mem_read(STATE, 4096)); after[OUTPUT - STATE:OUTPUT - STATE + 4] = before[OUTPUT - STATE:OUTPUT - STATE + 4]
        if (bytes(after) != before or writes != [(OUTPUT, 4)] or cpu.reg_read(UC_X86_REG_EAX) != OUTPUT or cpu.reg_read(UC_X86_REG_ESP) != sp + 16):
            raise ValueError('Original interpolation changed terrain/sentinels/ABI')
        expected = 0 if outside else oracle(x, y, heights)
        if result != expected:
            raise ValueError('Original interpolation disagrees with integer oracle')
        return result

    vectors, samples = [], []
    fixture_path = ROOT / 'output/native-actor-ground-fixtures.json'
    fixture_raw = fixture_path.read_bytes()
    fixture = json.loads(fixture_raw)
    try:
        for cellx in [0, 1]:
            for fx, fy in [(0, 0), (1, 0), (0, 1), (65535, 65535), (49152, 16384), (16384, 49152),
                           (16384, 16384), (49152, 49152), (32768, 32768), (32768, 32767), (32767, 32768)]:
                for heights in [[0, 65536, 196608, -65536], [-1, 0, -7, 13],
                                [2147483647, -2147483648, 2147483600, -2147483600]]:
                    x, y = cellx * 65536 + fx, fy
                    vectors.append(dict(xQ16=x, yQ16=y, heights=heights, observedQ16=query(x, y, heights)))
        fallback = []
        for x, y in [(-1, 0), (0, -1), (3 * 65536, 0), (0, 3 * 65536), (2147483647, 0)]:
            fallback.append(dict(xQ16=x, yQ16=y, observedQ16=query(x, y, [0, 0, 0, 0], True)))
        for c in fixture['cases']:
            for label in ['source', 'destination']:
                sample = c[label]
                converted = []
                for bits in sample['heightBits']:
                    mode = 'reader'
                    run(0x5f2b4b, 0x5f2bae, bits)
                    converted.append(signed(cpu.reg_read(UC_X86_REG_EAX)))
                if converted != sample['heights']:
                    raise ValueError('Copied vertex heights differ from original reader')
                position = sample['position']
                observed = query(position['x'], position['y'], converted)
                if observed != sample['groundQ16']:
                    raise ValueError('Actual copied terrain sample differs from original query')
                samples.append(dict(id=c['id'], checkpoint=label, position=position, heights=converted, observedQ16=observed))
        with tempfile.TemporaryDirectory(prefix='ground-pin-', dir=ROOT / 'output') as temp:
            bad = Path(temp) / 'wrong.exe'; bad.write_bytes(b'unpinned ground input')
            with patch.object(AUDIT.pefile, 'PE', side_effect=AssertionError('must not decode')) as decoder:
                try:
                    AUDIT.audit(bad)
                    raise AssertionError('Unpinned ground input accepted')
                except ValueError:
                    pass
                assert decoder.call_count == 0
    finally:
        for handle in handles:
            cpu.hook_del(handle)
        for address, length in mappings:
            cpu.mem_unmap(address, length)
    if list(cpu.mem_regions()) or hashlib.sha256(executable.read_bytes()).hexdigest() != AUDIT.PIN:
        raise ValueError('Guest mappings retained or executable changed')
    report = dict(qualified=True, executableSha256=AUDIT.PIN, instructionAnchors=audit['verifiedInstructionAnchors'],
                  vectors=vectors, fallbackCases=fallback, copiedTerrainSamples=samples,
                  originalHeightReaderCalls=32, originalGroundQueries=len(vectors) + len(fallback) + len(samples),
                  fixtureMetadataSha256=hashlib.sha256(fixture_raw).hexdigest(), terrainAndSentinelsUnchanged=True,
                  unpinnedInputRejectedBeforePeDecode=True, originalInstructions=total, largestCallInstructions=largest,
                  maxInstructionsPerCall=400, maxCallTimeMicros=100000, dataReads=read_count,
                  mappedGuestBytesPeak=sum(n for _, n in mappings), mappedGuestBytesAfterCleanup=0,
                  gameLaunches=0, browserLaunches=0, builds=0,
                  scope='Original pure ground query and inline height reader in isolated CPU state; four actual corner heights, synthetic terrain receiver; no original world/actor placement execution')
    with args.output.open('x') as f:
        json.dump(report, f, indent=2); f.write('\n')
    print(json.dumps(dict(qualified=True, originalGroundQueries=report['originalGroundQueries'], actualCornerSamples=len(samples), largestCallInstructions=largest)))


if __name__ == '__main__':
    main()
