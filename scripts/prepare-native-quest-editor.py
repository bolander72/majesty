#!/usr/bin/env python3
"""Stage the official RGS editor in an isolated, private SDK runtime."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
EDITOR_SHA = 'ab8cafe411372d9ff86b6a95e2a2087836b7e01891818af90c1e605fb7d121ef'
COMPILER_SHA = '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4'
RUNTIME_FILES = ['boxedwine-shell.js', 'boxedwine.js', 'boxedwine.css',
                 'boxedwine.zip', 'boxedwine.wasm', 'browserfs.min.js', 'jszip.min.js']


PRIVATE_MFC_FILES = {
    "mfc90.dll": {
        "source": "mfc90.dll.30729.6161.Microsoft_VC90_MFC_x86.QFE",
        "sha256": "a1a6f3e18b097ab046e8771a01f8b727a44348b28b82b5beb15ee311ad27cdd6",
        "bytes": 3766600
    },
    "mfc90u.dll": {
        "source": "mfc90u.dll.30729.6161.Microsoft_VC90_MFC_x86.QFE",
        "sha256": "0ea4cd410da764916ea201c0c1e16752e0d3dc9d8571510782af4aae62509af7",
        "bytes": 3781960
    },
    "mfcm90.dll": {
        "source": "mfcm90.dll.30729.6161.Microsoft_VC90_MFC_x86.QFE",
        "sha256": "4e1455f9f205a501ad0079b4b918943a752cd3f3bfece8b36397e5700c9f09f1",
        "bytes": 59904
    },
    "mfcm90u.dll": {
        "source": "mfcm90u.dll.30729.6161.Microsoft_VC90_MFC_x86.QFE",
        "sha256": "06d0444c7c7c84b9dfbb231245368f04529c505daefe4fb52cc459e487838008",
        "bytes": 59904
    },
    "msvcr90.dll": {
        "source": "msvcr90.dll.30729.6161.Microsoft_VC90_CRT_x86.QFE",
        "sha256": "8e7fe1a1f3550c479ffd86a77bc9d10686d47f8727025bb891d8f4f0259354c8",
        "bytes": 653136
    },
    "msvcp90.dll": {
        "source": "msvcp90.dll.30729.6161.Microsoft_VC90_CRT_x86.QFE",
        "sha256": "06918cf99ad26cd6cf106881c0d5bdb212dc0bac4549805c9f5906e3d03d152c",
        "bytes": 569680
    },
    "msvcm90.dll": {
        "source": "msvcm90.dll.30729.6161.Microsoft_VC90_CRT_x86.QFE",
        "sha256": "7a74da389fbd10a710c294c2e914dc6f18e05f028f07958a2fa53ac44f0e4b90",
        "bytes": 225280
    },
    "Microsoft.VC90.MFC.manifest": {
        "source": "manifest.30729.6161.Microsoft_VC90_MFC_x86.QFE",
        "sha256": "fe3f3fb142a2ed91c5fa5950002b616ed14ef853c739ac908c846c16179e34b2",
        "bytes": 2357
    },
    "Microsoft.VC90.CRT.manifest": {
        "source": "manifest.30729.6161.Microsoft_VC90_CRT_x86.QFE",
        "sha256": "0c838c4262f99f27495a7c2a1bf4ec8f482d1c9bc2493c3c19b9360f1a06b8eb",
        "bytes": 1860
    }
}


def sha(path):
    if path.stat().st_flags & 0x40000000:
        raise ValueError(f'Dataless input: {path.name}')
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def prepare(runtime, output, mfc_payload=None, resume_project=None, resume_template=None):
    if output.exists():
        raise ValueError('Preserve previous editor trials; choose a new output')
    receipt = json.loads((ROOT / 'output/sdk145-stage.json').read_text())
    for name in RUNTIME_FILES:
        if sha(runtime / name) != receipt['files'][name]['sha256']:
            raise ValueError(f'Qualified SDK runtime differs: {name}')
    game = ROOT / 'upstream/majesty-recomp/original/gog'
    if sha(game / 'SDK/RGSeditor.exe') != EDITOR_SHA:
        raise ValueError('Original SDK editor differs')
    if sha(game / 'SDK/Gplbcc.exe') != COMPILER_SHA:
        raise ValueError('Original SDK compiler differs')
    # Bootstrap authoring dependencies only. Audio and cinematic archives are
    # deliberately absent; this is not a claim that a map can yet be generated.
    paths = ['SDK/RGSeditor.exe', 'SDK/Gplbcc.exe', 'SDK/steam_api.dll', 'SDK/steam_appid.txt',
             'Data/DataSets.xml', 'Data/MajestyDatasetDefinitions.xml',
             'Data/InterfaceStrings.xml', 'Data/miscdata.cam', 'Data/unittype.cam',
             'Data/action.cam', 'Data/terrtype.cam', 'Data/tilesetdata.cam',
             'Data/maindata.cam', 'Data/textdata.cam', 'Data/constants.rgs',
             'Data/bytecode.bcd', 'DataMX/MajestyExpansionDatasetDefinitions.xml',
             'DataMX/mx_miscdata.cam', 'DataMX/mx_unittype.cam',
             'DataMX/mx_action.cam', 'DataMX/mx_terrtype.cam',
             'DataMX/mx_tilesetdata.cam', 'DataMX/mx_maindata.cam',
             'DataMX/mx_textdata.cam', 'DataMX/mx_rgstext.cam',
             'DataMX/mx_constants.rgs', 'DataMX/MX_Compatibility.bcd',
             'DataMX/MX_Build.bcd', 'DataMX/MX_Data.bcd',
             'DataMX/MX_Decision.bcd', 'DataMX/MX_Task.bcd']
    # Installed resource names vary in case; retain their exact bytes while
    # placing them at the SDK's expected, case-insensitive Windows paths.
    entries = {}
    for name in paths:
        parent = game / Path(name).parent
        source = next(p for p in parent.iterdir()
                      if p.name.casefold() == Path(name).name.casefold())
        entries[name] = (source, sha(source))
    mfc_files = {}
    if mfc_payload:
        for name, record in PRIVATE_MFC_FILES.items():
            source = mfc_payload / record['source']
            if sha(source) != record['sha256'] or source.stat().st_size != record['bytes']:
                raise ValueError(f'Official private MFC file differs: {name}')
            mfc_files[name] = source
    resume_files = {}
    if bool(resume_project) != bool(resume_template):
        raise ValueError('Resume needs both the SDK project and template')
    if resume_project:
        for source in [resume_project, resume_template]:
            if source.stat().st_size > 8 * 1024 * 1024:
                raise ValueError('Unexpected authoring checkpoint size')
            sha(source)
        project = ET.fromstring(resume_project.read_bytes())
        templates = project.findall('./Quest/DataConfiguration/Dataset/Load/Template')
        if len(templates) != 1 or not templates[0].text:
            raise ValueError('Resume needs exactly one quest template')
        name = Path(templates[0].text)
        if (name.name != templates[0].text or name.suffix != '.q'
                or '\\' in templates[0].text or ':' in templates[0].text
                or name.name.startswith('.')):
            raise ValueError('Resume template must be a local .q filename')
        if not resume_template.read_bytes().startswith(b'RGMa'):
            raise ValueError('Resume requires an SDK RGS template')
        resume_files[name.as_posix()] = resume_template
        resume_files[name.with_suffix('.mqxml').as_posix()] = resume_project
    output.mkdir(parents=True)
    for name in RUNTIME_FILES:
        shutil.copyfile(runtime / name, output / name)
    html = (runtime / 'boxedwine.html').read_text()
    html = html.replace('<script src="sdk-observer.js"></script>', '')
    html = html.replace('Private Majesty SDK compiler trial', 'Private Majesty RGS editor trial')
    html = html.replace('Original SDK compiler; isolated memory filesystem.',
                        'Original RGS editor; isolated memory filesystem.')
    html = html.replace('Waiting for compiler', 'Waiting for editor')
    html = html.replace('Download compiled bytecode', 'Download editor output')
    (output / 'boxedwine.html').write_text(html)
    batch = ('@echo off\r\ncd game\r\n'
             'SDK\\RGSeditor.exe\r\n'
             'echo EDITOR_EXIT=%ERRORLEVEL%\r\n').encode('ascii')
    with zipfile.ZipFile(output / 'editor.zip', 'x', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('editor/start-editor.bat', batch)
        for name, (source, _) in entries.items():
            archive.write(source, 'editor/game/' + name)
        for name, source in resume_files.items():
            archive.write(source, 'editor/game/SDK/' + name)
        for name, source in mfc_files.items():
            archive.write(source, 'editor/game/SDK/' + name)
        if mfc_files:
            # App-local activation configuration only; never alter the original
            # editor executable or the host's Windows/Wine installations.
            dependencies = ''.join(
                '<dependentAssembly><assemblyIdentity type="win32" '
                f'name="Microsoft.VC90.{name}" processorArchitecture="x86" '
                'publicKeyToken="1fc8b3b9a1e18e3b"/>'
                '<bindingRedirect oldVersion="9.0.0.0-9.0.30729.6161" '
                'newVersion="9.0.30729.6161"/></dependentAssembly>'
                for name in ['MFC', 'CRT'])
            configuration = ('<?xml version="1.0" encoding="UTF-8"?>'
                '<configuration><windows><assemblyBinding '
                'xmlns="urn:schemas-microsoft-com:asm.v1">' + dependencies +
                '</assemblyBinding></windows></configuration>')
            archive.writestr('editor/game/SDK/RGSeditor.exe.config', configuration)
    report = dict(editorSha256=EDITOR_SHA, runtimeReceipt='output/sdk145-stage.json',
                  inputs={name: dict(bytes=p.stat().st_size, sha256=h)
                          for name, (p, h) in entries.items()},
                  applicationSha256=sha(output / 'editor.zip'),
                  privateMfcFiles=PRIVATE_MFC_FILES if mfc_files else {},
                  originalEditorUnmodified=True,
                  resumeFiles={name: dict(bytes=source.stat().st_size, sha256=sha(source))
                               for name, source in resume_files.items()},
                  memoryFilesystemOnly=True, playerProfilesAccessed=False,
                  launched=False, mapGenerated=False, installed=False, published=False,
                  launchQuery='?app=editor.zip&work=editor/game/SDK&p=RGSeditor.exe&auto=false&sound=false')
    (output / 'stage.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--mfc-payload', type=Path, help='Extracted official VC2008 x86 security-update payload')
    parser.add_argument('--resume-project', type=Path, help='Previously exported SDK .mqxml project')
    parser.add_argument('--resume-template', type=Path, help='Its unchanged SDK-generated .q template')
    args = parser.parse_args()
    result = prepare(args.runtime, args.output, args.mfc_payload, args.resume_project, args.resume_template)
    print(json.dumps({key: result[key] for key in ['launched', 'mapGenerated', 'installed']}))
