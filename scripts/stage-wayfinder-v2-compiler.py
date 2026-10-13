#!/usr/bin/env python3
"""Stage source-bound Wayfinder compilation with the verified original SDK."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import zipfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stage(workspace, runtime, draft, output):
    if output.exists():
        raise ValueError('Preserve earlier compiler trials')
    runtime_proof = json.loads((workspace / 'output/sdk145-stage.json').read_text())
    author = json.loads((draft / 'authoring.json').read_text())
    names = list(runtime_proof['files'])
    for name in names:
        if sha((runtime / name).read_bytes()) != runtime_proof['files'][name]['sha256']:
            raise ValueError('Verified compiler runtime changed: ' + name)
    files = {}
    for name, expected in author['files'].items():
        data = (draft / name).read_bytes()
        if len(data) != expected['bytes'] or sha(data) != expected['sha256']:
            raise ValueError('Changed authoring input: ' + name)
        files[name] = data
    compiler = workspace / 'upstream/majesty-recomp/original/gog/SDK/Gplbcc.exe'
    raw = compiler.read_bytes()
    if sha(raw) != '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4':
        raise ValueError('Original compiler hash differs')
    output.mkdir(parents=True)
    for name in names:
        shutil.copyfile(runtime / name, output / name)
    # Keep bytecode out of the inputs. The observer reads a guest process exit
    # receipt and independently hashes the output created by that process.
    batch = (b'@echo off\r\ncd GPL\r\n'
             b'..\\Gplbcc.exe -in Wayfinder.gplproj -out Wayfinder.bcd -stdout > compiler.log 2>&1\r\n'
             b'set compile_exit=%ERRORLEVEL%\r\n'
             b'echo COMPILE_EXIT=%compile_exit% > compile.status\r\n'
             b'type compiler.log\r\necho COMPILE_EXIT=%compile_exit%\r\n'
             b'exit /b %compile_exit%\r\n')
    app = output / 'wayfinder-v2.zip'
    with zipfile.ZipFile(app, 'x', zipfile.ZIP_DEFLATED) as z:
        z.writestr('wayfinder/Gplbcc.exe', raw)
        z.writestr('wayfinder/compile.bat', batch)
        for name, data in files.items():
            z.writestr('wayfinder/' + name, data)
    meta = dict(compilerInvoked=False, bytecodeCompiled=False,
                compilerSha256=sha(raw), sourceAuthoringSha256=sha((draft / 'authoring.json').read_bytes()),
                sourceSha256={name: sha(data) for name, data in files.items()},
                files={app.name: dict(bytes=app.stat().st_size, sha256=sha(app.read_bytes()))},
                launchQuery='?app=wayfinder-v2.zip&work=wayfinder&p=compile.bat&auto=false&sound=false')
    (output / 'stage.json').write_text(json.dumps(meta, indent=2) + '\n')
    return meta


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for name in ['workspace', 'runtime', 'draft', 'output']:
        p.add_argument('--' + name, type=Path, required=True)
    a = p.parse_args()
    stage(a.workspace, a.runtime, a.draft, a.output)
    print('Original SDK compiler staged; compilation is not yet qualified')
