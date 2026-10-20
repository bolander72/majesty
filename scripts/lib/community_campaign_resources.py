"""Plan missing native resource dependencies without changing existing game data."""
from collections import deque
from pathlib import Path
import re
import xml.etree.ElementTree as ET

from .community_resource_closure import resource_calls, literal_attribute_writes, script_references
from .legacy_description_wire import resource_name, unit_parts


def native_catalog(game, folder, prefix):
    from majesty_cam.cam import read_cam
    result = {}
    for file, kind, namespace in [('unittype.cam', b'DUNT', 'Unit'),
                                  ('action.cam', b'DACT', 'Action'),
                                  ('sounddesc.cam', b'DSND', 'Sound')]:
        path = game / folder / (prefix + file)
        if path.stat().st_size > 2 * 1024 * 1024:
            raise ValueError('Oversized native description catalog')
        for section in read_cam(path.read_bytes()).sections:
            if section.extension != kind:
                continue
            for entry in section.entries:
                identity, name = resource_name(entry.data, kind)
                result.setdefault((namespace, name.casefold()), []).append((identity, entry, kind))
    return result


def symbols(roots):
    from majesty_cam.gpl import DefinitionKind, parse_gpl
    result = {}
    for root in roots:
        if not root.is_dir():
            raise ValueError('Missing script source directory')
        for path in sorted(root.rglob('*.gpl')):
            if path.stat().st_size > 2 * 1024 * 1024:
                raise ValueError('Oversized GPL input')
            for item in parse_gpl(path.read_text(encoding='cp1252'), str(path)).items:
                if item.kind in (DefinitionKind.FUNCTION, DefinitionKind.EXPRESSION,
                                 DefinitionKind.PROTOTYPE):
                    result[item.normalized_name] = item
    return result


def native_symbols(game):
    """Use actual shipped exports; SDK source alone is not a load guarantee."""
    from majesty_cam.bcd import definition_keys
    raw = (game / 'Data/bytecode.bcd').read_bytes()
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError('Oversized native bytecode input')
    return {name for _, name in definition_keys(raw)}


def base_function_reachability(game, source, available, base):
    """Conservatively trace shared source from actual base content entry points.

    The creator's shared files retain Northern-only quest/spawner helpers too.
    Their mere presence must not add Northern buildings/monsters to base play.
    Native names, original bytecode references, DAT function values and direct
    community bridge families are roots; source function references close them.
    """
    from majesty_cam.gpl import DefinitionKind
    roots = set()
    for name in ('Data/bytecode.bcd', 'Data/MDL1.bcd'):
        path = game / name
        if not path.exists():
            continue
        raw = path.read_bytes()
        if len(raw) > 16 * 1024 * 1024:
            raise ValueError('Oversized original entry point input')
        roots.update(m.decode('ascii').casefold() for m in
                     re.findall(rb'[A-Za-z_][A-Za-z_0-9]*\x00', raw)
                     if len(m) <= 129)
    roots = {name.rstrip('\0') for name in roots}
    for (namespace, _), rows in base.items():
        if namespace not in ('Unit', 'Action'):
            continue
        for _, entry, _ in rows:
            roots.update(m[:-1].decode('ascii').casefold() for m in
                         re.findall(rb'[A-Za-z_][A-Za-z_0-9]*\x00', entry.data))
    for path in (source / 'sources').rglob('*.dat'):
        if 'MajestyExpansion' not in path.parts:
            text = path.read_text(encoding='cp1252')
            # DAT function values are bare names, e.g. (birthScript Born).
            from .community_resource_closure import TOKEN
            clean = ''.join(m[0] for m in TOKEN.finditer(text) if m.lastgroup != 'comment')
            roots.update(name.casefold() for name in re.findall(r'[A-Za-z_]\w*', clean))
    # Bridge calls also use authored names directly, without a DACT callback.
    roots.update(name for name in available if name.startswith(
        ('mm_', 'bards_', 'alchemist_', 'phantom_')))
    for name in available:
        if name.startswith('mjc_') and name[4:] in roots:
            roots.add(name)
    reachable = set()
    queue = deque(sorted(roots & available.keys()))
    while queue:
        name = queue.popleft()
        if name in reachable or available[name].kind != DefinitionKind.FUNCTION:
            continue
        reachable.add(name)
        if 'mjc_' + name in available:
            queue.append('mjc_' + name)
        queue.extend(ref for kind, ref in script_references(available[name].text)
                     if kind == 'Function' and ref in available)
    return reachable


