#!/usr/bin/env python3
"""Inspect memory declarations without loading/compiling the WASM module."""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MAX_READ_BYTES = 65536
MAX_SECTIONS = 64


class Reader:
    def __init__(self, file, size):
        self.file, self.size, self.end = file, size, size
        self.read_bytes = self.largest_read = 0

    def read(self, size):
        if size < 0 or size > 4096 or self.file.tell()+size > self.end:
            raise ValueError('Truncated or unbounded WASM metadata read')
        if self.read_bytes+size > MAX_READ_BYTES:
            raise ValueError('WASM metadata read budget exceeded')
        result = self.file.read(size)
        self.read_bytes += len(result)
        self.largest_read = max(self.largest_read, size)
        if len(result) != size:
            raise ValueError('Truncated WASM metadata')
        return result

    def byte(self):
        return self.read(1)[0]

    def u32(self):
        value = 0
        for shift in range(0, 35, 7):
            byte = self.byte()
            if shift == 28 and byte & 0xf0:
                raise ValueError('Invalid WASM u32 encoding')
            value |= (byte & 0x7f) << shift
            if not byte & 0x80:
                return value
        raise ValueError('Invalid WASM u32 encoding')

    def name(self):
        size = self.u32()
        if size > 256:
            raise ValueError('WASM import name budget exceeded')
        return self.read(size).decode('utf-8', errors='strict')

    def limits(self, memory=False):
        flags = self.byte()
        if flags not in ((0, 1, 3) if memory else (0, 1)):
            raise ValueError('Unsupported WASM memory/table limits')
        minimum = self.u32()
        maximum = self.u32() if flags & 1 else None
        if maximum is not None and maximum < minimum:
            raise ValueError('Invalid WASM limits order')
        if memory and (minimum > 65536 or (maximum is not None and maximum > 65536)):
            raise ValueError('Unsupported WASM32 memory limits')
        return dict(minimumPages=minimum, maximumPages=maximum, shared=bool(flags & 2))


def inspect(file, size):
    reader = Reader(file, size)
    if reader.read(8) != b'\0asm\x01\0\0\0':
        raise ValueError('Unsupported WASM header')
    sections, memories, seen = [], [], set()
    while file.tell() < size:
        if len(sections) >= MAX_SECTIONS:
            raise ValueError('WASM section budget exceeded')
        reader.end = size
        section, length = reader.byte(), reader.u32()
        start, end = file.tell(), file.tell()+length
        if end > size or section > 13 or (section and section in seen):
            raise ValueError('Invalid WASM section header')
        if section:
            seen.add(section)
        sections.append(dict(id=section, offset=start, bytes=length))
        reader.end = end
        if section == 2:
            count = reader.u32()
            if count > 512:
                raise ValueError('WASM import budget exceeded')
            for _ in range(count):
                module, name, kind = reader.name(), reader.name(), reader.byte()
                if kind == 0:
                    reader.u32()
                elif kind == 1:
                    if reader.byte() not in (0x70, 0x6f):
                        raise ValueError('Unsupported imported WASM table')
                    reader.limits()
                elif kind == 2:
                    memories.append(dict(importModule=module, importName=name, **reader.limits(memory=True)))
                elif kind == 3:
                    if reader.byte() not in (0x7f, 0x7e, 0x7d, 0x7c, 0x7b, 0x70, 0x6f) or reader.byte() not in (0, 1):
                        raise ValueError('Unsupported imported WASM global')
                elif kind == 4:
                    if reader.byte() != 0:
                        raise ValueError('Unsupported imported WASM tag')
                    reader.u32()
                else:
                    raise ValueError('Unsupported WASM import kind')
        elif section == 5:
            count = reader.u32()
            if count > 2:
                raise ValueError('WASM memory count budget exceeded')
            for _ in range(count):
                memories.append(dict(importModule=None, importName=None, **reader.limits(memory=True)))
        if section in (2, 5) and file.tell() != end:
            raise ValueError('Trailing WASM import/memory metadata')
        file.seek(end)
    if not memories:
        raise ValueError('No WASM memory declaration found')
    return dict(memories=memories, sections=sections, logicalBytesRead=reader.read_bytes,
        largestRequestedReadBytes=reader.largest_read, fileBytes=size,
        skippedPayloadBytes=size-reader.read_bytes, fullModuleValidationPerformed=False)


