#!/usr/bin/env python3
"""Pin original cache backlinks, reference release and allocator ESI preservation."""
import argparse, hashlib, json, runpy, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = runpy.run_path(str(Path(__file__).with_name('audit-native-data-buffer-owner.py')))
PIN, audit = BASE['PIN'], BASE['audit']
FRAGMENTS = {
    'cacheAcquire': (0x529d41, 0x529d59, {
        0x529d41: ('mov', 'esi, dword ptr [ebx + 0x10]'),
        0x529d53: ('mov', 'eax, dword ptr [esi + 4]'),
        0x529d56: ('inc', 'dword ptr [eax + 0x14]')}),
    'cacheBacklinks': (0x52a079, 0x52a089, {
        0x52a079: ('mov', 'dword ptr [esi + 4], ebx'),
        0x52a07e: ('mov', 'dword ptr [ebx + 0x10], esi')}),
    'cacheRelease': (0x527c60, 0x527c9d, {
        0x527c63: ('mov', 'edx, dword ptr [esi + 0x14]'),
        0x527c66: ('dec', 'edx'),
        0x527c69: ('mov', 'dword ptr [esi + 0x14], edx'),
        0x527c6e: ('jg', '0x527c9b'),
        0x527c75: ('mov', 'dword ptr [esi + 0x14], 0'),
        0x527c8e: ('push', '2'),
        0x527c96: ('call', 'dword ptr [edx + 0x64]')}),
    'ownerRelease': (0x558930, 0x55894a, {
        0x558930: ('mov', 'eax, dword ptr [ecx + 4]'),
        0x558937: ('mov', 'ecx, eax'),
        0x558939: ('jmp', '0x527c60'),
        0x558946: ('call', 'dword ptr [eax + 8]')}),
    'heapSaveEsi': (0x64d5dd, 0x64d600, {0x64d5fe: ('push', 'esi')}),
    'heapRestoreEsi': (0x64d6d4, 0x64d6d9, {0x64d6d5: ('pop', 'esi')})}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists(): raise ValueError('Preserve previous audit')
    path = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    before = path.stat()
    evidence, controls = {}, []
    with path.open('rb') as f:
        h = hashlib.sha256()
        for chunk in iter(lambda: f.read(4096), b''): h.update(chunk)
        assert h.hexdigest() == PIN
        f.seek(0); header = f.read(4096)
        assert header[:2] == b'MZ'
        pe = struct.unpack_from('<I', header, 60)[0]
        assert header[pe:pe+4] == b'PE\0\0'
        count = struct.unpack_from('<H', header, pe+6)[0]
        opt = struct.unpack_from('<H', header, pe+20)[0]
        assert 0 < count <= 16 and struct.unpack_from('<I', header, pe+52)[0] == 0x400000
        sections = [struct.unpack_from('<IIII', header, pe+24+opt+40*i+8) for i in range(count)]
        def read_at(start, end):
            section = next(s for s in sections if s[1] <= start-0x400000 and end-0x400000 <= s[1]+s[2])
            f.seek(section[3]+start-0x400000-section[1])
            raw = f.read(end-start); assert len(raw) == end-start
            return raw
        for name, (start, end, required) in FRAGMENTS.items():
            raw = read_at(start, end)
            evidence[name] = audit(raw, start, required)
            at = next(iter(required))
            bad = bytearray(raw); bad[at-start] ^= 1
            try: audit(bad, start, required)
            except AssertionError: controls.append(dict(fragment=name, changedAddress=hex(at), refused=True))
            else: raise AssertionError('Changed reference instruction accepted')
        raw = read_at(0x688a70, 0x688a7c)
        assert struct.unpack('<III', raw) == (0x50fe80, 0x50fe70, 0x5588a0)
        vtable = dict(start=0x688a70, end=0x688a7c, sha256=hashlib.sha256(raw).hexdigest())
    after = path.stat()
    assert (before.st_ino,before.st_size,before.st_mtime_ns) == (after.st_ino,after.st_size,after.st_mtime_ns)
    result = dict(qualified=True, version=1, originalExecutableSha256=PIN,
        scope='Pinned original ordinary buffer cache backlink/acquire/release layout and ESI save/restore. Static layout does not establish safe eviction, current logical owner identity or coverage of converted graphics objects.',
        fragments=evidence, ownerVtable=vtable, contradictoryInstructionControls=controls,
        scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        dependencySha256=hashlib.sha256(Path(__file__).with_name('audit-native-data-buffer-owner.py').read_bytes()).hexdigest(),
        largestRead=4096, browserUsed=False, nativeProcessesStarted=0)
    with args.output.open('x') as f: f.write(json.dumps(result,indent=2)+'\n')
    print(json.dumps(dict(qualified=True,fragments=len(evidence),controls=len(controls))))

if __name__ == '__main__': main()
