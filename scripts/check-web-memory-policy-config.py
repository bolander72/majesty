#!/usr/bin/env python3
"""Evaluate link settings in CMake script mode, without a native build."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT/'upstream/majesty-recomp/kit'


def main():
    output = ROOT/'output/web-memory-policy-config-observed.json'
    output.unlink(missing_ok=True)
    beside = Path(sys.executable).with_name('cmake')
    cmake = str(beside) if beside.is_file() else shutil.which('cmake')
    assert cmake, 'CMake is required; do not silently skip configuration checks'
    policies = {}
    with tempfile.TemporaryDirectory(prefix='web-memory-policy-') as directory:
        for policy in ['legacy', 'conservative']:
            script, result_path = Path(directory)/'policy.cmake', Path(directory)/'options.txt'
            script.write_text('include("'+(KIT/'cmake/WebMemory.cmake').as_posix()+'")\n'
                'recomp_web_memory_options(options "'+policy+'")\n'
                'file(WRITE "'+result_path.as_posix()+'" "${options}")\n')
            subprocess.run([cmake, '-P', str(script)], check=True, capture_output=True, timeout=10)
            flags = result_path.read_text().split(';')
            assert len(flags) == 2
            values = dict(flag.split('=', 1) for flag in flags)
            policies[policy] = dict(flags=flags,
                step=float(values['-sMEMORY_GROWTH_GEOMETRIC_STEP']),
                excessCapBytes=int(values['-sMEMORY_GROWTH_GEOMETRIC_CAP']))
    assert policies['legacy']['step'] == 0.2 and policies['legacy']['excessCapBytes'] == 100663296
    assert policies['conservative']['step'] == 0.05 and policies['conservative']['excessCapBytes'] == 16777216
    host = (KIT/'host/CMakeLists.txt').read_text()
    assert 'recomp_web_memory_options(web_memory_options "${RECOMP_WEB_MEMORY_GROWTH}")' in host
    assert '${web_memory_options}' in host[host.index('target_link_options(recomp_app PRIVATE', host.index('elseif(EMSCRIPTEN)')):]
    assert 'set(RECOMP_WEB_MEMORY_GROWTH "legacy" CACHE STRING' in host
    files = ['scripts/check-web-memory-policy-config.py',
        'upstream/majesty-recomp/kit/cmake/WebMemory.cmake',
        'upstream/majesty-recomp/kit/host/CMakeLists.txt',
        'upstream/majesty-recomp/kit/tools/build.py']
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    result = dict(qualified=True, scope='CMake policy function evaluation and host option wiring',
        policies=policies, defaultPolicy='legacy', cmakeScriptRuns=2,
        nativeBuildRun=False, hostProjectConfigured=False, compiledArtifactUpdated=False,
        gameLaunched=False, browserUsed=False, sourceSha256={name: sha(ROOT/name) for name in files})
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, policies=2, cmakeScriptRuns=2, nativeBuildRun=False)))


if __name__ == '__main__':
    main()
