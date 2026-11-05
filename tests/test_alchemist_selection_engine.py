import importlib.util
from pathlib import Path
import tomllib
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('selection_engine', ROOT / 'scripts/prepare-alchemist-selection-engine.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)

class SelectionEntryTests(unittest.TestCase):
    def test_only_declared_entries_change(self):
        text = f'''[game]
sha256 = "{engine._research.PIN}"
[translate]
entry_points = [0x401000]
instruction_patches = [{{ at = 0x401000, text = "NOP" }}]
'''
        with patch.object(engine.hashlib, 'sha256') as sha, patch.object(engine._research, 'mapped_bytes', side_effect=lambda image, addr, size: engine.BINDINGS[addr]):
            sha.return_value.hexdigest.return_value = engine._research.PIN
            result = engine.curate(text, b'fixture')
            self.assertEqual(engine.curate(result, b'fixture'), result)
            before, after = tomllib.loads(text), tomllib.loads(result)
            self.assertEqual(after['translate']['entry_points'], [0x401000, *engine.ENTRIES])
            after['translate']['entry_points'] = before['translate']['entry_points']
            self.assertEqual(before, after)

    def test_unknown_picker_binding_is_refused(self):
        with patch.object(engine.hashlib, 'sha256') as sha, patch.object(engine._research, 'mapped_bytes', return_value=b'wrong'):
            sha.return_value.hexdigest.return_value = engine._research.PIN
            with self.assertRaisesRegex(ValueError, 'selection binding differs'):
                engine.curate('', b'fixture')

if __name__ == '__main__':
    unittest.main()
