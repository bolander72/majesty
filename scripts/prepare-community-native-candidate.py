#!/usr/bin/env python3
"""Assemble an isolated three-guild native candidate; never publish or launch it."""
import argparse
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import shutil
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
from majesty_cam.cam import CamArchive, read_cam


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def relative(name):
    path = Path(name)
    if not name or path.is_absolute() or '..' in path.parts or path == Path('.') or '\\' in name:
        raise ValueError('Unsafe collection path')
    return path


def read(path, expected=None):
    if not path.is_file() or getattr(path.stat(), 'st_flags', 0) & 0x40000000 or path.stat().st_size > 64 * 1024 * 1024:
        raise ValueError('Require a resident bounded input: ' + str(path))
    raw = path.read_bytes()
    if expected is not None and digest(raw) != expected:
        raise ValueError('Candidate input binding changed: ' + str(path))
    return raw


def merge_archive(stock, overlay):
    if any(s.extension not in (b'STRT', b'SMNU') for s in overlay.sections):
        raise ValueError('Only native text and widget overlays may merge here')
    additions = {(s.extension, e.name[:4]): e for s in overlay.sections for e in s.entries}
    if len(additions) != sum(len(s.entries) for s in overlay.sections):
        raise ValueError('Duplicate overlay resource')
    seen, sections = set(), []
    for section in stock.sections:
        entries = []
        for entry in section.entries:
            key = section.extension, entry.name[:4]
            if key in seen:
                raise ValueError('Duplicate original resource')
            seen.add(key)
            entries.append(additions.get(key, entry))
        entries += [e for key, e in additions.items() if key[0] == section.extension and key not in seen]
        seen.update((section.extension, e.name[:4]) for e in entries)
        sections.append(replace(section, entries=tuple(entries)))
    for section in overlay.sections:
        entries = tuple(e for e in section.entries if (section.extension, e.name[:4]) not in seen)
        if entries:
            sections.append(replace(section, entries=entries))
            seen.update((section.extension, e.name[:4]) for e in entries)
    return CamArchive(tuple(sections))


OLD_MEDIA = {'Alchemist-native-interface-text.cam', 'alchemist_maindata.cam',
    'alchemist_interfacedata.cam', 'alchemist_audio.cam', 'alchemist_sounddesc.cam',
    'Alchemist-native-units.cam', 'Alchemist-native-actions.cam'}
NEW_MEDIA = ('Community-main.cam', 'Community-interface.cam', 'Community-audio.cam')


def activate_groups(raw):
    if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('Native groups must not declare entities')
    root = ET.fromstring(raw)
    groups = root.findall('./DataGroups/LoadData/*')
    if not groups:
        raise ValueError('Missing native classifications')
    proof = {}
    for group in groups:
        edition = 'Base' if group.tag in ('MajestyCommonData', 'Rel0', 'Rel2') else (
            'Expansion' if group.tag in ('MajXCommonData', 'Relp', 'Rel3') else None)
        if not edition:
            continue
        old = list(group)
        for child in old:
            if child.tag == 'LoadCAM' and child.text in OLD_MEDIA:
                group.remove(child)
        # Preserve old MJA exports for existing saves, but let final authored
        # prototypes/functions register before that prior compatibility library.
        at = next((i for i, child in enumerate(group) if child.tag == 'LoadGPL'
                   and child.text == 'Alchemist_Composed.bcd'), len(group))
        for offset, filename in enumerate(['Community_Common.bcd', 'Community_' + edition + '.bcd']):
            child = ET.Element('LoadGPL'); child.text = filename
            group.insert(at + offset, child)
        for filename in NEW_MEDIA:
            ET.SubElement(group, 'LoadCAM').text = filename
        kept = [(c.tag, c.text) for c in old if not (c.tag == 'LoadCAM' and c.text in OLD_MEDIA)]
        actual = [(c.tag, c.text) for c in group if not (c.text or '').startswith('Community_')
                  and c.text not in NEW_MEDIA]
        if actual != kept:
            raise ValueError('Existing classification order changed')
        proof[group.tag] = dict(edition=edition, priorGplAndDemoOrderPreserved=True)
    return ET.tostring(root, encoding='utf-8'), proof


