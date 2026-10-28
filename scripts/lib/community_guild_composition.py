"""Compose creator resources before compiling their shared gameplay source.

This adapts output namespaces only. Author functions and feature declarations
remain inputs to the pinned manager's own composition pipeline.
"""
from dataclasses import asdict, is_dataclass, replace
import hashlib
import mmap
from pathlib import Path
import shutil
import struct
import subprocess
import xml.etree.ElementTree as ET

PARENT_IDS = {'alchemist': b'CG01', 'bards': b'CGBD', 'phantom': b'CGPH'}
CHILD_IDS = {'alchemist': b'CG02', 'bards': b'CGBC'}


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def json_value(value):
    if is_dataclass(value):
        return json_value(asdict(value))
    if isinstance(value, bytes):
        return value.decode('ascii')
    if isinstance(value, dict):
        return {str(k): json_value(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [json_value(v) for v in value]
    if isinstance(value, (set, frozenset)):
        return sorted(json_value(v) for v in value)
    return value.value if hasattr(value, 'value') else value


def declared_archives(game):
    """Use both original manifests, including base-data loads in the expansion."""
    root = game.resolve(strict=True)
    for folder, name in [('Data', 'MajestyDatasetDefinitions.xml'),
                         ('DataMX', 'MajestyExpansionDatasetDefinitions.xml')]:
        for node in ET.parse(root / folder / name).findall('.//Dataset/Load/CAM'):
            declared = (node.text or '').replace('\\', '/')
            if ')/' in declared:
                variable, suffix = declared.split(')/', 1)
                roots = {'$(majestydatapath': 'Data',
                         '$(majestyexpansiondatapath': 'DataMX'}
                if variable.casefold() not in roots:
                    raise ValueError('Unknown stock CAM path variable')
                relative = Path(roots[variable.casefold()]) / suffix
            else:
                relative = Path(folder) / declared
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError('Stock CAM path escapes the game')
            path = root / relative
            if (path.is_symlink() or not path.is_file()
                    or path.resolve().relative_to(root) != relative
                    or getattr(path.stat(), 'st_flags', 0) & 0x40000000
                    or path.suffix.casefold() != '.cam'):
                raise ValueError('Unavailable original stock CAM: ' + str(relative))
            yield relative, path


def complete_stock_fixture(game, fixture):
    """Own real archives; COW clones save disk space without sharing inodes."""
    evidence = {}
    for relative, source in declared_archives(game):
        if relative.as_posix() in evidence:
            continue
        target = fixture / relative
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            # macOS clonefile is optional. A regular private copy is equivalent.
            try:
                subprocess.run(['cp', '-c', str(source), str(target)], check=True,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except (OSError, subprocess.CalledProcessError):
                shutil.copyfile(source, target)
        if (target.is_symlink() or (target.stat().st_dev, target.stat().st_ino)
                == (source.stat().st_dev, source.stat().st_ino)):
            raise ValueError('Stock fixture must own its CAM inputs')
        with source.open('rb') as stream, mmap.mmap(stream.fileno(), 0,
                access=mmap.ACCESS_READ) as raw:
            original = digest(raw)
        with target.open('rb') as stream, mmap.mmap(stream.fileno(), 0,
                access=mmap.ACCESS_READ) as raw:
            if digest(raw) != original:
                raise ValueError('Fixture archive differs from original: ' + str(relative))
        evidence[relative.as_posix()] = original
    return evidence


def stock_named_resources(game, wanted_waves):
    """Read named records only, rather than materializing stock TILE/audio banks."""
    resources = {}
    for _, path in declared_archives(game):
        with path.open('rb') as stream, mmap.mmap(stream.fileno(), 0,
                access=mmap.ACCESS_READ) as raw:
            if raw[:12] != b'CYLBPC  \x01\x00\x01\x00' or len(raw) < 20:
                raise ValueError('Invalid stock CAM header')
            count, size = struct.unpack_from('<II', raw, 12)
            end = 20 + 8 * count + size
            if count > 4096 or end > len(raw):
                raise ValueError('Invalid stock CAM directory')
            for at in range(count):
                kind, offset = struct.unpack_from('<4sI', raw, 20 + 8 * at)
                if kind not in {b'SMNU', b'STRT', b'DSND', b'WAVE'}:
                    continue
                if offset < 20 + 8 * count or offset + 8 > end:
                    raise ValueError('Invalid stock CAM section')
                entries = struct.unpack_from('<I', raw, offset)[0]
                if entries > (end - offset - 8) // 28:
                    raise ValueError('Invalid stock CAM entries')
                for index in range(entries):
                    name, start, length = struct.unpack_from('<20sII', raw,
                                                            offset + 8 + index * 28)
                    key = name[:4]
                    if start < end or start + length > len(raw):
                        raise ValueError('Stock CAM record leaves its archive')
                    if kind == b'WAVE' and key not in wanted_waves:
                        continue
                    if length > 16 * 1024 * 1024:
                        raise ValueError('Oversized stock named resource')
                    resources[kind, key] = raw[start:start + length]
    return resources


def preserve_dialogs(controllers, inventories):
    """Preserve live Alchemist IDs independently of allocator traversal order."""
    panels = {panel.owner: panel for panel in controllers.panels}
    if set(panels) != set(CHILD_IDS):
        raise ValueError('Unreviewed secondary controller inventory')
    if any(resource.key == b'CGBC' for inventory in inventories
           for resource in inventory.resources):
        raise ValueError('Private Bards child ID is already occupied')
    remap = {panel.resolved_child_dialog_id: CHILD_IDS[owner]
             for owner, panel in panels.items()}
    if len(remap) != len(panels):
        raise ValueError('Controller allocator produced overlapping child IDs')

    def relocate(value, field=''):
        if is_dataclass(value):
            return replace(value, **{key: relocate(item, key)
                                     for key, item in vars(value).items()})
        if isinstance(value, tuple):
            return tuple(relocate(item, field) for item in value)
        if field.endswith('dialog_id') and field != 'source_dialog_id':
            if isinstance(value, bytes):
                return remap.get(value, value)
            if isinstance(value, int):
                numbers = {int.from_bytes(a, 'little'): int.from_bytes(b, 'little')
                           for a, b in remap.items()}
                return numbers.get(value, value)
        return value

    result = relocate(controllers)
    if {panel.owner: panel.resolved_child_dialog_id for panel in result.panels} != CHILD_IDS:
        raise ValueError('Private controller namespace relocation failed')
    return result


def compose_views(fixture, inventories, texts, resolutions):
    from majesty_cam import compose as c
    from majesty_cam.description_composition import prepare_description_views
    from majesty_cam.script_review import ScriptReviewSession
    from majesty_cam.spell_discovery import discover, transform_descriptions
    from majesty_cam.scoped_output import complete_observer_patches
    from majesty_cam.native_impact import resolve_bundle
    from majesty_cam.stock_controller_registry import (
        encode_stock_controller_registry, decode_stock_controller_registry)
    from majesty_cam.runtime_features import (
        encode_runtime_feature_registry, decode_runtime_feature_registry)

    dialogs = c.resolve_building_dialogs(inventories)
    if len(dialogs) != 3 or {row.owner for row in dialogs} != set(PARENT_IDS):
        raise ValueError('Unreviewed building dialog inventory')
    dialogs = tuple(replace(row, resolved_dialog_id=PARENT_IDS[row.owner]) for row in dialogs)
    controllers = preserve_dialogs(c.resolve_controller_registry(inventories,
        building_dialogs=dialogs, reserved_dialog_ids=(b'CG00',)), inventories)
    features = c.resolve_runtime_feature_registry(inventories)
    named = stock_named_resources(fixture, {resource.key for inventory in inventories
        for resource in inventory.resources if resource.section == b'WAVE'})
    text = c.merge_text_resources(fixture, inventories, private_activity_texts=texts,
        dialog_resolutions=dialogs, controller_panels=controllers.panels,
        controller_registry=controllers.registry, hero_info_tooltips=bool(features.hero_info_rows),
        stock_named_resources=named)
    bdep = c.merge_bdep_resource(fixture, inventories)
    stock = {key: value[0] for key, value in c._load_effective_stock_descriptions(fixture).items()}
    descriptions, patches, external = prepare_description_views(fixture, inventories, (),
        ScriptReviewSession(), None, dialog_resolutions=dialogs)
    descriptions = c.filter_passthrough_descriptions(descriptions, inventories, stock_records=stock)
    c.validate_controller_stock_evidence(fixture, inventories, controllers.registry,
        controller_panels=controllers.panels, controller_toggles=controllers.toggles,
        runtime_feature_registry=features, description_stock_deltas=
        c.analyze_description_stock_deltas(fixture, inventories, descriptions=descriptions),
        external_building_keys=external)
    descriptions, potions = c.prepare_potion_descriptions(descriptions, stock, c.potion_policies(inventories))
    spells = discover(c._spell_policy_bindings(inventories),
                      tuple(record.to_element() for record in descriptions.document.records))
    descriptions = transform_descriptions(descriptions, spells)
    bundle = c.prepare_gpl_bundle(fixture, inventories, private_activity_texts=texts,
        semantic_resolutions=resolutions, spell_policy_plan=spells,
        source_context_descriptions=descriptions, potion_plan=potions)
    interceptors = tuple(feature for inventory in inventories
        for feature in inventory.selected.package.definition.runtime_features
        if isinstance(feature, c.ProjectileInterception))
    if interceptors:
        bundle = complete_observer_patches(bundle, tuple(f.callback_symbol for f in interceptors))
    impacts = resolve_bundle(fixture, inventories, bundle, descriptions, patches)
    features, feature_bytes = c.finalize_script_runtime_feature_registry(features, bundle, stock, descriptions)
    controller_bytes = encode_stock_controller_registry(controllers.registry)
    if (decode_stock_controller_registry(controller_bytes) != controllers.registry
            or decode_runtime_feature_registry(feature_bytes) != features):
        raise ValueError('Controller/feature registry roundtrip failed')
    payloads = {'merged_textdata.cam': text.text_archive.to_bytes(),
        'merged_gpltext.cam': text.gpltext_archive.to_bytes(),
        'merged_miscdata.cam': bdep.archive.to_bytes(),
        'merged_descriptions.xml': descriptions.payload,
        'controllers.bin': controller_bytes, 'features.bin': feature_bytes}
    payloads.update({f'merged_descriptions-{scope}.xml': result.payload
                     for scope, result in patches.items()})
    contract = json_value(dict(dialogs=dialogs, controllers=controllers,
                               features=features, projectileBindings=impacts))
    return bundle, payloads, contract


def merge_shared_function_routes(inputs):
    """Fold GPL's case-insensitive source names to each exact exported alias."""
    prefix = b'majesty-community-shared-gpl-v2\n'
    union = {}
    for raw in inputs:
        if len(raw) > 65536 or b'\0' in raw or not raw.startswith(prefix):
            raise ValueError('Invalid bounded shared route input')
        for line in raw[len(prefix):].splitlines():
            parts = line.split(b'\t')
            if len(parts) != 2:
                raise ValueError('Invalid shared route row')
            name, target = parts
            if (not 1 <= len(name) <= 100 or len(target) >= 128
                    or not target.startswith(b'MJC_')
                    or target[4:].lower() != name.lower()
                    or any(c not in b'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_0123456789'
                           for c in name)):
                raise ValueError('Shared route changes function identity')
            key = name.lower()
            if key in union and union[key] != target:
                raise ValueError('Conflicting exact exported alias for shared function')
            union[key] = target
            if len(union) > 256:
                raise ValueError('Shared route union exceeds native bound')
    if not union:
        raise ValueError('Empty shared route union')
    # Native v2 deliberately requires exact MJC_ + spelling. Retain the
    # compiler's alias spelling, with one row per case-insensitive function.
    return prefix + b''.join(union[key][4:] + b'\t' + union[key] + b'\n'
                             for key in sorted(union))
