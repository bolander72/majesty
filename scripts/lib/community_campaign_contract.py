"""Validate the original-campaign script contract before compiling community content."""
import re
import sys
from pathlib import Path
import xml.etree.ElementTree as ET


def uncomment(text):
    # Prototype declarations contain no string initializers. Keep line breaks
    # so commented-out declarations cannot satisfy the original VM contract.
    return re.sub(r'//[^\n]*', '', re.sub(r'/\*.*?\*/', '', text, flags=re.S))


def prototype_fields(text, name):
    clean = uncomment(text)
    matches = list(re.finditer(r'(?im)^\s*prototype\s+' + re.escape(name) + r'\s*\(', clean))
    if len(matches) != 1:
        raise ValueError('Require one prototype: ' + name)
    declaration = re.split(r'(?im)^\s*begin\b', clean[matches[0].end():], maxsplit=1)
    if len(declaration) != 2:
        raise ValueError('Missing prototype declaration terminator: ' + name)
    fields = {}
    for kind, names in re.findall(r'(?im)^\s*(boolean|integer|float|function|coordinate|string|agent|list)\s+([^;\n]+);', declaration[0]):
        for field in names.split(','):
            field = field.strip().casefold()
            if not re.fullmatch(r'[a-z_]\w*', field) or field in fields:
                raise ValueError('Unsupported or duplicate prototype field: ' + name)
            fields[field] = kind.casefold()
    if not fields:
        raise ValueError('Empty prototype contract: ' + name)
    return fields


def validate(common, original_prototypes, available_functions, descriptions):
    """Require stock-compatible private prototypes and every authored callback.

    This does not classify edition-only effects as executable crash paths or
    replace gameplay verification. It catches missing/incorrectly typed fields
    and unresolved description callbacks before original SDK compilation.
    """
    checked = {}
    for private, stock in [('Bards_Hall_Prototype', 'Guild'),
                           ('Bards_Support_Hero', 'hero'), ('Phantom_Hero', 'hero')]:
        expected = prototype_fields(original_prototypes, stock)
        actual = prototype_fields(common, private)
        invalid = {name: dict(expected=kind, actual=actual.get(name))
                   for name, kind in expected.items() if actual.get(name) != kind}
        if invalid:
            raise ValueError('Original-campaign prototype mismatch in ' + private + ': ' + str(invalid))
        checked[private] = dict(stock=stock, requiredFields=len(expected), actualFields=len(actual))
    if len(descriptions) > 2 * 1024 * 1024 or any(
            token in descriptions.upper() for token in (b'<!DOCTYPE', b'<!ENTITY')):
        raise ValueError('Require bounded plain description XML')
    root = ET.fromstring(descriptions)
    available = {name.casefold() for name in available_functions}
    callbacks = []
    for description in root.iter('Description'):
        for element in description.iter():
            refs = []
            if element.tag == 'Script' and element.get('cProc', '0') == '0':
                refs.append(('GPLFunction', element.get('GPLFunction', '')))
            if element.tag == 'ValidationScript':
                refs.append(('ValidationScript', element.get('value', '')))
            for property_name, symbol in refs:
                if not symbol or symbol == '0':
                    continue
                if not re.fullmatch(r'[A-Za-z_]\w*', symbol) or symbol.casefold() not in available:
                    raise ValueError('Unresolved original-campaign callback: ' +
                                     str(description.get('Name')) + '/' + property_name + '=' + symbol)
                callbacks.append(dict(description=description.get('Name'), property=property_name,
                                      function=symbol))
    return dict(prototypes=checked, callbacks=callbacks,
                originalCampaignContractPassed=True, runtimeQualified=False)


def audit_stage(source, stock, descriptions):
    # The base campaign loads stock GPL plus composed common/base libraries;
    # expansion-only functions cannot satisfy an original-campaign callback.
    roots = [stock / 'SDK/OriginalQuests/Gpl', source / 'sources/Any',
             source / 'sources/Majesty']
    vendor = Path(__file__).resolve().parents[2] / 'third_party/majesty-mod-manager/src'
    if str(vendor) not in sys.path:
        sys.path.insert(0, str(vendor))
    from majesty_cam.gpl import DefinitionKind, parse_gpl
    functions = set()
    for root in roots:
        if not root.is_dir():
            raise ValueError('Missing original-campaign GPL source: ' + str(root))
        for path in sorted(root.rglob('*.gpl')):
            text = path.read_text(encoding='cp1252')
            functions.update(item.name for item in parse_gpl(text, path.name).items
                             if item.kind in (DefinitionKind.FUNCTION, DefinitionKind.PROTOTYPE))
    return validate((source / 'sources/Any/Merged.gpl').read_text(encoding='cp1252'),
                    (stock / 'SDK/OriginalQuests/Gpl/prototype.gpl').read_text(encoding='cp1252'),
                    functions, descriptions)
