#!/usr/bin/env python3
"""Read selected existing crash reports and tiny UUID-matched code windows."""
import base64
import hashlib
import json
from pathlib import Path
import struct
import uuid

import capstone

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ['ChatGPT-2026-10-03-080315.ips', 'ChatGPT-2026-10-03-083853.ips',
           'ChatGPT-2026-10-03-084632.ips']
KNOWN_UUID = '4c4c4451-5555-3144-a1c5-16973e763bc6'
FRAME_OFFSETS = [150142536, 150142536, 150142560, 150142588,
                 150153064, 150143740, 66556]
ANCHORS = {
    150142524: ('str', 'x0, [sp, #8]'),
    150142536: ('brk', '#0'),
    150142540: ('hlt', '#0'),
    150142544: ('brk', '#1'),
    150142556: ('bl', '#0x8f2fe30'),
    150142572: ('mov', 'x19, x0'),
    150142580: ('mov', 'x0, x19'),
    150142584: ('bl', '#0x8f2fe54'),
    150152880: ('mov', 'x19, x1'),
    150152888: ('ldr', 'x8, [x0, #0x1620]'),
    150152892: ('ldr', 'x9, [x0, #0x1628]'),
    150152900: ('mov', 'x9, #0x6176'),
    150152904: ('movk', 'x9, #0x735f, lsl #16'),
    150152908: ('movk', 'x9, #0x7a69, lsl #32'),
    150152912: ('movk', 'x9, #0x65, lsl #48'),
    150152940: ('mov', 'w8, #0x6c61'),
    150152944: ('movk', 'w8, #0x6f6c, lsl #16'),
    150152976: ('mov', 'w8, #0x6f63'),
    150152980: ('movk', 'w8, #0x6d6d, lsl #16'),
    150153008: ('stp', 'x21, x19, [sp]'),
    150153012: ('mov', 'w8, #0x6973'),
    150153016: ('movk', 'w8, #0x657a, lsl #16'),
    150153056: ('mov', 'x0, x19'),
    150153060: ('bl', '#0x8f2fe60'),
    150143704: ('mov', 'x19, x1'),
    150143728: ('mov', 'x0, x20'),
    150143732: ('mov', 'x1, x19'),
    150143736: ('bl', '#0x8f3269c'),
    66544: ('mov', 'x0, x20'),
    66548: ('mov', 'w1, #0x200000'),
    66552: ('bl', '#0x800f5bc'),
}


def layout(file):
    header = file.read(32)
    slice_offset = 0
    if header[:4] in (b'\xca\xfe\xba\xbe', b'\xca\xfe\xba\xbf'):
        count = struct.unpack('>I', header[4:8])[0]
        wide = header[:4] == b'\xca\xfe\xba\xbf'
        if not 1 <= count <= 8:
            raise ValueError('Mach-O architecture budget exceeded')
        file.seek(8)
        entries = file.read(count*(32 if wide else 20))
        for i in range(count):
            entry = entries[i*(32 if wide else 20):(i+1)*(32 if wide else 20)]
            if struct.unpack('>I', entry[:4])[0] == 0x0100000c:
                slice_offset = struct.unpack('>Q' if wide else '>I', entry[8:16] if wide else entry[8:12])[0]
                break
        else:
            raise ValueError('Missing arm64 framework slice')
        file.seek(slice_offset)
        header = file.read(32)
    if header[:4] != b'\xcf\xfa\xed\xfe':
        raise ValueError('Unsupported framework layout')
    _, cpu, _, _, count, size, _, _ = struct.unpack('<8I', header)
    if cpu != 0x0100000c or size > 1024*1024 or count > 4096:
        raise ValueError('Framework header budget exceeded')
    commands = file.read(size)
    offset, image_uuid, segments = 0, None, []
    for _ in range(count):
        command, length = struct.unpack_from('<II', commands, offset)
        if length < 8 or offset+length > size:
            raise ValueError('Invalid Mach-O load command')
        if command == 0x1b:
            image_uuid = str(uuid.UUID(bytes=commands[offset+8:offset+24]))
        if command == 0x19:
            name = commands[offset+8:offset+24].split(b'\0', 1)[0].decode()
            vm, vm_size, file_offset, file_size = struct.unpack_from('<4Q', commands, offset+24)
            segments.append(dict(name=name, vm=vm, vmSize=vm_size, fileOffset=file_offset, fileSize=file_size))
        offset += length
    text = next(s for s in segments if s['name'] == '__TEXT')
    return image_uuid, slice_offset, text['vm'], segments, 32+size


