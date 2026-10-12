#!/usr/bin/env python3
"""Stage an isolated official SDK quest compiler; never launch or install it."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
COMPILER_SHA = '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4'


def resident(path):
    if path.stat().st_flags & 0x40000000:
        raise ValueError(f'Dataless input: {path.name}')
    return path.read_bytes()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def prepare(runtime, output):
    if output.exists():
        raise ValueError('Preserve existing compiler trials; choose a new output')
    receipt = json.loads(resident(ROOT / 'output/sdk145-stage.json'))
    names = ['boxedwine-shell.js', 'boxedwine.js', 'boxedwine.css', 'boxedwine.zip',
             'boxedwine.wasm', 'browserfs.min.js', 'jszip.min.js', 'boxedwine.html', 'sdk-observer.js']
    for name in names:
        data = resident(runtime / name)
        if sha(data) != receipt['files'][name]['sha256']:
            raise ValueError(f'Qualified compiler runtime changed: {name}')
    compiler = resident(ROOT / 'upstream/majesty-recomp/original/gog/SDK/Gplbcc.exe')
    if sha(compiler) != COMPILER_SHA:
        raise ValueError('Official SDK compiler differs')
    source = ROOT / 'content/the-lost-trail'
    inputs = {name: resident(source / name) for name in ['TheLostTrail.gpl', 'TheLostTrail.gplproj']}
    output.mkdir(parents=True)
    for name in names:
        shutil.copyfile(runtime / name, output / name)
    observer = (output / 'sdk-observer.js').read_text()
    observer = observer.replace('/files/wayfinder/GPL/', '/files/quest/GPL/').replace('Wayfinder.bcd', 'TheLostTrail.bcd')
    (output / 'sdk-observer.js').write_text(observer)
    # A real exit-code receipt is written by the guest batch process. No
    # bytecode is included in the input ZIP or inferred from a log message.
    batch = ('@echo off\r\ncd GPL\r\n'
             '..\\Gplbcc.exe -in TheLostTrail.gplproj -out TheLostTrail.bcd -stdout > compiler.log 2>&1\r\n'
             'set compile_exit=%ERRORLEVEL%\r\n'
             'echo COMPILE_EXIT=%compile_exit% > compile.status\r\n'
             'type compiler.log\r\necho COMPILE_EXIT=%compile_exit%\r\n'
             'exit /b %compile_exit%\r\n').encode('ascii')
    with zipfile.ZipFile(output / 'quest.zip', 'x', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('quest/Gplbcc.exe', compiler)
        archive.writestr('quest/compile.bat', batch)
        for name, data in inputs.items():
            archive.writestr('quest/GPL/' + name, data)
    metadata = dict(compilerSha256=COMPILER_SHA, compilerInvoked=False, bytecodeCompiled=False,
                    nativeIntegrationQualified=False, installed=False, profilesAccessed=False,
                    sourceSha256={name: sha(data) for name, data in inputs.items()},
                    applicationSha256=sha(resident(output / 'quest.zip')),
                    runtimeReceipt='output/sdk145-stage.json',
                    launchQuery='?app=quest.zip&work=quest&p=compile.bat&auto=false&sound=false')
    (output / 'stage.json').write_text(json.dumps(metadata, indent=2) + '\n')
    return metadata


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = prepare(args.runtime, args.output)
    print(json.dumps({key: result[key] for key in ['compilerInvoked', 'bytecodeCompiled', 'installed']}))
