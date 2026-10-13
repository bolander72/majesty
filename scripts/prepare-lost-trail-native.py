#!/usr/bin/env python3
"""Stage a private Lost Trail native integration candidate; never install/publish."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'wayfinder_menu', ROOT / 'scripts/prepare-wayfinder-native-menu.py')
MENU = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MENU)
from lib.lost_trail_menu import (
    MENU_FILENAME, MENU_SHA256, QUEST_TEXT_SHA256,
    quest_title, reserved_art, reserved_title)
BASE_TEMPLATE_SHA = 'ea1554ac9f5b43975b4218e24ba01d84b1af1c43b0601e357e08f29140d7530e'
WAYFINDER_MENU_SHA = '2a983bf59b21dd644f02fb11dbacdbe39ad9589eedf5206157d47db86b2046dc'
LOAD_GROUPS = ('MajXCommonData', 'Rel0', 'Rel2', 'Relp', 'Rel3')
LEGACY_QUEST_ID = 'XQD2'
LEGACY_INITIALIZER = 'DOWNLOADABLE_QUEST_2'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def resident(path):
    if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError(f'Cloud-evicted input: {path.name}')
    return path.read_bytes()


def initializer(raw):
    # Original RGM6 and SDK RGMa files begin with a wrapper and duplicate
    # version marker, then a zero-terminated initialization function name.
    if (len(raw) < 32 or raw[:4] not in (b'RGM6', b'RGMa')
            or raw[4:8] != b'\0' * 4 or raw[8:16] != raw[:8]):
        raise ValueError('Unsupported RGS template envelope')
    end = raw.find(b'\0', 16, 80)
    if end < 17 or len(raw) - end < 16:
        raise ValueError('Missing bounded RGS initialization name')
    try:
        name = raw[16:end].decode('ascii')
    except UnicodeDecodeError as error:
        raise ValueError('Invalid RGS initialization name') from error
    if not re.fullmatch(r'[A-Za-z0-9_ ]+', name):
        raise ValueError('Invalid RGS initialization name')
    return name, end


def rename_initializer(raw, expected, new):
    old, end = initializer(raw)
    if old != expected or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,62}', new):
        raise ValueError('RGS initializer differs or replacement is invalid')
    # This is a serialized CString, not a directory offset. Preserve every
    # subsequent template byte, including unit/force/terrain definitions.
    result = raw[:16] + new.encode('ascii') + raw[end:]
    actual, new_end = initializer(result)
    if actual != new or result[new_end:] != raw[end:]:
        raise ValueError('RGS payload preservation failed')
    return result


def bind_scripts(raw, filename='TheLostTrail.bcd'):
    tree = ET.fromstring(raw)
    load = tree.find('./DataGroups/LoadData')
    if tree.tag != 'XmlDataRoot' or load is None:
        raise ValueError('Require the native legacy load configuration')
    groups = []
    for name in LOAD_GROUPS:
        matches = load.findall(name)
        if len(matches) != 1:
            raise ValueError('Missing or duplicate native mission load group')
        group = matches[0]
        if any(n.tag == 'LoadGPL' and n.text == filename for n in group):
            raise ValueError('Lost Trail scripts already bound')
        if not any(n.tag == 'LoadGPL' and n.text == 'Wayfinder.bcd' for n in group):
            raise ValueError('Require the qualified Wayfinder script reloads')
        groups.append(group)
    for group in groups:
        ET.SubElement(group, 'LoadGPL').text = filename
    common = groups[0]
    if any(n.tag == 'LoadCAM' and n.text == MENU_FILENAME for n in common):
        raise ValueError('Lost Trail menu artwork already bound')
    ET.SubElement(common, 'LoadCAM').text = MENU_FILENAME
    return ET.tostring(tree, encoding='utf-8')


def quest_catalog(name, short, long):
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,62}', name):
        raise ValueError('Invalid native quest identity')
    for value, limit in ((short, 2048), (long, 8192)):
        if not value or len(value) > limit or '[' in value or ']' in value:
            raise ValueError('Invalid bracket-delimited native quest description')
        value.encode('ascii')
    return ('// Original Lost Trail mission descriptions\r\n\r\n'
            f'Name =\r\n[{name}]\r\n\r\n'
            f'Short Description =\r\n[{short}]\r\n\r\n'
            f'Long Description =\r\n[{long}]\r\n').encode('ascii')


def quest_dependencies(raw, quest_id=LEGACY_QUEST_ID):
    # 004cfb20 maps the reserved DOWNLOADABLE_QUEST_2 name to XQD2.
    # QDEP availability rules use that same CYID; shipped XQD1 is retained.
    if not re.fullmatch(r'[A-Za-z0-9]{4}', quest_id):
        raise ValueError('Require a native four-character quest identity')
    text = raw.decode('ascii')
    ids = [line.split(':', 1)[0].strip() for line in text.splitlines()
           if ':' in line and not line.lstrip().startswith('#')]
    if quest_id in ids:
        raise ValueError('Native quest availability identity already present')
    return raw + ('\r\n# The Lost Trail: independent new mission\r\n' +
                  quest_id + ' : MEDM NONE\r\n\r\n').encode('ascii')


def prepare(compiler_stage, compiler_evidence, wayfinder_menu, output):
    if output.exists():
        raise ValueError('Preserve previous candidates; choose a new output')
    source = ROOT / 'content/the-lost-trail'
    stage = json.loads(resident(compiler_stage / 'stage.json'))
    evidence = json.loads(resident(compiler_evidence))
    if stage.get('compilerSha256') != '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4':
        raise ValueError('Require the pinned official SDK compiler')
    for name in ('TheLostTrail.gpl', 'TheLostTrail.gplproj'):
        if digest(resident(source / name)) != stage['sourceSha256'][name]:
            raise ValueError('Mission source differs from the compiled inputs')
    bytecode = resident(compiler_stage / 'TheLostTrail.bcd')
    if (not evidence.get('originalCompilerSucceeded')
            or evidence.get('compilerExitCode') != 0
            or not evidence.get('containerValidated')
            or evidence.get('sha256') != digest(bytecode)
            or evidence.get('bytes') != len(bytecode)
            or set(evidence.get('functionsPresent', [])) !=
               {'TheLostTrail', 'LostTrailLiving', 'LostTrailVictory', LEGACY_INITIALIZER}):
        raise ValueError('Require verified official mission compilation')
    quest = ET.fromstring(resident(source / 'TheLostTrail.mqxml')).find('Quest')
    if quest is None or quest.findtext('Name') != 'TheLostTrail':
        raise ValueError('Missing canonical Lost Trail definition')
    if quest.get('id') != '{8BC7C549-E5A2-4D0F-A726-83B16BF19E42}':
        raise ValueError('Canonical mission GUID differs')
    original = resident(ROOT / 'upstream/majesty-recomp/original/gog/Quests/fertile_plain.q')
    if digest(original) != BASE_TEMPLATE_SHA:
        raise ValueError('Original map baseline differs')
    modified = rename_initializer(original, 'FERTILE_PLAIN', LEGACY_INITIALIZER)
    config = resident(wayfinder_menu / 'mx_miscdata.cam')
    if digest(config) != WAYFINDER_MENU_SHA:
        raise ValueError('Require the qualified Wayfinder native configuration')
    records = MENU.RESOURCES.cam_records(config)
    config = MENU.replace_records(config, {
        (b'DATA', b'XML1'): bind_scripts(records[b'DATA', b'XML1']),
        (b'DATA', b'QDEP'): quest_dependencies(records[b'DATA', b'QDEP'])})
    assets = ROOT / 'upstream/majesty-recomp/original/gog/DataMX'
    menu_text = resident(assets / 'mx_textdata.cam')
    if digest(menu_text) != MENU_SHA256:
        raise ValueError('Purchased expansion menu differs')
    menu_records = MENU.RESOURCES.cam_records(menu_text)
    menu_text = MENU.replace_records(menu_text, {
        (b'STRT', b'AP30'): reserved_title(menu_records[b'STRT', b'AP30'])})
    quest_text = resident(assets / 'mx_gpltext.cam')
    if digest(quest_text) != QUEST_TEXT_SHA256:
        raise ValueError('Purchased quest name archive differs')
    quest_records = MENU.RESOURCES.cam_records(quest_text)
    quest_text = MENU.replace_records(quest_text, {
        (b'STRT', b'QUES'): quest_title(quest_records[b'STRT', b'QUES'])})
    files = {
        'QuestsMX/TheLostTrail.q': modified,
        'QuestsMX/TheLostTrail.qdd': quest_catalog(
            LEGACY_INITIALIZER, quest.findtext('Description/Short'),
            quest.findtext('Description/Long')),
        'DataMX/TheLostTrail.bcd': bytecode,
        'DataMX/mx_miscdata.cam': config,
        'DataMX/mx_textdata.cam': menu_text,
        # The purchased installation also has a Data/ alias. The native
        # resource provider can resolve this alias when retrieving strings.
        'Data/mx_textdata.cam': menu_text,
        'DataMX/mx_gpltext.cam': quest_text,
        'Data/mx_gpltext.cam': quest_text,
        'DataMX/' + MENU_FILENAME: reserved_art(resident(assets / 'XQD1_intro.cam')),
    }
    report = dict(format='majesty-lost-trail-native-candidate-v1',
                  canonicalGuid=quest.get('id'), initializer=LEGACY_INITIALIZER,
                  canonicalInitializer='TheLostTrail',
                  legacyQuestId=LEGACY_QUEST_ID,
                  templateBaseline='Quests/fertile_plain.q',
                  templateBaselineSha256=BASE_TEMPLATE_SHA,
                  templateGeometryUnmodified=True, newTerrainAuthored=False,
                  mapBytesAfterInitializerPreserved=True,
                  originalMenuWidgetsUnmodified=True,
                  menuSlotWidgetId=4032, menuSlotTriggerWidgetId=4132,
                  menuArtworkInherited=True, originalMissionArtworkAuthored=False,
                  requiresQualifiedWayfinderResources=True,
                  scriptLoadGroups=list(LOAD_GROUPS),
                  compilerEvidence=str(compiler_evidence.resolve().relative_to(ROOT)),
                  nativeMapLoadQualified=False, nativeCatalogQualified=False,
                  missionObjectivesQualified=False, saveReloadQualified=False,
                  victoryQualified=False, installed=False, published=False,
                  files={n: dict(bytes=len(b), sha256=digest(b)) for n, b in files.items()})
    output.mkdir(parents=True)
    for name, data in files.items():
        p = output / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
    (output / 'candidate.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compiler-stage', type=Path, required=True)
    parser.add_argument('--compiler-evidence', type=Path, required=True)
    parser.add_argument('--wayfinder-menu', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = prepare(args.compiler_stage, args.compiler_evidence, args.wayfinder_menu,
                     args.output)
    print(json.dumps({k: result[k] for k in ('nativeMapLoadQualified', 'installed', 'published')}))