def inspect(name):
    path = Path.home()/'Library/Logs/DiagnosticReports'/name
    result = dict(report=name, binaryPathMatched=False, allocatorPathMatched=False)
    if not path.is_file():
        return {**result, 'available': False}
    if path.stat().st_size > 4*1024*1024:
        raise ValueError('Crash report budget exceeded')
    with path.open() as file:
        file.readline()
        report = json.load(file)
    thread = report['threads'][report['faultingThread']]
    frames = thread['frames']
    image = report['usedImages'][frames[0]['imageIndex']]
    result.update(available=True, threadName=thread.get('name'),
                  exception=report.get('exception', {}).get('type'), imageUuid=image.get('uuid'))
    framework = Path(image['path'])
    if image.get('name') != 'Codex Framework' or not str(framework).startswith('/Applications/ChatGPT.app/Contents/Frameworks/'):
        raise ValueError('Unexpected crash framework path')
    if not framework.is_file() or image.get('uuid') != KNOWN_UUID:
        return {**result, 'qualificationUnavailable': 'Matching framework binary unavailable or unsupported UUID'}
    if [frame.get('imageOffset') for frame in frames[:7]] != FRAME_OFFSETS:
        raise ValueError('Crash frame chain differs from audited offsets')
    decoder = capstone.Cs(capstone.CS_ARCH_ARM64, capstone.CS_MODE_ARM)
    decoded, windows, chunks = {}, [], []
    with framework.open('rb') as file:
        image_uuid, slice_offset, base, segments, header_bytes = layout(file)
        if image_uuid != image['uuid']:
            raise ValueError('Installed framework UUID differs from crash')
        for start, size in [(150142512, 80), (150152860, 212), (150143688, 56), (66544, 12)]:
            vm = base+start
            segment = next(s for s in segments if s['vm'] <= vm and vm+size <= s['vm']+s['fileSize'])
            file.seek(slice_offset+segment['fileOffset']+vm-segment['vm'])
            raw = file.read(size)
            if len(raw) != size:
                raise ValueError('Truncated framework window')
            chunks.append(raw)
            for instruction in decoder.disasm(raw, vm):
                decoded[instruction.address-base] = (instruction.mnemonic, instruction.op_str)
            windows.append(dict(start=start, bytes=size, sha256=hashlib.sha256(raw).hexdigest()))
    for address, expected in ANCHORS.items():
        actual = decoded.get(address)
        # Decoder branch operands use the Mach-O VM base. This audited dylib
        # has a zero VM base; reject rather than guess another layout.
        if base != 0 or actual != expected:
            raise ValueError(f'Allocator diagnostic anchor differs at {address}')
    stream = report.get('instructionByteStream', {})
    at_pc = base64.b64decode(stream['atPC'], validate=True)
    if len(at_pc) > 256 or at_pc[:12] != chunks[0][24:36]:
        raise ValueError('Crash PC bytes differ from installed trap')
    registers = thread['threadState']['x']
    size = registers[19]['value']
    if size != 2097152:
        raise ValueError('Captured allocator size differs from original call argument')
    result.update(binaryPathMatched=True, allocatorPathMatched=True, verifiedInstructionAnchors=len(ANCHORS),
                  frameworkHeaderBytesRead=header_bytes, frameworkCodeBytesRead=sum(w['bytes'] for w in windows),
                  codeWindows=windows, requestedAllocationBytes=size,
                  debugDataLabels=['va_size', 'alloc', 'commit', 'size'], pcBytesMatched=True,
                  classification='Strong evidence for Chromium allocator OOM path; symbol names inferred from primary source signatures')
    return result


results = [inspect(name) for name in REPORTS]
matched = sum(r['allocatorPathMatched'] for r in results)
if matched != 2:
    raise ValueError('Expected two matching existing allocator crash cases')
output = dict(passed=True, reports=results, matchedAllocatorCases=matched,
              gameLaunches=0, browserLaunches=0, liveProcessesInspected=False,
              fullCrashReportsPersisted=False,
              sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              sourceReferences=[
                  'https://chromium.googlesource.com/chromium/src/+/0941a8e04be3c036279fa82a9d44bd391c504a8e/base/allocator/partition_allocator/src/partition_alloc/partition_root.cc',
                  'https://chromium.googlesource.com/chromium/src/+/refs/heads/main/base/allocator/partition_allocator/src/partition_alloc/oom.cc'],
              limitations=['No crash-time allocation totals, commit limits, or initiating action are recovered',
                           'Allocation failure does not alone identify system RAM, process/pool limit, leak, or original trigger',
                           'Older framework binary missing; first crash only retains the prior report-level classification',
                           'No app/game/browser restart or change; browser game testing remains suspended'])
(ROOT/'output/app-crash-allocator-audit.json').write_text(json.dumps(output, indent=2)+'\n')
print(json.dumps(dict(passed=True, matchedAllocatorCases=matched, requestedAllocationBytes=2097152,
                     frameworkCodeBytesReadPerCase=360, gameLaunches=0, browserLaunches=0)))
