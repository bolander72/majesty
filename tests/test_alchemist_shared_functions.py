import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('alchemist_shared_functions', ROOT / 'scripts/prepare-alchemist-shared-functions.py')
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)


class SharedFunctionsTest(unittest.TestCase):
    def source(self, root, text=None):
        root.mkdir()
        files = {
            shared.FILES[0]: (text or 'Function sample(agent ThisAgent)\nDeclare\nBegin\nReturn;\nEnd\n').encode(),
            shared.FILES[1]: b'[sample]\n[end]\n',
            shared.FILES[2]: b'data="Alchemist_Composed.dat"\nsource="Alchemist_Composed.gpl"\n',
        }
        for name, raw in files.items():
            (root / name).write_bytes(raw)
        report = dict(format='majesty-alchemist-source-composition-v1', sourcePoliciesApplied=True,
                      files={name: dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
                             for name, raw in files.items()})
        (root / 'source-composition.json').write_text(json.dumps(report))
        return files

    def test_original_exports_bodies_and_data_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original = self.source(root / 'source')
            report = shared.prepare(root / 'source', root / 'out')
            extended = (root / 'out' / shared.FILES[0]).read_bytes()
            self.assertTrue(extended.startswith(original[shared.FILES[0]]))
            self.assertEqual(report['legacyFunctionAliases'], {'sample': 'MJA_sample'})
            self.assertEqual((root / 'out' / shared.FILES[1]).read_bytes(), original[shared.FILES[1]])
            self.assertIn(b'sample\tMJA_sample\n', (root / 'out/shared-overrides.tsv').read_bytes())
            self.assertFalse(report['bytecodeCompiled'])

    def test_changed_composition_refused_without_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.source(root / 'source')
            (root / 'source' / shared.FILES[0]).write_text('modified source')
            with self.assertRaisesRegex(ValueError, 'Composed input changed'):
                shared.prepare(root / 'source', root / 'out')
            self.assertFalse((root / 'out').exists())

    def test_alias_collision_and_existing_output_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.source(root / 'source', 'Function sample()\nBegin\nReturn;\nEnd\nFunction MJA_sample()\nBegin\nReturn;\nEnd\n')
            with self.assertRaisesRegex(ValueError, 'Alias collision'):
                shared.prepare(root / 'source', root / 'out')
            (root / 'out').mkdir()
            with self.assertRaisesRegex(ValueError, 'Preserve existing output'):
                shared.prepare(root / 'source', root / 'out')


if __name__ == '__main__':
    unittest.main()
