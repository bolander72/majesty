#!/usr/bin/env python3
"""Original collector on tiny synthetic buffers, with strict CPU/access limits."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_READ, UC_HOOK_MEM_WRITE, UC_PROT_READ, UC_PROT_EXEC
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-rectangle-collector.py'
spec = importlib.util.spec_from_file_location('collector_audit', AUDITOR)
audit_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)
EXE = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
OUTPUT = ROOT/'output/native-rectangle-collector-emulated-observed.json'
OUTPUT.unlink(missing_ok=True)
audit = audit_module.audit(EXE)
data = EXE.read_bytes()
if hashlib.sha256(data).hexdigest() != audit_module.PIN:
    raise RuntimeError('Collector executable changed before CPU setup')
pe = pefile.PE(data=data)
base = pe.OPTIONAL_HEADER.ImageBase
CODE, CODE_BYTES = 0x00505000, 8192
STATE, STATE_BYTES = 0x01000000, 16384
STACK, STACK_BYTES, STOP = 0x02000000, 8192, 0x03000000
OBJECT, INPUT = STATE+0x100, STATE+0x3100
BUFFERS = [STATE+0x1100, STATE+0x2100]
MAX_CALL_INSTRUCTIONS, MAX_TOTAL_INSTRUCTIONS = 40_000, 2_000_000
MAX_CALL_TIME_MICROS, MAX_DEPTH = 500_000, 16
cpu = Uc(UC_ARCH_X86, UC_MODE_32)
cpu.mem_map(CODE, CODE_BYTES)
cpu.mem_write(CODE, pe.get_data(CODE-base, CODE_BYTES))
cpu.mem_protect(CODE, CODE_BYTES, UC_PROT_READ | UC_PROT_EXEC)
cpu.mem_map(STATE, STATE_BYTES)
cpu.mem_map(STACK, STACK_BYTES)
cpu.mem_map(STOP, 4096)
instructions = {int(i['address'], 16): i for r in audit['ranges'] for i in r['instructions']}
collector_returns = {int(i['address'], 16) for i in audit['ranges'][0]['instructions'] if i['mnemonic'] == 'ret'}
total_instructions, call_instructions, calls, depth, max_depth = 0, 0, 0, 0, 0
lowest_stack, initial_stack, call_max_depth = 0, 0, 0
collector_entries, splitter_entries, visited_split_targets = 0, 0, set()
switch_targets = {int(t, 16) for t in audit['splitterSwitch']['targets']}
splitter_output_only = False


def word(at, value=None):
    if value is not None:
        cpu.mem_write(at, struct.pack('<I', value & 0xffffffff))
    return struct.unpack('<I', cpu.mem_read(at, 4))[0]


def inside(address, size, start, length):
    return start <= address and address+size <= start+length


def code_hook(cpu, address, size, context):
    global total_instructions, call_instructions, depth, max_depth, call_max_depth
    global lowest_stack, collector_entries, splitter_entries
    total_instructions += 1
    call_instructions += 1
    if address not in instructions or call_instructions > MAX_CALL_INSTRUCTIONS or total_instructions > MAX_TOTAL_INSTRUCTIONS:
        raise RuntimeError('Collector escaped instruction closure or exceeded CPU budget')
    sp = cpu.reg_read(UC_X86_REG_ESP)
    lowest_stack = min(lowest_stack, sp)
    if not STACK+1024 <= sp <= STACK+STACK_BYTES-512:
        raise RuntimeError('Collector stack exceeded fixture bounds')
    if address == 0x00505860:
        collector_entries += 1
        depth += 1
        max_depth = max(max_depth, depth)
        call_max_depth = max(call_max_depth, depth)
        if depth > MAX_DEPTH:
            raise RuntimeError('Collector recursion exceeded fixture budget')
    if address in collector_returns:
        depth -= 1
        if depth < 0:
            raise RuntimeError('Collector return depth underflow')
    if address == 0x00505db0:
        splitter_entries += 1
    if address in switch_targets:
        visited_split_targets.add(address)


def read_hook(cpu, access, address, size, value, context):
    permitted = [(OBJECT, 0x44), (INPUT, 16), (STACK, STACK_BYTES), (0x00506324, 64)]
    permitted += [(buffer, 800) for buffer in BUFFERS]
    if not any(inside(address, size, start, length) for start, length in permitted):
        raise RuntimeError(f'Collector read outside owned fixture range at {address:08x}')


def write_hook(cpu, access, address, size, value, context):
    if inside(address, size, STACK, STACK_BYTES):
        return
    if splitter_output_only:
        if inside(address, size, BUFFERS[0], 64):
            return
        raise RuntimeError('Direct splitter wrote outside its four-rectangle output')
    if address in [OBJECT+0x34, OBJECT+0x38] and size == 4:
        if not 0 <= value <= 50:
            raise RuntimeError('Collector count exceeds allocated capacity')
        return
    if any(inside(address, size, buffer, 800) for buffer in BUFFERS):
        return
    raise RuntimeError(f'Collector wrote outside owned buffers/counts at {address:08x}')


cpu.hook_add(UC_HOOK_CODE, code_hook)
cpu.hook_add(UC_HOOK_MEM_READ, read_hook)
cpu.hook_add(UC_HOOK_MEM_WRITE, write_hook)


def initialize(mode, bank, initial_rectangles):
    cpu.mem_write(STATE, b'\xa5'*STATE_BYTES)
    cpu.mem_write(OBJECT, bytes(0x44))
    word(OBJECT+8, mode)
    word(OBJECT+0x10, 50)
    for offset, value in zip([0x14, 0x18, 0x1c, 0x20], [0, 0, 640, 480]):
        word(OBJECT+offset, value)
    for index, buffer in enumerate(BUFFERS):
        word(OBJECT+0x3c+index*4, buffer)
        cpu.mem_write(buffer, b'\xbd'*800)
    word(OBJECT+0x34+bank*4, len(initial_rectangles))
    for index, rectangle in enumerate(initial_rectangles):
        cpu.mem_write(BUFFERS[bank]+index*16, struct.pack('<4i', *rectangle))


def run_call(rectangle, bank, poison):
    global call_instructions, initial_stack, lowest_stack, calls, depth, call_max_depth
    call_instructions, depth, call_max_depth = 0, 0, 0
    cpu.mem_write(INPUT, struct.pack('<4i', *rectangle))
    before_input = bytes(cpu.mem_read(INPUT, 16))
    other = 1-bank
    before_other = bytes(cpu.mem_read(BUFFERS[other], 800))
    before_other_count = word(OBJECT+0x34+other*4)
    fences = [(b-32, bytes(cpu.mem_read(b-32, 32)), b+800, bytes(cpu.mem_read(b+800, 32))) for b in BUFFERS]
    cpu.mem_write(STACK, bytes([poison])*STACK_BYTES)
    initial_stack = STACK+STACK_BYTES-1024
    lowest_stack = initial_stack
    cpu.mem_write(initial_stack, struct.pack('<3I', STOP, INPUT, bank))
    cpu.reg_write(UC_X86_REG_ECX, OBJECT)
    cpu.reg_write(UC_X86_REG_ESP, initial_stack)
    cpu.emu_start(0x00505860, STOP, timeout=MAX_CALL_TIME_MICROS, count=MAX_CALL_INSTRUCTIONS)
    if cpu.reg_read(UC_X86_REG_EIP) != STOP or depth != 0:
        raise RuntimeError('Collector did not return before instruction/time limit')
    if cpu.reg_read(UC_X86_REG_ESP) != initial_stack+12:
        raise RuntimeError('Collector argument cleanup changed')
    if bytes(cpu.mem_read(INPUT, 16)) != before_input or bytes(cpu.mem_read(BUFFERS[other], 800)) != before_other:
        raise RuntimeError('Collector changed input or inactive buffer')
    if word(OBJECT+0x34+other*4) != before_other_count:
        raise RuntimeError('Collector changed inactive count')
    for before_at, before, after_at, after in fences:
        if bytes(cpu.mem_read(before_at, 32)) != before or bytes(cpu.mem_read(after_at, 32)) != after:
            raise RuntimeError('Collector buffer fence changed')
    calls += 1
    count = word(OBJECT+0x34+bank*4)
    return dict(count=count, payload=bytes(cpu.mem_read(BUFFERS[bank], 800)).hex(),
        firstRectangle=list(struct.unpack('<4i', cpu.mem_read(BUFFERS[bank], 16))),
        instructions=call_instructions, stackBytes=initial_stack-lowest_stack, depth=call_max_depth)


def pattern(mode, bank, poison):
    initialize(mode, bank, [(1, 1, 2, 2)])
    observed = []
    for index in range(64):
        x, y = 10+(index%16)*20, 20+(index//16)*20
        observed.append(run_call((x, y, x+5, y+5), bank, poison))
    return observed


def split_case(mask, poison):
    global call_instructions, depth, initial_stack, lowest_stack, splitter_output_only
    initialize(2, 0, [])
    a = [30 if mask & 1 else 10, 30 if mask & 4 else 10,
         70 if mask & 2 else 90, 70 if mask & 8 else 90]
    b = [20, 20, 80, 80]
    cpu.mem_write(INPUT, struct.pack('<4i', *a))
    cpu.mem_write(BUFFERS[1], struct.pack('<4i', *b))
    before_output_tail = bytes(cpu.mem_read(BUFFERS[0]+64, 736))
    before_b = bytes(cpu.mem_read(BUFFERS[1], 800))
    cpu.mem_write(STACK, bytes([poison])*STACK_BYTES)
    initial_stack = STACK+STACK_BYTES-1024
    lowest_stack, call_instructions, depth = initial_stack, 0, 0
    cpu.mem_write(initial_stack, struct.pack('<4I', STOP, INPUT, BUFFERS[1], BUFFERS[0]))
    cpu.reg_write(UC_X86_REG_ESP, initial_stack)
    splitter_output_only = True
    try:
        cpu.emu_start(0x00505db0, STOP, timeout=MAX_CALL_TIME_MICROS, count=MAX_CALL_INSTRUCTIONS)
    finally:
        splitter_output_only = False
    if cpu.reg_read(UC_X86_REG_EIP) != STOP or cpu.reg_read(UC_X86_REG_ESP) != initial_stack+4:
        raise RuntimeError('Direct splitter did not return with expected cleanup')
    count = cpu.reg_read(UC_X86_REG_EAX)
    if not 0 <= count <= 4:
        raise RuntimeError('Direct splitter returned an out-of-budget piece count')
    if bytes(cpu.mem_read(INPUT, 16)) != struct.pack('<4i', *a) or bytes(cpu.mem_read(BUFFERS[1], 800)) != before_b:
        raise RuntimeError('Direct splitter changed input rectangles')
    if bytes(cpu.mem_read(BUFFERS[0]+64, 736)) != before_output_tail:
        raise RuntimeError('Direct splitter overwrote output tail')
    pieces = [list(struct.unpack('<4i', cpu.mem_read(BUFFERS[0]+i*16, 16))) for i in range(count)]
    # Independent geometric oracle: partition at every input/output edge, then
    # compare each open cell's coverage with B minus A. Zero-area pieces ignored.
    valid = [p for p in pieces if p[0] < p[2] and p[1] < p[3]]
    xs = sorted({v for p in [a, b]+valid for v in [p[0], p[2]]})
    ys = sorted({v for p in [a, b]+valid for v in [p[1], p[3]]})
    def contains(p, x, y):
        return 2*p[0] < x < 2*p[2] and 2*p[1] < y < 2*p[3]
    for left, right in zip(xs, xs[1:]):
        for top, bottom in zip(ys, ys[1:]):
            x, y = left+right, top+bottom
            expected = contains(b, x, y) and not contains(a, x, y)
            actual = any(contains(p, x, y) for p in valid)
            if actual != expected:
                raise RuntimeError(f'Direct splitter coverage differs for mask {mask}')
    return dict(mask=mask, input=a, existing=b, count=count, pieces=pieces,
        instructions=call_instructions, stackBytes=initial_stack-lowest_stack)


cases = []
for mode in [0, 1, 2]:
    for bank in [0, 1]:
        clean, poisoned = pattern(mode, bank, 0), pattern(mode, bank, 0xcc)
        if clean != poisoned:
            raise RuntimeError('Collector clean/poisoned-stack replay differs')
        cases.append(dict(mode=mode, bank=bank, updates=64, finalCount=clean[-1]['count'],
            largestCount=max(c['count'] for c in clean), largestCallInstructions=max(c['instructions'] for c in clean),
            largestStackBytes=max(c['stackBytes'] for c in clean), largestDepth=max(c['depth'] for c in clean),
            finalPayloadSha256=hashlib.sha256(bytes.fromhex(clean[-1]['payload'])).hexdigest()))

directed = []
for mode in [1, 2]:
    replay = []
    for poison in [0, 0xcc]:
        initialize(mode, 0, [(20, 20, 80, 80)])
        replay.append(run_call((0, 0, 100, 100), 0, poison))
    if replay[0] != replay[1]:
        raise RuntimeError('Intersecting rectangle replay differs')
    result = replay[0]
    directed.append(dict(mode=mode, case='intersecting bounds', count=result['count'],
        instructions=result['instructions'], stackBytes=result['stackBytes'], depth=result['depth']))

split_cases = []
for mask in range(16):
    clean, poisoned = split_case(mask, 0), split_case(mask, 0xcc)
    if clean != poisoned:
        raise RuntimeError('Direct splitter clean/poisoned replay differs')
    split_cases.append(clean)
if visited_split_targets != switch_targets:
    raise RuntimeError('Direct splitter cases did not reach every audited switch target')

invalid_cases = []
for label, bank, count, expected in [
    ('bank outside two-buffer layout', 2, 1, 'read outside owned fixture'),
    ('count exceeds allocated capacity', 0, 51, 'wrote outside owned buffers'),
]:
    initialize(0, 0, [(1, 1, 2, 2)])
    word(OBJECT+0x34, count)
    try:
        run_call((10, 20, 30, 40), bank, 0)
    except RuntimeError as error:
        if expected not in str(error):
            raise
        invalid_cases.append(dict(case=label, bank=bank, count=count,
            fixtureStoppedAccess=True, reason=str(error), instructions=call_instructions))
    else:
        raise RuntimeError('Malformed state did not expose expected out-of-range access')

initialize(0, 0, [])
empty = run_call((10, 20, 30, 40), 0, 0)
initialize(0, 1, [(i, i, i+1, i+1) for i in range(50)])
full = run_call((10, 20, 30, 40), 1, 0)
if full['count'] != 1 or full['firstRectangle'] != [0, 0, 640, 480]:
    raise RuntimeError('Full-count fallback differs from configured bounds')
if hashlib.sha256(EXE.read_bytes()).hexdigest() != audit_module.PIN:
    raise RuntimeError('Collector original executable changed')
report = dict(executableSha256=audit_module.PIN, verifiedInstructionAnchors=audit['verifiedInstructionAnchors'],
    calls=calls, cases=cases, directedCases=directed, directSplitterCalls=32,
    directSplitterCases=split_cases, allSplitterSwitchTargetsVisited=True,
    sampledSplitterCoverageMatchesIndependentOracle=True,
    invalidStateCases=invalid_cases, invalidStatesStoppedByFixtureNotOriginalCode=True,
    emptyFirstRectangle=empty['firstRectangle'],
    emptyExpectedRectangle=[10, 20, 30, 40], emptyRectangleCopiesInputExactly=empty['firstRectangle']==[10, 20, 30, 40],
    fullCountFallbackQualified=True, fullCountFallbackRectangle=full['firstRectangle'],
    syntheticBufferOwnershipQualified=True, deterministicReplay=True, stackPoisonReplay=True,
    inputAndInactiveBankUnchanged=True, bufferCanariesUnchanged=True,
    ownershipAndCanaryAssertionsScope='completed valid-input collector calls only',
    totalInstructions=total_instructions, maxTotalInstructions=MAX_TOTAL_INSTRUCTIONS,
    maxCallInstructions=MAX_CALL_INSTRUCTIONS, maxCallTimeMicros=MAX_CALL_TIME_MICROS,
    maximumObservedRecursionDepth=max_depth, maximumAllowedRecursionDepth=MAX_DEPTH,
    collectorEntries=collector_entries, splitterEntries=splitter_entries,
    visitedSplitterTargets=[f'{t:08x}' for t in sorted(visited_split_targets)],
    guestMappedBytes=CODE_BYTES+STATE_BYTES+STACK_BYTES+4096,
    noAllocatorOrImportStubs=True, originalInstructionsExecuted=True,
    allNumericGeometryQualified=False, allRecursionBoundQualified=False, liveBufferBoundsQualified=False,
    actorReferenceRetentionExcluded=False, boundedNativeSimulationQualified=False, liveNativePagingQualified=False,
    gameLaunches=0, browserLaunches=0, builds=0, crashResolved=False,
    sourceSha256={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in [AUDITOR, Path(__file__).resolve(), audit_module.DEPENDENCY]},
    limitations=['Synthetic valid banks 0/1, capacity 50 and owned separate drawing buffers only.',
        'Hard limits stop the fixture; they do not bound the live native routine.',
        'Sampled streams and intersections do not qualify every split/numeric branch or general recursion.',
        'Empty-count rectangle behavior is observed separately; redraw coverage correctness is not assumed.',
        'No original saves, actor/world state, game/browser launch, build or live paging.'])
OUTPUT.write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(dict(passed=True, calls=calls, totalInstructions=total_instructions,
    guestMappedBytes=report['guestMappedBytes'], recursionDepth=max_depth,
    emptyFirstRectangle=empty['firstRectangle'], gameLaunches=0)))