def northern_goblin_spawn_guard(available, base):
    """Prove the retained Northern spawner is gated by its absent fortress."""
    if any(key in base for key in [('Unit', 'goblinfortress'), ('Unit', 'goblin_fortress')]):
        return False
    callers = lambda target: {name for name, item in available.items()
        if ('Function', target) in set(script_references(item.text))}
    if callers('goblin_spawn') != {'goblinforthitspawn', 'mjc_goblinforthitspawn'}:
        return False
    if callers('goblinforthitspawn') != {'damage', 'mjc_damage'}:
        return False
    gate = (r'if\s*\(\s*defender\s*\x27s\s*"title"\s*==\s*"GoblinFortress"\s*\)'
            r'\s*begin\s*\$goblinforthitspawn\s*\(\s*defender\s*\)\s*;\s*end')
    return all(re.search(gate, available[name].text, re.I) for name in ('damage', 'mjc_damage'))


def native_template_symbols(game):
    from majesty_cam.bcd import definition_keys
    from majesty_cam.gpl import DefinitionKind
    return {name for kind, name in definition_keys((game / 'Data/bytecode.bcd').read_bytes())
              if kind in (DefinitionKind.DAT_BLOCK, DefinitionKind.PROTOTYPE)}


def template_dependencies(game, source, stock, names):
    """A created GPL actor needs its data prototype, not just a DUNT image."""
    if not names:
        return '', []
    from majesty_cam.gpl import parse_dat
    native = native_template_symbols(game)
    def data(roots):
        records = {}
        for root in roots:
            for path in sorted(root.rglob('*.dat')):
                raw = path.read_bytes()
                if len(raw) > 2 * 1024 * 1024:
                    raise ValueError('Oversized original data template source')
                for item in parse_dat(raw.decode('cp1252'), str(path)).items:
                    records[item.normalized_name] = item
        return records
    existing = native | data([source / 'sources/Any', source / 'sources/Majesty']).keys()
    originals = data([stock / 'GPLMx'])
    additions = {}
    pending = deque(sorted(names))
    while pending:
        name = pending.popleft()
        if name in existing or name in additions:
            continue
        item = originals.get(name)
        if item is None:
            raise ValueError('Unresolved original actor template: ' + name)
        # This dependency is a plain Spell specialization, not a Northern NPC
        # or building tree with further behaviors/attributes to adapt.
        if name != 'critical_hit' or not re.fullmatch(
                r'\s*\[Critical_Hit\]\s*\{Spell\s*\(type\s+spell\)\s*'
                r'\(subtype\s+spell\)\s*\(title\s+Critical_Hit\)\s*\}\s*\[end\]\s*',
                item.text, re.I):
            raise ValueError('Unreviewed original actor template dependency: ' + name)
        if 'spell' not in existing:
            raise ValueError('Original base Spell prototype is unavailable')
        additions[name] = item
    return '\n\n'.join(item.text for item in additions.values()), [
        dict(name=item.name, source=item.source_name) for item in additions.values()]