def audit():
    site = ROOT/'upstream/majesty-recomp/build/web-site/majesty'
    path = site/'MajestyRecomp.wasm'
    before = path.stat()
    with path.open('rb', buffering=0) as file:
        binary = inspect(file, before.st_size)
    after = path.stat()
    if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
        raise ValueError('WASM artifact changed during inspection')
    glue_path = site/'MajestyRecomp.js'
    glue = glue_path.read_text()
    memory = binary['memories']
    assert len(memory) == 1 and memory[0] == dict(importModule='env', importName='memory',
        minimumPages=8192, maximumPages=65536, shared=True)
    anchors = ['var INITIAL_MEMORY = 536870912;', '"initial": INITIAL_MEMORY / 65536,',
        '"maximum": 65536,', '"shared": true', 'var pthreadPoolSize = 8;',
        'if ((ENVIRONMENT_IS_PTHREAD)) {\n    return;\n  }',
        'wasmMemory = msgData.wasmMemory;',
        'worker.postMessage({\n      cmd: 1,\n      handlers,\n      wasmMemory,\n      wasmModule,',
        'oldSize * (1 + .2 / cutDown)',
        'Math.min(overGrownHeapSize, requestedSize + 100663296)', '4294901760;']
    assert all(anchor in glue for anchor in anchors)
    cmake_path = ROOT/'upstream/majesty-recomp/kit/host/CMakeLists.txt'
    cmake = cmake_path.read_text()
    assert '-sINITIAL_MEMORY=536870912 -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=4294967296' in cmake
    assert '-sPTHREAD_POOL_SIZE=8' in cmake
    assert '-sSTACK_SIZE=8388608 -sDEFAULT_PTHREAD_STACK_SIZE=16777216' in cmake
    guest_path = ROOT/'upstream/majesty-recomp/build/recomp/gen/x86.h'
    guest = guest_path.read_text()
    assert re.search(r'#define GUEST_SIZE 0x10000000u', guest)
    config_path = ROOT/'upstream/majesty-recomp/build/cmake/web/generated/game_config.cmake'
    assert 'set(RECOMP_GUEST_SIZE 0x10000000u)' in config_path.read_text()
    runtime_path = ROOT/'upstream/majesty-recomp/kit/runtime/memory.cpp'
    runtime = runtime_path.read_text()
    assert 'void *p = os_vm_reserve(GUEST_SIZE);' in runtime
    assert 'os_vm_release(g_mem, GUEST_SIZE);' in runtime
    platform_path = ROOT/'upstream/majesty-recomp/kit/platform/os_posix.cpp'
    assert 'mmap(nullptr, bytes, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANON, -1, 0)' in platform_path.read_text()
    sources = [Path(__file__).resolve(), glue_path, cmake_path, guest_path, config_path,
        ROOT/'upstream/majesty-recomp/kit/cmake/WebMemory.cmake',
        ROOT/'upstream/majesty-recomp/kit/tools/build.py',
        runtime_path, platform_path]
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    return dict(qualified=True, scope='static artifact memory declaration and source configuration only',
        binary=binary, artifactIdentity=dict(path=str(path.relative_to(ROOT)), size=before.st_size,
            mtimeNs=before.st_mtime_ns, inode=before.st_ino, entireArtifactHashed=False),
        initialLinearMemoryBytes=536870912, maximumDeclaredLinearMemoryBytes=4294967296,
        effectiveGlueHeapLimitBytes=4294901760,
        geometricGrowthStepPercent=20, growthExcessCapBytes=100663296,
        sharedLinearMemory=True, preloadedWorkerPool=8, workersReceiveSameMemoryObject=True,
        configuredGuestArenaRequestBytes=268435456,
        mainStackBytes=8388608, defaultPthreadStackBytes=16777216,
        workerStackAllocationTimingQualified=False, totalStartupResidentBytesMeasured=False,
        smallerMemoryConfigurationQualified=False, crashCauseIdentified=False,
        crashResolved=False, gameLaunched=False, browserUsed=False, nativeBuildRun=False,
        wholeModuleCompiled=False, sourceSha256={str(p.relative_to(ROOT)): sha(p) for p in sources})


def main():
    output = ROOT/'output/wasm-memory-contract-audit.json'
    output.unlink(missing_ok=True)
    report = audit()
    output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, wasmMetadataBytesRead=report['binary']['logicalBytesRead'],
        initialLinearMemoryMiB=512, workerPool=8, gameLaunches=0)))


if __name__ == '__main__':
    main()
