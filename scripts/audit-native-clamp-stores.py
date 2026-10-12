#!/usr/bin/env python3
"""Pin the original clamp stores and their translated CALL continuations."""
import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
sys.path.insert(0, str(GAME / 'kit/tools'))
import game_config

def audit():
    executable = GAME / 'original/gog/MajestyHD - Old.exe'
    raw = executable.read_bytes()
    pin = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
    if hashlib.sha256(raw).hexdigest() != pin:
        raise ValueError('Clamp repair requires the pinned original executable')
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    if int.from_bytes(pe.get_data(0x0068b660 + 28 - base, 4), 'little') != 0x005fd160:
        raise ValueError('Original terrain clamp virtual slot differs')
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    md.detail = True
    instructions = []
    for item in md.disasm(pe.get_data(0x005fd160 - base, 4096), 0x005fd160):
        instructions.append(item)
        if item.mnemonic == 'ret':
            break
    if len(instructions) != 192 or instructions[-1].address != 0x005fd3ca or instructions[-1].op_str != '0x14':
        raise ValueError('Complete original clamp method differs')
    spec = importlib.util.spec_from_file_location('clamp_translate', GAME / 'kit/tools/recomp/translate.py')
    translator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(translator)
    cfg = game_config.load(GAME)
    translator.configure(cfg)
    image = translator.Image(str(executable))
    fn = translator.Function(0x005fd160, 'original_clamp', 0x26d,
                             [image.to_insn(i) for i in instructions])
    fn.measure(image)
    targets = {0x00428d70} | {int(i.op_str, 16) for i in instructions if i.mnemonic == 'call' and i.op_str.startswith('0x')}
    emit = translator.Translator(image, targets, SimpleNamespace(eager_flags=False))
    emit.prepare(fn)
    body = '\n'.join(emit.translate(fn))
    sites = []
    for address, encoded, operands in [(0x005fd2ba, b'\x89\x06', 'dword ptr [esi], eax'),
                                       (0x005fd2c6, b'\x89\x0e', 'dword ptr [esi], ecx')]:
        original = next(i for i in instructions if i.address == address)
        if bytes(original.bytes) != encoded or original.mnemonic != 'mov' or original.op_str != operands:
            raise ValueError('Original direct store differs')
        index = next(i for i, item in enumerate(fn.insns) if item.addr == address)
        patched = fn.insns[index]
        if patched.mnem != 'CALL' or patched.ops != ['0x00428d70'] or fn.fallthrough[index] != address + 2:
            raise ValueError('Store rewrite or original continuation differs')
        call = emit.emit(fn, index, set())
        if not any(f'wr32(c->r[4], {translator.hexlit(address + 2)})' in line for line in call) or not any(line.strip() == 'CALL_FN(00428d70);' for line in call):
            raise ValueError(f'Translated guarded store call differs at {address:08x}: {call!r}')
        sites.append({'address': f'{address:08x}', 'original': operands, 'nextPC': f'{address + 2:08x}', 'emitted': call})
    header = (GAME / 'browser_overrides.h').read_text()
    if '#define FN_00428d70 majesty_browser_connected_store' not in header:
        raise ValueError('Native guarded-store adapter is not declared')
    return {'version': 1, 'originalStoresAndContinuationsQualified': True,
            'originalExecutableSha256': pin, 'originalMethod': '005fd160', 'instructions': 192,
            'methodSha256': hashlib.sha256(pe.get_data(0x005fd160 - base, 0x26d)).hexdigest(),
            'sites': sites, 'translatedMethodSha256': hashlib.sha256(body.encode()).hexdigest(),
            'scope': 'Pinned original stores and production-emitter CALL continuations only; native behavior and wider restoration require actual game verification.'}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    result = audit()
    with args.output.open('x') as sink:
        json.dump(result, sink, indent=2)
        sink.write('\n')
    print(json.dumps({'originalStoresAndContinuationsQualified': True, 'stores': len(result['sites'])}))

if __name__ == '__main__':
    main()