def plan(game, source, stock, *, fire_balm=True):
    """Close literal calls, descriptor callbacks, sound and callback resources.

    Base imports are additions only. Retail's duplicate Speed_Tonic name is
    resolved by the same increasing native identity order as Old.exe 0059c060.
    The antimagic typo is adapted only in the newly imported base callback,
    after proving the base/Northern native engine and game payloads identical.
    """
    from majesty_cam.gpl import DefinitionKind
    base = native_catalog(game, 'Data', '')
    northern = native_catalog(game, 'DataMX', 'mx_')
    xml = {}
    for path in sorted((stock / 'DataMX').glob('*.xml')):
        raw = path.read_bytes()
        if len(raw) > 2 * 1024 * 1024 or any(x in raw.upper() for x in (b'<!DOCTYPE', b'<!ENTITY')):
            raise ValueError('Require bounded plain original descriptor XML')
        for desc in ET.fromstring(raw).iter('Description'):
            key = desc.get('type'), desc.get('ID')
            if key in xml:
                raise ValueError('Duplicate original descriptor identity')
            xml[key] = desc
    available = symbols([source / 'sources/Any', source / 'sources/Majesty'])
    original_symbols = native_symbols(game)
    stock_functions = symbols([stock / 'GPLMx'])
    reachable = base_function_reachability(game, source, available, base)
    goblin_gate = northern_goblin_spawn_guard(available, base)
    fire_support = None
    if fire_balm:
        from .community_fire_balm import fire_balm_support
        fire_support = fire_balm_support(stock, available.keys() | original_symbols | stock_functions.keys())
    wanted = set()
    if fire_support:
        wanted.update(('Action', name.casefold()) for name in fire_support['actions'].values()
                      if ('Action', name.casefold()) not in base)
    dynamic = []
    finite_attributes = {}
    dynamic_attribute_writers = []
    source_refs = set()
    optional_missing_sounds = []
    absent_capabilities = []
    inactive_spawns = []
    created_templates = set()
    for folder in ['Any', 'Majesty']:
        for path in sorted((source / 'sources' / folder).glob('*.gpl')):
            text = path.read_text(encoding='cp1252')
            from majesty_cam.gpl import parse_gpl
            functions = [item for item in parse_gpl(text, str(path)).items
                         if item.kind == DefinitionKind.FUNCTION]
            for namespace, name in script_references(text):
                source_refs.add((namespace, name))
                if name not in available and name not in original_symbols:
                    if namespace == 'Expression' and not name.startswith('#attrib_'):
                        wanted.add((namespace, name))
                    elif namespace == 'Function' and name in stock_functions:
                        wanted.add((namespace, name))
            # damage() consumes this field as a Unit description name. Trace
            # its literal writers too, rather than mistaking the field name
            # itself for an effector or overlooking deferred impact effects.
            for name, line in literal_attribute_writes(text, 'special_splat'):
                if name is None:
                    dynamic_attribute_writers.append(dict(file=str(path.relative_to(source)), line=line))
                elif name:
                    finite_attributes.setdefault('special_splat', set()).add(name)
                    if ('Unit', name.casefold()) not in base:
                        wanted.add(('Unit', name.casefold()))
            for call in resource_calls(text):
                if call.name and call.method.casefold() in ('spawnunit', 'createspellunit'):
                    owner = next((item for item in functions
                        if item.span.start_line <= call.line <= item.span.end_line), None)
                    inactive = (call.method.casefold() == 'spawnunit' and owner is not None
                        and (owner.normalized_name not in reachable or
                             (call.name.casefold() == 'goblinoverlord' and goblin_gate
                              and owner.normalized_name in ('goblin_spawn', 'mjc_goblin_spawn'))))
                    if not inactive:
                        created_templates.add(call.name.casefold())
                if call.name is None:
                    dynamic.append(dict(file=str(path.relative_to(source)), line=call.line,
                                        method=call.method))
                elif (call.namespace, call.name.casefold()) not in base:
                    key = call.namespace, call.name.casefold()
                    if call.method.casefold() in ('enableunittype', 'disableunittype'):
                        absent_capabilities.append(dict(method=call.method, name=call.name,
                            file=str(path.relative_to(source)), line=call.line))
                    elif call.method.casefold() == 'spawnunit' and (owner := next((item for item in functions
                            if item.span.start_line <= call.line <= item.span.end_line), None)) is not None \
                            and (owner.normalized_name not in reachable or
                                 (call.name.casefold() == 'goblinoverlord' and goblin_gate
                                  and owner.normalized_name in ('goblin_spawn', 'mjc_goblin_spawn'))):
                        inactive_spawns.append(dict(name=call.name, function=owner.name,
                            file=str(path.relative_to(source)), line=call.line))
                    elif call.namespace == 'Sound' and key not in northern:
                        optional_missing_sounds.append(dict(name=call.name,
                            file=str(path.relative_to(source)), line=call.line))
                    else:
                        wanted.add(key)
    queue = deque(sorted(wanted))
    imports, added, external, images, callbacks, aliases = {}, {}, set(), set(), set(), {}
    duplicate_resolution = []
    while queue:
        namespace, name = queue.popleft()
        key = namespace, name
        if key in base or key in imports:
            continue
        if key == ('Unit', 'antimagic_shield_icon'):
            old = base.get(('Unit', 'anitmagic_shield_icon'), [])
            new = northern.get(key, [])
            if (len(old) != 1 or len(new) != 1 or old[0][0] != new[0][0] or
                    unit_parts(old[0][1].data)[1:] != unit_parts(new[0][1].data)[1:]):
                raise ValueError('Unproven base antimagic name adaptation')
            aliases[name] = 'anitmagic_shield_icon'
            continue
        if namespace in ('Unit', 'Action', 'Sound'):
            if key not in northern:
                raise ValueError('Unresolved native resource: ' + str(key))
            entries = northern[key]
            if len(entries) > 1:
                if key != ('Unit', 'speed_tonic_icon') or {r[0] for r in entries} != {'XR01', 'XS01'}:
                    raise ValueError('Unreviewed duplicate native resource name')
                entries = [min(entries, key=lambda r: int.from_bytes(r[0].encode('ascii'), 'little'))]
                duplicate_resolution.append(dict(name=name, selected=entries[0][0],
                                                  nativeLookup='0059c060 increasing identity traversal'))
            imports[key] = entries
            for identity, entry, kind in entries:
                desc = xml.get((namespace, identity))
                if desc is None or desc.get('Name', '').casefold() != name:
                    raise ValueError('Native/SDK description binding differs')
                for node in desc.findall('Engine/ImageIDBase'):
                    if node.get('value', '0') != '0':
                        images.add(node.get('value'))
                for node in desc.findall('Engine/DefaultSound') + desc.findall('Engine/Sound'):
                    if node.get('value', '0') != '0':
                        queue.append(('Sound', node.get('value').casefold()))
                for tag in ['Projectile', 'Overlay']:
                    for node in desc.findall('Engine/' + tag):
                        if node.get('value', '0') != '0':
                            queue.append(('Unit', node.get('value').casefold()))
                for node in desc.findall('Engine/Script'):
                    if node.get('cProc') == '0':
                        function = node.get('GPLFunction')
                        queue.append(('Function', function.casefold()))
                        callbacks.add(function)
                for node in desc.findall('Game/ValidationScript'):
                    function = node.get('value')
                    queue.append(('Function', function.casefold()))
                    callbacks.add(function)
        elif namespace in ('Function', 'Expression'):
            if name in available or name in original_symbols or name in added:
                continue
            if name not in stock_functions:
                if namespace == 'Expression':
                    raise ValueError('Unresolved script constant: ' + name)
                external.add(name)
                continue
            item = stock_functions[name]
            added[name] = item
            for call in resource_calls(item.text):
                if call.name:
                    queue.append((call.namespace, call.name.casefold()))
            for kind, dependency in script_references(item.text):
                if not dependency.startswith('#attrib_'):
                    queue.append((kind, dependency))
        else:
            raise ValueError('Unsupported resource namespace')
    for (namespace, name), entries in imports.items():
        existing = {identity for (ns, _), rows in base.items() if ns == namespace
                    for identity, _, _ in rows}
        if existing & {identity for identity, _, _ in entries}:
            raise ValueError('Import would replace an original native identity')
    callback_routes = {item.name: 'MCR_' + item.name for item in added.values()
                       if item.kind == DefinitionKind.FUNCTION}
    if any(name.casefold() in available or name.casefold() in original_symbols
           or name.casefold() in stock_functions
           for name in callback_routes.values()):
        raise ValueError('Private resource callback name is occupied')
    # Common potion handlers also run in Northern missions, which never load
    # Community_Base.bcd. Keep their new helpers in the shared library.
    bodies = []
    template_source, templates = template_dependencies(game, source, stock, created_templates)
    for item in added.values():
        text = item.text
        if item.kind == DefinitionKind.FUNCTION:
            text, count = re.subn(r'^(\s*function\s+)' + re.escape(item.name) + r'\b',
                lambda m: m[1] + callback_routes[item.name], text, count=1, flags=re.I)
            if count != 1:
                raise ValueError('Unsupported original callback header')
        for original, target in callback_routes.items():
            text = re.sub(r'\$' + re.escape(original) + r'\b',
                          lambda m: '$' + target, text, flags=re.I)
        if item.normalized_name == 'stonebacks_hit':
            if aliases != {'antimagic_shield_icon': 'anitmagic_shield_icon'}:
                raise ValueError('Missing proven original antimagic adapter')
            text, count = re.subn(r'"antimagic_shield_icon"', '"anitmagic_shield_icon"', text)
            if count != 1:
                raise ValueError('Original antimagic callback differs')
        if item.normalized_name == 'fire_balm_end':
            anchor = '\t//Swap attack actions back again\n'
            if text.count(anchor) != 1:
                raise ValueError('Original Fire Balm cleanup differs')
            text = text.replace(anchor, '''    // Preserve an older save with a partially created icon but no MX field.
    // Its original attack could not have been swapped into the absent slot.
    if ($HasAttribute("Special_Attack_Action", ThisAgent) == False) begin
        ThisAgent's "special_splat" = "";
        return;
    end
''' + anchor)
        bodies.append(text)
    report = dict(initialMissingNames=len(wanted),
        descriptions=[dict(namespace=ns, name=name, ids=[r[0] for r in rows])
                      for (ns, name), rows in imports.items()],
        imageIds=sorted(images), callbackNames=sorted(callbacks),
        functions=[dict(name=i.name, source=i.source_name) for i in added.values()
                   if i.kind == DefinitionKind.FUNCTION],
        expressions=[i.name for i in added.values() if i.kind == DefinitionKind.EXPRESSION],
        externalFunctionNames=sorted(external), baseOnlyResourceAliases=aliases,
        privateBaseCallbackRoutes=callback_routes,
        duplicateNameResolution=duplicate_resolution, dynamicResourceCalls=dynamic,
        finiteDynamicAttributeNames={key: sorted(values) for key, values in finite_attributes.items()},
        dynamicAttributeWriters=dynamic_attribute_writers,
        originalExportCount=len(original_symbols),
        referencedFunctionNames=sorted(name for kind, name in source_refs if kind == 'Function'),
        nativeAttributeReferences=sorted(name for kind, name in source_refs
                                        if kind == 'Expression' and name.startswith('#attrib_')),
        unresolvedOptionalSoundCalls=optional_missing_sounds,
        absentUnitCapabilityCalls=absent_capabilities,
        inactiveBaseUnitCreationCalls=inactive_spawns,
        baseSourceReachableFunctionCount=len(reachable),
        northernGoblinSpawnerGatedByAbsentBaseFortress=goblin_gate,
        createdActorTemplateNames=sorted(created_templates), templateAdditions=templates,
        fireBalmCompatibility=({key: value for key, value in fire_support.items() if key != 'source'}
                               if fire_support else None),
        noExistingNativeIdentitiesReplaced=True, northernCampaignResourcesUnchanged=True,
        gameplayQualified=False)
    return dict(report=report, imports=imports, xml=xml, images=images, stock=stock,
                callbackSource='\n\n'.join(bodies), callbackRoutes=callback_routes,
                commonSource=fire_support['source'] if fire_support else '',
                templateSource=template_source)