def prepare(args):
    if args.out.exists() or args.out.is_symlink() or args.out.resolve().is_relative_to(args.game.resolve()):
        raise ValueError('Choose a fresh isolated output')
    source_raw = read(args.source / 'source-stage.json'); source = json.loads(source_raw)
    legacy_raw = read(args.legacy / 'source-stage.json'); legacy = json.loads(legacy_raw)
    tables_raw = read(args.tables / 'native-tables-stage.json'); tables = json.loads(tables_raw)
    media_raw = read(args.media / 'media-stage.json'); media = json.loads(media_raw)
    compiler_raw = read(args.compiled / 'compiler-proof.json'); compiler = json.loads(compiler_raw)
    if (legacy['legacyOriginalStage'] != digest(source_raw) or tables['sourceStage'] != digest(source_raw)
            or media['sourceStage'] != digest(source_raw) or not compiler['compiled']):
        raise ValueError('Require one final compiled/source/resource context')
    if (tables['baseRelease'] != digest(read(ROOT / 'deploy/alchemist-release.json')) or
            tables['baseDemoRelease'] != digest(read(ROOT / 'deploy/vampiric-revenge-release.json'))):
        raise ValueError('Native tables belong to a different deployed baseline')
    outputs = {}
    for scope, slug in [('Any', 'common'), ('Majesty', 'base'), ('MajestyExpansion', 'expansion')]:
        for name, expected in legacy['files'].items():
            relative(name)
            if name.startswith(scope + '/'):
                raw = read(args.legacy / 'sources' / name, expected)
                if read(args.compiled / (slug + '-' + Path(name).name)) != raw:
                    raise ValueError('Original SDK inputs differ from final source')
        expected = {k: compiler['outputs'][slug][k] for k in ['bytes', 'sha256']}
        outputs[slug] = read(args.compiled / (slug + '.bcd'), expected)
    patches = {}
    for name in ['alchemist-release.json', 'vampiric-revenge-release.json']:
        for item in json.loads(read(ROOT / 'deploy' / name))['patches']:
            relative(item['path'])
            patches[item['path'].casefold()] = item
    paths = {}
    for key, item in patches.items():
        expected = {k:item[k] for k in ['bytes', 'sha256']}
        path = next((folder / item['path'] for folder in [args.demo, args.game]
                     if (folder / item['path']).is_file() and digest(read(folder / item['path'])) == expected), None)
        if path is None:
            raise ValueError('Qualified baseline file unavailable: ' + item['path'])
        paths[key] = path
    if tables['verifiedEffectiveBaseFiles'] != len(paths):
        raise ValueError('Native tables and deployed baseline differ')
    staged = {name: read(args.tables / relative(name), expected) for name, expected in tables['files'].items()}
    for name, expected in media['files'].items():
        relative(name)
        raw = read(args.media / name, expected)
        if name in ['merged_main.cam', 'merged_interface.cam', 'merged_audio.cam']:
            for directory in ['Data', 'DataMX']:
                staged[directory + '/Community-' + name.removeprefix('merged_')] = raw
    for directory in ['Data', 'DataMX']:
        for slug, target in [('common','Common'),('base','Base'),('expansion','Expansion')]:
            staged[directory + '/Community_' + target + '.bcd'] = outputs[slug]
    runtime = {'community-name-bindings.bin': staged.pop('community-name-bindings.bin')}
    for edition, expected in legacy['legacyRoutes'].items():
        runtime['routes-' + edition + '.tsv'] = read(args.legacy / 'routes' / edition / 'shared-overrides.tsv', expected)
    # Targets have the same MJC name in both editions; absent edition aliases
    # fall through to the original VM. Refuse any inconsistent common target.
    union = {}
    for raw in runtime.values():
        if not raw.startswith(b'majesty-community-shared-gpl-v2\n'):
            continue
        for line in raw.splitlines()[1:]:
            name, target = line.split(b'\t')
            if name in union and union[name] != target:
                raise ValueError('Conflicting edition route target')
            union[name] = target
    runtime['shared-overrides.tsv'] = b'majesty-community-shared-gpl-v2\n' + b''.join(
        name + b'\t' + union[name] + b'\n' for name in sorted(union, key=bytes.lower))
    args.out.mkdir(parents=True); game = args.out / 'game'; game.mkdir()
    for directory in ['Data', 'DataMX', 'Quests', 'QuestsMX', 'Music']:
        for path in (args.game / directory).rglob('*'):
            target = game / path.relative_to(args.game)
            if path.is_dir(): target.mkdir(parents=True, exist_ok=True)
            else:
                if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
                    raise ValueError('Cold game input: ' + str(path))
                target.parent.mkdir(parents=True, exist_ok=True); target.symlink_to(path.resolve(strict=True))
    exe = args.game / 'MajestyHD - Old.exe'
    if digest(read(exe))['sha256'] != '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542':
        raise ValueError('Require the pinned original guest')
    (game / exe.name).symlink_to(exe.resolve())
    written = {}
    def write(name, raw):
        target = game / relative(name)
        if target.is_symlink(): target.unlink()
        target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
        written[name] = digest(raw)
    for key, path in paths.items():
        write(patches[key]['path'], read(path))
    for name, raw in staged.items(): write(name, raw)
    group_proof = {}
    for directory, prefix in [('Data',''),('DataMX','mx_')]:
        for filename in ['textdata.cam', 'gpltext.cam']:
            name = directory + '/' + prefix + filename
            path = next(p for p in (game / directory).iterdir() if p.name.casefold() == (prefix + filename).casefold())
            write(name, merge_archive(read_cam(read(path)), read_cam(staged[directory + '/Community-' + filename])).to_bytes())
        name = directory + '/' + prefix + 'miscdata.cam'; archive = read_cam(read(game / name))
        sections = []
        for section in archive.sections:
            entries = []
            for entry in section.entries:
                if section.extension == b'DATA' and entry.name[:4] == b'XML1':
                    raw, group_proof[directory] = activate_groups(entry.data)
                    entry = replace(entry, data=raw)
                entries.append(entry)
            sections.append(replace(section, entries=tuple(entries)))
        write(name, CamArchive(tuple(sections)).to_bytes())
    (args.out / 'runtime').mkdir()
    for name, raw in runtime.items(): (args.out / 'runtime' / name).write_bytes(raw)
    result = dict(format='majesty-community-native-candidate-v1', sourceStage=digest(source_raw),
        legacyStage=digest(legacy_raw), tablesStage=digest(tables_raw), mediaStage=digest(media_raw),
        compilerProof=digest(compiler_raw), originalSdkInputsByteIdentical=True,
        effectiveBaseFiles=len(paths), groups=group_proof,
        runtimeFiles={k:digest(v) for k,v in runtime.items()},
        compiledFiles={k:digest(v) for k,v in outputs.items()}, files=written, oldMjaExportsRetained=True,
        allRequiredRuntimeCapabilitiesActivated=False, nativePanelsNeedGameplayAudit=['CGPH','AP78'],
        originalSaveCompatibilityQualified=False, nativeGuildGameplayQualified=False,
        browserPlayable=False, published=False)
    (args.out / 'candidate.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['game','demo','source','legacy','tables','media','compiled','out']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try: result = prepare(args)
    except (ValueError, OSError, KeyError, StopIteration) as error:
        parser.exit(1, f'Private community candidate refused: {error}\n')
    print(json.dumps(dict(baseFiles=result['effectiveBaseFiles'], originalSdkInputsByteIdentical=True, published=False)))


if __name__ == '__main__':
    main()
