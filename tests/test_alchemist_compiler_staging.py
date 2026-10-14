"""Compiler inputs must be source-bound and existing trials must stay untouched."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('alchemist_compiler', ROOT / 'scripts/prepare-alchemist-compiler.py')
compiler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compiler)


class CompilerStagingTests(unittest.TestCase):
    def test_existing_trial_is_preserved(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / 'preserve').write_text('original')
            with self.assertRaisesRegex(ValueError, 'Preserve existing'):
                compiler.prepare(root, root, root, root, root, root)
            self.assertEqual((root / 'preserve').read_text(), 'original')

    def test_changed_composed_source_is_refused_before_creating_output(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            source = root / 'source'
            source.mkdir()
            payloads = {name: b'original' for name in compiler.INPUT_FILES}
            report = dict(format='majesty-alchemist-source-composition-v1', sourcePoliciesApplied=True,
                          files={name: dict(bytes=len(raw), sha256=compiler.sha(raw))
                                 for name, raw in payloads.items()})
            for name, raw in payloads.items():
                (source / name).write_bytes(raw)
            (source / 'source-composition.json').write_text(json.dumps(report))
            (source / 'Alchemist_Composed.gpl').write_text('changed')
            output = root / 'compiler'
            with self.assertRaisesRegex(ValueError, 'source changed'):
                compiler.prepare(source, root, root / 'missing', root, root, output)
            self.assertFalse(output.exists())

    def test_incomplete_policy_composition_is_refused(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / 'source-composition.json').write_text(json.dumps(dict(
                format='majesty-alchemist-source-composition-v1', sourcePoliciesApplied=False)))
            output = root / 'compiler'
            with self.assertRaisesRegex(ValueError, 'complete source-policy'):
                compiler.prepare(root, root, root, root, root, output)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