def route_native_callbacks(raw, kind, callbacks):
    """Change only typed callback strings, retaining original resource fields.

    Unique private names prevent imported base helpers from claiming Northern's
    original function exports in the first-wins VM. DACT script strings live
    outside its fixed PRIM size; DUNT strings live inside the PRIM chunk.
    """
    from .legacy_description_engine import block
    from .legacy_description_wire import unpack_chunk
    from .legacy_description_action import action_parts
    routes = {name.casefold().encode('ascii') + b'\0': target.encode('ascii') + b'\0'
              for name, target in callbacks.items()}
    def rewrite(part, sized):
        original = part
        for name, target in routes.items():
            at = part.lower().find(name)
            if at < 0 or (at and part[at - 1] != 0):
                continue
            if part.lower().find(name, at + 1) >= 0:
                raise ValueError('Ambiguous native callback string')
            part = part[:at] + target + part[at + len(name):]
        if sized and part != original:
            tag, version, count, _ = unpack_chunk(original)
            part = block(tag, part[16:], version=version, count=count)
        return part
    if kind == b'DUNT':
        head, engine, *game = unit_parts(raw)
        engine = rewrite(engine, True)
    elif kind == b'DACT':
        head, engine, game_part = action_parts(raw)
        engine = rewrite(engine, False)
        game = [rewrite(game_part, True)] if game_part else []
    else:
        return raw
    return block(kind, block(b'DATA', head + engine + b''.join(game),
                            count=2 + len(game)), count=1)


