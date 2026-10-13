#!/usr/bin/env python3
"""Prepare private SDK-derived authoring files; never install or compile them."""
import copy
import argparse
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SDK = ROOT / 'upstream/majesty-recomp/original/gog/SDK/OriginalQuests'
SOURCE = ROOT / 'content/wayfinder-trail-lodge'
OUTPUT = ROOT / 'output/wayfinder083-authoring'


def script_dependencies(sdk, script):
    """Check direct symbols against both SDK datasets, without compiling GPL.

    Expressions resolve at load time. A source-only successful compile would
    therefore not establish that the selected game's dataset supplies them.
    SpecifyIntent is an engine builtin documented in the SDK GPL Reference;
    the other direct calls in this draft must have shipped GPL definitions.
    This does not establish transitive, native-loader or gameplay compatibility.
    """
    text = re.sub(r'//[^\r\n]*', '', script.decode('utf-8'))
    functions = set(re.findall(r'\$([A-Za-z_]\w*)', text))
    expressions = set(re.findall(r'#([A-Za-z_]\w*)', text))
    local = {n.casefold() for n in re.findall(r'\bfunction\s+(\w+)\s*\(', text, re.I)}
    local_expressions = {n.casefold() for n in re.findall(r'\bexpression\s+#(\w+)\b', text, re.I)}
    builtin = {'specifyintent', 'getattribute', 'setattribute', 'listobjects',
               'listmember', 'listsize', 'getplayerdata', 'hasattribute',
               'addattribute', 'newthread', 'killthread', 'revealarea',
               'locationof', 'insidebuilding', 'distancebetweenagents',
               'nullagent', 'listtitles', 'createagent', 'retrieveagent', 'listpalaces',
               'lookupfunction', 'validfunction'}
    native_expressions = {'attrib_hp', 'attrib_maxhp', 'attrib_experiencelevel',
                          'attrib_firststagebuilt'}
    result = {'scope': 'direct-decision-tree-symbols-only' if len(local) == 1 else 'direct-content-script-symbols-only', 'datasets': {},
              'nativeBuiltins': [], 'inputSha256': {}}
    for dataset in ['GPL', 'GPLMx']:
        definitions = {'function': {}, 'expression': {}}
        for path in sorted((sdk / dataset).rglob('*.gpl')):
            raw = resident_bytes(path)
            result['inputSha256'][str(path.relative_to(sdk))] = hashlib.sha256(raw).hexdigest()
            source = re.sub(r'//[^\r\n]*', '', raw.decode('utf-8-sig'))
            for kind, pattern in [('function', r'\bfunction\s+(\w+)\s*\('),
                                  ('expression', r'\bexpression\s+#(\w+)\b')]:
                for name in re.findall(pattern, source, re.I):
                    files = definitions[kind].setdefault(name.casefold(), set())
                    files.add(str(path.relative_to(sdk)))
        resolved = {}
        for kind, names in [('function', functions), ('expression', expressions)]:
            for name in sorted(names):
                key = name.casefold()
                if kind == 'function' and key in local:
                    resolved['$' + name] = ['Wayfinder.gpl']
                elif kind == 'expression' and key in local_expressions:
                    resolved['#' + name] = ['Wayfinder.gpl']
                elif kind == 'function' and key in builtin:
                    resolved['$' + name] = ['engine-builtin:' + name]
                elif kind == 'expression' and key in native_expressions:
                    resolved['#' + name] = ['engine-native-unit-attribute:' + name]
                elif key in definitions[kind]:
                    resolved[('$' if kind == 'function' else '#') + name] = sorted(definitions[kind][key])
                else:
                    raise ValueError(f'Unresolved {dataset} {kind}: {name}')
        result['datasets'][dataset] = resolved
    if any(name.casefold() in builtin for name in functions) or native_expressions & {n.casefold() for n in expressions}:
        reference = sdk.parent / 'Documentation/GPL Reference.pdf'
        result['nativeBuiltins'] = sorted(name for name in functions if name.casefold() in builtin)
        result['nativeAttributes'] = sorted(name for name in expressions if name.casefold() in native_expressions)
        result['builtinReference'] = {
            'path': str(reference.relative_to(sdk.parent)),
            'sha256': hashlib.sha256(resident_bytes(reference)).hexdigest(),
            'section': 'Built-in functions and native unit attribute expressions',
        }
    return result


def resident_bytes(path):
    if path.stat().st_flags & 0x40000000:
        raise ValueError(f'SDK input is a dataless placeholder: {path.name}')
    return path.read_bytes()


def prototype(text, name):
    pattern = rf'^\[{re.escape(name)}\]\s*\n.*?^\[end\]'
    matches = list(re.finditer(pattern, text, re.M | re.S | re.I))
    if len(matches) != 1:
        raise ValueError(f'Expected exactly one SDK prototype {name}')
    return matches[0].group()


def property_value(text, key, value):
    pattern = rf'(?im)(\(\s*{re.escape(key)}\s+)[^()\r\n]+(\))'
    updated, count = re.subn(pattern, lambda m: m[1] + str(value) + m[2], text)
    if count != 1:
        raise ValueError(f'Expected one inherited prototype property {key}')
    return updated


