#!/usr/bin/env python3
"""Stage the unchanged upstream analyzer outside an offloaded source directory."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tomllib

ANALYZER_BLOB = 'bd067f15b7f33e199d750e71b1e331605cb596de'
EXE_SHA256 = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def prepare(game, executable, analyzer, kit_tools, output):
    if output.exists() or output.is_symlink():
        raise ValueError('Preserve existing analysis and choose a fresh directory')
    if any(part.startswith('.') for part in output.resolve().parts):
        raise ValueError('Ghidra rejects hidden elements in its project path; use a visible local directory outside iCloud')
    source = analyzer.read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(source)).encode() + b'\0' + source).hexdigest()
    if blob != ANALYZER_BLOB:
        raise ValueError('Expected the verified unchanged upstream analyzer')
    config = tomllib.loads((game / 'game.toml').read_text())
    if config['game']['sha256'] != EXE_SHA256 or hashlib.sha256(executable.read_bytes()).hexdigest() != EXE_SHA256:
        raise ValueError('Expected the pinned DirectDraw executable and configuration')
    developer_path = Path(config['game']['developer_exe'])
    if developer_path != Path('original/gog/MajestyHD - Old.exe'):
        raise ValueError('Expected the original relative installation layout')
    files = {'game.toml': (game / 'game.toml').read_bytes(),
             'globals.toml': (game / 'globals.toml').read_bytes(),
             'tools/analyze.py': source,
             'kit/tools/game_config.py': (kit_tools / 'game_config.py').read_bytes(),
             'kit/tools/ExportProgram.java': (kit_tools / 'ExportProgram.java').read_bytes()}
    for name in config['translate']['native']['sources']:
        files[name] = (game / name).read_bytes()
    for header in game.glob('*.h'):
        files[header.name] = header.read_bytes()
    output.mkdir(parents=True)
    for name, data in files.items():
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    (output / 'original').mkdir()
    (output / 'original/gog').symlink_to(executable.resolve().parent, target_is_directory=True)
    (output / 'analysis').mkdir()
    receipt = {'format': 'majesty-original-analysis-recovery-v1',
               'upstreamAnalyzerGitBlob': blob, 'exeSha256': EXE_SHA256,
               'filesSha256': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()},
               'originalAnalysisUntouched': True, 'analysisComplete': False,
               'engineCompiled': False, 'browserQualified': False}
    (output / 'source-binding.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('game', 'executable', 'analyzer', 'kit-tools', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        prepare(args.game, args.executable, args.analyzer, args.kit_tools, args.out)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Analysis recovery preparation refused: {error}\n')
    print('Fresh analysis view staged; run the original analyzer under resource guards')
