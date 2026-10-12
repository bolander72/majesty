#!/usr/bin/env python3
"""Tiny original common-dispatch fixture; leaf updates are modeled, never run."""
import hashlib
import json
from pathlib import Path
import struct
import capstone
import pefile
from unicorn import (Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE,
                     UC_HOOK_MEM_READ, UC_HOOK_MEM_WRITE, UC_PROT_READ, UC_PROT_EXEC)
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX,
                              UC_X86_REG_EDX, UC_X86_REG_ESI, UC_X86_REG_EDI,
                              UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_EIP,
                              UC_X86_REG_EFLAGS)

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT = ROOT / 'output/native-order-dispatch-clock-emulated-observed.json'
DATA, STACK, STOP = 0x100000, 0x200000, 0x300000
BANK, TABLE, OWNER, LEAF = DATA + 128, DATA + 256, 0x12345678, STOP + 16
CLOCK, START, END = 0x71c6a8, 0x5e53c0, 0x5e53f6
PAGES = [DATA, STACK, STOP, START & ~4095, CLOCK & ~4095]
PRESERVED = [UC_X86_REG_EBX, UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP]
MASK = 0xffffffff


def main():
    OUTPUT.unlink(missing_ok=True)
    raw = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Requires pinned original Majesty executable')
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    assert struct.unpack('<I', pe.get_data(0x683148 + 0x50 - base, 4))[0] == START
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    native = pe.get_data(START - base, END - START)
    decoded = list(decoder.disasm(native, START))
    assert sum(i.size for i in decoded) == END - START
    rows = {i.address: (i.mnemonic, i.op_str) for i in decoded}
    anchors = {0x5e53c4: ('mov', 'edx, dword ptr [eax + 0x10]'),
               0x5e53cb: ('mov', 'edx, dword ptr [0x71c6a8]'),
               0x5e53d2: ('mov', 'esi, dword ptr [eax + 8]'),
               0x5e53d5: ('sub', 'edx, esi'),
               0x5e53d7: ('mov', 'esi, dword ptr [eax + 0xc]'),
               0x5e53da: ('cmp', 'esi, edx'),
               0x5e53dd: ('ja', '0x5e53f3'),
               0x5e53df: ('test', 'byte ptr [eax + 0x18], 1'),
               0x5e53f0: ('call', 'dword ptr [edx + 0x18]')}
    assert all(rows[at] == pair for at, pair in anchors.items())
    # The debug receiver is the embedded base at order+4.
    debug_raw = pe.get_data(0x5ded85 - base, 0x5dedcd - 0x5ded85)
    debug = list(decoder.disasm(debug_raw, 0x5ded85))
    assert sum(i.size for i in debug) == len(debug_raw)
    debug_rows = {i.address: (i.mnemonic, i.op_str) for i in debug}
    for address, label, load, operands in [
            (0x6ceaec, '_rate', 0x5ded85, 'ecx, dword ptr [esi + 0x10]'),
            (0x6ceae0, '_when', 0x5ded97, 'edx, dword ptr [esi + 4]'),
            (0x6cead0, '_delta', 0x5deda9, 'eax, dword ptr [esi + 8]'),
            (0x6ceac4, '_info', 0x5dedbb, 'ecx, dword ptr [esi + 0x14]')]:
        assert debug_rows[load] == ('mov', operands)
        assert pe.get_data(address - base, 32).split(b'\0', 1)[0] == ('\r\n' + label + ': %d').encode()
    writer_path = ROOT / 'output/native-order-writers-emulated-observed.json'
    writers = json.loads(writer_path.read_text())
    assert writers['qualified'] and writers['completedCalls'] == 20 and writers['executableSha256'] == PIN
    for name, digest in writers['sourceSha256'].items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
    for replay in writers['replays']:
        at = 6 if replay['kind'] == 11 else 5
        assert replay['words'][at - 1:at + 3] == [0x11000014, 0x11000008, 0x1100000c, 0x11000018]

    # Synthetic stopped clocks only: zero, wrap, future-looking stamps,
    # unsigned maximum delay, kind-zero skip, and the pause bit.
    cases = [(k, 1000, 9000, 901, 100, 0) for k in [1, 2, 4, 5, 6, 7, 10, 11]]
    cases += [(6, 100, 0, 0, 100, 0), (6, 0, MASK, MASK, 1, 0),
              (6, 0, 9000, 10, MASK - 9, 0), (10, 1000, 9000, 900, 100, 1),
              (10, 1000, 9000, 1000, MASK, 0), (0, 0, 0, 0, 0, 0)]
    original_total = calls = dispatched = 0
    observations = []
    for kind, source, destination, when, delta, info in cases:
        after = (destination - ((source - when) & MASK)) & MASK
        for advance in [0, 1, 100, 0x80000000, MASK]:
            expected = bool(kind and not info & 1 and delta <= ((source + advance - when) & MASK))
            observed = []
            for poison in [0x5a, 0xc3]:
                for clock, stamp in [((source + advance) & MASK, when),
                                     ((destination + advance) & MASK, after)]:
                    cpu = Uc(UC_ARCH_X86, UC_MODE_32)
                    hooks = []
                    try:
                        for page in PAGES:
                            cpu.mem_map(page, 4096)
                        assert sum(end - start + 1 for start, end, _ in cpu.mem_regions()) == 20480
                        cpu.mem_write(START, native)
                        cpu.mem_write(LEAF, b'\xc3')
                        cpu.mem_write(DATA, bytes([poison]) * 4096)
                        cpu.mem_write(STACK, bytes([poison]) * 4096)

                        def word(at, value=None):
                            if value is not None:
                                cpu.mem_write(at, struct.pack('<I', value & MASK))
                            return struct.unpack('<I', cpu.mem_read(at, 4))[0]

                        for at, value in [(DATA, TABLE), (DATA + 8, stamp), (DATA + 12, delta),
                                          (DATA + 16, kind), (DATA + 24, info),
                                          (BANK + 4, OWNER), (TABLE + 24, LEAF), (CLOCK, clock)]:
                            word(at, value)
                        before = bytes(cpu.mem_read(DATA, 4096))
                        for page in [STOP, START & ~4095, CLOCK & ~4095]:
                            cpu.mem_protect(page, 4096, UC_PROT_READ | UC_PROT_EXEC)
                        steps = leaf_calls = 0

                        def inside(at, size, start, length):
                            return start <= at and at + size <= start + length

                        def code(uc, at, size, context):
                            nonlocal steps, leaf_calls, original_total
                            steps += 1
                            assert steps <= 64
                            sp = uc.reg_read(UC_X86_REG_ESP)
                            assert STACK + 512 <= sp <= STACK + 3584
                            if at == LEAF:
                                assert uc.reg_read(UC_X86_REG_ECX) == DATA
                                assert [word(sp + 4), word(sp + 8), word(sp + 12)] == [OWNER, BANK, 0]
                                leaf_calls += 1
                                assert leaf_calls == 1
                                uc.reg_write(UC_X86_REG_EIP, word(sp))
                                uc.reg_write(UC_X86_REG_ESP, sp + 16)
                                for reg in [UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EDX]:
                                    uc.reg_write(reg, poison * 0x01010101)
                                return
                            assert at in rows, 'Dispatch escaped pinned code'
                            original_total += 1
                            assert original_total <= 20000

                        def read(uc, access, at, size, value, context):
                            assert any(inside(at, size, start, length) for start, length in
                                       [(DATA, 28), (BANK, 8), (TABLE, 28), (CLOCK, 4), (STACK, 4096)])

                        def write(uc, access, at, size, value, context):
                            assert inside(at, size, STACK, 4096), 'Dispatch wrote outside stack'

                        hooks = [cpu.hook_add(UC_HOOK_CODE, code), cpu.hook_add(UC_HOOK_MEM_READ, read),
                                 cpu.hook_add(UC_HOOK_MEM_WRITE, write)]
                        sp = STACK + 3072
                        word(sp, STOP)
                        word(sp + 4, DATA)
                        for reg in PRESERVED:
                            cpu.reg_write(reg, poison * 0x01010101)
                        cpu.reg_write(UC_X86_REG_ECX, BANK)
                        cpu.reg_write(UC_X86_REG_ESP, sp)
                        cpu.reg_write(UC_X86_REG_EFLAGS, 0x202)
                        cpu.emu_start(START, STOP, timeout=1000000, count=64)
                        assert cpu.reg_read(UC_X86_REG_EIP) == STOP and cpu.reg_read(UC_X86_REG_ESP) == sp + 8
                        assert all(cpu.reg_read(reg) == poison * 0x01010101 for reg in PRESERVED)
                        assert bytes(cpu.mem_read(DATA, 4096)) == before and word(CLOCK) == clock
                        assert bool(leaf_calls) == expected
                        observed.append(bool(leaf_calls))
                        calls += 1
                        dispatched += leaf_calls
                    finally:
                        for hook in hooks:
                            cpu.hook_del(hook)
                        for page in PAGES:
                            cpu.mem_unmap(page, 4096)
                        assert list(cpu.mem_regions()) == []
                        cpu = None
            assert len(set(observed)) == 1
            observations.append(dict(kind=kind,sourceClockMs=source,destinationClockMs=destination,
                                     when=when,after=after,delta=delta,info=info,advance=advance,dispatchDue=expected))
    report = dict(qualified=True, scope='original common dispatcher only; synthetic clock snapshots; modeled leaf update',
                  executableSha256=PIN, completedCalls=calls, originalInstructions=original_total,
                  modeledLeafCalls=dispatched, mappedGuestBytesPeak=20480, mappedGuestBytesAfterCleanup=0,
                  writerHeaderChecks=20, dispatchAnchors=len(anchors), observations=observations,
                  sourceSha256={'scripts/check-native-order-dispatch-clock.py': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
                  writerEvidenceSha256=hashlib.sha256(writer_path.read_bytes()).hexdigest(),
                  actualStoppedClockCaptureQualified=False,leafUpdatesExecuted=False,
                  completeOrderMigrationQualified=False,liveHeroCrossingQualified=False,
                  gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False)
    OUTPUT.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['qualified', 'completedCalls', 'originalInstructions',
                                          'modeledLeafCalls', 'mappedGuestBytesPeak', 'gameLaunched']}))


if __name__ == '__main__':
    main()
