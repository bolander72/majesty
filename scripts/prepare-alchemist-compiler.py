#!/usr/bin/env python3
"""Stage source-bound Alchemist GPL for the official compiler; never launch it."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

COMPILER_SHA = '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4'
RUNTIME_FILES = ('boxedwine-shell.js', 'boxedwine.js', 'boxedwine.css', 'boxedwine.zip',
                 'boxedwine.wasm', 'browserfs.min.js', 'jszip.min.js', 'boxedwine.html')
INPUT_FILES = ('Alchemist_Composed.gpl', 'Alchemist_Composed.dat', 'Alchemist_Composed.gplproj')


def read(path):
    if path.is_symlink() or not path.is_file() or getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError('Unavailable or linked compiler input: ' + path.name)
    return path.read_bytes()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def prepare(source, runtime, runtime_receipt, compiler, observer, output):
    if output.exists():
        raise ValueError('Preserve existing compiler output; choose a new directory')
    composition = json.loads(read(source / 'source-composition.json'))
    if composition.get('format') != 'majesty-alchemist-source-composition-v1' or composition.get('sourcePoliciesApplied') is not True:
        raise ValueError('Require complete source-policy composition')
    inputs = {name: read(source / name) for name in INPUT_FILES}
    for name, raw in inputs.items():
        if composition['files'][name] != dict(bytes=len(raw), sha256=sha(raw)):
            raise ValueError('Composed compiler source changed: ' + name)
    receipt = json.loads(read(runtime_receipt))
    runtime_data = {name: read(runtime / name) for name in RUNTIME_FILES}
    for name, raw in runtime_data.items():
        if sha(raw) != receipt['files'][name]['sha256']:
            raise ValueError('Qualified compiler runtime differs: ' + name)
    observer_raw = read(observer)
    if sha(observer_raw) != receipt['files']['sdk-observer.js']['sha256']:
        raise ValueError('Original compiler observer differs')
    compiler_raw = read(compiler)
    if sha(compiler_raw) != COMPILER_SHA:
        raise ValueError('Official compiler differs')
    updated_observer = observer_raw.decode().replace('/files/wayfinder/GPL/', '/files/quest/GPL/').replace('Wayfinder.bcd', 'Alchemist_Composed.bcd')
    batch = ('@echo off\r\ncd GPL\r\n'
             '..\\Gplbcc.exe -in Alchemist_Composed.gplproj -out Alchemist_Composed.bcd -stdout > compiler.log 2>&1\r\n'
             'set compile_exit=%ERRORLEVEL%\r\n'
             'echo COMPILE_EXIT=%compile_exit% > compile.status\r\n'
             'type compiler.log\r\necho COMPILE_EXIT=%compile_exit%\r\n'
             'exit /b %compile_exit%\r\n').encode('ascii')
    output.mkdir(parents=True)
    for name, raw in runtime_data.items():
        (output / name).write_bytes(raw)
    (output / 'sdk-observer.js').write_text(updated_observer)
    with zipfile.ZipFile(output / 'quest.zip', 'x', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('quest/Gplbcc.exe', compiler_raw)
        archive.writestr('quest/compile.bat', batch)
        for name, raw in inputs.items():
            archive.writestr('quest/GPL/' + name, raw)
    report = dict(format='majesty-alchemist-compiler-stage-v1', compilerSha256=COMPILER_SHA,
                  sourceCompositionSha256=sha(read(source / 'source-composition.json')),
                  files={name: dict(bytes=len(raw), sha256=sha(raw)) for name, raw in inputs.items()},
                  applicationSha256=sha(read(output / 'quest.zip')),
                  launchQuery='?app=quest.zip&work=quest&p=compile.bat&auto=false&sound=false',
                  compilerInvoked=False, bytecodeCompiled=False, browserPlayable=False, installed=False)
    (output / 'stage.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'runtime', 'runtime-receipt', 'compiler', 'observer', 'out'):
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    try:
        prepare(args.source, args.runtime, args.runtime_receipt, args.compiler, args.observer, args.out)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Alchemist compiler preparation refused: {error}\n')
    print('Source-bound official compiler staged; not launched or installed')
