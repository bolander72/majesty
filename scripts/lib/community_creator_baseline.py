"""Authenticate a recovered creator baseline against its original SDK outputs."""
import hashlib
import json
from pathlib import Path


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def verify_creator_baseline(source, reference, compiled=None):
    raw = (source / 'source-stage.json').read_bytes()
    binding = digest(raw)
    if binding == reference['sourceStage']:
        return dict(mode='pinned-manifest', sourceStage=binding)
    if compiled is None:
        raise ValueError('Creator baseline differs; require an independently compiled recovery proof')
    return verify_compiled_baseline(source, reference, compiled)


def verify_compiled_baseline(source, reference, compiled):
    raw = (source / 'source-stage.json').read_bytes()
    binding = digest(raw)
    proof_raw = (compiled / 'compiler-proof.json').read_bytes()
    proof = json.loads(proof_raw)
    if (proof.get('format') != 'majesty-community-original-sdk-compile-v1'
            or proof.get('compilerSha256') != reference['compilerSha256']
            or proof.get('sourceStage') != binding
            or any(proof.get(key) is not True for key in (
                'compiled', 'compilerSourceDefinitionsQualified', 'compiledBytesExportedQualified'))
            or set(proof.get('outputs', {})) != set(reference['outputs'])):
        raise ValueError('Recovered creator compiler proof is incomplete or belongs to another source')
    stage = json.loads(raw)
    if stage.get('format') != 'majesty-community-combined-creator-gpl-stage-v1' or not stage.get('files'):
        raise ValueError('Require a complete recovered creator source inventory')
    for name, expected in stage['files'].items():
        path = Path(name)
        if (len(path.parts) != 2 or path.parts[0] not in ('Any', 'Majesty', 'MajestyExpansion')
                or path.suffix not in ('.gpl', '.dat')):
            raise ValueError('Unexpected recovered creator source path')
        file = source / 'sources' / path
        if file.is_symlink() or file.stat().st_size > 2 * 1024 * 1024 or digest(file.read_bytes()) != expected:
            raise ValueError('Recovered creator source differs from its compiler proof: ' + name)
    outputs = {}
    for scope, expected in reference['outputs'].items():
        actual = proof['outputs'][scope]
        for key in ('bytes', 'sha256', 'sourceDefinitions', 'compiledDefinitions'):
            if actual.get(key) != expected[key]:
                raise ValueError('Recovered creator output differs from the original: ' + scope)
        if actual.get('exitCode') != 0 or actual.get('headerValid') is not True:
            raise ValueError('Recovered creator compilation is unqualified: ' + scope)
        file = compiled / (scope + '.bcd')
        if file.is_symlink() or file.stat().st_size > 64 * 1024 * 1024:
            raise ValueError('Unavailable recovered creator bytecode: ' + scope)
        outputs[scope] = digest(file.read_bytes())
        if outputs[scope] != {key: expected[key] for key in ('bytes', 'sha256')}:
            raise ValueError('Recovered creator bytecode changed: ' + scope)
    return dict(mode='compiler-byte-identical', sourceStage=binding,
                originalSourceStage=reference.get('sourceStage'), originalManifestRecovered=False,
                compilerProof=digest(proof_raw), outputs=outputs)
