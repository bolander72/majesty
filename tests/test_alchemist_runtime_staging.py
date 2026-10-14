"""Original community recipes must retain their real costs, dependencies and callbacks."""
import importlib.util
import json
from pathlib import Path
import shutil
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('alchemist_staging', ROOT / 'scripts/stage-alchemist-runtime-registries.py')
staging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(staging)


class RegistryStagingTests(unittest.TestCase):
    def test_complete_authored_contract_uses_actual_community_codec(self):
        with tempfile.TemporaryDirectory() as name:
            output = Path(name) / 'staged'
            report = staging.stage(staging.DEFAULT_MANAGER, 'CG01', 'CG02', output)
            from majesty_cam.stock_controller_registry import decode_stock_controller_registry
            raw = (output / 'DataMX/majesty_mod_manager_controllers.bin').read_bytes()
            self.assertEqual(struct.unpack_from('<I', raw, 4)[0], 20)
            registry = decode_stock_controller_registry(raw)
            self.assertEqual(report['controllerSectionCounts'], dict(panels=1, meters=1,
                research_rows=2, upgrade_gates=1, timed_rage_actions=1,
                rage_command_actions=1, sovereign_target_actions=1))
            panel, = registry.panels
            self.assertEqual(panel.building_family_id, 'ALB')
            self.assertEqual(panel.open_command_id, 8009)
            meter, = registry.meters
            self.assertEqual((meter.resource_key, meter.attribute_id), ('reagents', 'APV0'))
            self.assertEqual({row.recipe_key: row.price for row in registry.research_rows},
                {'weapon-oil': 250, 'phoenix-phial': 750})
            gate, = registry.upgrade_gates
            self.assertEqual([(r.building_level, r.recipe_key) for r in gate.requirements],
                [(1, 'weapon-oil'), (2, 'phoenix-phial')])
            vigor, = registry.timed_rage_actions
            self.assertEqual((vigor.callback_symbol, vigor.gold_cost, vigor.resource_cost, vigor.duration_ms),
                ('Alchemist_DoInvigoratingElixer', 1500, 1, 30000))
            infusion, = registry.rage_command_actions
            self.assertEqual((infusion.callback_symbol, infusion.resource_cost),
                ('Alchemist_Arcane_Infusion', 10))
            stone, = registry.sovereign_target_actions
            self.assertEqual((stone.private_mode, stone.private_unit_id, stone.resource_cost),
                ('AlS1', 'ALS1', 10))
            self.assertEqual(stone.callback_symbol, 'Philosophers_Stone_Hit')
            policies = {p['type']: p for p in report['sourcePolicies']}
            self.assertEqual(policies['stock.typed-boolean-dispatch.v1']['dispatch_symbol'],
                'Alchemist_Dispatch_Hero_Capability')
            self.assertEqual(policies['stock.bazaar-potion-policy.v1']['shapeshift']['unit_name'],
                'Giant_Spider')
            self.assertIs(report['sourcePoliciesApplied'], False)
            self.assertEqual(report['capabilities'], ['expanded-building-slots.cg-prefix',
                'stock.ap78-enchantment-row.v1', 'stock.controller-recipes.v1', 'stock.name-generator.v1'])
            for field in ['packageResourcesBound', 'nativeHooksQualified', 'browserPlayable', 'published']:
                self.assertIs(report[field], False)

    def test_invalid_or_equal_dialogs_refused_without_creating_output(self):
        with tempfile.TemporaryDirectory() as name:
            output = Path(name) / 'staged'
            for parent, child in [('AP10', 'CG02'), ('CG01', 'CG01'), ('../x', 'CG02'), ('CG01', 'CGB!')]:
                with self.subTest(parent=parent, child=child), self.assertRaises(ValueError):
                    staging.stage(staging.DEFAULT_MANAGER, parent, child, output)
                self.assertFalse(output.exists())

    def test_existing_staging_output_is_preserved(self):
        with tempfile.TemporaryDirectory() as name:
            output = Path(name)
            (output / 'preserve').write_text('original')
            with self.assertRaisesRegex(ValueError, 'Preserve existing'):
                staging.stage(staging.DEFAULT_MANAGER, 'CG01', 'CG02', output)
            self.assertEqual((output / 'preserve').read_text(), 'original')

    def test_modified_community_module_refused_before_output(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            manager = root / 'manager'
            shutil.copytree(staging.DEFAULT_MANAGER, manager, ignore=shutil.ignore_patterns('__pycache__'))
            module = manager / 'src/majesty_cam/runtime_features.py'
            module.write_bytes(module.read_bytes() + b'\n# changed encoder\n')
            output = root / 'staged'
            with self.assertRaisesRegex(ValueError, 'differs from pinned'):
                staging.stage(manager, 'CG01', 'CG02', output)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
