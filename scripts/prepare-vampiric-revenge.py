#!/usr/bin/env python3
"""Prepare a separate, source-bound original demo overlay; never install it."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zipfile

from lib.vampiric_revenge import (
    bonus_art, legacy_template, records, replace_records, string_table)

ROOT = Path(__file__).resolve().parents[1]
GUID = '{504D4156-0000-0000-0000-000000000000}'
TEMPLATE_SHA = 'ce4cd8dfd43cf6c40766f6c100df8743094b9e06628d6d38eac8ef6a8651a5d0'
COMPILER_SHA = '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4'
BRIDGE_SHA = '6026659ec89f775c6190c3bce73914c29b4029402caadca0816951ac8aa23657'
ORIGINAL_SHA = {
    'Quests/Vampiric_Revenge.q': TEMPLATE_SHA,
    'Quests/VampiricRevenge.mqxml': '93203fea5c3587380bbbc3d1e610e890f86521282b91e3cdf926e538ae75041d',
    'DataMX/mx_textdata.cam': '60ab851f56c563025ad8db0814436c50c34594ee396e27ab77c057e4b47e0b1f',
    'DataMX/XQD1_intro.cam': '1e6b742a9250ff0affa406feb484c9bc231d51d4b7fbec4b3cfa898ae6ae3d8b',
    'Data/addinterface.cam': '18b206e02c5d19dce5b69893cbc78de70d291156549df4cbd76a2861b092c2e7',
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def bind_scripts(raw):
    tree = ET.fromstring(raw)
    groups = tree.findall('./DataGroups/LoadData/*')
    if tree.tag != 'XmlDataRoot' or not groups:
        raise ValueError('Require the native data-load configuration')
    for group in groups:
        if any(n.text == 'VampiricRevengeBridge.bcd' for n in group):
            raise ValueError('Demo bridge already installed')
        ET.SubElement(group, 'LoadGPL').text = 'VampiricRevengeBridge.bcd'
        if group.tag in ('MajestyCommonData', 'MajXCommonData'):
            ET.SubElement(group, 'LoadCAM').text = 'VampiricRevenge-menu.cam'
    return ET.tostring(tree)


def quest_catalog(quest):
    values = [quest.findtext('Description/' + kind) for kind in ('Short', 'Long')]
    if any(not value or '[' in value.replace('[newline]', '') or
           ']' in value.replace('[newline]', '') for value in values):
        raise ValueError('Unexpected demo briefing markup')
    short, long = (value.replace('[newline]', '\r\n') for value in values)
    return ('Name =\r\n[DOWNLOADABLE_QUEST_3]\r\n\r\nShort Description =\r\n[' +
            short + ']\r\n\r\nLong Description =\r\n[' + long + ']\r\n').encode('ascii')


def prepare(game_archive, alchemist_game, compiler_stage, compiler_proof, output):
    if output.exists():
        raise ValueError('Preserve earlier candidates; choose a new output')
    stage = json.loads((compiler_stage / 'stage.json').read_text())
    proof = json.loads(compiler_proof.read_text())
    sources = ROOT / 'content/vampiric-revenge'
    for name in ('VampiricRevengeBridge.gpl', 'VampiricRevengeBridge.gplproj'):
        if sha((sources / name).read_bytes()) != stage['sourceSha256'][name]:
            raise ValueError('Bridge source differs from original compiler inputs')
    bytecode = (compiler_stage / 'VampiricRevengeBridge.bcd').read_bytes()
    if (stage.get('compilerSha256') != COMPILER_SHA or
            proof.get('compiled') is not True or proof.get('headerValid') is not True or
            proof.get('compilerExitCode') != 0 or proof.get('sha256') != BRIDGE_SHA or
            len(bytecode) != 616 or sha(bytecode) != BRIDGE_SHA or
            struct.unpack_from('<III', bytecode) != (612, 612, 0xffffffff) or
            b'DOWNLOADABLE_QUEST_3\0' not in bytecode or b'VAMPIRIC_REVENGE\0' not in bytecode):
        raise ValueError('Require verified original SDK bridge compilation')
    release = json.loads((ROOT / 'deploy/alchemist-release.json').read_text())
    bindings = {p['path']: p for p in release['patches']}
    inputs, files = {}, {}
    def community(name):
        raw = (alchemist_game / name).read_bytes()
        expected = bindings[name]
        if len(raw) != expected['bytes'] or sha(raw) != expected['sha256']:
            raise ValueError('Qualified Alchemist input differs: ' + name)
        inputs[name] = sha(raw)
        return raw
    with zipfile.ZipFile(game_archive) as archive:
        def original(name):
            raw = archive.read(name)
            if sha(raw) != ORIGINAL_SHA[name]:
                raise ValueError('Purchased original resource differs: ' + name)
            inputs['original/' + name] = sha(raw)
            return raw
        for name in ('Data/miscdata.cam', 'DataMX/mx_miscdata.cam'):
            raw = community(name)
            entries = {(kind, key): body for kind, key, body in records(raw)}
            dependencies = entries[b'DATA', b'QDEP']
            if b'XQD3 :' in dependencies:
                raise ValueError('Reserved demo slot already in use')
            files[name] = replace_records(raw, {
                (b'DATA', b'XML1'): bind_scripts(entries[b'DATA', b'XML1']),
                (b'DATA', b'QDEP'): dependencies +
                    b'\r\n# Original Cyberlore demo: Vampiric Revenge\r\nXQD3 : EASY NONE\r\n\r\n',
            })
        raw = original('DataMX/mx_textdata.cam')
        entries = {(kind, key): body for kind, key, body in records(raw)}
        files['DataMX/mx_textdata.cam'] = replace_records(raw, {
            (b'STRT', b'AP30'): string_table(entries[b'STRT', b'AP30'],
                                           struct.pack('<I', 0), b'Vampiric Revenge')})
        files['Data/mx_textdata.cam'] = files['DataMX/mx_textdata.cam']
        raw = community('DataMX/mx_gpltext.cam')
        entries = {(kind, key): body for kind, key, body in records(raw)}
        files['DataMX/mx_gpltext.cam'] = replace_records(raw, {
            (b'STRT', b'QUES'): string_table(entries[b'STRT', b'QUES'], b'XQD3', b'Vampiric Revenge')})
        files['Data/mx_gpltext.cam'] = files['DataMX/mx_gpltext.cam']
        template = original('Quests/Vampiric_Revenge.q')
        if sha(template) != TEMPLATE_SHA:
            raise ValueError('Original demo map differs')
        quest = ET.fromstring(original('Quests/VampiricRevenge.mqxml')).find('Quest')
        if quest is None or quest.get('id') != GUID or quest.findtext('Name') != 'VAMPIRIC_REVENGE':
            raise ValueError('Original demo identity differs')
        for directory in ('Quests', 'QuestsMX'):
            files[directory + '/VampiricRevengeLegacy.q'] = legacy_template(template)
            files[directory + '/VampiricRevengeLegacy.qdd'] = quest_catalog(quest)
        artwork = bonus_art(original('DataMX/XQD1_intro.cam'), original('Data/addinterface.cam'))
        for directory in ('Data', 'DataMX'):
            files[directory + '/VampiricRevenge-menu.cam'] = artwork
            files[directory + '/VampiricRevengeBridge.bcd'] = bytecode
    output.mkdir(parents=True)
    for name, raw in files.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    report = dict(format='majesty-vampiric-revenge-candidate-v1', canonicalGuid=GUID,
                  nativeId='XQD3', canonicalInitializer='VAMPIRIC_REVENGE',
                  templateBodyPreserved=True, nativeBonusArtworkReused=True,
                  originalScriptsUnmodified=True, installed=False, browserQualified=False,
                  sourceSha256=stage['sourceSha256'], inputSha256=inputs,
                  files={name: dict(bytes=len(raw), sha256=sha(raw)) for name, raw in files.items()})
    (output / 'candidate.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('game-archive', 'alchemist-game', 'compiler-stage', 'compiler-proof', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    result = prepare(args.game_archive, args.alchemist_game, args.compiler_stage,
                     args.compiler_proof, args.output)
    print('Original demo overlay prepared:', len(result['files']), 'files; not installed')