def original_movement_references(closure, base):
    """Bind required movement names through unchanged base SDK/native witnesses."""
    from .legacy_description_wire import unpack_chunk, children
    from .legacy_description_engine import MOVEMENT_TYPES
    import struct
    wanted = set()
    for (namespace, _), rows in closure['imports'].items():
        if namespace == 'Unit':
            for identity, _, _ in rows:
                for node in closure['xml'][namespace, identity].findall('Engine/Attachment'):
                    if node.get('kind') != 'Movement' or node.get('type') not in MOVEMENT_TYPES:
                        raise ValueError('Unreviewed original attachment kind')
                    wanted.add(node.get('ID').casefold())
    witnesses = {name: [] for name in wanted}
    for path in sorted((closure['stock'] / 'Data').glob('*.xml')):
        raw = path.read_bytes()
        if len(raw) > 2 * 1024 * 1024 or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
            raise ValueError('Require bounded original movement witness XML')
        for desc in ET.fromstring(raw).iter('Description'):
            nodes = desc.findall('Engine/Attachment')
            if len(nodes) != 1 or nodes[0].get('ID', '').casefold() not in wanted:
                continue
            node = nodes[0]
            if node.get('kind') != 'Movement' or node.get('type') not in MOVEMENT_TYPES:
                continue
            rows = base.get(('Unit', desc.get('Name', '').casefold()), [])
            rows = [row for row in rows if row[0] == desc.get('ID')]
            if len(rows) != 1:
                continue
            engine = unit_parts(rows[0][1].data)[1]
            at = engine.find(b'ATCH')
            if at < 0:
                raise ValueError('Original movement witness has no attachment block')
            end = at + 16 + struct.unpack_from('<I', engine, at + 4)[0]
            _, version, count, payload = unpack_chunk(engine[at:end], b'ATCH')
            moves = [part for part in children(payload, count) if part[:4] == b'MOVE']
            if version or len(moves) != 1:
                raise ValueError('Original movement attachment boundary differs')
            _, version, count, slots = unpack_chunk(moves[0], b'MOVE')
            if (version or count != 8 or len(slots) != 64 or slots[8:] != bytes(56)
                    or struct.unpack_from('<I', slots)[0] != MOVEMENT_TYPES[node.get('type')]
                    or not re.fullmatch(rb'[A-Za-z_0-9]{4}', slots[4:8])):
                raise ValueError('Original movement witness slots differ')
            witnesses[node.get('ID').casefold()].append((slots[4:8].decode('ascii'), rows[0][0]))
    bindings, proof = {}, []
    for name, rows in sorted(witnesses.items()):
        identities = {identity for identity, _ in rows}
        if len(identities) != 1:
            raise ValueError('Original movement name is absent or ambiguous: ' + name)
        bindings[name] = next(iter(identities))
        proof.append(dict(name=name, identity=bindings[name],
                          existingBaseWitnesses=sorted({witness for _, witness in rows})))
    return bindings, proof


