#!/usr/bin/env python3
"""Package the qualified Wayfinder resources into a separate local game ZIP."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile

EXE = 'MajestyHD - Old.exe'
EXE_SHA256 = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
CONFIG = 'DataMX/mx_miscdata.cam'
RESOURCE_NAMES = ('Wayfinder.bcd', 'Wayfinder-units.cam', 'Wayfinder-interface.cam')
# These are the actual resource/config inputs exercised by browser trial254.
# A changed pack needs its own gameplay qualification before distribution.
QUALIFIED = {
    'Wayfinder.bcd': '61a51da7b5a069a9839dc63ee97e50e77e47cf7d0243611f19db66faeeb19037',
    'Wayfinder-units.cam': 'f79c8de2e7eaa844f0afb8594cdea69638a2d5cdcfa0573b00c8aa90fdad3c38',
    'Wayfinder-interface.cam': '84892eb8d8b8999be2f65718ad1912f9d0a8ff9c5dc4500536c14054b27b9595',
    'mx_miscdata.cam': '2a983bf59b21dd644f02fb11dbacdbe39ad9589eedf5206157d47db86b2046dc',
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def resident(path):
    if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError(f'Cloud-evicted input: {path.name}')
    return path.read_bytes()


def resources(pack, menu):
    raw = resident(pack / 'native-resources.json')
    receipt = json.loads(raw)
    configuration = json.loads(resident(menu / 'menu.json'))
    if receipt.get('resourceIds') != ['AVz1', 'ABs1'] or receipt.get('interfaceId') != 'APw1':
        raise ValueError('Require the independent Wayfinder and Trail Lodge identities')
    if configuration.get('nativeResourceReceiptSha256') != digest(raw):
        raise ValueError('Menu configuration belongs to another resource pack')
    if configuration.get('missionBytecodeReloadGroups') != ['Rel0', 'Rel2', 'Relp', 'Rel3']:
        raise ValueError('Missing mission-entry initialization reloads')
    additions = {}
    for name in RESOURCE_NAMES:
        data = resident(pack / 'Data' / name)
        expected = receipt['files']['Data/' + name]
        if len(data) != expected['bytes'] or digest(data) != expected['sha256']:
            raise ValueError(f'Changed resource: {name}')
        if digest(data) != QUALIFIED[name]:
            raise ValueError(f'Resource differs from the gameplay-qualified pack: {name}')
        additions['DataMX/' + name] = data
    data = resident(menu / 'mx_miscdata.cam')
    if digest(data) != configuration.get('configSha256') or digest(data) != QUALIFIED['mx_miscdata.cam']:
        raise ValueError('Configuration differs from the gameplay-qualified menu')
    additions[CONFIG] = data
    return additions, configuration['sourceSha256']


def source_entries(archive):
    entries, folded = {}, set()
    for item in archive.infolist():
        name = item.filename
        path = PurePosixPath(name)
        if (path.is_absolute() or '\\' in name or ':' in name or '\x00' in name
                or any(p in ('', '.', '..') for p in name.rstrip('/').split('/'))
                or name.casefold() in folded or item.flag_bits & 1):
            raise ValueError('Unsafe, duplicate or encrypted source ZIP entry')
        folded.add(name.casefold())
        if not item.is_dir():
            entries[name] = item
    if EXE not in entries or CONFIG not in entries:
        raise ValueError('Require the original flat Majesty browser import ZIP')
    existing = {name.casefold() for name in entries}
    if any(('DataMX/' + name).casefold() in existing for name in RESOURCE_NAMES):
        raise ValueError('Source already includes Wayfinder; preserve it separately')
    for folder in ('Data', 'DataMX', 'Quests', 'QuestsMX', 'Music'):
        if not any(name.startswith(folder + '/') for name in entries):
            raise ValueError(f'Missing original game folder: {folder}')
    if len(entries) > 20000 or sum(item.file_size for item in entries.values()) > 8 * 1024**3:
        raise ValueError('Unexpectedly large source game ZIP')
    return entries


def copy_entry(source, target, name):
    checksum, size = hashlib.sha256(), 0
    with source.open(name) as incoming, target.open(name, 'w', force_zip64=True) as outgoing:
        for block in iter(lambda: incoming.read(65536), b''):
            outgoing.write(block)
            checksum.update(block)
            size += len(block)
    return dict(bytes=size, sha256=checksum.hexdigest())


def prepare(base, pack, menu, output):
    if output.exists():
        raise ValueError('Preserve existing output; choose a new directory')
    additions, original_config_sha = resources(pack, menu)
    # Validate inputs before creating output. No game/profile directory is written.
    with zipfile.ZipFile(base) as source:
        entries = source_entries(source)
        if digest(source.read(EXE)) != EXE_SHA256:
            raise ValueError('Unsupported original executable')
        if digest(source.read(CONFIG)) != original_config_sha:
            raise ValueError('Source configuration differs from the original menu receipt')
        output.mkdir(parents=True)
        temporary = output / 'game.zip.partial'
        try:
            files = {}
            with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as target:
                for name in sorted(entries):
                    if name not in additions:
                        files[name] = copy_entry(source, target, name)
                for name, data in sorted(additions.items()):
                    target.writestr(name, data)
                    files[name] = dict(bytes=len(data), sha256=digest(data))
            with zipfile.ZipFile(temporary) as candidate:
                if candidate.testzip() is not None or set(candidate.namelist()) != set(files):
                    raise ValueError('Output archive verification failed')
                for name, record in files.items():
                    h = hashlib.sha256()
                    with candidate.open(name) as stream:
                        for block in iter(lambda: stream.read(65536), b''):
                            h.update(block)
                    if candidate.getinfo(name).file_size != record['bytes'] or h.hexdigest() != record['sha256']:
                        raise ValueError(f'Output file differs: {name}')
            destination = output / 'majesty-wayfinder-game.zip'
            temporary.rename(destination)
            report = dict(version=1, contentSet='wayfinder-v1', importGameId='majesty-wayfinder',
                          resourceIds=['AVz1', 'ABs1'], sourceGameZip=str(base.resolve()),
                          originalFilesCopied=len(entries) - 1, replacedFiles=[CONFIG],
                          addedFiles=sorted(set(additions) - {CONFIG}), files=files,
                          archiveBytes=destination.stat().st_size,
                          browserInstallationQualified=False, published=False,
                          scope='Separate local import artifact; use the content-edition launcher. '
                                'Source ZIP, installed game and player saves are never modified.')
            (output / 'browser-import.json').write_text(json.dumps(report, indent=2) + '\n')
            return report
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('base', 'native-pack', 'menu', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    report = prepare(args.base, args.native_pack, args.menu, args.output)
    print(json.dumps({k: report[k] for k in ('contentSet', 'importGameId', 'archiveBytes', 'originalFilesCopied', 'browserInstallationQualified')}))


if __name__ == '__main__':
    main()
