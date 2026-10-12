#!/usr/bin/env python3
"""Bind actual official compiler output to a private draft; never install it."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zipfile

COMPILER = Path(__file__).resolve().parents[1] / 'upstream/majesty-recomp/original/gog/SDK/Gplbcc.exe'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def resident(path):
    if path.stat().st_flags & 0x40000000:
        raise ValueError(f'Dataless input: {path.name}')
    return path.read_bytes()


def prepare(draft, bytecode, observed, runtime, stage, app, compiler=COMPILER, compiled_draft=None):
    report = json.loads(resident(draft / 'authoring.json'))
    proof = json.loads(resident(observed))
    state = json.loads(resident(runtime))
    environment = json.loads(resident(stage))
    archived_report = report if compiled_draft is None else json.loads(resident(compiled_draft / 'authoring.json'))
    compiler_inputs = {'GPL/Wayfinder.gpl', 'GPL/Wayfinder_Data.dat', 'GPL/Wayfinder.gplproj'}
    resource_inputs = {'Data/Wayfinder_Characters.xml', 'Data/Wayfinder_Buildings.xml', 'Wayfinder.mmxml'}
    if compiled_draft is not None and (set(report['files']) != compiler_inputs | resource_inputs
                                     or set(archived_report['files']) != set(report['files'])):
        raise ValueError('Compiler reuse requires the complete known Wayfinder input set')
    if not (proof.get('originalSDKCompilerSucceeded') is True
            and proof.get('compilerExitCode') == 0
            and proof.get('ownedBrowserReleased') is True
            and proof.get('guardStopped') is False
            and state.get('compilerFinished') is True
            and state.get('compilerExitCode') == 0
            and state.get('compiled') is True):
        raise ValueError('Successful, closed official compiler trial required')
    archive = resident(app)
    if sha(archive) != environment['files'][app.name]['sha256']:
        raise ValueError('Compiler input archive differs from trial stage')
    files = {}
    with zipfile.ZipFile(app) as z:
        if z.read('wayfinder/Gplbcc.exe') != resident(compiler):
            raise ValueError('Input compiler differs from purchased official SDK compiler')
        if any(n.lower().endswith('.bcd') for n in z.namelist()):
            raise ValueError('Compiler inputs contain pre-existing bytecode')
        for name, expected in archived_report['files'].items():
            if Path(name).is_absolute() or '..' in Path(name).parts:
                raise ValueError('Unsafe draft path')
            archived = resident((draft if compiled_draft is None else compiled_draft) / name)
            if sha(archived) != expected['sha256'] or len(archived) != expected['bytes']:
                raise ValueError('Draft differs from recorded authoring source')
            if z.read('wayfinder/' + name) != archived:
                raise ValueError('Compiled source differs from draft')
            raw = resident(draft / name)
            expected = report['files'][name]
            if sha(raw) != expected['sha256'] or len(raw) != expected['bytes']:
                raise ValueError('Draft differs from recorded authoring source')
            # FourCC descriptions and mod metadata are consumed by the resource
            # loader, not Gplbcc. Reuse only an identical complete compiler input
            # set, still validating every original archive byte and receipt.
            if compiled_draft is not None and name in compiler_inputs and raw != archived:
                raise ValueError('Compiler inputs changed; a fresh SDK compilation is required')
            files[name] = raw
    raw = resident(bytecode)
    if not 28 <= len(raw) <= 16 * 1024 * 1024:
        raise ValueError('Unexpected bytecode size')
    if struct.unpack_from('<III', raw) != (len(raw) - 4, len(raw) - 4, 0xffffffff):
        raise ValueError('Invalid SDK bytecode container')
    if any(p.get('sha256') != sha(raw) or p.get('bytes') != len(raw) for p in (proof, state)):
        raise ValueError('Bytecode differs from original compiler output')
    files['Data/Wayfinder.bcd'] = raw
    result = dict(version=1, status='compiled-private-draft', bytecodeCompiled=True,
                  nativeIntegrationQualified=False, installed=False, published=False,
                  sourceAuthoringSha256=sha(resident(draft / 'authoring.json')),
                  evidenceSha256={str(p): sha(resident(p)) for p in (observed, runtime, stage)},
                  files={n: dict(bytes=len(b), sha256=sha(b)) for n, b in files.items()})
    if compiled_draft is not None:
        result['compilerInputReuse'] = dict(
            compiledAuthoringSha256=sha(resident(compiled_draft / 'authoring.json')),
            exactInputSha256={name: sha(files[name]) for name in sorted(compiler_inputs)},
            scope='Identical official compiler inputs; resource descriptions independently rebound to current authoring')
    return files, result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('draft', 'bytecode', 'observed', 'runtime', 'stage', 'app', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--compiled-draft', type=Path,
                        help='Previous exact archived draft; reuse only byte-identical GPL compiler inputs')
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Existing pack must be preserved; choose a new output directory')
    files, report = prepare(args.draft, args.bytecode, args.observed, args.runtime, args.stage, args.app,
                            compiled_draft=args.compiled_draft)
    args.output.mkdir()
    for name, raw in files.items():
        p = args.output / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(raw)
    (args.output / 'compiled.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('status', 'bytecodeCompiled', 'nativeIntegrationQualified', 'installed')}))


if __name__ == '__main__':
    main()