def verify_retail_descriptions(closure, game):
    """Prove imported engine/game fields against SDK XML and native originals.

    One retail invisibility sound name is duplicated. Its existing native
    descriptor uses SL49; preserving that ID is required, rather than resolving
    the ambiguous XML name to a different original sound.
    """
    from .legacy_description_engine import encode_engine
    from .legacy_description_action import encode_action_engine, encode_action_game, action_parts
    from .legacy_description_game import encode_overlay, encode_character
    base = native_catalog(game, 'Data', '')
    northern = native_catalog(game, 'DataMX', 'mx_')
    resources = {ns: {name: min(rows,
                    key=lambda r: int.from_bytes(r[0].encode('ascii'), 'little'))[0]
                    for (kind, name), rows in {**base, **northern}.items() if kind == ns}
                 for ns in ('Unit', 'Action', 'Sound', 'Movement')}
    resources['Movement'], movement_proof = original_movement_references(closure, base)
    checked = []
    retail_omissions = []
    for (namespace, name), rows in closure['imports'].items():
        for identity, entry, kind in rows:
            if kind not in (b'DUNT', b'DACT'):
                continue
            desc = closure['xml'][namespace, identity]
            resolved = resources
            if identity == 'XR06':
                if ('SL49' not in {r[0] for r in base.get(('Sound', 'invisibility'), [])}):
                    raise ValueError('Original invisibility sound identity is unavailable')
                resolved = {**resources, 'Sound': {**resources['Sound'], 'invisibility': 'SL49'}}
            if kind == b'DUNT':
                parts = unit_parts(entry.data)
                actual_engine, actual_game = parts[1], parts[2] if len(parts) == 3 else None
                expected_engine = encode_engine(desc, resolved)
                game_part = desc.find('Game')
                expected_game = (None if game_part is None else
                    encode_character(game_part, resources['Action']) if desc.get('subType') == 'Character'
                    else encode_overlay(game_part))
                if identity == 'WVj1':
                    # Retail's two-second critical-hit presenter is serialized
                    # as a Character. Its omitted recruitment delay retains
                    # the SDK debug-fill sentinel; keep the original bytes.
                    if (game_part.find('RecruitDelay') is not None or len(actual_game) != 156
                            or actual_game[104:108] != b'\xcd' * 4):
                        raise ValueError('Retail critical-hit recruitment sentinel differs')
                    expected_game = expected_game[:104] + b'\xcd' * 4 + expected_game[108:]
                    retail_omissions.append(dict(identity=identity, field='RecruitDelay',
                        preservedNativeValue='0xcdcdcdcd', authoredFieldPresent=False))
            else:
                _, actual_engine, actual_game = action_parts(entry.data)
                expected_engine = encode_action_engine(desc.find('Engine'), resolved)
                expected_game = encode_action_game(desc.find('Game'))
            if actual_engine != expected_engine or actual_game != expected_game:
                raise ValueError('Retail engine/game fields differ from SDK: ' + identity)
            checked.append(identity)
    return dict(engineAndGameExactRoundTrips=checked,
                existingBaseMovementReferences=movement_proof,
                preservedRetailXmlOmissions=retail_omissions,
                nativeInvisibilitySoundIdentityPreserved='SL49')