def description(root, unit, subtype):
    found = [d for d in root.findall('Description') if d.get('ID') == unit['baseDescription']]
    if len(found) != 1 or found[0].get('type') != 'Unit' or found[0].get('subType') != subtype:
        raise ValueError('SDK base description differs from its expected kind')
    d = copy.deepcopy(found[0])
    d.set('ID', unit['id'])
    d.set('Name', unit['name'])
    d.set('Description', unit.get('displayName', unit['name']))
    for key, value in unit['game'].items():
        items = d.findall(f'Game/{key}')
        if len(items) != 1:
            raise ValueError(f'Expected one inherited game property {key}')
        items[0].set('value', str(value))
    for key, value in unit.get('engine', {}).items():
        items = d.findall(f'Engine/{key}')
        if key != 'ImageIDBase' or len(items) != 1 or not re.fullmatch(r'[A-Za-z0-9]{4}', value):
            raise ValueError('Unsupported custom engine artwork binding')
        items[0].set('value', value)
    if unit.get('attackRange'):
        fields = unit['attackRange']
        node = d.find('Game/AttackRange')
        if node is None or set(fields) != {'min', 'max'} or not 0 < fields['min'] <= fields['max'] <= 1000:
            raise ValueError('Invalid custom attack range')
        for key, value in fields.items():
            node.set(key, str(value))
    if unit.get('allowedWeapon'):
        node = d.find('Game/AllowedWeapon')
        if node is None or unit['allowedWeapon'] != 'Staff':
            raise ValueError('Unsupported custom weapon family')
        node.set('value', unit['allowedWeapon'])
    return d


