#!/usr/bin/env python3
"""Prepare private translated stock presenters; never alter the image or generated C.

Each isolated module must compile with registration redirected to the private
template bank and all raw fn_ symbols renamed, as recorded in its manifest.
Never install these patched modules in the global guest dispatch registry.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[1]
PROFILE = {
    'presenter': (0x00465510, 0x00465AA0),
    'tooltip': (0x00465AC0, 0x00465BF0),
    'counts': (0x0047E680, 0x0047E830),
    'availability': (0x0047E8F0, 0x0047E9C0),
    'setup': (0x0047F1B0, 0x0047F270),
    'event': (0x0047F530, 0x0047F640),
}
INDEX_ROLES = {
    0x004657F6: 'push 0',
    0x00465890: 'push ebp',
    0x00465923: 'push ebp',
    0x004659FB: 'push ebx',
    0x00465B5E: 'push edi',
}
CONTROL_ROLES = {
    0x0046554C: 'push 0x1f48', 0x0046555A: 'push 0x1f51',
    0x004655AB: 'push 0x1f48', 0x004655B9: 'push 0x1f51',
    0x0046569B: 'push 0x1f48', 0x004656A9: 'push 0x1f51',
    0x004657D8: 'push 0x1f48', 0x0046586E: 'push 0x1f48',
    0x00465900: 'push 0x1f48', 0x00465A69: 'push 0x1f51',
    0x00465A79: 'push 0x1f51',
}


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def normalize(value):
    return re.sub(r'\s+', ' ', value.casefold().strip())


def private_patches(instructions, index, third_price):
    """Patch only audited index/control roles in the literal native routines."""
    if index not in (0, 1, 2) or isinstance(index, bool) or not 0x22CE < third_price <= 0xFFFFFFFF:
        raise ValueError('Invalid private three-choice binding')
    command, price = (0x1F48, 0x1389, 0x1388)[index], (0x1752, 0x1F51, third_price)[index]
    result = []
    for address, expected in INDEX_ROLES.items():
        if instructions.get(address) != expected:
            raise ValueError(f'Original index role differs at {address:08x}')
        result.append(dict(at=address, text=f'PUSH 0x{index:x}', role='native-produced-index'))
    controls = {address: value for address, value in instructions.items()
                if PROFILE['presenter'][0] <= address < PROFILE['presenter'][1]
                and value in ('push 0x1f48', 'push 0x1f51')}
    if controls != CONTROL_ROLES:
        raise ValueError('Original presenter control set differs')
    for address, value in controls.items():
        result.append(dict(at=address, text=f'PUSH 0x{command if value.endswith("1f48") else price:x}',
                           role='native-recruit-command' if value.endswith('1f48') else 'native-price-control'))
    if instructions.get(0x00465AE5) != 'cmp edi, 0x1f48':
        raise ValueError('Original tooltip command differs')
    result.append(dict(at=0x00465AE5, text=f'CMP EDI,0x{command:x}', role='native-tooltip-command'))
    return sorted(result, key=lambda x: x['at'])


def common_patches(instructions):
    # Literal private ThreeCounts: declare the two extra slots available. Native
    # AP52 still obtains all actual counts through its indexed vtable method.
    originals = ['push ebx', 'push ebp', 'push esi', 'push edi', 'call 0x481ec0']
    replacements = ['MOV EAX,dword ptr [ESP + 0x4]', 'MOV dword ptr [EAX],0x1',
                    'MOV EAX,dword ptr [ESP + 0x8]', 'MOV dword ptr [EAX],0x1', 'RET 0x8']
    result = []
    for offset, (before, after) in enumerate(zip(originals, replacements)):
        address = 0x0047E8F0 + offset
        if instructions.get(address) != before:
            raise ValueError('Original availability helper differs')
        result.append(dict(at=address, text=after, role='private-three-counts'))
    if instructions.get(0x0047F1B0) != 'push esi' or instructions.get(0x0047F55A) != 'call 0x415b40':
        raise ValueError('Original Call-to-Arms setup/event prefix differs')
    # AP52 adds only Call-to-Arms before the generic setup. Preserve the full
    # native base setup; the adapter sets the Old child flag +0x20 beforehand.
    result.append(dict(at=0x0047F1B0, text='JMP 0x00465aa0', role='private-no-call-to-arms-setup'))
    result.append(dict(at=0x0047F55A, text='JMP 0x0047f60a', role='private-no-call-to-arms-event'))
    return result


def append_patches(text, rows):
    before = tomllib.loads(text)
    existing = before['translate'].get('instruction_patches', [])
    if {x['at'] for x in existing} & {x['at'] for x in rows}:
        raise ValueError('Private patch collides with an existing game patch')
    match = re.search(r'^instruction_patches\s*=\s*\[(?:[ \t]*\]|.*?^\])', text, re.M | re.S)
    if not match:
        raise ValueError('Require the original bounded patch declaration')
    added = ''.join('  { at = 0x%08x, text = %s },\n' % (x['at'], json.dumps(x['text'])) for x in rows)
    result = text[:match.end() - 1] + added + text[match.end() - 1:]
    after = tomllib.loads(result)
    after['translate']['instruction_patches'] = existing
    if after != before:
        raise ValueError('Private presenter curation changed unrelated configuration')
    return result


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve prior templates; choose a fresh output')
    policy = module('community_source_policy', ROOT / 'scripts/prepare-community-guild-gpl.py')
    policy.verified_git(args.manager, policy.MANAGER_COMMIT)
    sys.path.insert(0, str(args.manager / 'src'))
    from majesty_cam.stock_controller_registry import decode_stock_controller_registry
    registry_raw = args.controllers.read_bytes()
    registry = decode_stock_controller_registry(registry_raw)
    records = [r for r in registry.private_recruitments
               if r.panel_key.startswith('me277a34fbfb654ecbfec565d735edc37.')]
    if len(records) != 1:
        raise ValueError('Require one authentic Bards private recruitment record')
    record = records[0]
    config = tomllib.loads((args.game / 'game.toml').read_text())
    original = module('community_recruitment_entries', ROOT / 'scripts/prepare-community-recruitment-engine.py')
    raw = (args.game / config['game']['developer_exe']).read_bytes()
    text = original.curate((args.game / 'game.toml').read_text(), raw)
    import capstone
    disassembler = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    instructions, functions = {}, {}
    for name, (start, end) in PROFILE.items():
        body = original.original.mapped_bytes(raw, start, end - start)
        functions[name] = dict(start=f'{start:08x}', end=f'{end:08x}', sha256=hashlib.sha256(body).hexdigest())
        instructions.update((ins.address, normalize(ins.mnemonic + ' ' + ins.op_str))
                            for ins in disassembler.disasm(body, start))
    plans = [(f'recruit{i}', [0x00465510, 0x00465AC0],
              private_patches(instructions, i, record.third_price_control_id)) for i in range(3)]
    plans.append(('common', [0x0047E680, 0x0047E8F0, 0x0047F1B0, 0x0047F530], common_patches(instructions)))
    args.out.mkdir(parents=True)
    modules = {}
    for name, entries, patches in plans:
        folder = args.out / name
        folder.mkdir()
        (folder / 'game.toml').write_text(append_patches(text, patches))
        shutil.copyfile(args.game / 'globals.toml', folder / 'globals.toml')
        for link in ('original', 'analysis', 'kit'):
            (folder / link).symlink_to((args.game / link).resolve(), target_is_directory=True)
        for header in args.game.glob('*.h'):
            (folder / header.name).symlink_to(header.resolve())
        for source in config['translate']['native']['sources']:
            path = folder / source
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.symlink_to((args.game / source).resolve())
        modules[name] = dict(moduleName='majesty_private_' + name,
            entries=[f'{entry:08x}' for entry in entries], patches=patches,
            gameConfigSha256=hashlib.sha256((folder / 'game.toml').read_bytes()).hexdigest())
    report = dict(format='majesty-private-native-recruitment-templates-v1',
        originalExeSha256=original.original.PIN, originalFunctions=functions,
        controllerRegistrySha256=hashlib.sha256(registry_raw).hexdigest(),
        thirdPriceControlId=record.third_price_control_id, modules=modules,
        requiredRegistrationRedirect='recomp_module_register=majesty_collect_private_template',
        requiredRawFunctionRenaming=True, globalDispatchRegistrationAllowed=False,
        generatedSourcesEdited=False, compiled=False, nativeGameplayQualified=False, published=False)
    (args.out / 'template-stage.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('game', 'manager', 'controllers', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    result = prepare(args)
    print(json.dumps({k: len(v['patches']) for k, v in result['modules'].items()}))
