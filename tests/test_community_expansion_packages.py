"""Reject changed originals and unsafe loads before any game is started."""
import copy
from dataclasses import dataclass
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


POLICY = load('expansion_inspection', 'inspect-community-expansion-package.py')
COMPOSE = load('expansion_composition', 'prepare-community-expansion-gpl.py')
LEGACY = load('expansion_legacy', 'stage-community-expansion-legacy-gpl.py')
POTION = load('expansion_potion', 'stage-more-heroes-shapeshift.py')


class PackageTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.pkg = Path(temp.name)
        (self.pkg / 'Data').mkdir()
        (self.pkg / 'GPL').mkdir()
        self.contract = dict(format='majesty-community-expansion-source-contract-v1',
            id='test', fullPackageAcquired=True, canonicalGuid='test-guid',
            internalName='Test', manifestFilename='Test.mmxml',
            requiredMedia=['Data/art.cam'], requiredCamRecords={}, runtimeFeatureCounts={})
        raw_cam = (POLICY.PRIMITIVES.CAM_MAGIC + struct.pack('<II', 1, 8)
                   + struct.pack('<4sI', b'IMAG', 28) + struct.pack('<II', 0, 0))
        for name, raw in {
            'Test.mmxml': b'<Majesty><Mod id="test-guid"><Name>Test</Name><DataConfiguration>'
                b'<Dataset base="Any"><Load><CAM>Data/art.cam</CAM><Descriptions>Data/units.xml</Descriptions>'
                b'<GPL><Source>GPL/test.gpl</Source><Target>Data/test.bcd</Target></GPL>'
                b'</Load></Dataset></DataConfiguration></Mod></Majesty>',
            'mod-definition.json': b'{"mod_id":"test-guid","internal_name":"Test"}',
            'Data/art.cam': raw_cam,
            'Data/units.xml': b'<Majesty/>',
            'GPL/test.gpl': b'function Test()\ndeclare\nbegin\nend\n',
            'Data/test.bcd': struct.pack('<III', 1020, 1020, 0xffffffff) + bytes(1012),
        }.items():
            (self.pkg / name).write_bytes(raw)
        self.repin()

    def repin(self):
        inventory = {p.relative_to(self.pkg).as_posix(): POLICY.digest(p.read_bytes())
                     for p in sorted(self.pkg.rglob('*')) if p.is_file()}
        self.contract['packageFiles'] = inventory
        self.contract['packageInventorySha256'] = hashlib.sha256(json.dumps(
            inventory, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

    def test_verified_original_remains_explicitly_unplayable(self):
        result = POLICY.inspect(self.pkg, self.contract)
        self.assertTrue(result['originalMediaPresent'])
        self.assertFalse(result['browserPlayable'])
        self.assertFalse(result['published'])

    def test_standard_package_needs_no_invented_definition(self):
        (self.pkg / 'mod-definition.json').unlink()
        self.contract['definitionFilename'] = None
        self.repin()
        self.assertEqual(POLICY.inspect(self.pkg, self.contract)['runtimeFeatureCounts'], {})

    def test_changed_source_and_extra_file_are_rejected(self):
        (self.pkg / 'GPL/test.gpl').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'resource changed'):
            POLICY.inspect(self.pkg, self.contract)
        self.repin()
        (self.pkg / 'unreviewed.dll').write_bytes(b'new')
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            POLICY.inspect(self.pkg, self.contract)

    def test_links_are_rejected_even_if_bytes_match(self):
        path = self.pkg / 'Data/units.xml'
        raw = path.read_bytes()
        target = self.pkg / 'other.xml'
        target.write_bytes(raw)
        path.unlink()
        path.symlink_to(target)
        with self.assertRaisesRegex(ValueError, 'Linked'):
            POLICY.inspect(self.pkg, self.contract)

    def test_manifest_cannot_escape_inventory(self):
        path = self.pkg / 'Test.mmxml'
        path.write_bytes(path.read_bytes().replace(b'GPL/test.gpl', b'../outside.gpl'))
        self.repin()
        with self.assertRaisesRegex(ValueError, 'Unsafe package path'):
            POLICY.inspect(self.pkg, self.contract)

    def test_entities_are_rejected_in_declared_descriptions(self):
        (self.pkg / 'Data/units.xml').write_bytes(b'<!DOCTYPE x [<!ENTITY y SYSTEM "file:///x">]><Majesty/>')
        self.repin()
        with self.assertRaisesRegex(ValueError, 'entities'):
            POLICY.inspect(self.pkg, self.contract)

    def test_bad_cam_and_bytecode_bounds_are_rejected_after_repin(self):
        cam = self.pkg / 'Data/art.cam'
        original = cam.read_bytes()
        cam.write_bytes(original + b'unaccounted')
        self.repin()
        with self.assertRaisesRegex(ValueError, 'Unaccounted CAM payload'):
            POLICY.inspect(self.pkg, self.contract)
        cam.write_bytes(original)
        (self.pkg / 'Data/test.bcd').write_bytes(bytes(1024))
        self.repin()
        with self.assertRaisesRegex(ValueError, 'compiled expansion'):
            POLICY.inspect(self.pkg, self.contract)

    def test_unacquired_or_changed_contract_is_rejected(self):
        changed = copy.deepcopy(self.contract)
        changed['fullPackageAcquired'] = False
        with self.assertRaisesRegex(ValueError, 'acquired'):
            POLICY.inspect(self.pkg, changed)
        changed = copy.deepcopy(self.contract)
        changed['packageFiles']['GPL/test.gpl']['bytes'] += 1
        with self.assertRaisesRegex(ValueError, 'contract changed'):
            POLICY.inspect(self.pkg, changed)


@dataclass(frozen=True)
class Panel:
    owner: str
    raw_panel_key: str
    source_dialog_id: bytes
    resolved_child_dialog_id: bytes


@dataclass(frozen=True)
class Row:
    dialog_id: int
    source_dialog_id: bytes
    row_key: int


@dataclass(frozen=True)
class Controllers:
    panels: tuple
    records: tuple


class NamespaceTests(unittest.TestCase):
    def fixture(self):
        allocated = (b'CGBC', b'CG02', b'CGZC', b'CGZT', b'CGAQ')
        panels = tuple(Panel(owner, key, b'ORIG', old)
                       for ((owner, key), _), old in zip(COMPOSE.CHILDREN.items(), allocated))
        records = tuple(Row(int.from_bytes(p.resolved_child_dialog_id, 'little'),
                            b'ORIG', int.from_bytes(p.resolved_child_dialog_id, 'little')) for p in panels)
        return Controllers(panels, records)

    def test_simultaneous_relocation_preserves_record_keys_and_source_ids(self):
        original = self.fixture()
        result = COMPOSE.preserve_namespace(original, ())
        self.assertEqual([p.resolved_child_dialog_id for p in result.panels], list(COMPOSE.CHILDREN.values()))
        self.assertEqual([p.row_key for p in result.records], [p.row_key for p in original.records])
        self.assertTrue(all(p.source_dialog_id == b'ORIG' for p in result.records))
        self.assertEqual([p.dialog_id.to_bytes(4, 'little') for p in result.records], list(COMPOSE.CHILDREN.values()))

    def test_original_alchemist_ids_are_allowed_and_new_collisions_rejected(self):
        inventory = lambda key: SimpleNamespace(resources=(SimpleNamespace(key=key),))
        COMPOSE.preserve_namespace(self.fixture(), (inventory(b'CG01'), inventory(b'CG02')))
        with self.assertRaisesRegex(ValueError, 'reserved'):
            COMPOSE.preserve_namespace(self.fixture(), (inventory(b'CGAQ'),))

    def test_incomplete_or_overlapping_panels_are_rejected(self):
        fixture = self.fixture()
        with self.assertRaisesRegex(ValueError, 'inventory'):
            COMPOSE.preserve_namespace(Controllers(fixture.panels[:-1], ()), ())
        duplicate = tuple(Panel(p.owner, p.raw_panel_key, p.source_dialog_id, b'SAME') for p in fixture.panels)
        with self.assertRaisesRegex(ValueError, 'Overlapping child'):
            COMPOSE.preserve_namespace(Controllers(duplicate, ()), ())


class GameplaySourceTests(unittest.TestCase):
    def test_existing_health_guard_and_new_event_both_survive(self):
        base = 'function Effect(agent Hero)\ndeclare\nbegin\n$Apply(Hero);\nend\n'
        current = base.replace('$Apply(Hero);',
            'if ($SafeHealth(Hero) == False) return;\n$Apply(Hero);')
        proposed = base.replace('$Apply(Hero);', '$Apply(Hero);\n$QuestCredit(Hero);')
        merged = LEGACY.carry_function(base, current, proposed)
        self.assertLess(merged.index('$safehealth'), merged.index('$apply'))
        self.assertLess(merged.index('$apply'), merged.index('$questcredit'))

    def test_competing_health_values_require_an_explicit_resolution(self):
        from majesty_cam.gpl_function_merge import FunctionMergeError
        base = 'function Effect(agent Hero)\ndeclare\nbegin\n$SetHP(Hero,10);\nend\n'
        with self.assertRaises(FunctionMergeError):
            LEGACY.carry_function(base, base.replace('10', '20'), base.replace('10', '30'))

    def test_alias_rename_does_not_change_calls_or_string_values(self):
        body = 'function Effect(agent Hero)\ndeclare\nbegin\n$Effect(Hero);\n$Name(Hero,"Effect");\nend\n'
        result = LEGACY.renamed(body, 'MJC_Effect')
        self.assertEqual(result.replace('function MJC_Effect', 'function Effect', 1), body)

    def effect(self, cleanup=False):
        adjustment = '-30' if cleanup else '30'
        return ('function Effect(agent Hero)\ndeclare\nstring title;\nbegin\n'
                'title = Hero\'s "title";\nif (Hero\'s "AttackType" == 2)\n'
                '$Adjust(Hero,0);\nelse if (title == "Priestess" || title == "Wizard" || title == "Healer")\n'
                f'$Adjust(Hero,{adjustment});\nelse\n$Adjust(Hero,0);\nend\n')

    def custom(self):
        return self.effect().replace('title == "Healer"', 'title == "Healer"' + ''.join(
            ' || title == "' + name + '"' for name in POTION.MAGIC_HEROES))

    def test_magic_forms_receive_matching_cleanup_with_ranged_precedence(self):
        cleanup = POTION.matching_cleanup(self.effect(), self.effect(True), self.custom())
        self.assertIn('$Adjust(Hero,-30);', cleanup)
        self.assertLess(cleanup.index('"AttackType"'), cleanup.index('"Necromancer"'))
        self.assertTrue(all('title == "' + name + '"' in cleanup for name in POTION.MAGIC_HEROES))

    def test_shapeshift_proof_rejects_an_extra_effect_or_changed_stock_title(self):
        for changed in (self.custom().replace('$Adjust(Hero,30);', '$Adjust(Hero,31);'),
                        self.custom().replace('"Wizard"', '"Other"')):
            with self.assertRaisesRegex(ValueError, 'seven magic-title additions'):
                POTION.matching_cleanup(self.effect(), self.effect(True), changed)


if __name__ == '__main__':
    unittest.main()
