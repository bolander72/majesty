import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('native_trial_saves', ROOT / 'scripts/lib/native_trial_saves.py')
SAVES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SAVES)


class TrialSaveTests(unittest.TestCase):
    def test_excludes_unchanged_input_even_when_it_sorts_first(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            old = root / '1 Day.GMP'
            new = root / '2 Days.GMP'
            old.write_bytes(b'original copied input')
            new.write_bytes(b'new hero world')
            self.assertEqual(SAVES.changed_save(root, [SAVES.save_sha256(old)], root), new)
            self.assertEqual(old.read_bytes(), b'original copied input')

    def test_accepts_updated_same_name_but_refuses_missing_or_ambiguous_progress(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            path = root / '0 Days.GMP'
            path.write_bytes(b'initial world')
            initial = SAVES.save_sha256(path)
            with self.assertRaises(ValueError):
                SAVES.changed_save(root, [initial], root)
            path.write_bytes(b'paid construction')
            self.assertEqual(SAVES.changed_save(root, [initial], root), path)
            (root / 'another.GMP').write_bytes(b'ambiguous world')
            with self.assertRaises(ValueError):
                SAVES.changed_save(root, [initial], root)

    def test_refuses_unowned_directory_and_linked_saves(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            owned = root / 'owned'
            owned.mkdir()
            original = root / 'original.GMP'
            original.write_bytes(b'preserved world')
            with self.assertRaises(ValueError):
                SAVES.changed_save(root, [], owned)
            (owned / 'linked.GMP').symlink_to(original)
            with self.assertRaises(ValueError):
                SAVES.changed_save(owned, [], owned)
            self.assertEqual(original.read_bytes(), b'preserved world')


if __name__ == '__main__':
    unittest.main()