def prepare(sdk=SDK, source=SOURCE):
    spec = json.loads(resident_bytes(source / 'spec.json'))
    if spec.get('status') != 'authoring-draft' or spec.get('nativeIntegrationQualified') is not False:
        raise ValueError('This tool only prepares unqualified drafts')
    hero, building = spec['hero'], spec['building']
    for unit in [hero, building]:
        # Legacy IDs are case-sensitive. The purchased game also uses lower-
        # case subtype letters (e.g. ABr1); upper-case-only validation rejected
        # valid independent native families for these new types.
        if not re.fullmatch(r'[A-Z]{2}[A-Za-z][1-9]', unit['id']) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', unit['name']):
            raise ValueError('Invalid stable description ID or prototype name')
        if any(type(v) is not int or not 0 < v <= 100000 for v in unit['game'].values()):
            raise ValueError('Invalid game property value')
    if hero['id'] == building['id'] or hero['name'].casefold() == building['name'].casefold():
        raise ValueError('Draft types collide')
    if not hero['id'].startswith('AV') or not building['id'].startswith('AB'):
        raise ValueError('Require the legacy hero and building ID families')
    inputs = {}
    ids, names = set(), set()
    # Inspect every SDK description, including examples; never skip a
    # placeholder and silently claim that its unseen IDs were checked.
    for path in sorted(sdk.parent.rglob('*.xml')):
        raw = resident_bytes(path)
        inputs[str(path.relative_to(sdk.parent))] = hashlib.sha256(raw).hexdigest()
        tree = ET.fromstring(raw)
        for d in tree.iter('Description'):
            if d.get('ID'): ids.add(d.get('ID'))
            if d.get('Name'): names.add(d.get('Name').casefold())
    for unit in [hero, building]:
        if unit['id'] in ids or unit['name'].casefold() in names:
            raise ValueError('Draft description ID or name collides with SDK content')
    chars_path, buildings_path = sdk / 'Data/M_Characters.xml', sdk / 'Data/M_Buildings.xml'
    char = description(ET.fromstring(resident_bytes(chars_path)), hero, 'Character')
    lodge = description(ET.fromstring(resident_bytes(buildings_path)), building, 'Building')
    if building.get('dialogId') != 'APw1':
        raise ValueError('Require the separate Trail Lodge interface identity')
    lodge.find('Game/DialogID').set('value', building['dialogId'])
    products = lodge.findall('Game/Produces')
    if len(products) != 1 or len(list(products[0])) != 1:
        raise ValueError('Unexpected inherited guild production list')
    products[0][0].set('ID', hero['name'])
    dats = {}
    for path in sorted(sdk.parent.rglob('*.dat')):
        raw = resident_bytes(path)
        inputs[str(path.relative_to(sdk.parent))] = hashlib.sha256(raw).hexdigest()
        dats[path] = raw.decode('utf-8-sig').replace('\r\n', '\n')
        for name in re.findall(r'^\[([^]\r\n]+)\]', dats[path], re.M):
            if name.casefold() in {hero['name'].casefold(), building['name'].casefold()}:
                raise ValueError('Draft prototype name collides with SDK data')
    hero_data = prototype(dats[sdk / 'GPLMx/mx_Hero_Data.dat'], hero['basePrototype'])
    lodge_data = prototype(dats[sdk / 'GPLMx/mx_Building_Data.dat'], building['basePrototype'])
    hero_data = re.sub(r'^\[[^]]+\]', f"[{hero['name']}]", hero_data)
    lodge_data = re.sub(r'^\[[^]]+\]', f"[{building['name']}]", lodge_data)
    for key, value in {'title': hero['name'], 'activeScript': hero['decisionTree'],
                       'basicscript': hero['decisionTree'], 'StartingScript': hero['decisionTree'],
                       **hero['prototype']}.items():
        hero_data = property_value(hero_data, key, value)
    for key, value in {'title': building['name'], 'member_title': hero['name'],
                       'member_basicscript': hero['decisionTree'],
                       **building.get('prototype', {})}.items():
        lodge_data = property_value(lodge_data, key, value)
    support_data = b''
    support_path = source / 'Wayfinder_Support.dat'
    if support_path.exists():
        support_data = re.sub(rb'//[^\r\n]*', b'', resident_bytes(support_path))
        support_names = [name for name in re.findall(r'^\[([^]]+)\]', support_data.decode(), re.M)
                         if name.casefold() != 'end']
        if support_names != ['WayfinderSupportV2'] or any(
                re.search(rf'(?im)^\[{re.escape(name)}\]', text)
                for name in support_names for text in dats.values()):
            raise ValueError('Support controller prototype collides with SDK data')
    gpl = resident_bytes(source / 'Wayfinder.gpl')
    if support_data:
        custom = re.search(rb'prototype\s+WayfinderSupportPrototype\s*\(\s*\)\s+declare\s+integer\s+counter\s*;', gpl)
        stock = re.fullmatch(rb'\s*\[WayfinderSupportV2\]\s*\{AIRoot\s*\(Done_setup 0\)\s*\(Quest_Number 0\)\s*\(VictoryCondition wayfinder_support_tick\)\s*\}\s*\[end\]\s*', support_data)
        if not custom and not stock:
            raise ValueError('Support controller requires explicit typed or stock timer fields')
    if not re.search(rf'\bfunction\s+{re.escape(hero["decisionTree"])}\s*\(', gpl.decode()):
        raise ValueError('Draft decision tree is missing')
    dependencies = script_dependencies(sdk, gpl)
    def xml_bytes(element):
        root = ET.Element('Majesty'); root.append(element); ET.indent(root)
        return ET.tostring(root, encoding='utf-8', xml_declaration=True) + b'\n'
    mod = ET.Element('Mod', id='{' + spec['modUuid'] + '}')
    ET.SubElement(mod, 'Name').text = 'WayfinderTrailLodgeDraft'
    ET.SubElement(mod, 'DisplayName', lang='en_US').text = 'Wayfinder / Trail Lodge (unqualified draft)'
    info = ET.SubElement(mod, 'Description', lang='en_US')
    ET.SubElement(info, 'Short').text = 'Private authoring draft; native integration is pending.'
    ET.SubElement(info, 'Long')
    config = ET.SubElement(mod, 'DataConfiguration')
    load = ET.SubElement(ET.SubElement(config, 'Dataset', base='Any'), 'Load')
    for file in ['Wayfinder_Characters.xml', 'Wayfinder_Buildings.xml']:
        ET.SubElement(load, 'Descriptions').text = 'Data/' + file
    bytecode = ET.SubElement(load, 'GPL')
    ET.SubElement(bytecode, 'Target').text = 'Data\\Wayfinder.bcd'
    for file in ['Wayfinder.gpl', 'Wayfinder_Data.dat']:
        ET.SubElement(bytecode, 'Source').text = 'GPL\\' + file
    files = {'Data/Wayfinder_Characters.xml': xml_bytes(char),
             'Data/Wayfinder_Buildings.xml': xml_bytes(lodge),
             'GPL/Wayfinder_Data.dat': (hero_data + '\n\n' + lodge_data + '\n').encode() + support_data,
             'GPL/Wayfinder.gpl': gpl,
             'GPL/Wayfinder.gplproj': b'data="Wayfinder_Data.dat"\nsource="Wayfinder.gpl"\n',
             'Wayfinder.mmxml': xml_bytes(mod)}
    report = dict(version=1, status='authoring-draft', nativeIntegrationQualified=False,
                  bytecodeCompiled=False, installed=False, published=False,
                  descriptionIds=[hero['id'], building['id']], sdkDescriptionIdsChecked=len(ids),
                  scriptDependencies=dependencies,
                  sdkInputSha256=inputs, specSha256=hashlib.sha256(resident_bytes(source/'spec.json')).hexdigest(),
                  files={name: dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest()) for name, raw in files.items()})
    return files, report


def write_draft(output, files, report):
    # Validate completely before creating files. Refuse any existing output
    # directory rather than replacing a user's edited draft or compiled pack.
    output.mkdir(parents=False, exist_ok=False)
    for name, raw in files.items():
        path = output / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(raw)
    (output / 'authoring.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUTPUT,
                        help='New private draft directory; existing directories are refused')
    args = parser.parse_args()
    files, report = prepare()
    write_draft(args.output, files, report)
    print(json.dumps({k: report[k] for k in ['status', 'descriptionIds', 'sdkDescriptionIdsChecked',
                                           'bytecodeCompiled', 'installed', 'published']}))
