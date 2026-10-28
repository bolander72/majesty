#!/usr/bin/env python3
"""Run the original SDK compiler in an isolated Wine prefix with bounded resources."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import struct
import subprocess
import time

COMPILER_SHA = '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4'
SCOPES = (('Any', 'common'), ('Majesty', 'base'), ('MajestyExpansion', 'expansion'))


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def read(path, limit=16 * 1024 * 1024):
    if (path.is_symlink() or not path.is_file() or path.stat().st_size > limit
            or getattr(path.stat(), 'st_flags', 0) & 0x40000000):
        raise ValueError('Unavailable or oversized compiler input: ' + path.name)
    return path.read_bytes()


def prepare_inputs(source, compiler, output):
    if output.exists():
        raise ValueError('Preserve prior compiler outputs; choose a fresh directory')
    proof_raw = read(source / 'source-stage.json')
    proof = json.loads(proof_raw)
    if proof.get('format') != 'majesty-community-combined-creator-gpl-stage-v1':
        raise ValueError('Require prepared authentic community source')
    payloads = {}
    for scope, slug in SCOPES:
        names = sorted(name for name in proof['files'] if name.startswith(scope + '/'))
        if not names or any(Path(name).parts != (scope, Path(name).name)
                            or Path(name).suffix not in ('.gpl', '.dat') for name in names):
            raise ValueError('Unexpected prepared source inventory')
        for name in names:
            raw = read(source / 'sources' / name)
            if digest(raw) != proof['files'][name]:
                raise ValueError('Prepared source changed: ' + name)
            payloads[(scope, slug, Path(name).name)] = raw
    compiler_raw = read(compiler)
    if hashlib.sha256(compiler_raw).hexdigest() != COMPILER_SHA:
        raise ValueError('Require the pinned original SDK Gplbcc.exe')
    output.mkdir(parents=True)
    (output / 'Gplbcc.exe').write_bytes(compiler_raw)
    for scope, slug in SCOPES:
        rows = []
        for (owner, _, name), raw in payloads.items():
            if owner != scope:
                continue
            filename = slug + '-' + name
            (output / filename).write_bytes(raw)
            rows.append(('data' if name.endswith('.dat') else 'source') + '="' + filename + '"')
        (output / (slug + '.gplproj')).write_bytes(('\r\n'.join(rows) + '\r\n').encode('ascii'))
    return proof, digest(proof_raw)


def compile_sources(args):
    # Reuse the source preparer's exact creator-source commit check.
    path = Path(__file__).with_name('prepare-community-guild-gpl.py')
    spec = importlib.util.spec_from_file_location('community_source_policy', path)
    policy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(policy)
    policy.verified_git(args.manager, policy.MANAGER_COMMIT)
    proof, proof_digest = prepare_inputs(args.source, args.compiler, args.out)
    import sys
    sys.path.insert(0, str(args.manager / 'src'))
    from majesty_cam.bcd import definition_keys
    from majesty_cam.gpl import parse_gpl, parse_dat

    env = dict(os.environ, WINEPREFIX=str(args.out.resolve() / 'wine-prefix'),
               WINEARCH='win32', WINEDEBUG='-all',
               WINEDLLOVERRIDES='winemenubuilder.exe=d;mscoree=d;mshtml=d')
    started, peak, outputs = time.monotonic(), 0, {}
    process = None
    try:
        for scope, slug in SCOPES:
            with (args.out / (slug + '.log')).open('xb') as log:
                process = subprocess.Popen([str(args.wine.resolve()),
                    str(args.out.resolve() / 'Gplbcc.exe'), '-in', slug + '.gplproj',
                    '-out', slug + '.bcd', '-stdout'], cwd=args.out, env=env,
                    stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                while process.poll() is None:
                    rows = [row.split(None, 3) for row in subprocess.check_output(
                        ['ps', '-axo', 'pid=,ppid=,rss=,comm='], text=True).splitlines()]
                    owned = {process.pid}
                    for _ in range(12):
                        owned.update(int(row[0]) for row in rows
                                     if len(row) == 4 and int(row[1]) in owned)
                    rss = sum(int(row[2]) for row in rows
                              if len(row) == 4 and int(row[0]) in owned) / 1024
                    peak = max(peak, rss)
                    if rss > 2048 or time.monotonic() - started > 180:
                        raise ValueError('Original SDK trial exceeded its resource/deadline guard')
                    time.sleep(.2)
            if process.returncode:
                raise ValueError('Original SDK compiler failed: ' + slug)
            # The merged expansion library includes autonomous quest scripts.
            # Keep source inputs at16 MiB; allow bounded compiler outputs up to
            #64 MiB, still checking the full container and every definition.
            raw = read(args.out / (slug + '.bcd'), limit=64 * 1024 * 1024)
            if (len(raw) < 28 or struct.unpack_from('<III', raw)
                    != (len(raw) - 4, len(raw) - 4, 0xffffffff)):
                raise ValueError('Original SDK emitted no valid bytecode: ' + slug)
            keys = definition_keys(raw)
            expected = set()
            for name in proof['files']:
                if not name.startswith(scope + '/'):
                    continue
                source_raw = read(args.source / 'sources' / name)
                parser = parse_gpl if name.endswith('.gpl') else parse_dat
                expected.update(item.key for item in parser(source_raw.decode('cp1252'), name).items)
            if expected != keys:
                raise ValueError('Compiled definitions differ from prepared source: ' + slug)
            outputs[slug] = dict(**digest(raw), exitCode=process.returncode,
                                 headerValid=True, sourceDefinitions=len(expected),
                                 compiledDefinitions=len(keys))
    finally:
        if process is not None and process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=10)
        # This prefix is newly created inside this output; never stop a user server.
        subprocess.run([str(args.wineserver.resolve()), '-k'], env=env,
                       capture_output=True, timeout=10)
    receipt = dict(format='majesty-community-original-sdk-compile-v1',
        compilerSha256=COMPILER_SHA, sourceStage=proof_digest, outputs=outputs,
        elapsedSeconds=round(time.monotonic() - started, 2), peakRssMiB=round(peak, 1),
        compiled=True, compilerSourceDefinitionsQualified=True,
        compiledBytesExportedQualified=True, playerProfilesAccessed=False,
        nativeRuntimeQualified=False, browserPlayable=False, published=False)
    (args.out / 'compiler-proof.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'compiler', 'manager', 'wine', 'wineserver', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        receipt = compile_sources(args)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        parser.exit(1, f'Community SDK compilation refused: {error}\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
